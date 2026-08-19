import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Play,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Layers,
  Sliders,
} from 'lucide-react';
import type { QuizConfig } from '../types';

interface PracticeProps {
  onStartSession: (sessionId: string) => void;
  onNavigate: (page: any, params?: any) => void;
  initialTargetId?: string;
  initialTopicId?: string;
  initialQuestionCount?: number;
}

export const Practice: React.FC<PracticeProps> = ({
  onStartSession,
  onNavigate,
  initialTargetId,
  initialTopicId,
  initialQuestionCount,
}) => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).and(t => !t.isArchived).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>(initialTargetId || '');
  const [topicSelectionMode, setTopicSelectionMode] = useState<'single' | 'multi' | 'all'>('single');
  const [selectedSingleTopicId, setSelectedSingleTopicId] = useState<string>(initialTopicId || '');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(initialQuestionCount || 15);
  const [examMode, setExamMode] = useState<'practice' | 'timed_test'>('practice');
  const [timerMinutes, setTimerMinutes] = useState<number>(45);

  // Set default target
  useEffect(() => {
    if (!selectedTargetId && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets, selectedTargetId]);

  const topics = useLiveQuery(
    () => (selectedTargetId ? db.topics.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  // When topics load, if in multi mode and none selected, select all by default
  useEffect(() => {
    if (topics.length > 0 && selectedTopicIds.length === 0) {
      setSelectedTopicIds(topics.map(t => t.id));
    }
    if (topics.length > 0 && !selectedSingleTopicId) {
      setSelectedSingleTopicId(topics[0].id);
    }
  }, [topics]);

  // Query eligible questions pool strictly deduplicated
  const questionsPool = useLiveQuery(
    async () => {
      let q = db.questions.where('userId').equals(currentUser.id);
      if (selectedTargetId) {
        q = db.questions.where('targetId').equals(selectedTargetId);
      }
      let pool = await q.toArray();

      if (topicSelectionMode === 'single' && selectedSingleTopicId) {
        pool = pool.filter(item => item.topicId === selectedSingleTopicId);
      } else if (topicSelectionMode === 'multi' && selectedTopicIds.length > 0) {
        pool = pool.filter(item => item.topicId && selectedTopicIds.includes(item.topicId));
      }

      // Deduplicate questions by unique ID
      const seen = new Set<string>();
      return pool.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    },
    [currentUser.id, selectedTargetId, topicSelectionMode, selectedSingleTopicId, selectedTopicIds]
  ) || [];

  const handleToggleTopicCheckbox = (topicId: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const handleSelectAllTopics = () => {
    setSelectedTopicIds(topics.map(t => t.id));
  };

  const handleClearAllTopics = () => {
    setSelectedTopicIds([]);
  };

  const handleStartSession = async () => {
    if (questionsPool.length === 0) {
      alert('No questions found for the selected topics. Please upload questions or pick another topic.');
      return;
    }

    // Step 1: Shuffle questions once
    const shuffled = [...questionsPool].sort(() => 0.5 - Math.random());
    
    // Step 2: Slice exact required count (capped at pool length)
    const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length));

    const sessionId = `session-practice-${Date.now()}`;
    const targetObj = targets.find(t => t.id === selectedTargetId);

    const isTest = examMode === 'timed_test';
    const durationMins = isTest ? timerMinutes : undefined;

    const config: QuizConfig = {
      mode: isTest ? 'exam' : 'practice',
      title: `${targetObj?.name || 'MCQ'} ${isTest ? 'Timed Exam' : 'Practice'} (${selected.length} Qs)`,
      targetId: selectedTargetId || undefined,
      subjectIds: [],
      topicIds: topicSelectionMode === 'single' ? (selectedSingleTopicId ? [selectedSingleTopicId] : []) : selectedTopicIds,
      questionCount: selected.length,
      durationMinutes: durationMins,
      marksPerCorrect: 2,
      negativeMarks: 0.4, // Lok Sewa standard 20% deduction
      shuffleQuestions: false, // Already deterministically shuffled once
      shuffleOptions: false,
      immediateFeedback: !isTest,
    };

    await db.quizSessions.put({
      id: sessionId,
      userId: currentUser.id,
      targetId: selectedTargetId || undefined,
      title: config.title,
      mode: config.mode,
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
    <div className="max-w-3xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Header & Quick Action Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">MCQ Practice Room</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single topic drill, multi-topic mix, or full-length timed mock exam.
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
        </div>
      </div>

      {/* Practice Setup Form */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
        {/* 1. Target / Course Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            1. Select Course / Target
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {targets.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTargetId(t.id)}
                className={`p-3.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-3 ${
                  selectedTargetId === t.id
                    ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 text-brand-900 dark:text-brand-100 ring-1 ring-brand-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.color || '#6366f1' }}
                />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Topic Selection Mode */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              2. Syllabus Topic Selection
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setTopicSelectionMode('single')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  topicSelectionMode === 'single'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                One Topic
              </button>
              <button
                type="button"
                onClick={() => setTopicSelectionMode('multi')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  topicSelectionMode === 'multi'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Multiple Topics
              </button>
              <button
                type="button"
                onClick={() => setTopicSelectionMode('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  topicSelectionMode === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                All Topics Mixed
              </button>
            </div>
          </div>

          {/* Single Topic Dropdown */}
          {topicSelectionMode === 'single' && (
            <select
              value={selectedSingleTopicId}
              onChange={e => setSelectedSingleTopicId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              {topics.map(top => (
                <option key={top.id} value={top.id}>{top.name}</option>
              ))}
            </select>
          )}

          {/* Multi-Topic Checkboxes */}
          {topicSelectionMode === 'multi' && (
            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500">{selectedTopicIds.length} of {topics.length} topics selected</span>
                <div className="space-x-2">
                  <button type="button" onClick={handleSelectAllTopics} className="text-brand-600 font-semibold hover:underline">Select All</button>
                  <span className="text-slate-300">•</span>
                  <button type="button" onClick={handleClearAllTopics} className="text-slate-500 font-semibold hover:underline">Clear</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {topics.map(top => {
                  const isChecked = selectedTopicIds.includes(top.id);
                  return (
                    <label
                      key={top.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-300 dark:border-brand-800 font-semibold text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTopicCheckbox(top.id)}
                        className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span className="truncate">{top.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Topics Message */}
          {topicSelectionMode === 'all' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600 shrink-0" />
              <span>Questions will be balanced and selected evenly across all {topics.length} syllabus topics.</span>
            </div>
          )}
        </div>

        {/* 3. Question Count & Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              3. Question Count
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 25, 50].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setQuestionCount(cnt)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    questionCount === cnt
                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {cnt} Qs
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              4. Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExamMode('practice')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left ${
                  examMode === 'practice'
                    ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 text-brand-900 dark:text-brand-100 ring-1 ring-brand-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div>Practice</div>
                <div className="text-[10px] text-slate-400 font-normal">Immediate feedback</div>
              </button>

              <button
                type="button"
                onClick={() => setExamMode('timed_test')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left ${
                  examMode === 'timed_test'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div>Timed Exam</div>
                <div className="text-[10px] text-slate-400 font-normal">45m Countdown clock</div>
              </button>
            </div>
          </div>
        </div>

        {/* Available Pool Summary & Start Button */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Available in selected topic(s): <strong className="text-slate-900 dark:text-white">{questionsPool.length} questions</strong>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto font-bold shadow-md"
            leftIcon={<Play className="w-4 h-4 fill-white" />}
            onClick={handleStartSession}
            disabled={questionsPool.length === 0}
          >
            {examMode === 'timed_test' ? 'Start Timed Exam →' : 'Start Practice →'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
