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
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FolderArchive,
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

  // Course Question Counts Summary
  const [courseMcqCounts, setCourseMcqCounts] = useState<Record<string, number>>({});
  const [courseSubCounts, setCourseSubCounts] = useState<Record<string, number>>({});

  // MCQ Questions List & Pagination
  const [mcqList, setMcqList] = useState<CloudQuestion[]>([]);
  const [totalMcqs, setTotalMcqs] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  // Subjective Papers List
  const [subjectiveList, setSubjectiveList] = useState<CloudSubjectivePaper[]>([]);

  // Modals
  const [isManualMcqModalOpen, setIsManualMcqModalOpen] = useState(false);
  const [isUploadMcqModalOpen, setIsUploadMcqModalOpen] = useState(false);
  const [isUploadSubjectiveModalOpen, setIsUploadSubjectiveModalOpen] = useState(false);

  // Large Upload Success / Partial Review Summary State
  const [uploadSummary, setUploadSummary] = useState<{
    totalDetected: number;
    savedCount: number;
    uncertainCount: number;
    uncertainQuestions: ParsedMCQCandidate[];
    courseName: string;
    year: number;
  } | null>(null);

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

      const mcqCounts = await questionService.getQuestionCountsByCourse();
      setCourseMcqCounts(mcqCounts);

      // Subjective counts
      const allSubjective = await subjectiveService.getSubjectivePapers();
      const subCounts: Record<string, number> = {};
      allSubjective.forEach(p => {
        subCounts[p.course_id] = (subCounts[p.course_id] || 0) + 1;
      });
      setCourseSubCounts(subCounts);
    }
    loadInitialData();
  }, [currentUser.id]);

  // Load subjects & topics for selected course
  useEffect(() => {
    async function loadHierarchy() {
      if (!selectedCourseId) {
        setSubjects([]);
        setTopics([]);
        return;
      }
      const [subs, tops] = await Promise.all([
        courseService.getSubjects(selectedCourseId),
        courseService.getTopics(selectedCourseId),
      ]);
      setSubjects(subs);
      setTopics(tops.filter(t => !t.parent_topic_id));
    }
    loadHierarchy();
  }, [selectedCourseId]);

  // Query MCQ list
  const loadMcqs = async () => {
    if (!selectedCourseId) {
      setMcqList([]);
      setTotalMcqs(0);
      return;
    }
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
  };

  // Query Subjective list
  const loadSubjective = async () => {
    if (!selectedCourseId) {
      setSubjectiveList([]);
      return;
    }
    const list = await subjectiveService.getSubjectivePapers({
      courseId: selectedCourseId,
      subjectId: selectedSubjectId || undefined,
      topicId: selectedTopicId || undefined,
      year: selectedYear,
    });
    setSubjectiveList(list);
  };

  useEffect(() => {
    if (activeTab === 'mcq') {
      loadMcqs();
    } else {
      loadSubjective();
    }
  }, [activeTab, selectedCourseId, selectedSubjectId, selectedTopicId, selectedYear, searchQuery, currentPage]);

  const toggleAnswerReveal = (questionId: string) => {
    setRevealedAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Handle Save Manual MCQ
  const handleSaveManualMcq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !manualText.trim()) return;

    await questionService.createQuestion({
      courseId: selectedCourseId,
      subjectId: selectedSubjectId || null,
      topicId: selectedTopicId || null,
      questionText: manualText.trim(),
      optionA: manualA.trim(),
      optionB: manualB.trim(),
      optionC: manualC.trim(),
      optionD: manualD.trim(),
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

  // Handle Large / Bulk MCQ Upload via PDF or text
  const handleMcqFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCourseId) return;

    try {
      const result = await importMCQsFromPDF(file);
      const validCandidates = result.questions.filter(q => q.status === 'valid');
      const uncertainCandidates = result.questions.filter(q => q.status !== 'valid');

      // Convert valid candidates to QuestionInsertInput
      const inputs: QuestionInsertInput[] = validCandidates.map(c => ({
        courseId: selectedCourseId,
        subjectId: selectedSubjectId || null,
        topicId: selectedTopicId || null,
        questionText: c.questionText,
        optionA: c.options.find(o => o.id === 'A')?.text || '',
        optionB: c.options.find(o => o.id === 'B')?.text || '',
        optionC: c.options.find(o => o.id === 'C')?.text || '',
        optionD: c.options.find(o => o.id === 'D')?.text || '',
        correctAnswer: c.detectedAnswer || 'UNKNOWN',
        explanation: c.explanation || null,
        year: selectedYear || 2027,
        sourceFileId: file.name,
      }));

      // Batch insert valid questions into Supabase
      const insertRes = await questionService.createQuestionsBatch(inputs);

      const courseName = courses.find(c => c.id === selectedCourseId)?.name || 'Course';

      // Set summary dialog (Never flood screen with 200 cards)
      setUploadSummary({
        totalDetected: result.questions.length,
        savedCount: insertRes.inserted,
        uncertainCount: uncertainCandidates.length,
        uncertainQuestions: uncertainCandidates,
        courseName,
        year: selectedYear || 2027,
      });

      setIsUploadMcqModalOpen(false);
      loadMcqs();
    } catch (err) {
      console.error('Error importing MCQs:', err);
      alert('Failed to parse MCQ file.');
    }
  };

  // Handle Save Subjective Paper
  const handleUploadSubjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !subTitle.trim() || !subFile) return;

    setIsUploadingSub(true);
    try {
      await subjectiveService.uploadSubjectivePaper({
        courseId: selectedCourseId,
        subjectId: selectedSubjectId || null,
        topicId: selectedTopicId || null,
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

  // Secure View Paper in New Tab
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#5b5bd6]" />
            <span>Question Bank</span>
          </h1>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
            Cloud archives for Multiple Choice Questions and Subjective/Long Question papers.
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
                className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold text-xs"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => setIsUploadMcqModalOpen(true)}
                disabled={!selectedCourseId}
              >
                Upload MCQ PDF
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs"
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => setIsUploadSubjectiveModalOpen(true)}
              disabled={!selectedCourseId}
            >
              Upload Subjective Paper
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs: MCQ QUESTIONS vs SUBJECTIVE PAPERS */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] dark:border-[#23293d] pb-2">
        <button
          onClick={() => { setActiveTab('mcq'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'mcq'
              ? 'bg-[#5b5bd6] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>MCQ Questions</span>
        </button>

        <button
          onClick={() => { setActiveTab('subjective'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'subjective'
              ? 'bg-[#0284c7] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Subjective / Long Questions</span>
        </button>
      </div>

      {/* Course Collection Summary Cards (Requirement 32) */}
      {!selectedCourseId ? (
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
            Select Course Collection
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(c => {
              const mcqCount = courseMcqCounts[c.id] || 0;
              const subCount = courseSubCounts[c.id] || 0;
              return (
                <Card
                  key={c.id}
                  className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4 hover:border-[#5b5bd6]/50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-[#172033] dark:text-[#f8f9fc]">{c.name}</h3>
                      {c.year && (
                        <span className="text-[11px] font-bold text-[#5b5bd6]">Exam Year {c.year}</span>
                      )}
                    </div>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color || '#5b5bd6' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                      <span className="text-[10px] font-bold text-[#64748b] uppercase">MCQs</span>
                      <p className="text-base font-extrabold text-[#5b5bd6]">{mcqCount}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                      <span className="text-[10px] font-bold text-[#64748b] uppercase">Subjective</span>
                      <p className="text-base font-extrabold text-[#0284c7]">{subCount} Files</p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full font-bold bg-[#5b5bd6] text-white"
                    onClick={() => setSelectedCourseId(c.id)}
                  >
                    Open Collection
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* Active Collection Opened View with Filters (Requirement 33) */
        <div className="space-y-5">
          {/* Active Filter Bar */}
          <Card className="p-4 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedCourseId('')}
                  className="text-xs font-bold text-[#5b5bd6] hover:underline flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>All Collections</span>
                </button>
                <span className="text-[#cbd5e1]">|</span>
                <span className="text-xs font-bold text-[#172033] dark:text-white">
                  {courses.find(c => c.id === selectedCourseId)?.name}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search questions or keywords..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
                />
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-semibold outline-none"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-semibold outline-none"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={selectedTopicId}
                onChange={e => setSelectedTopicId(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-semibold outline-none"
              >
                <option value="">All Topics</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.code ? `${t.code}. ` : ''}{t.name}</option>
                ))}
              </select>

              <select
                value={selectedYear || ''}
                onChange={e => setSelectedYear(e.target.value ? parseInt(e.target.value) : undefined)}
                className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-semibold outline-none"
              >
                <option value="">All Years</option>
                <option value="2027">2027</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </Card>

          {/* TAB 1: MCQ QUESTIONS LIST (Paginated, Hidden answers until click) */}
          {activeTab === 'mcq' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-[#64748b]">
                <span>Showing {mcqList.length} of {totalMcqs} MCQs</span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('practice', { courseId: selectedCourseId })}
                    className="text-[#5b5bd6] hover:underline"
                  >
                    Go to Practice →
                  </button>
                )}
              </div>

              {mcqList.length > 0 ? (
                <div className="space-y-3">
                  {mcqList.map((q, idx) => {
                    const isRevealed = revealedAnswers[q.id];
                    return (
                      <Card
                        key={q.id}
                        className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-bold text-xs sm:text-sm text-[#172033] dark:text-[#f8f9fc] leading-snug">
                            <span className="text-[#5b5bd6] font-mono mr-1">
                              {(currentPage - 1) * pageSize + idx + 1}.
                            </span>
                            {q.question_text}
                          </h4>

                          <button
                            onClick={() => toggleAnswerReveal(q.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#5b5bd6] hover:bg-[#eef2f6]"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isRevealed ? 'Hide Answer' : 'View Answer'}</span>
                          </button>
                        </div>

                        {/* Options A, B, C, D */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className={`p-2 rounded-xl border ${isRevealed && q.correct_answer === 'A' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#334155] dark:text-[#cbd5e1]'}`}>
                            <span className="font-bold text-[#5b5bd6] mr-1.5">A.</span> {q.option_a}
                          </div>
                          <div className={`p-2 rounded-xl border ${isRevealed && q.correct_answer === 'B' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#334155] dark:text-[#cbd5e1]'}`}>
                            <span className="font-bold text-[#5b5bd6] mr-1.5">B.</span> {q.option_b}
                          </div>
                          <div className={`p-2 rounded-xl border ${isRevealed && q.correct_answer === 'C' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#334155] dark:text-[#cbd5e1]'}`}>
                            <span className="font-bold text-[#5b5bd6] mr-1.5">C.</span> {q.option_c}
                          </div>
                          <div className={`p-2 rounded-xl border ${isRevealed && q.correct_answer === 'D' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#334155] dark:text-[#cbd5e1]'}`}>
                            <span className="font-bold text-[#5b5bd6] mr-1.5">D.</span> {q.option_d}
                          </div>
                        </div>

                        {/* Revealed Explanation */}
                        {isRevealed && (
                          <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-xs space-y-1 animate-fade-in">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Correct Answer: Option {q.correct_answer || 'UNKNOWN'}
                            </span>
                            {q.explanation && (
                              <p className="text-[#64748b] dark:text-[#9496a8]">{q.explanation}</p>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-bold text-[#64748b] px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="p-8 text-center text-xs text-[#64748b]">
                  <p>No MCQ questions found in this collection.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3 bg-[#5b5bd6] text-white font-bold"
                    onClick={() => setIsUploadMcqModalOpen(true)}
                  >
                    Upload MCQ PDF
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: SUBJECTIVE / LONG QUESTIONS ARCHIVE (Requirement 38, 39) */}
          {activeTab === 'subjective' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-[#64748b]">
                <span>{subjectiveList.length} Subjective Papers Archived</span>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setIsUploadSubjectiveModalOpen(true)}
                >
                  + Upload Paper
                </Button>
              </div>

              {subjectiveList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjectiveList.map(paper => (
                    <Card
                      key={paper.id}
                      className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="brand" size="sm">Year {paper.year || 2027}</Badge>
                          <FileText className="w-4 h-4 text-[#0284c7]" />
                        </div>
                        <h4 className="font-bold text-sm text-[#172033] dark:text-[#f8f9fc] line-clamp-2">
                          {paper.paper_title}
                        </h4>
                        <p className="text-[11px] text-[#64748b] truncate">{paper.file_name}</p>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full font-bold bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs"
                        leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                        onClick={() => handleViewSubjectivePaper(paper)}
                      >
                        View Paper Securely
                      </Button>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-xs text-[#64748b]">
                  <p>No subjective or long question papers archived for this course yet.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3 bg-[#0284c7] text-white font-bold"
                    onClick={() => setIsUploadSubjectiveModalOpen(true)}
                  >
                    Upload First Subjective Paper
                  </Button>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: LARGE UPLOAD SUMMARY (Requirement 35, 36) ================= */}
      {uploadSummary && (
        <Modal
          isOpen={true}
          onClose={() => setUploadSummary(null)}
          title="Upload Summary"
          size="md"
        >
          <div className="space-y-5 text-center text-[#172033] dark:text-[#f8f9fc]">
            <div className="w-14 h-14 rounded-full bg-[#f4fbf7] dark:bg-[#122820] text-emerald-600 border border-emerald-500/30 flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#172033] dark:text-white">
                {uploadSummary.savedCount} MCQs Added Successfully
              </h3>
              <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                Course: {uploadSummary.courseName} · Year: {uploadSummary.year}
              </p>
            </div>

            {uploadSummary.uncertainCount > 0 && (
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                ⚠ {uploadSummary.uncertainCount} questions need review due to missing options or answers.
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadSummary(null)}
              >
                Close
              </Button>
              {onNavigate && (
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#5b5bd6] text-white font-bold"
                  onClick={() => {
                    setUploadSummary(null);
                    onNavigate('practice', { courseId: selectedCourseId });
                  }}
                >
                  Go to Practice →
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: UPLOAD MCQ PDF ================= */}
      <Modal
        isOpen={isUploadMcqModalOpen}
        onClose={() => setIsUploadMcqModalOpen(false)}
        title="Upload MCQ PDF"
        size="md"
      >
        <div className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
          <p className="text-xs text-[#64748b]">
            Upload a past question paper or practice PDF. The parser will extract all questions, map options A/B/C/D, and save valid questions directly into the database.
          </p>

          <div className="border-2 border-dashed border-[#cbd5e1] dark:border-[#2b334d] rounded-2xl p-6 text-center space-y-2">
            <Upload className="w-8 h-8 text-[#5b5bd6] mx-auto animate-bounce" />
            <p className="text-xs font-bold">Select Question PDF</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleMcqFileUpload}
              className="block w-full text-xs text-[#64748b] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#5b5bd6]/10 file:text-[#5b5bd6] cursor-pointer"
            />
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
        <form onSubmit={handleSaveManualMcq} className="space-y-3.5 text-[#172033] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold">Question Text *</label>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Type the question..."
              required
              className="w-full h-16 px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <input
              type="text"
              placeholder="Option A *"
              value={manualA}
              onChange={e => setManualA(e.target.value)}
              required
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
            />
            <input
              type="text"
              placeholder="Option B *"
              value={manualB}
              onChange={e => setManualB(e.target.value)}
              required
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
            />
            <input
              type="text"
              placeholder="Option C *"
              value={manualC}
              onChange={e => setManualC(e.target.value)}
              required
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
            />
            <input
              type="text"
              placeholder="Option D *"
              value={manualD}
              onChange={e => setManualD(e.target.value)}
              required
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold">Correct Option</label>
            <select
              value={manualCorrect}
              onChange={e => setManualCorrect(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-bold outline-none"
            >
              <option value="A">Option A</option>
              <option value="B">Option B</option>
              <option value="C">Option C</option>
              <option value="D">Option D</option>
            </select>
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
        <form onSubmit={handleUploadSubjective} className="space-y-3.5 text-[#172033] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold">Paper Title *</label>
            <input
              type="text"
              value={subTitle}
              onChange={e => setSubTitle(e.target.value)}
              placeholder="e.g. 2027 RBB Level 5 Banking Subjective Question"
              required
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold">Exam / Paper Year</label>
            <input
              type="number"
              value={subYear}
              onChange={e => setSubYear(parseInt(e.target.value) || 2027)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold">Question Document File (PDF/Image) *</label>
            <input
              type="file"
              required
              onChange={e => setSubFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-[#64748b] file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#0284c7]/10 file:text-[#0284c7] cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold">Solution Document (Optional)</label>
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
