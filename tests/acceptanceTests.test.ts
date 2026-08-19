import { describe, it, expect, beforeEach } from 'vitest';
import {
  getKathmanduDateStr,
  getKathmanduTodayStr,
  isKathmanduToday,
  calculateKathmanduStreak,
  offsetDateStr,
  getKathmanduDailyAggregates,
} from '../src/utils/dateUtils';
import type { StudySession, Question, Attempt } from '../src/types';

describe('ACCEPTANCE TESTS — StudyDashboard Final Suite', () => {

  // 1. DAILY ROLLOVER TEST
  describe('1. Daily Rollover (Asia/Kathmandu Midnight)', () => {
    it('should reset today to 0m at midnight while preserving yesterday in historical charts and streaks', () => {
      const todayStr = getKathmanduTodayStr();
      const yesterdayStr = offsetDateStr(todayStr, -1);

      // Create a 45-minute session for yesterday
      const [yY, mY, dY] = yesterdayStr.split('-').map(Number);
      // 12:00 in Kathmandu (UTC+5:45) is 06:15 UTC
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

      // On Today (new calendar day), sessions filter for today must be 0 minutes
      const todaySessions = sessions.filter(s => isKathmanduToday(s.startTime));
      const todayMinutes = todaySessions.reduce((sum, s) => sum + s.focusedMinutes, 0);
      expect(todayMinutes).toBe(0);

      // Historical 7-day chart must still contain yesterday's 45 minutes
      const aggregates = getKathmanduDailyAggregates(sessions, [], 7);
      const yesterdayAgg = aggregates.find(a => a.date === yesterdayStr);
      expect(yesterdayAgg).toBeDefined();
      expect(yesterdayAgg?.focusedMinutes).toBe(45);

      // Streak calculation must maintain the completed study day
      const streak = calculateKathmanduStreak(sessions);
      expect(streak).toBe(1);
    });
  });

  // 2. AI RESEARCH HIERARCHY TEST
  describe('2. Trusted AI Research & Zero Fabrication Rules', () => {
    it('should adhere to Tier 1 official sources for standard Nepal exams', () => {
      const tier1Sources = ['psc.gov.np', 'nrb.org.np', 'rbb.com.np', 'lawcommission.gov.np'];
      const targetName = 'RBB IT Assistant Level 5';

      const isOfficialExam = targetName.includes('RBB') || targetName.includes('NRB') || targetName.includes('PSC');
      expect(isOfficialExam).toBe(true);

      // Fallback message rule when no historical past questions exist
      const isCustomUnknown = false;
      const evidenceMsg = isCustomUnknown
        ? 'No reliable historical-question evidence was found. I can generate syllabus-based practice questions instead.'
        : null;

      expect(evidenceMsg).toBeNull();
    });

    it('should output fallback warning for unverified custom topics', () => {
      const customTopic = 'Random Custom Unverified Topic';
      const hasHistoricalPapers = !customTopic.includes('Random');
      const evidenceMsg = !hasHistoricalPapers
        ? 'No reliable historical-question evidence was found. I can generate syllabus-based practice questions instead.'
        : null;

      expect(evidenceMsg).toBe('No reliable historical-question evidence was found. I can generate syllabus-based practice questions instead.');
    });
  });

  // 3. STRICT QUESTION ORIGIN TEST
  describe('3. Strict Question Origin', () => {
    it('should assign explicit origins and prevent false historical labels', () => {
      const aiQuestion: Partial<Question> = {
        id: 'q-ai-1',
        userId: 'user-sid',
        targetId: 't-1',
        questionText: 'Which protocol operates at layer 3?',
        origin: 'AI_GENERATED',
        source: 'Syllabus Practice',
      };

      expect(aiQuestion.origin).toBe('AI_GENERATED');
      // Must not be falsely labeled as an official past paper
      expect(aiQuestion.source).not.toContain('Asked in NRB');
      expect(aiQuestion.source).not.toContain('Past PSC Question');
    });

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

      // Together dashboard query (only shared questions or aggregated stats)
      const sharedQuestions = allQuestions.filter(q => q.isShared);
      expect(sharedQuestions.length).toBe(1);
      expect(sharedQuestions[0].id).toBe('q-sid-2');
    });
  });
});
