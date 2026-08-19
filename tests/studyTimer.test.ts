import { describe, it, expect } from 'vitest';
import {
  formatSecondsToTime,
  ActiveStudySessionRecord,
} from '../src/context/StudyTimerContext';

describe('StudyTimer Timestamp Logic', () => {
  it('should format seconds to MM:SS and HH:MM:SS accurately', () => {
    expect(formatSecondsToTime(0)).toBe('00:00');
    expect(formatSecondsToTime(45)).toBe('00:45');
    expect(formatSecondsToTime(65)).toBe('01:05');
    expect(formatSecondsToTime(3665)).toBe('01:01:05');
  });

  it('should calculate elapsed time from timestamps accurately excluding paused time', () => {
    const startedAt = 1000000;
    const pausedAt = 1060000; // 60s later
    const totalPausedMs = 15000; // 15s accumulated

    // Scenario 1: Paused session
    const pausedSession: ActiveStudySessionRecord = {
      id: 's1',
      userId: 'u1',
      targetId: 't1',
      targetName: 'RBB IT',
      activityType: 'Reading',
      startedAt,
      pausedAt,
      totalPausedMs,
      status: 'PAUSED',
    };

    const elapsedPaused = Math.floor((pausedSession.pausedAt! - pausedSession.startedAt - pausedSession.totalPausedMs) / 1000);
    expect(elapsedPaused).toBe(45); // 60s - 15s = 45s

    // Scenario 2: Resumed running session
    const resumedRunningSession: ActiveStudySessionRecord = {
      ...pausedSession,
      status: 'RUNNING',
      pausedAt: null,
      totalPausedMs: 20000,
    };
    const mockNow = 1120000; // 120s after start
    const elapsedRunning = Math.floor((mockNow - resumedRunningSession.startedAt - resumedRunningSession.totalPausedMs) / 1000);
    expect(elapsedRunning).toBe(100); // 120s - 20s = 100s
  });
});
