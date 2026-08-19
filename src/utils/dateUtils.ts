import type { StudySession, Attempt } from '../types';

export const KATHMANDU_TZ = 'Asia/Kathmandu';

/**
 * Returns YYYY-MM-DD in Asia/Kathmandu timezone (UTC+5:45).
 */
export function getKathmanduDateStr(dateOrTimestamp: number | Date = Date.now()): string {
  const d = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp) : dateOrTimestamp;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KATHMANDU_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Returns today's YYYY-MM-DD string in Asia/Kathmandu.
 */
export function getKathmanduTodayStr(): string {
  return getKathmanduDateStr(Date.now());
}

/**
 * Checks if a given timestamp belongs to today in Asia/Kathmandu.
 */
export function isKathmanduToday(dateOrTimestamp: number | Date): boolean {
  return getKathmanduDateStr(dateOrTimestamp) === getKathmanduTodayStr();
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string in local/Kathmandu space.
 */
export function offsetDateStr(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

/**
 * Calculates study streak from actual historical sessions in Asia/Kathmandu.
 * - If user studied today: streak includes today and consecutive preceding days.
 * - If user hasn't studied today yet: streak is preserved from yesterday's streak.
 * - If user missed yesterday: streak is 0.
 */
export function calculateKathmanduStreak(sessions: StudySession[]): number {
  if (!sessions || sessions.length === 0) return 0;

  // Set of all distinct study dates (YYYY-MM-DD) with actual study minutes
  const studyDates = new Set<string>();
  for (const s of sessions) {
    if (s.focusedMinutes > 0 || (s.endTime && s.endTime > s.startTime)) {
      studyDates.add(getKathmanduDateStr(s.startTime));
    }
  }

  if (studyDates.size === 0) return 0;

  const today = getKathmanduTodayStr();
  const yesterday = offsetDateStr(today, -1);

  let currentCheckDate: string;
  let streak = 0;

  if (studyDates.has(today)) {
    // User already studied today
    currentCheckDate = today;
  } else if (studyDates.has(yesterday)) {
    // User studied yesterday, streak is active today pending study
    currentCheckDate = yesterday;
  } else {
    // Missed yesterday and hasn't studied today -> 0 streak
    return 0;
  }

  // Count backwards consecutively
  while (studyDates.has(currentCheckDate)) {
    streak++;
    currentCheckDate = offsetDateStr(currentCheckDate, -1);
  }

  return streak;
}

export interface DayMetric {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Sun", "Mon"
  formattedDate: string; // e.g. "Aug 18"
  focusedMinutes: number;
  focusedHoursFormatted: string; // e.g. "1h 30m"
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number; // 0 - 100
}

/**
 * Aggregates study sessions and MCQ attempts for the last N calendar days in Asia/Kathmandu.
 */
export function getKathmanduDailyAggregates(
  sessions: StudySession[],
  attempts: Attempt[],
  daysCount = 7
): DayMetric[] {
  const todayStr = getKathmanduTodayStr();
  const result: DayMetric[] = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDateStr = offsetDateStr(todayStr, -i);
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));

    const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(dateObj);
    const formattedDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(dateObj);

    // Sessions for this specific date
    const daySessions = sessions.filter(s => getKathmanduDateStr(s.startTime) === targetDateStr);
    const focusedMinutes = daySessions.reduce((acc, s) => acc + (s.focusedMinutes || 0), 0);

    const hours = Math.floor(focusedMinutes / 60);
    const mins = focusedMinutes % 60;
    const focusedHoursFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    // MCQ attempts for this date
    const dayAttempts = attempts.filter(a => getKathmanduDateStr(a.timestamp) === targetDateStr);
    const questionsAttempted = dayAttempts.length;
    const questionsCorrect = dayAttempts.filter(a => a.isCorrect).length;
    const accuracy = questionsAttempted > 0 ? Math.round((questionsCorrect / questionsAttempted) * 100) : 0;

    result.push({
      date: targetDateStr,
      dayLabel,
      formattedDate,
      focusedMinutes,
      focusedHoursFormatted,
      questionsAttempted,
      questionsCorrect,
      accuracy,
    });
  }

  return result;
}

export interface MonthlyMetric {
  monthKey: string; // e.g. "2026-08"
  monthLabel: string; // e.g. "August 2026"
  totalMinutes: number;
  totalHoursFormatted: string;
  totalAttempts: number;
  totalCorrect: number;
  accuracy: number;
  activeDaysCount: number;
}

/**
 * Aggregates monthly study sessions and MCQ attempts.
 */
export function getKathmanduMonthlyAggregates(
  sessions: StudySession[],
  attempts: Attempt[]
): MonthlyMetric[] {
  const monthMap = new Map<string, {
    minutes: number;
    attempts: number;
    correct: number;
    days: Set<string>;
  }>();

  for (const s of sessions) {
    const dateStr = getKathmanduDateStr(s.startTime);
    const monthKey = dateStr.substring(0, 7); // YYYY-MM
    const current = monthMap.get(monthKey) || { minutes: 0, attempts: 0, correct: 0, days: new Set<string>() };
    current.minutes += s.focusedMinutes || 0;
    current.days.add(dateStr);
    monthMap.set(monthKey, current);
  }

  for (const a of attempts) {
    const dateStr = getKathmanduDateStr(a.timestamp);
    const monthKey = dateStr.substring(0, 7);
    const current = monthMap.get(monthKey) || { minutes: 0, attempts: 0, correct: 0, days: new Set<string>() };
    current.attempts += 1;
    if (a.isCorrect) current.correct += 1;
    monthMap.set(monthKey, current);
  }

  const result: MonthlyMetric[] = [];
  const sortedMonths = Array.from(monthMap.keys()).sort();

  for (const mKey of sortedMonths) {
    const data = monthMap.get(mKey)!;
    const [y, m] = mKey.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, 1));
    const monthLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(dateObj);

    const hours = Math.floor(data.minutes / 60);
    const mins = data.minutes % 60;
    const totalHoursFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    const accuracy = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;

    result.push({
      monthKey: mKey,
      monthLabel,
      totalMinutes: data.minutes,
      totalHoursFormatted,
      totalAttempts: data.attempts,
      totalCorrect: data.correct,
      accuracy,
      activeDaysCount: data.days.size,
    });
  }

  return result;
}
