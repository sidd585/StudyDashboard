import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../db';
import { useUser } from './UserContext';
import type { StudyActivityType, Target, Subject } from '../types';

export type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHING' | 'COMPLETED';

export interface ActiveStudySessionRecord {
  id: string;
  userId: string;
  targetId: string;
  targetName: string;
  subjectId?: string | null;
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
  activeTargetId: string | null;
  activeTargetName: string | null;
  activeSubjectId: string | null;
  activeActivityType: StudyActivityType;
  isModalOpen: boolean;
  isLongSession: boolean; // Flag if session running > 6 hours
  startSession: (targetId: string, subjectId?: string, activity?: StudyActivityType) => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (focusRating?: number, notes?: string) => Promise<string | null>;
  openModal: () => void;
  closeModal: () => void;
}

const STORAGE_KEY_PREFIX = 'studydashboard_active_session_';
const StudyTimerContext = createContext<StudyTimerContextType | undefined>(undefined);

/**
 * Computes exact elapsed seconds from timestamps.
 * Elapsed = (Current or Paused Time - startedAt - totalPausedMs) / 1000
 */
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

/**
 * Format total seconds to HH:MM:SS or MM:SS
 */
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

  // Restore active session from persistent localStorage for current user
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

  // Sync state whenever user profile switches
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

  // Persist session changes to localStorage & BroadcastChannel for multi-tab sync
  const persistSession = useCallback((session: ActiveStudySessionRecord | null) => {
    setActiveSession(session);
    if (session) {
      localStorage.setItem(storageKey, JSON.stringify(session));
    } else {
      localStorage.removeItem(storageKey);
    }

    // Broadcast update across open tabs
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('studydashboard_timer_channel');
        channel.postMessage({ type: 'TIMER_SYNC', session, userId: currentUser.id });
        channel.close();
      }
    } catch (e) {
      // Ignore broadcast errors in unsupported environments
    }
  }, [storageKey, currentUser.id]);

  // Listen to external tab sync events
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

  // Master UI refresh ticker: Recalculates elapsed seconds from true timestamps every second
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'RUNNING') {
      if (activeSession && activeSession.status === 'PAUSED') {
        setElapsedSeconds(computeElapsedSeconds(activeSession));
      }
      return;
    }

    // Immediately compute on start/resume
    setElapsedSeconds(computeElapsedSeconds(activeSession));

    const interval = setInterval(() => {
      setElapsedSeconds(computeElapsedSeconds(activeSession));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // 1. START SESSION
  const startSession = async (
    targetId: string,
    subjectId?: string,
    activity: StudyActivityType = 'Reading'
  ) => {
    // If there is already an active running timer on another target, notify user
    if (activeSession && activeSession.status !== 'IDLE' && activeSession.status !== 'COMPLETED') {
      if (activeSession.targetId !== targetId) {
        const confirmSwitch = window.confirm(
          `You are already studying ${activeSession.targetName} (${formatSecondsToTime(elapsedSeconds)} elapsed).\n\nDo you want to finish the current session first?`
        );
        if (!confirmSwitch) return;
        await stopTimer(4, 'Switched to a new target session');
      } else {
        // Same target, open modal
        setIsModalOpen(true);
        return;
      }
    }

    const target = await db.targets.get(targetId);
    const newSession: ActiveStudySessionRecord = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser.id,
      targetId,
      targetName: target?.name || 'Study Target',
      subjectId: subjectId || null,
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

  // 4. STOP / FINISH SESSION (Atomic, Prevents Double-Submissions)
  const stopTimer = async (focusRating: number = 4, notes: string = ''): Promise<string | null> => {
    if (!activeSession || isSaving) return null;

    setIsSaving(true);
    try {
      const now = Date.now();
      const finalElapsed = computeElapsedSeconds(activeSession);
      const focusedMins = Math.max(1, Math.round(finalElapsed / 60));
      const totalPausedMins = Math.round((activeSession.totalPausedMs + (activeSession.pausedAt ? now - activeSession.pausedAt : 0)) / 60000);

      const completedSessionId = activeSession.id;

      // Save permanently to Dexie db.studySessions
      await db.studySessions.put({
        id: completedSessionId,
        userId: currentUser.id,
        targetId: activeSession.targetId,
        subjectId: activeSession.subjectId || undefined,
        activityType: activeSession.activityType,
        startTime: activeSession.startedAt,
        endTime: now,
        focusedMinutes: focusedMins,
        breakMinutes: totalPausedMins,
        focusRating,
        notes: notes.trim() || undefined,
        createdAt: now,
      });

      // Clear active session storage
      persistSession(null);
      setElapsedSeconds(0);
      setIsModalOpen(false);

      return completedSessionId;
    } catch (err) {
      console.error('Failed to save completed study session:', err);
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
        activeTargetId: activeSession?.targetId || null,
        activeTargetName: activeSession?.targetName || null,
        activeSubjectId: activeSession?.subjectId || null,
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
