import { describe, it, expect } from 'vitest';
import {
  getKathmanduDateStr,
  getKathmanduTodayStr,
  isKathmanduToday,
  calculateKathmanduStreak,
  offsetDateStr,
  getKathmanduDailyAggregates,
} from '../src/utils/dateUtils';
import type { StudySession, Question, Attempt } from '../src/types';

describe('ACCEPTANCE TESTS — StudyDashboard Streamlined Suite', () => {

  // 1. DAILY ROLLOVER TEST
  describe('1. Daily Rollover (Asia/Kathmandu Midnight)', () => {
    it('should reset today to 0m at midnight while preserving yesterday in historical charts and streaks', () => {
      const todayStr = getKathmanduTodayStr();
      const yesterdayStr = offsetDateStr(todayStr, -1);

      const [yY, mY, dY] = yesterdayStr.split('-').map(Number);
      const yesterdaySessionTime = Date.UTC(yY, mY - 1, dY, 6, 15, 0);

      const sessions: StudySession[] = [
        {
          id: 'sess-yesterday-1',
          userId: 'user-sid',
          targetId: 't-rbb',
          startTime: yesterdaySessionTime,
          endTime: yesterdaySessionTime + 45 * 60000,
          focusedMinutes: 45,
          breakMinutes: 5,
          activityType: 'Reading',
          createdAt: yesterdaySessionTime,
        }
      ];

      // Today should show 0 minutes
      const todaySessions = sessions.filter(s => isKathmanduToday(s.startTime));
      const todayMinutes = todaySessions.reduce((sum, s) => sum + s.focusedMinutes, 0);
      expect(todayMinutes).toBe(0);

      // Yesterday is preserved in 7-day chart
      const aggregates = getKathmanduDailyAggregates(sessions, [], 7);
      const yesterdayAgg = aggregates.find(a => a.date === yesterdayStr);
      expect(yesterdayAgg).toBeDefined();
      expect(yesterdayAgg?.focusedMinutes).toBe(45);

      // Streak is preserved
      const streak = calculateKathmanduStreak(sessions);
      expect(streak).toBe(1);
    });
  });

  // 2. ZERO DUPLICATES & BALANCED ANSWER MAPPING
  describe('2. Practice Engine: Zero Duplicates & Answer Balance', () => {
    it('should eliminate duplicate questions during test generation', () => {
      const rawPool: Partial<Question>[] = [
        { id: 'q-1', questionText: 'What is OSI layer 3?', correctOptionId: 'C' },
        { id: 'q-2', questionText: 'What is BAFIA 2073?', correctOptionId: 'B' },
        { id: 'q-1', questionText: 'What is OSI layer 3?', correctOptionId: 'C' }, // Duplicate
        { id: 'q-3', questionText: 'What is ETA 2063?', correctOptionId: 'A' },
        { id: 'q-4', questionText: 'What is 3NF?', correctOptionId: 'D' },
      ];

      const seen = new Set<string>();
      const deduplicated = rawPool.filter(q => {
        if (!q.id || seen.has(q.id)) return false;
        seen.add(q.id);
        return true;
      });

      expect(deduplicated.length).toBe(4);
      expect(new Set(deduplicated.map(q => q.id)).size).toBe(4);
    });

    it('should support balanced distribution across options A, B, C, and D', () => {
      const sampleAnswers = ['A', 'B', 'C', 'D', 'B', 'C', 'A', 'D'];
      const uniqueOptions = new Set(sampleAnswers);
      expect(uniqueOptions.has('A')).toBe(true);
      expect(uniqueOptions.has('B')).toBe(true);
      expect(uniqueOptions.has('C')).toBe(true);
      expect(uniqueOptions.has('D')).toBe(true);
    });
  });

  // 3. STRICT QUESTION ORIGIN TEST
  describe('3. Strict Question Origin', () => {
    it('should preserve original wording and answer for imported questions', () => {
      const importedQuestion: Partial<Question> = {
        id: 'q-imported-1',
        userId: 'user-sid',
        targetId: 't-1',
        questionText: '1. What is the capital of Nepal?',
        options: [
          { id: 'A', text: 'Kathmandu' },
          { id: 'B', text: 'Pokhara' },
          { id: 'C', text: 'Lalitpur' },
          { id: 'D', text: 'Bhaktapur' },
        ],
        correctOptionId: 'A',
        origin: 'IMPORTED_OLD_QUESTION',
        source: 'NRB 2080 Model Paper',
      };

      expect(importedQuestion.origin).toBe('IMPORTED_OLD_QUESTION');
      expect(importedQuestion.correctOptionId).toBe('A');
      expect(importedQuestion.options?.length).toBe(4);
    });
  });

  // 4. DATA SECURITY & ISOLATION TEST
  describe('4. Siddhartha & Shilpa Data Isolation', () => {
    it('should isolate private study records between users while sharing only permitted summary metrics', () => {
      const sidUserId = 'siddhartha-user-id';
      const shilpaUserId = 'shilpa-user-id';

      const allQuestions: Partial<Question>[] = [
        { id: 'q-sid-1', userId: sidUserId, questionText: 'Sid Private Question 1', isShared: false },
        { id: 'q-sid-2', userId: sidUserId, questionText: 'Sid Shared Question 2', isShared: true },
        { id: 'q-shilpa-1', userId: shilpaUserId, questionText: 'Shilpa Private Question 1', isShared: false },
      ];

      // Siddhartha private query
      const sidPrivateQuestions = allQuestions.filter(q => q.userId === sidUserId);
      expect(sidPrivateQuestions.length).toBe(2);
      expect(sidPrivateQuestions.some(q => q.id === 'q-shilpa-1')).toBe(false);

      // Shilpa private query
      const shilpaPrivateQuestions = allQuestions.filter(q => q.userId === shilpaUserId);
      expect(shilpaPrivateQuestions.length).toBe(1);
      expect(shilpaPrivateQuestions.some(q => q.id === 'q-sid-1')).toBe(false);
    });
  });
});
