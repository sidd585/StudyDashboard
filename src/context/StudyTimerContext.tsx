import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { useUser } from './UserContext';
import type { StudyActivityType, Target, Subject } from '../types';

interface StudyTimerContextType {
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  formattedTime: string;
  activeTargetId: string | null;
  activeTargetName: string | null;
  activeSubjectId: string | null;
  activeActivityType: StudyActivityType;
  isModalOpen: boolean;
  startSession: (targetId: string, subjectId?: string, activity?: StudyActivityType) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (focusRating?: number, notes?: string) => Promise<string | null>;
  openModal: () => void;
  closeModal: () => void;
}

const StudyTimerContext = createContext<StudyTimerContextType | undefined>(undefined);

export const StudyTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useUser();
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [pausedSeconds, setPausedSeconds] = useState<number>(0);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [activeTargetName, setActiveTargetName] = useState<string | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeActivityType, setActiveActivityType] = useState<StudyActivityType>('Reading');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Format HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  };

  useEffect(() => {
    if (isRunning && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRunning, isPaused]);

  const startSession = async (targetId: string, subjectId?: string, activity: StudyActivityType = 'Reading') => {
    const target = await db.targets.get(targetId);
    setActiveTargetId(targetId);
    setActiveTargetName(target?.name || 'Study Target');
    setActiveSubjectId(subjectId || null);
    setActiveActivityType(activity);
    setElapsedSeconds(0);
    setPausedSeconds(0);
    setIsRunning(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
  };

  const pauseTimer = () => {
    if (isRunning && !isPaused) {
      setIsPaused(true);
    }
  };

  const resumeTimer = () => {
    if (isRunning && isPaused) {
      setIsPaused(false);
    }
  };

  const stopTimer = async (focusRating: number = 4, notes: string = ''): Promise<string | null> => {
    if (!isRunning || !activeTargetId) {
      setIsRunning(false);
      setIsPaused(false);
      return null;
    }

    const endTime = Date.now();
    const startTime = startTimeRef.current || (endTime - elapsedSeconds * 1000);
    const focusedMins = Math.max(1, Math.round(elapsedSeconds / 60));
    const sessionId = `session-${Date.now()}`;

    await db.studySessions.put({
      id: sessionId,
      userId: currentUser.id,
      targetId: activeTargetId,
      subjectId: activeSubjectId || undefined,
      activityType: activeActivityType,
      startTime,
      endTime,
      focusedMinutes: focusedMins,
      breakMinutes: Math.round(pausedSeconds / 60),
      focusRating,
      notes: notes || undefined,
      createdAt: Date.now(),
    });

    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setPausedSeconds(0);
    setActiveTargetId(null);
    setActiveTargetName(null);
    setActiveSubjectId(null);
    setIsModalOpen(false);

    return sessionId;
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <StudyTimerContext.Provider
      value={{
        isRunning,
        isPaused,
        elapsedSeconds,
        formattedTime: formatTime(elapsedSeconds),
        activeTargetId,
        activeTargetName,
        activeSubjectId,
        activeActivityType,
        isModalOpen,
        startSession,
        pauseTimer,
        resumeTimer,
        stopTimer,
        openModal,
        closeModal,
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
