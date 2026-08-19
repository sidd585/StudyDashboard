import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from './UserContext';
import { studySessionService } from '../services/studySessionService';
import { courseService } from '../services/courseService';
import type { StudyActivityType } from '../types';

export type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHING' | 'COMPLETED';

export interface ActiveStudySessionRecord {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  subjectId?: string | null;
  subjectName?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  lessonId?: string | null;
  lessonName?: string | null;
  activityType: StudyActivityType;
  startedAt: number; // Timestamp ms
  pausedAt: number | null; // Timestamp ms if currently paused
  totalPausedMs: number; // Accumulated paused ms
  status: TimerStatus;
}

interface StudyTimerContextType {
  activeSession: ActiveStudySessionRecord | null;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  formattedTime: string;
  activeCourseId: string | null;
  activeCourseName: string | null;
  activeSubjectId: string | null;
  activeSubjectName: string | null;
  activeTopicId: string | null;
  activeTopicName: string | null;
  activeLessonId: string | null;
  activeLessonName: string | null;
  activeActivityType: StudyActivityType;
  isModalOpen: boolean;
  isLongSession: boolean;
  startSession: (
    courseId: string,
    subjectId?: string | null,
    topicId?: string | null,
    lessonId?: string | null,
    activity?: StudyActivityType
  ) => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (focusRating?: number, notes?: string) => Promise<string | null>;
  openModal: () => void;
  closeModal: () => void;
}

const STORAGE_KEY_PREFIX = 'studydashboard_active_session_';
const StudyTimerContext = createContext<StudyTimerContextType | undefined>(undefined);

function computeElapsedSeconds(session: ActiveStudySessionRecord | null): number {
  if (!session || session.status === 'IDLE' || session.status === 'COMPLETED') {
    return 0;
  }

  if (session.status === 'PAUSED' && session.pausedAt) {
    const elapsedMs = Math.max(0, session.pausedAt - session.startedAt - session.totalPausedMs);
    return Math.floor(elapsedMs / 1000);
  }

  const elapsedMs = Math.max(0, Date.now() - session.startedAt - session.totalPausedMs);
  return Math.floor(elapsedMs / 1000);
}

export function formatSecondsToTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export const StudyTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useUser();
  const storageKey = `${STORAGE_KEY_PREFIX}${currentUser.id}`;

  const [activeSession, setActiveSession] = useState<ActiveStudySessionRecord | null>(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${currentUser.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.userId === currentUser.id && parsed.status !== 'COMPLETED' && parsed.status !== 'IDLE') {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load active study session:', e);
    }
    return null;
  });

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => computeElapsedSeconds(activeSession));
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync state whenever user switches
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${currentUser.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.userId === currentUser.id && parsed.status !== 'COMPLETED' && parsed.status !== 'IDLE') {
          setActiveSession(parsed);
          setElapsedSeconds(computeElapsedSeconds(parsed));
          return;
        }
      }
    } catch (e) {
      console.error('User switch timer load error:', e);
    }
    setActiveSession(null);
    setElapsedSeconds(0);
  }, [currentUser.id]);

  const persistSession = useCallback((session: ActiveStudySessionRecord | null) => {
    setActiveSession(session);
    if (session) {
      localStorage.setItem(storageKey, JSON.stringify(session));
    } else {
      localStorage.removeItem(storageKey);
    }

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('studydashboard_timer_channel');
        channel.postMessage({ type: 'TIMER_SYNC', session, userId: currentUser.id });
        channel.close();
      }
    } catch {}
  }, [storageKey, currentUser.id]);

  // Tab sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setActiveSession(parsed);
          } catch {}
        } else {
          setActiveSession(null);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  // Master UI refresh ticker: Recalculates elapsed seconds from true timestamps locally every second
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'RUNNING') {
      if (activeSession && activeSession.status === 'PAUSED') {
        setElapsedSeconds(computeElapsedSeconds(activeSession));
      }
      return;
    }

    setElapsedSeconds(computeElapsedSeconds(activeSession));

    const interval = setInterval(() => {
      setElapsedSeconds(computeElapsedSeconds(activeSession));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // 1. START SESSION
  const startSession = async (
    courseId: string,
    subjectId?: string | null,
    topicId?: string | null,
    lessonId?: string | null,
    activity: StudyActivityType = 'Reading'
  ) => {
    if (activeSession && activeSession.status !== 'IDLE' && activeSession.status !== 'COMPLETED') {
      if (activeSession.courseId !== courseId) {
        const confirmSwitch = window.confirm(
          `You are already studying ${activeSession.courseName} (${formatSecondsToTime(elapsedSeconds)} elapsed).\n\nDo you want to finish the current session first?`
        );
        if (!confirmSwitch) return;
        await stopTimer(4, 'Switched to a new course session');
      } else {
        setIsModalOpen(true);
        return;
      }
    }

    // Resolve human names
    let courseName = 'Course';
    let subjectName: string | null = null;
    let topicName: string | null = null;
    let lessonName: string | null = null;

    try {
      const courses = await courseService.getCourses();
      const matchCourse = courses.find(c => c.id === courseId);
      if (matchCourse) courseName = matchCourse.name;

      if (subjectId) {
        const subjects = await courseService.getSubjects(courseId);
        const matchSub = subjects.find(s => s.id === subjectId);
        if (matchSub) subjectName = matchSub.name;
      }

      if (topicId) {
        const topics = await courseService.getTopics(courseId);
        const matchTop = topics.find(t => t.id === topicId);
        if (matchTop) topicName = matchTop.name;
      }

      if (lessonId) {
        const topics = await courseService.getTopics(courseId);
        const matchLes = topics.find(t => t.id === lessonId);
        if (matchLes) lessonName = matchLes.name;
      }
    } catch (e) {
      console.warn('Could not fetch name metadata for timer:', e);
    }

    const newSession: ActiveStudySessionRecord = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser.id,
      courseId,
      courseName,
      subjectId: subjectId || null,
      subjectName,
      topicId: topicId || null,
      topicName,
      lessonId: lessonId || null,
      lessonName,
      activityType: activity,
      startedAt: Date.now(),
      pausedAt: null,
      totalPausedMs: 0,
      status: 'RUNNING',
    };

    persistSession(newSession);
    setIsModalOpen(true);
  };

  // 2. PAUSE TIMER
  const pauseTimer = () => {
    if (!activeSession || activeSession.status !== 'RUNNING') return;

    const updated: ActiveStudySessionRecord = {
      ...activeSession,
      status: 'PAUSED',
      pausedAt: Date.now(),
    };

    persistSession(updated);
  };

  // 3. RESUME TIMER
  const resumeTimer = () => {
    if (!activeSession || activeSession.status !== 'PAUSED' || !activeSession.pausedAt) return;

    const pausedDuration = Math.max(0, Date.now() - activeSession.pausedAt);
    const updated: ActiveStudySessionRecord = {
      ...activeSession,
      status: 'RUNNING',
      pausedAt: null,
      totalPausedMs: activeSession.totalPausedMs + pausedDuration,
    };

    persistSession(updated);
  };

  // 4. STOP / FINISH SESSION
  const stopTimer = async (focusRating: number = 4, notes: string = ''): Promise<string | null> => {
    if (!activeSession || isSaving) return null;

    setIsSaving(true);
    try {
      const finalElapsed = computeElapsedSeconds(activeSession);
      const durationSeconds = Math.max(10, finalElapsed);

      // Save permanently to Supabase study_sessions
      const saved = await studySessionService.recordCompletedSession(
        activeSession.courseId,
        durationSeconds,
        activeSession.topicId || undefined,
        notes.trim() || undefined
      );

      persistSession(null);
      setElapsedSeconds(0);
      setIsModalOpen(false);

      return saved?.id || activeSession.id;
    } catch (err) {
      console.error('Failed to save completed study session in cloud:', err);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const isRunning = activeSession?.status === 'RUNNING';
  const isPaused = activeSession?.status === 'PAUSED';
  const isLongSession = elapsedSeconds > 21600; // > 6 hours

  return (
    <StudyTimerContext.Provider
      value={{
        activeSession,
        isRunning,
        isPaused,
        elapsedSeconds,
        formattedTime: formatSecondsToTime(elapsedSeconds),
        activeCourseId: activeSession?.courseId || null,
        activeCourseName: activeSession?.courseName || null,
        activeSubjectId: activeSession?.subjectId || null,
        activeSubjectName: activeSession?.subjectName || null,
        activeTopicId: activeSession?.topicId || null,
        activeTopicName: activeSession?.topicName || null,
        activeLessonId: activeSession?.lessonId || null,
        activeLessonName: activeSession?.lessonName || null,
        activeActivityType: activeSession?.activityType || 'Reading',
        isModalOpen,
        isLongSession,
        startSession,
        pauseTimer,
        resumeTimer,
        stopTimer,
        openModal: () => setIsModalOpen(true),
        closeModal: () => setIsModalOpen(false),
      }}
    >
      {children}
    </StudyTimerContext.Provider>
  );
};

export const useStudyTimer = (): StudyTimerContextType => {
  const context = useContext(StudyTimerContext);
  if (!context) {
    throw new Error('useStudyTimer must be used within a StudyTimerProvider');
  }
  return context;
};
