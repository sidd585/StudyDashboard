import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Plus,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Share2,
  Sparkles,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  CheckSquare,
  Play,
  Filter,
} from 'lucide-react';
import { importMCQsFromPDF, importMCQsFromText } from '../services/import';
import { AIStudyBuilderModal } from '../components/ai/AIStudyBuilderModal';
import type { ParsedMCQCandidate, ImportDiagnostics } from '../services/import/types';
import type { Question, Difficulty, QuestionOrigin } from '../types';

export const Questions: React.FC = () => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Answer visibility toggle state per question in list
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  // Modal States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [viewSourceId, setViewSourceId] = useState<string | null>(null);

  // Manual Question Form State
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [isShared, setIsShared] = useState(true);

  // Ingestion / PDF Review state
  const [extractedReviewList, setExtractedReviewList] = useState<ParsedMCQCandidate[]>([]);
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostics | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingStage, setExtractingStage] = useState<string>('Reading PDF...');
  const [rawPastedText, setRawPastedText] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'needs_attention' | 'valid'>('all');

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
      if (originFilter !== 'all') {
        list = list.filter(item => item.origin === originFilter);
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
    [currentUser.id, selectedTargetId, selectedSubjectId, difficultyFilter, originFilter, searchQuery]
  ) || [];

  const toggleAnswerReveal = (questionId: string) => {
    setRevealedAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

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
      origin: 'USER_CREATED',
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

    const result = importMCQsFromText(rawPastedText, {
      defaultTargetId: targetId,
      defaultSubjectId: selectedSubjectId || undefined,
      sourceFileName: 'Manual Paste / Text',
    });

    if (result.questions.length > 0) {
      setExtractedReviewList(result.questions);
      setDiagnostics(result.diagnostics);
      setIsUploadModalOpen(false);
      setIsReviewModalOpen(true);
    } else {
      alert('No MCQs could be detected in the pasted text. Please verify formatting.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetId = selectedTargetId || (targets.length > 0 ? targets[0].id : '');
    if (!targetId) {
      alert('Please select a target before uploading a document.');
      return;
    }

    setIsExtracting(true);
    setExtractingStage('Connecting to document processor...');
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setExtractingStage('Extracting text & running OCR if needed...');
        const result = await importMCQsFromPDF(file, {
          defaultTargetId: targetId,
          defaultSubjectId: selectedSubjectId || undefined,
          sourceFileName: file.name,
        });

        if (result.questions.length > 0) {
          setExtractedReviewList(result.questions);
          setDiagnostics(result.diagnostics);
          setIsUploadModalOpen(false);
          setIsReviewModalOpen(true);
        } else {
          alert('Could not detect questions in this PDF. Please check if file is password protected or corrupted.');
        }
      } else {
        const rawText = await file.text();
        const result = importMCQsFromText(rawText, {
          defaultTargetId: targetId,
          defaultSubjectId: selectedSubjectId || undefined,
          sourceFileName: file.name,
        });

        if (result.questions.length > 0) {
          setExtractedReviewList(result.questions);
          setDiagnostics(result.diagnostics);
          setIsUploadModalOpen(false);
          setIsReviewModalOpen(true);
        } else {
          alert('Could not extract questions from this text file.');
        }
      }
    } catch (err: any) {
      console.error('File extraction error:', err);
      alert(`Error parsing file: ${err?.message || 'Please ensure it is a valid PDF or image document.'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Bulk Save Approved Questions to Dexie Question Bank
  const handleSaveApprovedToBank = async (onlyValid: boolean = false) => {
    const approved = extractedReviewList.filter(q => (onlyValid ? q.status === 'valid' && q.approved : q.approved) && q.questionText.trim());
    if (approved.length === 0) {
      alert('No approved questions to save. Please review and approve questions.');
      return;
    }

    const targetIdToUse = selectedTargetId || (targets.length > 0 ? targets[0].id : '');

    const questionsToInsert: Question[] = approved.map((q, idx) => {
      const cleanQuestionText = q.questionText
        .replace(/(?:Answer|Ans|Correct(?:\s+Answer)?)[\s\:\.\-\=]+[A-D].*$/i, '')
        .replace(/(?:Explanation|Solution|Sol)[\s\:\.\-\=]+.*$/i, '')
        .trim();

      const options = q.options.length >= 2 ? q.options : [
        { id: 'A' as const, text: q.options[0]?.text || 'Option A' },
        { id: 'B' as const, text: q.options[1]?.text || 'Option B' },
        { id: 'C' as const, text: q.options[2]?.text || 'Option C' },
        { id: 'D' as const, text: q.options[3]?.text || 'Option D' },
      ];

      return {
        id: `q-imported-${Date.now()}-${idx}-${q.originalQuestionNumber}`,
        userId: currentUser.id,
        targetId: q.targetId || targetIdToUse,
        subjectId: q.subjectId || selectedSubjectId || undefined,
        topicId: q.topicId || undefined,
        questionText: cleanQuestionText,
        options,
        correctOptionId: q.detectedAnswer || null,
        explanation: q.explanation ? q.explanation.trim() : '',
        source: q.sourceFileName || 'Imported PDF Bank',
        difficulty: q.difficulty || 'medium',
        origin: 'IMPORTED_OLD_QUESTION' as QuestionOrigin,
        isShared: true,
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
      };
    });

    await db.questions.bulkPut(questionsToInsert);
    setIsReviewModalOpen(false);
    setExtractedReviewList([]);
    setDiagnostics(null);
    setRawPastedText('');
    alert(`Successfully saved ${questionsToInsert.length} questions to your Question Bank!`);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Delete this question from your Question Bank?')) {
      await db.questions.delete(id);
    }
  };

  const totalCount = extractedReviewList.length;
  const validCount = extractedReviewList.filter(q => q.status === 'valid').length;
  const needsAttentionCount = totalCount - validCount;
  const approvedCount = extractedReviewList.filter(q => q.approved).length;

  const filteredReviewList = extractedReviewList.filter(q => {
    if (reviewFilter === 'needs_attention') return q.status !== 'valid';
    if (reviewFilter === 'valid') return q.status === 'valid';
    return true;
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-6xl mx-auto">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Question Bank</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your verified old questions, AI blueprints, and practice bank.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload className="w-4 h-4 text-blue-500" />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10"
            leftIcon={<Sparkles className="w-4 h-4 text-amber-500" />}
            onClick={() => setIsAIModalOpen(true)}
          >
            Ask AI
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
      <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

          {/* Origin Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Origin</label>
            <select
              value={originFilter}
              onChange={e => setOriginFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Origins</option>
              <option value="IMPORTED_OLD_QUESTION">Imported Old Questions</option>
              <option value="AI_PAST_PATTERN">AI Past-Pattern</option>
              <option value="AI_GENERATED">AI Generated</option>
              <option value="USER_CREATED">User Created</option>
              <option value="SHARED">Shared Partner</option>
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
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Search</label>
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
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Questions Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Upload a past exam PDF, generate high-yield MCQs with AI, or add questions manually.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => setIsUploadModalOpen(true)}
              >
                Upload PDF
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Sparkles className="w-4 h-4" />}
                onClick={() => setIsAIModalOpen(true)}
              >
                Build with AI
              </Button>
            </div>
          </Card>
        ) : (
          questions.map((q, idx) => {
            const isRevealed = !!revealedAnswers[q.id];
            const cleanQuestionText = q.questionText
              .replace(/(?:Answer|Ans|Correct(?:\s+Answer)?)[\s\:\.\-\=]+[A-D].*$/i, '')
              .replace(/(?:Explanation|Solution|Sol)[\s\:\.\-\=]+.*$/i, '')
              .trim();

            return (
              <Card
                key={q.id}
                className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">#{idx + 1}</span>
                    <Badge variant={q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'danger'}>
                      {q.difficulty}
                    </Badge>
                    {q.origin && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                        {q.origin === 'IMPORTED_OLD_QUESTION' ? 'Old Question' : q.origin === 'AI_PAST_PATTERN' ? 'AI Past Pattern' : q.origin === 'AI_GENERATED' ? 'AI Generated' : 'User Created'}
                      </span>
                    )}
                    {q.isShared && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> Shared
                      </span>
                    )}
                    {q.source && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {q.source}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                  {cleanQuestionText}
                </h4>

                {/* Structured Options (DO NOT HIGHLIGHT ANSWER BY DEFAULT) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map(opt => {
                    const isCorrectAnswer = isRevealed && opt.id === q.correctOptionId;
                    return (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                          isCorrectAnswer
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500/30'
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isCorrectAnswer ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {opt.id}
                        </span>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* View Answer & Explanation Toggle (Zero Spoilers while browsing) */}
                <div className="pt-1 flex items-center justify-between">
                  <button
                    onClick={() => toggleAnswerReveal(q.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isRevealed ? 'Hide Answer' : 'View Answer'}</span>
                  </button>

                  {isRevealed && q.correctOptionId && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Correct: Option {q.correctOptionId}
                    </span>
                  )}
                </div>

                {isRevealed && q.explanation && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Explanation: </strong>
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
              rows={2}
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="e.g. Which layer of the OSI model does a router operate at?"
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
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Upload File (PDF / PNG / JPG / Text)</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.json,.csv"
              onChange={handleFileUpload}
              disabled={!selectedTargetId || isExtracting}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
            />
            {isExtracting && (
              <div className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 font-medium mt-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>{extractingStage}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Or Paste Text / Markdown</label>
            <textarea
              rows={6}
              value={rawPastedText}
              onChange={e => setRawPastedText(e.target.value)}
              placeholder="1. Which layer of the OSI model does a router operate at?&#10;A. Data Link&#10;B. Network&#10;C. Transport&#10;D. Application&#10;Answer: B"
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

      {/* Streamlined PDF / Document Import Review Modal with Sticky Action Bar */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Review Extracted Exam Questions"
        size="xl"
      >
        <div className="space-y-4">
          {/* Summary Banner with Instant Action Buttons */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  PDF Analysis Complete: {totalCount} Questions Detected
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="success">✓ {validCount} Ready</Badge>
                {needsAttentionCount > 0 && <Badge variant="warning">! {needsAttentionCount} Needs Attention</Badge>}
                <span className="text-xs text-slate-400">({approvedCount} approved)</span>
              </div>
            </div>

            {/* Fast Batch Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                onClick={() => handleSaveApprovedToBank(true)}
                disabled={validCount === 0}
              >
                Save {validCount} & Practice
              </Button>
            </div>
          </div>

          {/* Review Filter Bar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Filter:</span>
              <button
                type="button"
                onClick={() => setReviewFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  reviewFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('valid')}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  reviewFilter === 'valid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Ready ({validCount})
              </button>
              {needsAttentionCount > 0 && (
                <button
                  type="button"
                  onClick={() => setReviewFilter('needs_attention')}
                  className={`px-2.5 py-1 rounded-lg font-semibold ${
                    reviewFilter === 'needs_attention' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Needs Attention ({needsAttentionCount})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  const updated = extractedReviewList.map(q => ({
                    ...q,
                    approved: q.confidence === 'high' && q.status === 'valid',
                  }));
                  setExtractedReviewList(updated);
                }}
              >
                Approve High Confidence
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  const updated = extractedReviewList.map(q => ({ ...q, approved: true }));
                  setExtractedReviewList(updated);
                }}
              >
                Approve All
              </Button>
            </div>
          </div>

          {/* Questions Scroll Area */}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {filteredReviewList.map((q) => {
              const realIndex = extractedReviewList.findIndex(item => item.tempId === q.tempId);
              return (
                <Card key={q.tempId} className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                        Question #{q.originalQuestionNumber}
                      </span>
                      <Badge variant={q.status === 'valid' ? 'success' : q.status === 'answer_unknown' ? 'warning' : 'danger'}>
                        {q.status === 'valid' ? 'Valid' : q.status === 'answer_unknown' ? 'Answer Unknown' : 'Needs Review'}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        Page {q.sourcePageStart}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {q.rawSourceSnippet && (
                        <button
                          onClick={() => setViewSourceId(viewSourceId === q.tempId ? null : q.tempId)}
                          className="text-[11px] text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 font-semibold"
                        >
                          <Eye className="w-3 h-3" /> {viewSourceId === q.tempId ? 'Hide Source' : 'View Source'}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const updated = extractedReviewList.filter((_, idx) => idx !== realIndex);
                          setExtractedReviewList(updated);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500"
                        title="Delete question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.approved}
                          onChange={e => {
                            if (realIndex >= 0) {
                              const updated = [...extractedReviewList];
                              updated[realIndex].approved = e.target.checked;
                              setExtractedReviewList(updated);
                            }
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span>Approve</span>
                      </label>
                    </div>
                  </div>

                  {/* View Source Drawer */}
                  {viewSourceId === q.tempId && q.rawSourceSnippet && (
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">
                      {q.rawSourceSnippet}
                    </div>
                  )}

                  {/* Question Statement Input */}
                  <div>
                    <textarea
                      value={q.questionText}
                      onChange={e => {
                        if (realIndex >= 0) {
                          const updated = [...extractedReviewList];
                          updated[realIndex].questionText = e.target.value;
                          setExtractedReviewList(updated);
                        }
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
                            if (realIndex >= 0) {
                              const updated = [...extractedReviewList];
                              updated[realIndex].options[oIdx].text = e.target.value;
                              setExtractedReviewList(updated);
                            }
                          }}
                          className="w-full px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Answer and Explanation Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Detected Answer:
                      </label>
                      <select
                        value={q.detectedAnswer || ''}
                        onChange={e => {
                          if (realIndex >= 0) {
                            const updated = [...extractedReviewList];
                            const val = (e.target.value as 'A' | 'B' | 'C' | 'D') || null;
                            updated[realIndex].detectedAnswer = val;
                            if (val && updated[realIndex].status === 'answer_unknown') {
                              updated[realIndex].status = 'valid';
                            }
                            setExtractedReviewList(updated);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-brand-600 dark:text-brand-400"
                      >
                        <option value="">Unknown (Unanswered in Key)</option>
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
                        value={q.explanation || ''}
                        onChange={e => {
                          if (realIndex >= 0) {
                            const updated = [...extractedReviewList];
                            updated[realIndex].explanation = e.target.value;
                            setExtractedReviewList(updated);
                          }
                        }}
                        placeholder="Leave blank if not in source"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Sticky Bottom Action Bar */}
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
                onClick={() => handleSaveApprovedToBank(false)}
                disabled={approvedCount === 0}
              >
                Save {approvedCount} Questions to Bank
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* AI Study Builder Modal */}
      <AIStudyBuilderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        initialTargetId={selectedTargetId || targets[0]?.id}
      />
    </div>
  );
};
