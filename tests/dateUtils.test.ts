import { describe, it, expect } from 'vitest';
import {
  getKathmanduDateStr,
  getKathmanduTodayStr,
  isKathmanduToday,
  calculateKathmanduStreak,
  offsetDateStr,
  getKathmanduDailyAggregates,
  getKathmanduMonthlyAggregates,
} from '../src/utils/dateUtils';
import type { StudySession, Attempt } from '../src/types';

describe('dateUtils - Asia/Kathmandu & Streak Logic', () => {
  it('should format date in Asia/Kathmandu UTC+5:45 timezone', () => {
    // 2026-08-18 18:30:00 UTC is 2026-08-19 00:15:00 in Kathmandu
    const utcTimestamp = Date.UTC(2026, 7, 18, 18, 30, 0);
    const ktmDate = getKathmanduDateStr(utcTimestamp);
    expect(ktmDate).toBe('2026-08-19');
  });

  it('should calculate streak accurately from completed study days', () => {
    const today = getKathmanduTodayStr();
    const yesterday = offsetDateStr(today, -1);
    const dayBeforeYesterday = offsetDateStr(today, -2);

    const [yT, mT, dT] = today.split('-').map(Number);
    const [yY, mY, dY] = yesterday.split('-').map(Number);
    const [yD, mD, dD] = dayBeforeYesterday.split('-').map(Number);

    // Scenario 1: Studied today, yesterday, and day before yesterday -> 3 day streak
    const sessions3Days: StudySession[] = [
      {
        id: 's1',
        userId: 'u1',
        targetId: 't1',
        startTime: new Date(Date.UTC(yT, mT - 1, dT, 4, 0)).getTime(),
        endTime: new Date(Date.UTC(yT, mT - 1, dT, 5, 0)).getTime(),
        focusedMinutes: 60,
        breakMinutes: 0,
        activityType: 'Reading',
        createdAt: Date.now(),
      },
      {
        id: 's2',
        userId: 'u1',
        targetId: 't1',
        startTime: new Date(Date.UTC(yY, mY - 1, dY, 4, 0)).getTime(),
        endTime: new Date(Date.UTC(yY, mY - 1, dY, 4, 45)).getTime(),
        focusedMinutes: 45,
        breakMinutes: 0,
        activityType: 'Reading',
        createdAt: Date.now(),
      },
      {
        id: 's3',
        userId: 'u1',
        targetId: 't1',
        startTime: new Date(Date.UTC(yD, mD - 1, dD, 4, 0)).getTime(),
        endTime: new Date(Date.UTC(yD, mD - 1, dD, 4, 30)).getTime(),
        focusedMinutes: 30,
        breakMinutes: 0,
        activityType: 'Reading',
        createdAt: Date.now(),
      },
    ];

    expect(calculateKathmanduStreak(sessions3Days)).toBe(3);

    // Scenario 2: Studied yesterday and day before, but has NOT studied yet today morning -> streak is STILL 2!
    const sessionsMorning: StudySession[] = [
      sessions3Days[1],
      sessions3Days[2],
    ];
    expect(calculateKathmanduStreak(sessionsMorning)).toBe(2);

    // Scenario 3: Missed yesterday and has not studied today -> streak is 0
    const sessionsMissed: StudySession[] = [
      sessions3Days[2], // Only studied 2 days ago
    ];
    expect(calculateKathmanduStreak(sessionsMissed)).toBe(0);

    // Scenario 4: Empty history -> streak is 0
    expect(calculateKathmanduStreak([])).toBe(0);
  });

  it('should aggregate daily and monthly metrics without deleting historical data', () => {
    const today = getKathmanduTodayStr();
    const [y, m, d] = today.split('-').map(Number);

    const sessions: StudySession[] = [
      {
        id: 's-today',
        userId: 'u1',
        targetId: 't1',
        startTime: new Date(Date.UTC(y, m - 1, d, 5, 0)).getTime(),
        endTime: new Date(Date.UTC(y, m - 1, d, 6, 30)).getTime(),
        focusedMinutes: 90,
        breakMinutes: 0,
        activityType: 'Reading',
        createdAt: Date.now(),
      },
    ];

    const attempts: Attempt[] = [
      {
        id: 'a1',
        userId: 'u1',
        questionId: 'q1',
        targetId: 't1',
        selectedOptionId: 'B',
        correctOptionId: 'B',
        isCorrect: true,
        isSkipped: false,
        responseTimeMs: 3000,
        mode: 'practice',
        timestamp: new Date(Date.UTC(y, m - 1, d, 5, 30)).getTime(),
      },
    ];

    const daily = getKathmanduDailyAggregates(sessions, attempts, 7);
    expect(daily.length).toBe(7);
    const todayData = daily[daily.length - 1];
    expect(todayData.focusedMinutes).toBe(90);
    expect(todayData.questionsAttempted).toBe(1);
    expect(todayData.accuracy).toBe(100);

    const monthly = getKathmanduMonthlyAggregates(sessions, attempts);
    expect(monthly.length).toBe(1);
    expect(monthly[0].totalMinutes).toBe(90);
    expect(monthly[0].activeDaysCount).toBe(1);
  });
});
