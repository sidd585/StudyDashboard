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
  Eye,
  EyeOff,
  Play,
  RotateCcw,
  Check,
} from 'lucide-react';
import { importMCQsFromPDF, importMCQsFromText } from '../services/import';
import { questionService } from '../services/questionService';
import type { ParsedMCQCandidate, ImportDiagnostics } from '../services/import/types';
import type { Question, Difficulty, QuestionOrigin } from '../types';
import type { PageId } from '../components/layout/Sidebar';

interface QuestionsProps {
  onNavigate?: (page: PageId, params?: any) => void;
}

export const Questions: React.FC<QuestionsProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Answer visibility toggle state per question in list
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  // Modal States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadSuccessModalOpen, setIsUploadSuccessModalOpen] = useState(false);
  const [isReviewProblemModalOpen, setIsReviewProblemModalOpen] = useState(false);

  // Manual Question Form State
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  // Ingestion / PDF state
  const [uploadStats, setUploadStats] = useState<{
    totalDetected: number;
    savedCount: number;
    answersMapped: number;
    needsReviewCount: number;
    problematicQuestions: ParsedMCQCandidate[];
    targetId: string;
    topicId?: string;
  } | null>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingStage, setExtractingStage] = useState<string>('Reading PDF...');
  const [rawPastedText, setRawPastedText] = useState('');
  const [uploadTopicId, setUploadTopicId] = useState<string>('');

  const topics = useLiveQuery(
    () => (selectedTargetId ? db.topics.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  const uploadTargetTopics = useLiveQuery(
    () => (selectedTargetId ? db.topics.where('targetId').equals(selectedTargetId).toArray() : []),
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
      if (selectedTopicId) {
        list = list.filter(item => item.topicId === selectedTopicId);
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
    [currentUser.id, selectedTargetId, selectedTopicId, difficultyFilter, searchQuery]
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
      topicId: selectedTopicId || undefined,
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

  // Helper to directly store parsed questions into DB and open success modal
  const processAndDirectlyStoreMCQs = async (
    parsedQuestions: ParsedMCQCandidate[],
    targetId: string,
    topicId?: string,
    sourceName: string = 'Uploaded PDF'
  ) => {
    if (!parsedQuestions.length) return;

    const validOnes = parsedQuestions.filter(q => q.status === 'valid' && q.questionText.trim());
    const problemOnes = parsedQuestions.filter(q => q.status !== 'valid' || !q.questionText.trim());

    // Prepare questions to bulk insert
    const now = Date.now();
    const questionsToInsert: Question[] = validOnes.map((q, idx) => {
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
        id: `q-imported-${now}-${idx}-${q.originalQuestionNumber}`,
        userId: currentUser.id,
        targetId: q.targetId || targetId,
        topicId: topicId || q.topicId || undefined,
        questionText: cleanQuestionText,
        options,
        correctOptionId: q.detectedAnswer || null,
        explanation: q.explanation ? q.explanation.trim() : '',
        source: sourceName,
        difficulty: q.difficulty || 'medium',
        origin: 'IMPORTED_OLD_QUESTION' as QuestionOrigin,
        isShared: true,
        isBookmarked: false,
        isDifficult: false,
        tags: [],
        createdAt: now,
        updatedAt: now,
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

    if (questionsToInsert.length > 0) {
      await db.questions.bulkPut(questionsToInsert);

      // Also persist directly to Supabase Cloud Question Bank
      try {
        const cloudQuestions = validOnes.map(q => {
          const optA = q.options[0]?.text || 'Option A';
          const optB = q.options[1]?.text || 'Option B';
          const optC = q.options[2]?.text || 'Option C';
          const optD = q.options[3]?.text || 'Option D';
          return {
            courseId: targetId,
            topicId: topicId || null,
            questionText: q.questionText,
            optionA: optA,
            optionB: optB,
            optionC: optC,
            optionD: optD,
            correctAnswer: q.detectedAnswer || 'A',
            explanation: q.explanation ? q.explanation.trim() : null,
            sourceFileId: sourceName,
            originalQuestionNumber: q.originalQuestionNumber || undefined,
            answerStatus: 'VALID' as const,
          };
        });
        await questionService.createQuestionsBatch(cloudQuestions);
      } catch (cloudErr) {
        console.warn('Cloud batch save note:', cloudErr);
      }
    }

    const answersMappedCount = validOnes.filter(q => q.detectedAnswer).length;

    setUploadStats({
      totalDetected: parsedQuestions.length,
      savedCount: questionsToInsert.length,
      answersMapped: answersMappedCount,
      needsReviewCount: problemOnes.length,
      problematicQuestions: problemOnes,
      targetId,
      topicId,
    });

    setIsUploadModalOpen(false);
    setIsUploadSuccessModalOpen(true);
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetId = selectedTargetId || (targets.length > 0 ? targets[0].id : '');
    if (!targetId) {
      alert('Please select a course / target before uploading a document.');
      return;
    }

    setIsExtracting(true);
    setExtractingStage('Extracting MCQs & mapping answers...');
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const result = await importMCQsFromPDF(file, {
          defaultTargetId: targetId,
          sourceFileName: file.name,
        });

        if (result.questions.length > 0) {
          await processAndDirectlyStoreMCQs(result.questions, targetId, uploadTopicId, file.name);
        } else {
          alert('Could not detect questions in this PDF. Please check if file is text-readable.');
        }
      } else {
        const rawText = await file.text();
        const result = importMCQsFromText(rawText, {
          defaultTargetId: targetId,
          sourceFileName: file.name,
        });

        if (result.questions.length > 0) {
          await processAndDirectlyStoreMCQs(result.questions, targetId, uploadTopicId, file.name);
        } else {
          alert('Could not extract questions from this text file.');
        }
      }
    } catch (err: any) {
      console.error('File extraction error:', err);
      alert(`Error parsing file: ${err?.message || 'Please ensure it is a valid document.'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleStartPracticeTest = (questionCount: number) => {
    setIsUploadSuccessModalOpen(false);
    if (onNavigate && uploadStats) {
      onNavigate('practice', {
        targetId: uploadStats.targetId,
        topicId: uploadStats.topicId,
        questionCount,
      });
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Delete this question from your Question Bank?')) {
      await db.questions.delete(id);
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in max-w-6xl mx-auto">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Question Bank</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store, filter, and practice your syllabus questions and old question papers.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsManualModalOpen(true)}
          >
            Add Question
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Target Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Course / Target
            </label>
            <select
              value={selectedTargetId}
              onChange={e => {
                setSelectedTargetId(e.target.value);
                setSelectedTopicId('');
              }}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">All Courses ({targets.length})</option>
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Topic Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Syllabus Topic
            </label>
            <select
              value={selectedTopicId}
              onChange={e => setSelectedTopicId(e.target.value)}
              disabled={!selectedTargetId}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
            >
              <option value="">All Topics ({topics.length})</option>
              {topics.map(top => (
                <option key={top.id} value={top.id}>{top.name}</option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Difficulty
            </label>
            <select
              value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search MCQs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Questions Count Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Showing <strong>{questions.length}</strong> questions in Question Bank</span>
        {questions.length > 0 && onNavigate && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Play className="w-3.5 h-3.5 text-brand-600" />}
            onClick={() => onNavigate('practice', { targetId: selectedTargetId || undefined, topicId: selectedTopicId || undefined })}
          >
            Practice Filtered Set →
          </Button>
        )}
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No questions found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Upload a PDF old question set or add your first question manually.
          </p>
          <Button variant="primary" size="sm" onClick={() => setIsUploadModalOpen(true)}>
            Upload Question PDF
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, index) => {
            const isRevealed = revealedAnswers[q.id] || false;
            const targetObj = targets.find(t => t.id === q.targetId);

            return (
              <Card
                key={q.id}
                className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-brand-300 dark:hover:border-brand-800 transition-all space-y-4"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">#{index + 1}</span>
                    <Badge variant={q.difficulty === 'hard' ? 'danger' : q.difficulty === 'medium' ? 'warning' : 'success'} size="sm">
                      {q.difficulty}
                    </Badge>
                    {targetObj && (
                      <span className="text-xs text-slate-500 font-medium">
                        {targetObj.name}
                      </span>
                    )}
                    {q.source && (
                      <span className="text-[11px] text-slate-400">
                        • {q.source}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Question Text */}
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {q.questionText}
                </h4>

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map(opt => {
                    const isCorrect = isRevealed && opt.id === q.correctOptionId;

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${
                          isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500'
                            : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                        }`}>
                          {opt.id}
                        </span>
                        <span className="flex-1 leading-snug">{opt.text}</span>
                        {isCorrect && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>

                {/* Answer Reveal Toggle */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => toggleAnswerReveal(q.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {isRevealed ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide Answer</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Answer</span>
                      </>
                    )}
                  </button>

                  {isRevealed && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                      Correct: Option {q.correctOptionId || 'Unknown'}
                    </div>
                  )}
                </div>

                {/* Explanation (Shown when answer revealed) */}
                {isRevealed && q.explanation && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-white">Explanation: </span>
                    {q.explanation}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ================= MODAL 1: UPLOAD PDF / TEXT ================= */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Questions (PDF or Document)"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select course and syllabus topic, then drop your PDF. All detected MCQs will be directly stored in your bank.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Course / Target *
            </label>
            <select
              value={selectedTargetId}
              onChange={e => setSelectedTargetId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">Select a Course</option>
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assign to Syllabus Topic (Optional)
            </label>
            <select
              value={uploadTopicId}
              onChange={e => setUploadTopicId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">General / All Syllabus Topics</option>
              {uploadTargetTopics.map(top => (
                <option key={top.id} value={top.id}>{top.name}</option>
              ))}
            </select>
          </div>

          {/* File Drag / Select Box */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-brand-500 transition-all bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="file"
              accept=".pdf,.txt,.json,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload-input"
              disabled={isExtracting || !selectedTargetId}
            />
            <label htmlFor="file-upload-input" className={`cursor-pointer ${!selectedTargetId ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-10 h-10 text-brand-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {isExtracting ? extractingStage : 'Click to Upload PDF or Old Question Sheet'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Supports standard PDFs, text files, and scanned question papers</p>
            </label>
          </div>

          {isExtracting && (
            <div className="p-3.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>{extractingStage}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL 2: UPLOAD SUCCESS & 1-CLICK PRACTICE ================= */}
      <Modal
        isOpen={isUploadSuccessModalOpen}
        onClose={() => setIsUploadSuccessModalOpen(false)}
        title="✓ Upload Successful — Questions Added"
      >
        {uploadStats && (
          <div className="space-y-6 text-center py-2 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {uploadStats.savedCount} Questions Successfully Added!
              </h3>
              <p className="text-xs text-slate-500">
                {uploadStats.answersMapped} answers accurately mapped • Stored directly in your Question Bank
              </p>
            </div>

            {uploadStats.needsReviewCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                <span>⚠ {uploadStats.needsReviewCount} questions need manual review</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsUploadSuccessModalOpen(false);
                    setIsReviewProblemModalOpen(true);
                  }}
                >
                  Review {uploadStats.needsReviewCount} Questions
                </Button>
              </div>
            )}

            {/* Instant Practice Launchers */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-3">
                Ready for Practice — Choose Session Size:
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                <Button
                  variant="primary"
                  className="font-bold py-3 text-xs"
                  onClick={() => handleStartPracticeTest(15)}
                >
                  Practice 15
                </Button>
                <Button
                  variant="primary"
                  className="font-bold py-3 text-xs"
                  onClick={() => handleStartPracticeTest(25)}
                >
                  Practice 25
                </Button>
                <Button
                  variant="primary"
                  className="font-bold py-3 text-xs"
                  onClick={() => handleStartPracticeTest(50)}
                >
                  Practice 50
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsUploadSuccessModalOpen(false);
                  if (onNavigate) onNavigate('practice', { targetId: uploadStats.targetId });
                }}
              >
                Custom Practice Setup →
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUploadSuccessModalOpen(false)}
              >
                View Question Bank
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= MODAL 3: MANUAL ADD QUESTION ================= */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Add Question Manually"
      >
        <form onSubmit={handleSaveManual} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Course / Target *
            </label>
            <select
              value={selectedTargetId}
              onChange={e => setSelectedTargetId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Question Text *
            </label>
            <textarea
              rows={2}
              required
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="Enter full MCQ question statement..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Option A *</label>
              <input
                type="text"
                required
                value={optionA}
                onChange={e => setOptionA(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Option B *</label>
              <input
                type="text"
                required
                value={optionB}
                onChange={e => setOptionB(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Option C *</label>
              <input
                type="text"
                required
                value={optionC}
                onChange={e => setOptionC(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Option D *</label>
              <input
                type="text"
                required
                value={optionD}
                onChange={e => setOptionD(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Correct Answer *</label>
              <select
                value={correctOption}
                onChange={e => setCorrectOption(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Explanation (Optional)</label>
            <input
              type="text"
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="Why is this answer correct?"
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Question
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
