import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { courseService } from '../services/courseService';
import { questionService, type QuestionInsertInput } from '../services/questionService';
import { subjectiveService } from '../services/subjectiveService';
import { importMCQsFromPDF, importMCQsFromText } from '../services/import';
import type { ParsedMCQCandidate } from '../services/import/types';
import type { CloudCourse, CloudSubject, CloudTopic, CloudQuestion, CloudSubjectivePaper } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  HelpCircle,
  FileText,
  Upload,
  Plus,
  Search,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  FolderArchive,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface QuestionsProps {
  onNavigate?: (page: PageId, params?: any) => void;
}

export const Questions: React.FC<QuestionsProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();

  const [activeTab, setActiveTab] = useState<'mcq' | 'subjective'>('mcq');
  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [subjects, setSubjects] = useState<CloudSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<CloudTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // MCQ Questions List & Pagination
  const [mcqList, setMcqList] = useState<CloudQuestion[]>([]);
  const [totalMcqs, setTotalMcqs] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [isLoadingMcqs, setIsLoadingMcqs] = useState(false);

  // Subjective Papers List
  const [subjectiveList, setSubjectiveList] = useState<CloudSubjectivePaper[]>([]);

  // Modals
  const [isManualMcqModalOpen, setIsManualMcqModalOpen] = useState(false);
  const [isUploadMcqModalOpen, setIsUploadMcqModalOpen] = useState(false);
  const [isUploadSubjectiveModalOpen, setIsUploadSubjectiveModalOpen] = useState(false);

  // Upload Form Selection States (Course -> Subject -> Topic -> File)
  const [uploadCourseId, setUploadCourseId] = useState<string>('');
  const [uploadSubjects, setUploadSubjects] = useState<CloudSubject[]>([]);
  const [uploadSubjectId, setUploadSubjectId] = useState<string>('');
  const [uploadTopics, setUploadTopics] = useState<CloudTopic[]>([]);
  const [uploadTopicId, setUploadTopicId] = useState<string>('');
  const [uploadYear, setUploadYear] = useState<number>(2027);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');

  // Upload Success Alert & Uncertain Review State
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uncertainReviewQuestions, setUncertainReviewQuestions] = useState<ParsedMCQCandidate[]>([]);
  const [isUncertainModalOpen, setIsUncertainModalOpen] = useState(false);

  // MCQ Manual Form
  const [manualText, setManualText] = useState('');
  const [manualA, setManualA] = useState('');
  const [manualB, setManualB] = useState('');
  const [manualC, setManualC] = useState('');
  const [manualD, setManualD] = useState('');
  const [manualCorrect, setManualCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [manualExplanation, setManualExplanation] = useState('');

  // Subjective Upload Form
  const [subTitle, setSubTitle] = useState('');
  const [subYear, setSubYear] = useState<number>(2027);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [subSolutionFile, setSubSolutionFile] = useState<File | null>(null);
  const [isUploadingSub, setIsUploadingSub] = useState(false);

  // Load courses & initial summary
  useEffect(() => {
    async function loadInitialData() {
      const loadedCourses = await courseService.getCourses();
      setCourses(loadedCourses);
      if (loadedCourses.length > 0) {
        if (!selectedCourseId) {
          setSelectedCourseId(loadedCourses[0].id);
        }
        if (!uploadCourseId) {
          setUploadCourseId(loadedCourses[0].id);
        }
      }
    }
    loadInitialData();
  }, [currentUser.id]);

  // Load subjects & topics for selected filter course
  useEffect(() => {
    async function loadHierarchy() {
      if (!selectedCourseId) {
        setSubjects([]);
        setTopics([]);
        return;
      }
      const [subs, tops] = await Promise.all([
        courseService.getSubjects(selectedCourseId),
        courseService.getTopics(selectedCourseId, selectedSubjectId || undefined),
      ]);
      setSubjects(subs);
      setTopics(tops);
    }
    loadHierarchy();
  }, [selectedCourseId, selectedSubjectId]);

  // Load upload subjects when upload course changes
  useEffect(() => {
    async function loadUploadSubs() {
      if (!uploadCourseId) {
        setUploadSubjects([]);
        setUploadSubjectId('');
        return;
      }
      const subs = await courseService.getSubjects(uploadCourseId);
      setUploadSubjects(subs);
      if (subs.length > 0) {
        setUploadSubjectId(subs[0].id);
      } else {
        setUploadSubjectId('');
      }
    }
    loadUploadSubs();
  }, [uploadCourseId]);

  // Load upload topics when upload subject changes
  useEffect(() => {
    async function loadUploadTops() {
      if (!uploadCourseId) {
        setUploadTopics([]);
        setUploadTopicId('');
        return;
      }
      const tops = await courseService.getTopics(uploadCourseId, uploadSubjectId || undefined);
      setUploadTopics(tops);
      setUploadTopicId('');
    }
    loadUploadTops();
  }, [uploadCourseId, uploadSubjectId]);

  // Query MCQ list
  const loadMcqs = async () => {
    if (!selectedCourseId) {
      setMcqList([]);
      setTotalMcqs(0);
      return;
    }
    setIsLoadingMcqs(true);
    try {
      const res = await questionService.getQuestions({
        courseId: selectedCourseId,
        subjectId: selectedSubjectId || undefined,
        topicId: selectedTopicId || undefined,
        year: selectedYear,
        search: searchQuery || undefined,
        page: currentPage,
        pageSize,
      });
      setMcqList(res.questions);
      setTotalMcqs(res.total);
    } catch (err) {
      console.error('Error loading MCQs:', err);
    } finally {
      setIsLoadingMcqs(false);
    }
  };

  // Query Subjective list
  const loadSubjective = async () => {
    if (!selectedCourseId) {
      setSubjectiveList([]);
      return;
    }
    try {
      const list = await subjectiveService.getSubjectivePapers({
        courseId: selectedCourseId,
        subjectId: selectedSubjectId || undefined,
        topicId: selectedTopicId || undefined,
        year: selectedYear,
      });
      setSubjectiveList(list);
    } catch (err) {
      console.error('Error loading subjective papers:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'mcq') {
      loadMcqs();
    } else {
      loadSubjective();
    }
  }, [selectedCourseId, selectedSubjectId, selectedTopicId, selectedYear, searchQuery, currentPage, activeTab]);

  // Toggle reveal answer for single MCQ card
  const toggleReveal = (qId: string) => {
    setRevealedAnswers(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Delete MCQ
  const handleDeleteMcq = async (id: string) => {
    if (!window.confirm('Delete this question permanently?')) return;
    const success = await questionService.deleteQuestion(id);
    if (success) {
      setMcqList(prev => prev.filter(q => q.id !== id));
      setTotalMcqs(prev => Math.max(0, prev - 1));
    }
  };

  // Delete Subjective Paper
  const handleDeleteSubjectivePaper = async (id: string) => {
    if (!window.confirm('Delete this subjective paper?')) return;
    const success = await subjectiveService.deleteSubjectivePaper(id);
    if (success) {
      setSubjectiveList(prev => prev.filter(p => p.id !== id));
    }
  };

  // Handle Save Manual Single MCQ
  const handleSaveManualMcq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !manualText.trim() || !manualA.trim() || !manualB.trim()) return;

    await questionService.createQuestion({
      courseId: selectedCourseId,
      subjectId: selectedSubjectId || null,
      topicId: selectedTopicId || null,
      questionText: manualText.trim(),
      optionA: manualA.trim(),
      optionB: manualB.trim(),
      optionC: manualC.trim() || 'None',
      optionD: manualD.trim() || 'All of the above',
      correctAnswer: manualCorrect,
      explanation: manualExplanation.trim() || null,
      year: selectedYear || 2027,
    });

    setIsManualMcqModalOpen(false);
    setManualText('');
    setManualA('');
    setManualB('');
    setManualC('');
    setManualD('');
    setManualExplanation('');
    loadMcqs();
  };

  // Handle MCQ File Upload (PDF, CSV, JSON, Image)
  const handleMcqFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadCourseId) return;

    setIsProcessingUpload(true);
    setUploadProgressText('Parsing questions and extracting options...');

    try {
      let validCandidates: ParsedMCQCandidate[] = [];
      let uncertainCandidates: ParsedMCQCandidate[] = [];

      // Check file type
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        const parsed = Array.isArray(json) ? json : json.questions || [];
        validCandidates = parsed.map((q: any, i: number) => ({
          tempId: `json-${i}`,
          originalQuestionNumber: i + 1,
          questionText: q.question || q.questionText,
          options: [
            { id: 'A', text: q.optionA || q.options?.[0]?.text || q.options?.A || '' },
            { id: 'B', text: q.optionB || q.options?.[1]?.text || q.options?.B || '' },
            { id: 'C', text: q.optionC || q.options?.[2]?.text || q.options?.C || '' },
            { id: 'D', text: q.optionD || q.options?.[3]?.text || q.options?.D || '' },
          ],
          detectedAnswer: (q.correctAnswer || q.correct_answer || 'A').toUpperCase() as any,
          explanation: q.explanation || '',
          confidence: 'high',
          status: 'valid',
          extractionMethod: 'native',
          issues: [],
          approved: true,
        }));
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const result = importMCQsFromText(text);
        validCandidates = result.questions.filter(q => q.status === 'valid');
        uncertainCandidates = result.questions.filter(q => q.status !== 'valid');
      } else {
        // PDF or image document
        const result = await importMCQsFromPDF(file, {
          onProgress: (stage) => setUploadProgressText(stage),
        });
        validCandidates = result.questions.filter(q => q.status === 'valid');
        uncertainCandidates = result.questions.filter(q => q.status !== 'valid');
      }

      // Convert valid candidates to QuestionInsertInput
      const inputs: QuestionInsertInput[] = validCandidates.map(c => ({
        courseId: uploadCourseId,
        subjectId: uploadSubjectId || null,
        topicId: uploadTopicId || null,
        questionText: c.questionText,
        optionA: c.options.find(o => o.id === 'A')?.text || '',
        optionB: c.options.find(o => o.id === 'B')?.text || '',
        optionC: c.options.find(o => o.id === 'C')?.text || '',
        optionD: c.options.find(o => o.id === 'D')?.text || '',
        correctAnswer: (c.detectedAnswer as any) || 'A',
        explanation: c.explanation || null,
        year: uploadYear || 2027,
        sourceFileId: file.name,
      }));

      // Directly batch save valid questions to Supabase
      let batchResult = { inserted: 0, errors: 0 };
      if (inputs.length > 0) {
        batchResult = await questionService.createQuestionsBatch(inputs);
      }

      setIsUploadMcqModalOpen(false);

      if (uploadCourseId !== selectedCourseId) {
        setSelectedCourseId(uploadCourseId);
      }
      if (uploadSubjectId) {
        setSelectedSubjectId(uploadSubjectId);
      }

      if (batchResult.inserted > 0) {
        setUploadSuccessMessage(
          `✓ ${batchResult.inserted} questions saved to Supabase Question Bank — ready for practice!`
        );
        setTimeout(() => setUploadSuccessMessage(null), 6000);
      } else if (validCandidates.length > 0 && batchResult.errors > 0) {
        alert('Could not save questions to Supabase. Please ensure your database table permissions are open.');
      }

      if (uncertainCandidates.length > 0) {
        setUncertainReviewQuestions(uncertainCandidates);
        setIsUncertainModalOpen(true);
      } else if (validCandidates.length === 0) {
        alert('No valid MCQs could be detected in this document. Please check the file format.');
      }

      await loadMcqs();
    } catch (err: any) {
      console.error('Error importing MCQs:', err);
      alert(`Failed to parse file: ${err.message || 'Error processing document'}`);
    } finally {
      setIsProcessingUpload(false);
      setUploadProgressText('');
    }
  };

  // Save reviewed uncertain questions
  const handleSaveUncertainQuestions = async () => {
    const inputs: QuestionInsertInput[] = uncertainReviewQuestions.map(c => ({
      courseId: uploadCourseId,
      subjectId: uploadSubjectId || null,
      topicId: uploadTopicId || null,
      questionText: c.questionText,
      optionA: c.options.find(o => o.id === 'A')?.text || '',
      optionB: c.options.find(o => o.id === 'B')?.text || '',
      optionC: c.options.find(o => o.id === 'C')?.text || '',
      optionD: c.options.find(o => o.id === 'D')?.text || '',
      correctAnswer: (c.detectedAnswer as any) || 'A',
      explanation: c.explanation || null,
      year: uploadYear || 2027,
    }));

    if (inputs.length > 0) {
      await questionService.createQuestionsBatch(inputs);
    }
    setIsUncertainModalOpen(false);
    setUncertainReviewQuestions([]);
    loadMcqs();
  };

  // Handle Save Subjective Paper
  const handleUploadSubjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCourseId || !subTitle.trim() || !subFile) return;

    setIsUploadingSub(true);
    try {
      await subjectiveService.uploadSubjectivePaper({
        courseId: uploadCourseId,
        subjectId: uploadSubjectId || null,
        topicId: uploadTopicId || null,
        paperTitle: subTitle.trim(),
        year: subYear,
        file: subFile,
        solutionFile: subSolutionFile,
      });

      setIsUploadSubjectiveModalOpen(false);
      setSubTitle('');
      setSubFile(null);
      setSubSolutionFile(null);
      loadSubjective();
    } catch (err) {
      console.error('Error uploading subjective paper:', err);
      alert('Error uploading paper to cloud.');
    } finally {
      setIsUploadingSub(false);
    }
  };

  // View Subjective Paper URL
  const handleViewSubjectivePaper = async (paper: CloudSubjectivePaper) => {
    const url = await subjectiveService.getSecureViewUrl(paper.file_path);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('Unable to open paper file.');
    }
  };

  const totalPages = Math.ceil(totalMcqs / pageSize) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#101828] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#5b5bd6]" />
            <span>Question Bank</span>
          </h1>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
            Manage Multiple Choice Questions and Subjective/Long Question papers by Course and Subject.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'mcq' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="bg-white dark:bg-[#181d2f] text-xs font-bold border-[#e2e8f0] dark:border-[#2b334d] text-[#5b5bd6]"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsManualMcqModalOpen(true)}
                disabled={!selectedCourseId}
              >
                + Add Single MCQ
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold text-xs shadow-xs"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => {
                  setUploadCourseId(selectedCourseId);
                  setUploadSubjectId(selectedSubjectId);
                  setIsUploadMcqModalOpen(true);
                }}
                disabled={!selectedCourseId}
              >
                Upload Questions
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs"
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => {
                setUploadCourseId(selectedCourseId);
                setUploadSubjectId(selectedSubjectId);
                setIsUploadSubjectiveModalOpen(true);
              }}
              disabled={!selectedCourseId}
            >
              Upload Subjective Paper
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {uploadSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{uploadSuccessMessage}</span>
          </div>
          {onNavigate && (
            <Button
              variant="outline"
              size="sm"
              className="bg-white dark:bg-[#141824] text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold text-xs"
              onClick={() => onNavigate('practice')}
            >
              Start Practice →
            </Button>
          )}
        </div>
      )}

      {/* Main Tabs: MCQ QUESTIONS vs SUBJECTIVE PAPERS */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] dark:border-[#23293d] pb-2">
        <button
          onClick={() => { setActiveTab('mcq'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'mcq'
              ? 'bg-[#5b5bd6] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#101828] dark:hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>MCQ Questions ({totalMcqs})</span>
        </button>

        <button
          onClick={() => { setActiveTab('subjective'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'subjective'
              ? 'bg-[#0284c7] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#101828] dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Subjective Question Papers ({subjectiveList.length})</span>
        </button>
      </div>

      {/* Cascading Filters Bar */}
      <Card className="p-4 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Course */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Course</label>
            <select
              value={selectedCourseId}
              onChange={e => {
                setSelectedCourseId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Subject */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={e => {
                setSelectedSubjectId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
              ))}
            </select>
          </div>

          {/* 3. Topic */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Topic</label>
            <select
              value={selectedTopicId}
              onChange={e => {
                setSelectedTopicId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
            >
              <option value="">All Topics</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* 4. Search */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Search Questions</label>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Keywords..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ================= TAB 1: MCQ QUESTIONS LIST ================= */}
      {activeTab === 'mcq' && (
        <div className="space-y-4">
          {isLoadingMcqs ? (
            <Card className="p-12 text-center text-xs text-[#64748b]">
              <p className="animate-pulse font-bold">Loading questions...</p>
            </Card>
          ) : mcqList.length > 0 ? (
            <div className="space-y-3">
              {mcqList.map((q, idx) => {
                const isRevealed = revealedAnswers[q.id];
                const qNum = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <Card
                    key={q.id}
                    className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-3.5 hover:border-[#5b5bd6]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-xl bg-[#5b5bd6]/10 text-[#5b5bd6] dark:text-[#8282ea] font-extrabold text-xs flex items-center justify-center shrink-0">
                          {qNum}
                        </span>
                        <h3 className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc] leading-relaxed">
                          {q.question_text}
                        </h3>
                      </div>

                      <button
                        onClick={() => handleDeleteMcq(q.id)}
                        className="p-1 text-[#94a3b8] hover:text-rose-600 transition-colors shrink-0"
                        title="Delete MCQ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Options Grid (A, B, C, D) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {[
                        { id: 'A', text: q.option_a },
                        { id: 'B', text: q.option_b },
                        { id: 'C', text: q.option_c },
                        { id: 'D', text: q.option_d },
                      ].map(opt => {
                        const isCorrectOption = opt.id === q.correct_answer;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                              isRevealed && isCorrectOption
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold'
                                : 'bg-[#f8fafc] dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#334155] dark:text-[#cbd5e1]'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-lg bg-white dark:bg-[#141824] border border-[#d0d5dd] dark:border-[#2b334d] text-[11px] font-bold flex items-center justify-center shrink-0">
                              {opt.id}
                            </span>
                            <span>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reveal Answer Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#e2e8f0] dark:border-[#23293d] text-xs">
                      <button
                        onClick={() => toggleReveal(q.id)}
                        className="font-bold text-[#5b5bd6] dark:text-[#8282ea] hover:underline flex items-center gap-1.5"
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isRevealed ? 'Hide Correct Answer' : 'Show Answer'}</span>
                      </button>

                      {isRevealed && (
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          Correct Answer: Option {q.correct_answer}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 bg-white dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] rounded-2xl text-xs">
                  <span className="text-[#64748b]">Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card className="p-12 text-center text-xs text-[#64748b] space-y-3">
              <HelpCircle className="w-8 h-8 mx-auto text-[#94a3b8] opacity-50" />
              <p className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">No questions found</p>
              <p>Upload a PDF, CSV, or JSON question bank to practice.</p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#5b5bd6] text-white font-bold"
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => setIsUploadMcqModalOpen(true)}
                  disabled={!selectedCourseId}
                >
                  Upload Questions
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================= TAB 2: SUBJECTIVE PAPERS ================= */}
      {activeTab === 'subjective' && (
        <div className="space-y-4">
          {subjectiveList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectiveList.map(paper => (
                <Card
                  key={paper.id}
                  className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0284c7]/10 text-[#0284c7]">
                        {paper.year} Paper
                      </span>
                      <button
                        onClick={() => handleDeleteSubjectivePaper(paper.id)}
                        className="p-1 text-[#94a3b8] hover:text-rose-600 transition-colors"
                        title="Delete Paper"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">
                      {paper.paper_title}
                    </h3>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-bold bg-[#f8fafc] dark:bg-[#181d2f] text-[#0284c7] border-[#e2e8f0] dark:border-[#2b334d]"
                    leftIcon={<FileText className="w-3.5 h-3.5" />}
                    onClick={() => handleViewSubjectivePaper(paper)}
                  >
                    Open Question Paper
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center text-xs text-[#64748b] space-y-3">
              <FileText className="w-8 h-8 mx-auto text-[#94a3b8] opacity-50" />
              <p className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">No subjective papers uploaded yet</p>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#0284c7] text-white font-bold"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => setIsUploadSubjectiveModalOpen(true)}
                disabled={!selectedCourseId}
              >
                Upload Subjective Paper
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ================= MODAL: UPLOAD MCQ FILE ================= */}
      <Modal
        isOpen={isUploadMcqModalOpen}
        onClose={() => setIsUploadMcqModalOpen(false)}
        title="Upload MCQ Question Bank"
        size="md"
      >
        <div className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
            Select target Course and Subject first, then upload your PDF, CSV, or JSON file. Valid MCQs are saved directly for practice.
          </p>

          {/* 1. Course Selection (Required) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Course *</label>
            <select
              value={uploadCourseId}
              onChange={e => setUploadCourseId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Subject Selection (Required) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Subject belonging to this Course *</label>
            <select
              value={uploadSubjectId}
              onChange={e => setUploadSubjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
            >
              <option value="">General / All Subjects</option>
              {uploadSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
              ))}
            </select>
          </div>

          {/* 3. Topic & Year (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Topic (Optional)</label>
              <select
                value={uploadTopicId}
                onChange={e => setUploadTopicId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
              >
                <option value="">Select Topic</option>
                {uploadTopics.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Exam Year (Optional)</label>
              <input
                type="number"
                value={uploadYear}
                onChange={e => setUploadYear(parseInt(e.target.value) || 2027)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none"
              />
            </div>
          </div>

          {/* 4. File Drop Area */}
          <div className="border-2 border-dashed border-[#d0d5dd] dark:border-[#2b334d] rounded-2xl p-6 text-center space-y-2">
            <Upload className="w-8 h-8 text-[#5b5bd6] mx-auto" />
            <p className="text-xs font-bold">Select MCQ File (.pdf, .csv, .json)</p>
            <input
              type="file"
              accept=".pdf,.csv,.json,.txt"
              onChange={handleMcqFileUpload}
              disabled={isProcessingUpload || !uploadCourseId}
              className="block w-full text-xs text-[#64748b] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#5b5bd6]/10 file:text-[#5b5bd6] cursor-pointer disabled:opacity-50"
            />
          </div>

          {isProcessingUpload && (
            <div className="p-3 bg-[#5b5bd6]/10 text-[#5b5bd6] rounded-xl text-xs font-bold text-center animate-pulse">
              {uploadProgressText || 'Extracting questions and batch saving...'}
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL: UNCERTAIN QUESTIONS REVIEW ================= */}
      <Modal
        isOpen={isUncertainModalOpen}
        onClose={() => setIsUncertainModalOpen(false)}
        title={`Review Incomplete Questions (${uncertainReviewQuestions.length})`}
        size="lg"
      >
        <div className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
            Valid questions have already been stored directly. These {uncertainReviewQuestions.length} questions had uncertain options or missing answer keys.
          </p>

          <div className="max-h-80 overflow-y-auto space-y-3 p-1">
            {uncertainReviewQuestions.map((q, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-500/5 text-xs space-y-2">
                <p className="font-bold">{idx + 1}. {q.questionText}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {q.options.map(o => (
                    <div key={o.id}><strong>{o.id}:</strong> {o.text || '---'}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsUncertainModalOpen(false)}>
              Discard Incomplete
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveUncertainQuestions} className="bg-[#5b5bd6] text-white font-bold">
              Save All
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: ADD MANUAL MCQ ================= */}
      <Modal
        isOpen={isManualMcqModalOpen}
        onClose={() => setIsManualMcqModalOpen(false)}
        title="Add Single MCQ"
        size="md"
      >
        <form onSubmit={handleSaveManualMcq} className="space-y-3.5 text-[#101828] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Question Text *</label>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Type the question..."
              required
              className="w-full h-16 px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none resize-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <input
              type="text"
              placeholder="Option A *"
              value={manualA}
              onChange={e => setManualA(e.target.value)}
              required
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
            />
            <input
              type="text"
              placeholder="Option B *"
              value={manualB}
              onChange={e => setManualB(e.target.value)}
              required
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
            />
            <input
              type="text"
              placeholder="Option C"
              value={manualC}
              onChange={e => setManualC(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
            />
            <input
              type="text"
              placeholder="Option D"
              value={manualD}
              onChange={e => setManualD(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Correct Option</label>
              <select
                value={manualCorrect}
                onChange={e => setManualCorrect(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] font-bold outline-none"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Explanation (Optional)</label>
              <input
                type="text"
                placeholder="Reason or formula..."
                value={manualExplanation}
                onChange={e => setManualExplanation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsManualMcqModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" className="bg-[#5b5bd6] text-white font-bold">Save MCQ</Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: UPLOAD SUBJECTIVE PAPER ================= */}
      <Modal
        isOpen={isUploadSubjectiveModalOpen}
        onClose={() => setIsUploadSubjectiveModalOpen(false)}
        title="Upload Subjective / Long Question Paper"
        size="md"
      >
        <form onSubmit={handleUploadSubjective} className="space-y-3.5 text-[#101828] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Paper Title *</label>
            <input
              type="text"
              value={subTitle}
              onChange={e => setSubTitle(e.target.value)}
              placeholder="e.g. 2027 RBB Level 5 Banking Subjective Question"
              required
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Exam Year</label>
            <input
              type="number"
              value={subYear}
              onChange={e => setSubYear(parseInt(e.target.value) || 2027)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Question Document File *</label>
            <input
              type="file"
              required
              onChange={e => setSubFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-[#64748b] file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#0284c7]/10 file:text-[#0284c7] cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Solution Document (Optional)</label>
            <input
              type="file"
              onChange={e => setSubSolutionFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-[#64748b] file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#64748b]/10 file:text-[#64748b] cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsUploadSubjectiveModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={isUploadingSub} className="bg-[#0284c7] text-white font-bold">
              {isUploadingSub ? 'Uploading...' : 'Save Paper'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
