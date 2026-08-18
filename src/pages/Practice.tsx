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
} from 'lucide-react';
import type { QuizConfig } from '../types';

interface PracticeProps {
  onStartSession: (sessionId: string) => void;
  onNavigate: (page: any) => void;
  initialTargetId?: string;
}

export const Practice: React.FC<PracticeProps> = ({ onStartSession, initialTargetId }) => {
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
  const [mode, setMode] = useState<'all' | 'wrong_only' | 'unseen'>('all');

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
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">MCQ Practice Room</h2>
        <p className="text-xs text-slate-400">Configure your target practice session with instant explanations.</p>
      </div>

      <Card className="p-6 border-slate-800 space-y-6">
        {/* 1. Target Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            1. Select Target
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
                    ? 'border-brand-500 bg-brand-500/10 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: target.color }} />
                <div className="truncate">
                  <p className="font-bold text-sm truncate">{target.name}</p>
                  <p className="text-[11px] text-slate-400">{target.type}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Optional Subject & Topic */}
        {subjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Subject (Optional)
              </label>
              <select
                value={selectedSubjectId}
                onChange={e => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedTopicId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Topic (Optional)
              </label>
              <select
                value={selectedTopicId}
                onChange={e => setSelectedTopicId(e.target.value)}
                disabled={!selectedSubjectId || topics.length === 0}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="">All Topics</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 3. Question Count & Filter Mode */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            2. Number of Questions
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {[5, 10, 15, 25, 50, 60].map(count => (
              <button
                key={count}
                type="button"
                onClick={() => setQuestionCount(count)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  questionCount === count
                    ? 'bg-brand-600 border-brand-500 text-white shadow-md shadow-brand-500/20'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {count} Qs
              </button>
            ))}
            <button
              type="button"
              onClick={() => setQuestionCount(questions.length || 10)}
              className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                questionCount === questions.length
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              All ({questions.length})
            </button>
          </div>
        </div>

        {/* 4. Practice Mode Filters */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            3. Practice Filter
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'all', label: 'All Questions' },
              { id: 'wrong_only', label: 'Past Mistakes' },
              { id: 'unseen', label: 'Unseen MCQs' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id as any)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  mode === m.id
                    ? 'bg-brand-600 border-brand-500 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Footer & Start Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Available in pool: <strong className="text-white">{questions.length} Questions</strong>
          </div>

          <Button
            variant="primary"
            size="lg"
            leftIcon={<Play className="w-4 h-4 fill-current" />}
            onClick={handleStartPractice}
            disabled={questions.length === 0}
            className="px-8 shadow-lg shadow-brand-500/20"
          >
            Start Practice
          </Button>
        </div>
      </Card>
    </div>
  );
};
