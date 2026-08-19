import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useUser } from '../../context/UserContext';
import { useStudyTimer } from '../../context/StudyTimerContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  Play,
  Pause,
  Square,
  Star,
  Clock,
  Sparkles,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import type { StudyActivityType } from '../../types';

interface StudyTimerModalProps {
  onNavigatePractice?: (targetId: string) => void;
}

export const StudyTimerModal: React.FC<StudyTimerModalProps> = ({ onNavigatePractice }) => {
  const { currentUser } = useUser();
  const {
    activeSession,
    isRunning,
    isPaused,
    formattedTime,
    activeTargetId,
    activeTargetName,
    isModalOpen,
    isLongSession,
    startSession,
    pauseTimer,
    resumeTimer,
    stopTimer,
    closeModal,
  } = useStudyTimer();

  // User targets
  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).and(t => !t.isArchived).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [activityType, setActivityType] = useState<StudyActivityType>('Reading');

  // Finish session state
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [focusRating, setFocusRating] = useState<number>(4);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  const topics = useLiveQuery(
    () => (selectedSubjectId ? db.topics.where('subjectId').equals(selectedSubjectId).toArray() : []),
    [selectedSubjectId]
  ) || [];

  // Default target selection
  useEffect(() => {
    if (!selectedTargetId && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets, selectedTargetId]);

  const handleStart = async () => {
    if (!selectedTargetId) return;
    await startSession(selectedTargetId, selectedSubjectId || undefined, activityType);
  };

  const handleFinishPrompt = () => {
    pauseTimer();
    setIsFinishing(true);
  };

  const handleConfirmSave = async (andPractice: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const targetToPractice = activeTargetId || selectedTargetId;
    try {
      await stopTimer(focusRating, completionNotes);
      setIsFinishing(false);
      setCompletionNotes('');
      if (andPractice && onNavigatePractice && targetToPractice) {
        onNavigatePractice(targetToPractice);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasActiveSession = !!activeSession && (activeSession.status === 'RUNNING' || activeSession.status === 'PAUSED');

  const startTimeDisplay = activeSession?.startedAt
    ? new Date(activeSession.startedAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={closeModal}
      title={
        isFinishing
          ? 'Finish Focus Session'
          : hasActiveSession
          ? `Focus Session: ${activeTargetName || 'Target'}`
          : 'Start Focus Session'
      }
      size="md"
    >
      <div className="space-y-6">
        {/* CASE 1: Finishing Celebration & Review Screen */}
        {isFinishing ? (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-brand-500/10 to-slate-900 rounded-2xl border border-emerald-500/30 text-center space-y-1">
              <span className="text-xl">🎉</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Great work! Session Completed.
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You focused on <strong className="text-slate-900 dark:text-white">{activeTargetName}</strong> for{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formattedTime}</strong>
              </p>
              <div className="text-[11px] text-slate-400 pt-1">
                Started at {startTimeDisplay}
              </div>
            </div>

            {/* Focus Rating */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
                How focused were you? (1–5 Stars)
              </label>
              <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFocusRating(rating)}
                    className={`p-2 rounded-xl transition-all ${
                      focusRating >= rating
                        ? 'text-amber-500 bg-amber-500/20 scale-105'
                        : 'text-slate-400 dark:text-slate-600 hover:text-slate-500'
                    }`}
                  >
                    <Star className="w-6 h-6 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                What did you complete? (Optional Notes)
              </label>
              <textarea
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="e.g. Completed Chapter 4, reviewed 25 past questions..."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button
                variant="primary"
                className="w-full"
                disabled={isSubmitting}
                leftIcon={<BookOpen className="w-4 h-4" />}
                onClick={() => handleConfirmSave(true)}
              >
                {isSubmitting ? 'Saving...' : 'Practice This Topic Now'}
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => {
                    setIsFinishing(false);
                    resumeTimer();
                  }}
                >
                  Resume Timer
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => handleConfirmSave(false)}
                >
                  Finish & Save
                </Button>
              </div>
            </div>
          </div>
        ) : hasActiveSession ? (
          /* CASE 2: Active Stopwatch Screen (Running or Paused) */
          <div className="text-center space-y-6 py-3 animate-fade-in">
            {isLongSession && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>This session has been active for over 6 hours.</span>
              </div>
            )}

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-600 dark:text-brand-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Target: {activeTargetName}</span>
            </div>

            <div className="py-2">
              <div className="text-6xl font-mono font-extrabold tracking-tight text-slate-900 dark:text-white select-none">
                {formattedTime}
              </div>
              <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{isPaused ? '❚❚ Timer Paused' : '● Timer Running in Background'}</span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              {isPaused ? (
                <Button
                  variant="success"
                  size="md"
                  leftIcon={<Play className="w-4 h-4 fill-current" />}
                  onClick={resumeTimer}
                  className="px-6"
                >
                  Resume
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Pause className="w-4 h-4" />}
                  onClick={pauseTimer}
                  className="px-6"
                >
                  Pause
                </Button>
              )}

              <Button
                variant="danger"
                size="md"
                leftIcon={<Square className="w-4 h-4 fill-current" />}
                onClick={handleFinishPrompt}
                className="px-6"
              >
                Finish Session
              </Button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <p className="text-[11px] text-slate-400">
                You can close (✕) this popup and study freely. The timer continues running in the header.
              </p>
            </div>
          </div>
        ) : (
          /* CASE 3: Start Focus Session Configuration */
          <div className="space-y-4 animate-fade-in">
            {/* 1. Target Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
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
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedTargetId === target.id
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-slate-900 dark:text-white ring-1 ring-brand-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{target.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{target.dailyGoalMinutes ? `${target.dailyGoalMinutes}m daily goal` : 'Active Target'}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Subject & Topic Selection */}
            {subjects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Subject (Optional)
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
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
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

            {/* 3. Activity Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Activity Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Reading', 'MCQ Practice', 'Revision'] as StudyActivityType[]).map(act => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setActivityType(act)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      activityType === act
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                leftIcon={<Play className="w-4 h-4 fill-current" />}
                disabled={!selectedTargetId}
                onClick={handleStart}
              >
                Start Focus Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
