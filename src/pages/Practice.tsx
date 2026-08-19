import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Play,
  Clock,
  Sparkles,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Upload,
} from 'lucide-react';
import { AIStudyBuilderModal } from '../components/ai/AIStudyBuilderModal';
import type { QuizConfig, QuestionOrigin } from '../types';

interface PracticeProps {
  onStartSession: (sessionId: string) => void;
  onNavigate: (page: any) => void;
  initialTargetId?: string;
}

export const Practice: React.FC<PracticeProps> = ({ onStartSession, onNavigate, initialTargetId }) => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).and(t => !t.isArchived).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>(initialTargetId || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<number>(15);
  const [isTimed, setIsTimed] = useState<boolean>(false);
  const [timeMinutes, setTimeMinutes] = useState<number>(15);
  const [mode, setMode] = useState<'all' | 'weak_topics' | 'old_questions' | 'ai_pattern' | 'wrong_only'>('all');
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);

  // Default target selection
  React.useEffect(() => {
    if (!selectedTargetId && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets, selectedTargetId]);

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  const topics = useLiveQuery(
    () => (selectedSubjectId ? db.topics.where('subjectId').equals(selectedSubjectId).toArray() : []),
    [selectedSubjectId]
  ) || [];

  // Available questions pool
  const questions = useLiveQuery(
    async () => {
      let q = db.questions.where('userId').equals(currentUser.id);
      if (selectedTargetId) {
        q = db.questions.where('targetId').equals(selectedTargetId);
      }
      let pool = await q.toArray();
      if (selectedSubjectId) {
        pool = pool.filter(item => item.subjectId === selectedSubjectId);
      }
      if (selectedTopicId) {
        pool = pool.filter(item => item.topicId === selectedTopicId);
      }
      if (mode === 'wrong_only') {
        pool = pool.filter(item => item.stats.wrongAttempts > 0);
      } else if (mode === 'weak_topics') {
        pool = pool.filter(item => {
          const total = item.stats.totalAttempts || 0;
          const correct = item.stats.correctAttempts || 0;
          return total === 0 || (correct / total) < 0.65;
        });
      } else if (mode === 'old_questions') {
        pool = pool.filter(item => item.origin === 'IMPORTED_OLD_QUESTION');
      } else if (mode === 'ai_pattern') {
        pool = pool.filter(item => item.origin === 'AI_PAST_PATTERN' || item.origin === 'AI_GENERATED');
      }
      return pool;
    },
    [currentUser.id, selectedTargetId, selectedSubjectId, selectedTopicId, mode]
  ) || [];

  const handleStartPractice = async () => {
    if (questions.length === 0) return;

    // Shuffle and pick subset
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, questionCount);

    const sessionId = `session-practice-${Date.now()}`;
    const targetObj = targets.find(t => t.id === selectedTargetId);

    const config: QuizConfig = {
      mode: 'practice',
      title: `${targetObj?.name || 'MCQ'} Practice (${selected.length} Qs)`,
      targetId: selectedTargetId || undefined,
      subjectIds: selectedSubjectId ? [selectedSubjectId] : [],
      topicIds: selectedTopicId ? [selectedTopicId] : [],
      questionCount: selected.length,
      durationMinutes: isTimed ? timeMinutes : undefined,
      marksPerCorrect: 1,
      negativeMarks: 0,
      shuffleQuestions: true,
      shuffleOptions: true,
      immediateFeedback: true,
    };

    await db.quizSessions.put({
      id: sessionId,
      userId: currentUser.id,
      targetId: selectedTargetId || undefined,
      title: config.title,
      mode: 'practice',
      status: 'in_progress',
      config,
      questionIds: selected.map(q => q.id),
      answers: {},
      currentQuestionIndex: 0,
      startedAt: Date.now(),
      completedAt: null,
      totalTimeSpentMs: 0,
    });

    onStartSession(sessionId);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Header & Quick Action Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">MCQ Practice Room</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Targeted drills with instant explanations and topic accuracy analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload className="w-4 h-4 text-blue-500" />}
            onClick={() => onNavigate('questions')}
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
        </div>
      </div>

      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-6">
        {/* 1. Target Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            1. Select Target Exam
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {targets.map(target => (
              <button
                key={target.id}
                type="button"
                onClick={() => {
                  setSelectedTargetId(target.id);
                  setSelectedSubjectId('');
                  setSelectedTopicId('');
                }}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  selectedTargetId === target.id
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-slate-900 dark:text-white ring-1 ring-brand-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: target.color || '#6366f1' }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{target.name}</p>
                  <p className="text-[10px] text-slate-400">{target.type}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Subject & Topic Filter */}
        {subjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                2. Subject (Optional)
              </label>
              <select
                value={selectedSubjectId}
                onChange={e => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedTopicId('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {topics.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Topic (Optional)
                </label>
                <select
                  value={selectedTopicId}
                  onChange={e => setSelectedTopicId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">All Topics</option>
                  {topics.map(tp => (
                    <option key={tp.id} value={tp.id}>{tp.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* 3. Practice Mode Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            3. Practice Mode & Source
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'all', label: 'All Available' },
              { id: 'weak_topics', label: 'Weak Topics' },
              { id: 'old_questions', label: 'Old Questions Only' },
              { id: 'ai_pattern', label: 'AI Past-Pattern' },
              { id: 'wrong_only', label: 'Wrong Questions Only' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id as any)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all text-center ${
                  mode === m.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Question Count & Timer Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              4. Question Count
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 25, 50].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setQuestionCount(cnt)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                    questionCount === cnt
                      ? 'border-brand-500 bg-brand-600 text-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Timed Practice
            </label>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTimed}
                  onChange={e => setIsTimed(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Enable Timer</span>
              </label>

              {isTimed && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={timeMinutes}
                    onChange={e => setTimeMinutes(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs text-center rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                  />
                  <span className="text-xs text-slate-400">minutes</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Question Pool Status & Launch Button */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {questions.length > 0 ? (
              <span>✓ <strong>{questions.length}</strong> matching questions available in your bank</span>
            ) : (
              <span className="text-amber-500">⚠ No matching questions found for this selection</span>
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            leftIcon={<Play className="w-4 h-4 fill-current" />}
            disabled={questions.length === 0}
            onClick={handleStartPractice}
            className="w-full sm:w-auto px-8"
          >
            Start Practice ({Math.min(questionCount, questions.length)} Qs)
          </Button>
        </div>
      </Card>

      {/* AI Study Builder Modal */}
      <AIStudyBuilderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        initialTargetId={selectedTargetId}
      />
    </div>
  );
};
