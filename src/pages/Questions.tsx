import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  HelpCircle,
  Plus,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Share2,
  Sparkles,
  Eye,
  Check,
} from 'lucide-react';
import { parseMCQText, parseJSONQuestions, parseCSVQuestions } from '../services/mcqParser';
import { extractTextFromPDF, extractTextFromImageWithOCR } from '../services/ocrService';
import type { Question, ExtractedQuestion, Difficulty } from '../types';

export const Questions: React.FC = () => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  // Modal States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [viewSourceId, setViewSourceId] = useState<string | null>(null);

  // Manual Question Form
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [isShared, setIsShared] = useState(true);

  // Ingestion / Review state
  const [extractedReviewList, setExtractedReviewList] = useState<ExtractedQuestion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [rawPastedText, setRawPastedText] = useState('');

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  // Filtered Questions Query
  const questions = useLiveQuery(
    async () => {
      let q = db.questions.where('userId').equals(currentUser.id);
      if (selectedTargetId) {
        q = db.questions.where('targetId').equals(selectedTargetId);
      }
      let list = await q.toArray();
      if (selectedSubjectId) {
        list = list.filter(item => item.subjectId === selectedSubjectId);
      }
      if (difficultyFilter !== 'all') {
        list = list.filter(item => item.difficulty === difficultyFilter);
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        list = list.filter(item =>
          item.questionText.toLowerCase().includes(query) ||
          item.options.some(o => o.text.toLowerCase().includes(query))
        );
      }
      return list;
    },
    [currentUser.id, selectedTargetId, selectedSubjectId, difficultyFilter, searchQuery]
  ) || [];

  // Handle Save Manual Question
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIdToUse = selectedTargetId || (targets.length > 0 ? targets[0].id : '');
    if (!questionText.trim() || !targetIdToUse) return;

    const id = `q-${Date.now()}`;
    await db.questions.put({
      id,
      userId: currentUser.id,
      targetId: targetIdToUse,
      subjectId: selectedSubjectId || undefined,
      questionText: questionText.trim(),
      options: [
        { id: 'A', text: optionA.trim() },
        { id: 'B', text: optionB.trim() },
        { id: 'C', text: optionC.trim() },
        { id: 'D', text: optionD.trim() },
      ],
      correctOptionId: correctOption,
      explanation: explanation.trim(),
      source: 'Manual Entry',
      difficulty,
      isShared,
      isBookmarked: false,
      isDifficult: false,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        totalAttempts: 0,
        correctAttempts: 0,
        wrongAttempts: 0,
        consecutiveCorrect: 0,
        easeFactor: 2.5,
        intervalDays: 1,
      },
    });

    // Reset Form
    setQuestionText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setExplanation('');
    setIsManualModalOpen(false);
  };

  // Handle Text / PDF extraction
  const handleExtractText = () => {
    const targetId = selectedTargetId || (targets.length > 0 ? targets[0].id : '');
    if (!rawPastedText.trim() || !targetId) {
      alert('Please select a target and provide MCQ text.');
      return;
    }
    const parsed = parseMCQText(rawPastedText, {
      defaultTargetId: targetId,
      defaultSubjectId: selectedSubjectId || undefined,
    });
    if (parsed.length > 0) {
      setExtractedReviewList(parsed);
      setIsUploadModalOpen(false);
      setIsReviewModalOpen(true);
    } else {
      alert('No MCQs could be identified. Make sure each question has numbered statements (1., 2.) and options (A., B., C., D.).');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = selectedTargetId || (targets.length > 0 ? targets[0].id : '');
    if (!file) return;
    if (!targetId) {
      alert('Please create or select a study target first.');
      return;
    }

    setIsExtracting(true);
    try {
      let rawText = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfRes = await extractTextFromPDF(file);
        rawText = pdfRes.text;
      } else if (file.type.startsWith('image/')) {
        rawText = await extractTextFromImageWithOCR(file);
      } else {
        rawText = await file.text();
      }

      setRawPastedText(rawText);

      let parsed: ExtractedQuestion[] = [];
      if (file.name.endsWith('.json')) {
        parsed = parseJSONQuestions(rawText);
      } else if (file.name.endsWith('.csv')) {
        parsed = parseCSVQuestions(rawText);
      } else {
        parsed = parseMCQText(rawText, {
          defaultTargetId: targetId,
          defaultSubjectId: selectedSubjectId || undefined,
          sourceName: file.name,
        });
      }

      if (parsed.length > 0) {
        setExtractedReviewList(parsed);
        setIsUploadModalOpen(false);
        setIsReviewModalOpen(true);
      } else {
        alert('Text extracted from document, but questions need formatting. We loaded the text into the box below for you to review and extract.');
      }
    } catch (err: any) {
      console.error('File extraction error:', err);
      alert('Could not read PDF directly. Please open the PDF, select and copy the text (Ctrl+A, Ctrl+C), and paste it directly into the text box below.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Bulk Save Approved Questions to Dexie Question Bank
  const handleSaveApprovedToBank = async () => {
    const approved = extractedReviewList.filter(q => q.approved && q.questionText.trim());
    if (approved.length === 0) {
      alert('No approved questions to save. Please review and approve at least one question.');
      return;
    }

    const targetIdToUse = selectedTargetId || (targets.length > 0 ? targets[0].id : '');

    const questionsToInsert: Question[] = approved.map((q, idx) => {
      const cleanQuestionText = q.questionText
        .replace(/(?:Answer|Ans|Correct(?:\s+Answer)?)[\s\:\.\-\=]+[A-D].*$/i, '')
        .replace(/(?:Explanation|Solution|Sol)[\s\:\.\-\=]+.*$/i, '')
        .trim();

      const options = q.options.length >= 2 ? q.options : [
        { id: 'A', text: q.options[0]?.text || 'Option A' },
        { id: 'B', text: q.options[1]?.text || 'Option B' },
        { id: 'C', text: q.options[2]?.text || 'Option C' },
        { id: 'D', text: q.options[3]?.text || 'Option D' },
      ];

      return {
        id: `q-imported-${Date.now()}-${idx}`,
        userId: currentUser.id,
        targetId: q.targetId || targetIdToUse,
        subjectId: q.subjectId || selectedSubjectId || undefined,
        topicId: q.topicId || undefined,
        questionText: cleanQuestionText,
        options,
        correctOptionId: q.detectedAnswer || 'A',
        explanation: q.explanation ? q.explanation.trim() : '',
        source: q.source || 'Uploaded PDF Bank',
        difficulty: q.difficulty || 'medium',
        isShared: true,
        isBookmarked: false,
        isDifficult: false,
        tags: q.tags || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stats: {
          totalAttempts: 0,
          correctAttempts: 0,
          wrongAttempts: 0,
          consecutiveCorrect: 0,
          easeFactor: 2.5,
          intervalDays: 1,
        },
      };
    });

    await db.questions.bulkPut(questionsToInsert);
    setIsReviewModalOpen(false);
    setExtractedReviewList([]);
    setRawPastedText('');
    alert(`Successfully saved ${questionsToInsert.length} questions to your Question Bank!`);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Delete this question from your Question Bank?')) {
      await db.questions.delete(id);
    }
  };

  // Review statistics counts
  const totalCount = extractedReviewList.length;
  const validCount = extractedReviewList.filter(q => q.status === 'valid').length;
  const needsReviewCount = extractedReviewList.filter(q => q.status === 'needs_review').length;
  const unknownCount = extractedReviewList.filter(q => q.status === 'answer_unknown').length;
  const approvedCount = extractedReviewList.filter(q => q.approved).length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">MCQ Question Bank</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Add, review, and organize questions by Target and Subject with zero answer exposure during practice.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Import PDF / Text
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsManualModalOpen(true)}
          >
            Add Question
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Target Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Target</label>
            <select
              value={selectedTargetId}
              onChange={e => {
                setSelectedTargetId(e.target.value);
                setSelectedSubjectId('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            >
              <option value="">All Targets</option>
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              disabled={!selectedTargetId}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white disabled:opacity-50"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Difficulty</label>
            <select
              value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Search Keyword */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Search Keyword</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search MCQs..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <Card className="p-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Questions in Question Bank</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Upload a past Nepal exam PDF (e.g. NRB / RBB) or add questions manually to build your practice bank.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Import PDF Questions
            </Button>
          </Card>
        ) : (
          questions.map((q, idx) => {
            const cleanQuestionText = q.questionText
              .replace(/(?:Answer|Ans|Correct(?:\s+Answer)?)[\s\:\.\-\=]+[A-D].*$/i, '')
              .replace(/(?:Explanation|Solution|Sol)[\s\:\.\-\=]+.*$/i, '')
              .trim();

            return (
              <Card key={q.id} className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">#{idx + 1}</span>
                    <Badge variant={q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'danger'}>
                      {q.difficulty}
                    </Badge>
                    {q.isShared && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> Shared
                      </span>
                    )}
                    {q.source && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {q.source}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed mb-3">
                  {cleanQuestionText}
                </h4>

                {/* Structured Options Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {q.options.map(opt => {
                    const isCorrect = opt.id === q.correctOptionId;
                    return (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                          isCorrect
                            ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium'
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {opt.id}
                        </span>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300">Explanation: </strong>
                    {q.explanation}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Manual Question Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Add Question to Question Bank"
        size="lg"
      >
        <form onSubmit={handleSaveManual} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target *</label>
              <select
                required
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                <option value="">Select Target</option>
                {targets.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                <option value="">Select Subject (Optional)</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Question Statement *</label>
            <textarea
              required
              rows={3}
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="e.g. Which device operates at the Network Layer of the OSI Model?"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option A *</label>
              <input
                required
                type="text"
                value={optionA}
                onChange={e => setOptionA(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option B *</label>
              <input
                required
                type="text"
                value={optionB}
                onChange={e => setOptionB(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option C *</label>
              <input
                required
                type="text"
                value={optionC}
                onChange={e => setOptionC(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option D *</label>
              <input
                required
                type="text"
                value={optionD}
                onChange={e => setOptionD(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Correct Answer *</label>
              <select
                value={correctOption}
                onChange={e => setCorrectOption(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-bold"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as Difficulty)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Explanation (Optional)</label>
            <textarea
              rows={2}
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="Why this answer is correct..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Question
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import / Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Import Questions (PDF / Past Papers)"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign Target *</label>
              <select
                required
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                <option value="">Select Target</option>
                {targets.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign Subject</label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                <option value="">Select Subject (Optional)</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Upload File (PDF / JSON / CSV / Image)</label>
            <input
              type="file"
              accept=".pdf,.json,.csv,image/*"
              onChange={handleFileUpload}
              disabled={!selectedTargetId || isExtracting}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
            />
            {isExtracting && <p className="text-xs text-amber-500 font-medium mt-1">Extracting text & parsing MCQs...</p>}
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Or Paste Text / Markdown</label>
            <textarea
              rows={6}
              value={rawPastedText}
              onChange={e => setRawPastedText(e.target.value)}
              placeholder="1. What is the time complexity of binary search?&#10;A. O(n)&#10;B. O(log n)&#10;C. O(n^2)&#10;D. O(1)&#10;Answer: B"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleExtractText}
              disabled={!selectedTargetId || !rawPastedText.trim()}
            >
              Extract & Review
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mandatory Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Review Extracted Questions"
        size="xl"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Summary Status Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-bold text-slate-900 dark:text-white">Detected: {totalCount}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Valid: {validCount}</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Needs Review: {needsReviewCount}</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">Answer Unknown: {unknownCount}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  const updated = extractedReviewList.map(q => ({
                    ...q,
                    approved: q.status !== 'needs_review' || q.questionText.trim().length >= 5
                  }));
                  setExtractedReviewList(updated);
                }}
              >
                Approve All Valid
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review questions before saving. Correct any statement or options, or select the correct answer key.
          </p>

          <div className="space-y-3">
            {extractedReviewList.map((q, i) => (
              <Card key={q.tempId} className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                      Q#{q.rawQuestionNumber || i + 1} {q.sourcePage ? `(Page ${q.sourcePage})` : ''}
                    </span>
                    <Badge variant={q.status === 'valid' ? 'success' : q.status === 'answer_unknown' ? 'warning' : 'danger'}>
                      {q.status === 'valid' ? 'Valid' : q.status === 'answer_unknown' ? 'Answer Unknown' : 'Needs Review'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    {q.rawSourceText && (
                      <button
                        onClick={() => setViewSourceId(viewSourceId === q.tempId ? null : q.tempId)}
                        className="text-[11px] text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 font-semibold"
                      >
                        <Eye className="w-3 h-3" /> {viewSourceId === q.tempId ? 'Hide Source' : 'View Source'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const updated = extractedReviewList.filter((_, idx) => idx !== i);
                        setExtractedReviewList(updated);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500"
                      title="Delete this question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.approved}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].approved = e.target.checked;
                          setExtractedReviewList(updated);
                        }}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span>Approve</span>
                    </label>
                  </div>
                </div>

                {/* View Source Drawer */}
                {viewSourceId === q.tempId && q.rawSourceText && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">
                    {q.rawSourceText}
                  </div>
                )}

                {/* Question Statement Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Question Statement</label>
                  <textarea
                    value={q.questionText}
                    onChange={e => {
                      const updated = [...extractedReviewList];
                      updated[i].questionText = e.target.value;
                      setExtractedReviewList(updated);
                    }}
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>

                {/* Options Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 w-4 text-center">{opt.id}.</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].options[oIdx].text = e.target.value;
                          setExtractedReviewList(updated);
                        }}
                        placeholder={`Option ${opt.id}`}
                        className="w-full px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>

                {/* Answer and Explanation Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Correct Answer:
                    </label>
                    <select
                      value={q.detectedAnswer || ''}
                      onChange={e => {
                        const updated = [...extractedReviewList];
                        const val = e.target.value || null;
                        updated[i].detectedAnswer = val;
                        if (val && updated[i].status === 'answer_unknown') {
                          updated[i].status = 'valid';
                        }
                        setExtractedReviewList(updated);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-brand-600 dark:text-brand-400"
                    >
                      <option value="">Unknown (Select Answer)</option>
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Explanation (Optional):
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={e => {
                        const updated = [...extractedReviewList];
                        updated[i].explanation = e.target.value;
                        setExtractedReviewList(updated);
                      }}
                      placeholder="Leave blank if not in PDF"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">
              Approved: {approvedCount} of {totalCount}
            </span>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveApprovedToBank}
                disabled={approvedCount === 0}
              >
                Save Approved Questions ({approvedCount})
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
