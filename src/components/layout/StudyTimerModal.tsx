import React, { useState } from 'react';
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
  BookOpen,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { StudyActivityType } from '../../types';

export const StudyTimerModal: React.FC = () => {
  const { currentUser } = useUser();
  const {
    isRunning,
    isPaused,
    formattedTime,
    activeTargetId,
    activeTargetName,
    activeSubjectId,
    activeActivityType,
    isModalOpen,
    startSession,
    pauseTimer,
    resumeTimer,
    stopTimer,
    closeModal,
  } = useStudyTimer();

  // User-specific targets and subjects
  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).and(t => !t.isArchived).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activityType, setActivityType] = useState<StudyActivityType>('Reading');

  // Finish session step
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [focusRating, setFocusRating] = useState<number>(4);
  const [completionNotes, setCompletionNotes] = useState<string>('');

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  // Default target selection
  React.useEffect(() => {
    if (!selectedTargetId && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets, selectedTargetId]);

  const handleStart = () => {
    if (!selectedTargetId) return;
    startSession(selectedTargetId, selectedSubjectId || undefined, activityType);
  };

  const handleFinishPrompt = () => {
    pauseTimer();
    setIsFinishing(true);
  };

  const handleConfirmSave = async () => {
    await stopTimer(focusRating, completionNotes);
    setIsFinishing(false);
    setCompletionNotes('');
    closeModal();
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={closeModal}
      title={
        isFinishing
          ? 'Log Completed Session'
          : isRunning
          ? `Studying ${activeTargetName}`
          : 'Start Focused Study'
      }
      size="md"
    >
      <div className="space-y-6">
        {/* CASE 1: Finishing Review Modal */}
        {isFinishing ? (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Time</span>
              <p className="text-3xl font-mono font-bold text-brand-400 mt-1">{formattedTime}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                How focused were you? (1–5)
              </label>
              <div className="flex items-center justify-center gap-2 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFocusRating(rating)}
                    className={`p-2 rounded-xl transition-all ${
                      focusRating >= rating
                        ? 'text-amber-400 bg-amber-500/20 scale-105'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <Star className="w-7 h-7 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                What did you complete? (Optional)
              </label>
              <textarea
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="e.g. Solved 20 networking questions, revised BAFIA section 15..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsFinishing(false);
                  resumeTimer();
                }}
              >
                Resume Timer
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleConfirmSave}
              >
                Save & Complete
              </Button>
            </div>
          </div>
        ) : isRunning ? (
          /* CASE 2: Active Stopwatch Screen */
          <div className="text-center space-y-6 py-4 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Target: {activeTargetName}</span>
            </div>

            <div className="py-4">
              <div className="text-6xl font-mono font-extrabold tracking-tight text-white select-none">
                {formattedTime}
              </div>
              <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{isPaused ? 'Timer Paused' : 'Timer Running'}</span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              {isPaused ? (
                <Button
                  variant="success"
                  size="lg"
                  leftIcon={<Play className="w-5 h-5 fill-current" />}
                  onClick={resumeTimer}
                  className="px-6"
                >
                  Resume
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  leftIcon={<Pause className="w-5 h-5" />}
                  onClick={pauseTimer}
                  className="px-6"
                >
                  Pause
                </Button>
              )}

              <Button
                variant="danger"
                size="lg"
                leftIcon={<Square className="w-5 h-5 fill-current" />}
                onClick={handleFinishPrompt}
                className="px-6"
              >
                Finish Session
              </Button>
            </div>
          </div>
        ) : (
          /* CASE 3: Configure and Start Screen */
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Select Target
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {targets.map(target => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setSelectedTargetId(target.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      selectedTargetId === target.id
                        ? 'border-brand-500 bg-brand-500/10 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: target.color }}
                    />
                    <div className="truncate">
                      <p className="font-semibold text-sm truncate">{target.name}</p>
                      <p className="text-[11px] text-slate-400">{target.dailyGoalMinutes}m daily goal</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {subjects.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Subject (Optional)
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All Subjects / General Study</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Activity
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Reading', 'MCQ Practice', 'Revision'] as StudyActivityType[]).map(act => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setActivityType(act)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      activityType === act
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              leftIcon={<Play className="w-5 h-5 fill-current" />}
              className="w-full mt-4 shadow-lg shadow-brand-500/20"
              onClick={handleStart}
              disabled={!selectedTargetId}
            >
              Start Study
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
