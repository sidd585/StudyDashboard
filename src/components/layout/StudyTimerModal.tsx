import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { useStudyTimer, formatSecondsToTime } from '../../context/StudyTimerContext';
import { courseService } from '../../services/courseService';
import type { CloudCourse, CloudSubject, CloudTopic } from '../../lib/supabase';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  Play,
  Pause,
  Square,
  Star,
  Clock,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import type { StudyActivityType } from '../../types';

interface StudyTimerModalProps {
  onNavigatePractice?: (courseId: string) => void;
}

export const StudyTimerModal: React.FC<StudyTimerModalProps> = ({ onNavigatePractice }) => {
  const { currentUser } = useUser();
  const {
    activeSession,
    isRunning,
    isPaused,
    formattedTime,
    elapsedSeconds,
    activeCourseId,
    activeCourseName,
    activeSubjectName,
    activeTopicName,
    activeLessonName,
    isModalOpen,
    startSession,
    pauseTimer,
    resumeTimer,
    stopTimer,
    closeModal,
  } = useStudyTimer();

  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [subjects, setSubjects] = useState<CloudSubject[]>([]);
  const [topics, setTopics] = useState<CloudTopic[]>([]);
  const [lessons, setLessons] = useState<CloudTopic[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [activityType, setActivityType] = useState<StudyActivityType>('Reading');

  // Finish session state
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [focusRating, setFocusRating] = useState<number>(4);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load courses
  useEffect(() => {
    async function loadCourses() {
      try {
        const loaded = await courseService.getCourses();
        setCourses(loaded);
        if (loaded.length > 0 && !selectedCourseId) {
          setSelectedCourseId(loaded[0].id);
        }
      } catch (err) {
        console.error('Error loading courses in timer:', err);
      }
    }
    if (isModalOpen) {
      loadCourses();
    }
  }, [isModalOpen, currentUser.id]);

  // Load subjects when course changes
  useEffect(() => {
    async function loadSubjects() {
      if (!selectedCourseId) {
        setSubjects([]);
        setSelectedSubjectId('');
        return;
      }
      const loaded = await courseService.getSubjects(selectedCourseId);
      setSubjects(loaded);
      if (loaded.length > 0) {
        setSelectedSubjectId(loaded[0].id);
      } else {
        setSelectedSubjectId('');
      }
    }
    loadSubjects();
  }, [selectedCourseId]);

  // Load topics when subject/course changes
  useEffect(() => {
    async function loadTopics() {
      if (!selectedCourseId) {
        setTopics([]);
        setSelectedTopicId('');
        return;
      }
      const allTopics = await courseService.getTopics(selectedCourseId, selectedSubjectId || undefined);
      // Top level topics have parent_topic_id === null
      const topTopics = allTopics.filter(t => !t.parent_topic_id);
      setTopics(topTopics);
      if (topTopics.length > 0) {
        setSelectedTopicId(topTopics[0].id);
      } else {
        setSelectedTopicId('');
      }
    }
    loadTopics();
  }, [selectedCourseId, selectedSubjectId]);

  // Load child lessons when parent topic changes
  useEffect(() => {
    async function loadLessons() {
      if (!selectedCourseId || !selectedTopicId) {
        setLessons([]);
        setSelectedLessonId('');
        return;
      }
      const allTopics = await courseService.getTopics(selectedCourseId);
      const childLessons = allTopics.filter(t => t.parent_topic_id === selectedTopicId);
      setLessons(childLessons);
      setSelectedLessonId('');
    }
    loadLessons();
  }, [selectedCourseId, selectedTopicId]);

  const handleStart = async () => {
    if (!selectedCourseId) return;
    await startSession(
      selectedCourseId,
      selectedSubjectId || null,
      selectedTopicId || null,
      selectedLessonId || null,
      activityType
    );
  };

  const handleFinishPrompt = () => {
    pauseTimer();
    setIsFinishing(true);
  };

  const handleConfirmSave = async (andPractice: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const courseToPractice = activeCourseId || selectedCourseId;
    try {
      await stopTimer(focusRating, completionNotes);
      setIsFinishing(false);
      setCompletionNotes('');
      if (andPractice && onNavigatePractice && courseToPractice) {
        onNavigatePractice(courseToPractice);
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
          ? `Focus Session: ${activeCourseName || 'Course'}`
          : 'Start Focus Session'
      }
      size="md"
    >
      <div className="space-y-6 text-[#172033] dark:text-[#f8f9fc]">
        {/* CASE 1: Finishing Review & Save */}
        {isFinishing ? (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 bg-[#f4fbf7] dark:bg-[#122820] rounded-2xl border border-emerald-500/30 text-center space-y-1">
              <span className="text-2xl">🎉</span>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Session Completed!
              </h3>
              <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                You focused on <strong className="text-[#172033] dark:text-white">{activeCourseName}</strong> for{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm">{formattedTime}</strong>
              </p>
              {activeTopicName && (
                <p className="text-[11px] text-[#5b5bd6] dark:text-[#8282ea] font-semibold">
                  Topic: {activeTopicName}
                </p>
              )}
              <div className="text-[11px] text-[#64748b] pt-1">
                Started at {startTimeDisplay}
              </div>
            </div>

            {/* Focus Rating */}
            <div>
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-2 text-center">
                How focused were you? (1–5 Stars)
              </label>
              <div className="flex items-center justify-center gap-2 p-3 bg-[#f8fafc] dark:bg-[#181d2f] rounded-xl border border-[#e2e8f0] dark:border-[#23293d]">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFocusRating(rating)}
                    className="p-1.5 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        rating <= focusRating
                          ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                          : 'text-[#cbd5e1] dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Completion Note */}
            <div>
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1.5">
                Study Note (Optional)
              </label>
              <textarea
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="What topics or questions did you cover in this session?"
                className="w-full h-20 px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] focus:border-[#5b5bd6] outline-none resize-none transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white dark:bg-[#181d2f] text-[#64748b]"
                onClick={() => setIsFinishing(false)}
                disabled={isSubmitting}
              >
                Resume
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
                onClick={() => handleConfirmSave(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Session'}
              </Button>
            </div>
          </div>
        ) : hasActiveSession ? (
          /* CASE 2: Active Session Screen */
          <div className="space-y-6 animate-fade-in text-center">
            {/* Header info */}
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#5b5bd6]/10 text-[#5b5bd6] dark:text-[#8282ea] text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{activeCourseName || 'Course'}</span>
              </div>
              {activeSubjectName && (
                <p className="text-xs text-[#64748b] dark:text-[#9496a8] font-medium">{activeSubjectName}</p>
              )}
              {activeTopicName && (
                <p className="text-xs font-semibold text-[#172033] dark:text-white">
                  Topic: {activeTopicName} {activeLessonName ? `· ${activeLessonName}` : ''}
                </p>
              )}
            </div>

            {/* Big Timer Display */}
            <div className="p-8 rounded-2xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] shadow-inner">
              <div className="font-mono text-5xl sm:text-6xl font-black tracking-tight text-[#172033] dark:text-white">
                {formattedTime}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
                  {isRunning ? 'Focused & Tracking' : 'Session Paused'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {isRunning ? (
                <Button
                  variant="outline"
                  size="md"
                  className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold"
                  leftIcon={<Pause className="w-4 h-4 fill-current" />}
                  onClick={pauseTimer}
                >
                  Pause
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  leftIcon={<Play className="w-4 h-4 fill-current" />}
                  onClick={resumeTimer}
                >
                  Resume
                </Button>
              )}

              <Button
                variant="primary"
                size="md"
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
                leftIcon={<Square className="w-4 h-4 fill-current" />}
                onClick={handleFinishPrompt}
              >
                Finish Session
              </Button>
            </div>
          </div>
        ) : (
          /* CASE 3: Start New Focus Form */
          <div className="space-y-4 animate-fade-in">
            {/* 1. Course */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                {courses.length === 0 && <option value="">No courses created yet</option>}
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.year ? `(${c.year})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Subject / Paper */}
            {subjects.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                  Select Subject / Paper
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  <option value="">All Subjects / General</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Topic */}
            {topics.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                  Select Topic
                </label>
                <select
                  value={selectedTopicId}
                  onChange={e => setSelectedTopicId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  <option value="">Whole Subject / General</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code ? `${t.code}. ` : ''}{t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 4. Lesson (Optional) */}
            {lessons.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                  Select Lesson (Optional)
                </label>
                <select
                  value={selectedLessonId}
                  onChange={e => setSelectedLessonId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  <option value="">All Lessons in Topic</option>
                  {lessons.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.code ? `${l.code} ` : ''}{l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 5. Activity Type */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                Activity
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Reading', 'MCQ Practice', 'Revision'] as StudyActivityType[]).map(act => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setActivityType(act)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      activityType === act
                        ? 'bg-[#5b5bd6] text-white shadow-xs'
                        : 'bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#64748b] hover:text-[#172033] dark:hover:text-white'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-sm"
                leftIcon={<Play className="w-4 h-4 fill-white" />}
                onClick={handleStart}
                disabled={!selectedCourseId}
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
