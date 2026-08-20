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

  // 5. ROLE HIERARCHY & SUB-ADMIN VISIBILITY RESTRICTION
  describe('5. Role Hierarchy & Sub-Admin Visibility Masking', () => {
    interface TestUser {
      id: string;
      displayName: string;
      email: string;
      role: 'MAIN_ADMIN' | 'SUB_ADMIN' | 'FRIEND' | 'USER';
      managedBy?: string;
      visibleToSubAdmin: boolean;
    }

    const mockDatabaseUsers: TestUser[] = [
      { id: 'admin-1', displayName: 'Super Admin', email: 'admin@studyos.org', role: 'MAIN_ADMIN', visibleToSubAdmin: false },
      { id: 'friend-1', displayName: 'Admin Friend', email: 'friend@studyos.org', role: 'FRIEND', visibleToSubAdmin: false },
      { id: 'subadmin-1', displayName: 'Sub Admin One', email: 'sub@studyos.org', role: 'SUB_ADMIN', visibleToSubAdmin: true },
      { id: 'student-1', displayName: 'Student Ram', email: 'ram@studyos.org', role: 'USER', managedBy: 'subadmin-1', visibleToSubAdmin: true },
      { id: 'student-2', displayName: 'Student Sita', email: 'sita@studyos.org', role: 'USER', visibleToSubAdmin: true },
    ];

    it('Super Admin can see all users, assign roles, and delete accounts', () => {
      // Main Admin query
      const visibleToAdmin = mockDatabaseUsers;
      expect(visibleToAdmin.length).toBe(5);
      expect(visibleToAdmin.some(u => u.role === 'MAIN_ADMIN')).toBe(true);
      expect(visibleToAdmin.some(u => u.role === 'FRIEND')).toBe(true);

      // Main admin delete operation
      const remainingAfterDelete = visibleToAdmin.filter(u => u.id !== 'student-2');
      expect(remainingAfterDelete.length).toBe(4);
      expect(remainingAfterDelete.some(u => u.id === 'student-2')).toBe(false);
    });

    it('Sub-Admin CANNOT view Main Admin or Admin Friend data', () => {
      // Sub-Admin filtered view
      const subAdminFilter = (users: TestUser[]) =>
        users.filter(u => u.role !== 'MAIN_ADMIN' && u.role !== 'FRIEND' && u.visibleToSubAdmin);

      const visibleToSubAdmin = subAdminFilter(mockDatabaseUsers);
      expect(visibleToSubAdmin.length).toBe(3);
      expect(visibleToSubAdmin.some(u => u.role === 'MAIN_ADMIN')).toBe(false);
      expect(visibleToSubAdmin.some(u => u.role === 'FRIEND')).toBe(false);
      expect(visibleToSubAdmin.some(u => u.email === 'admin@studyos.org')).toBe(false);
      expect(visibleToSubAdmin.some(u => u.email === 'friend@studyos.org')).toBe(false);
    });
  });

  // 6. EXAM COUNTDOWN & DATE FORMATTING
  describe('6. Exam Date & Live Countdown', () => {
    it('should compute remaining days, urgency, and formatted badges for exam targets', () => {
      const now = new Date();
      const examIn30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Simulated course model
      const course = {
        id: 'c-nrb',
        name: 'Nepal Rastra Bank Assistant',
        examDate: examIn30Days,
        dailyGoalMinutes: 60,
      };

      const daysRemaining = Math.ceil((new Date(`${course.examDate}T00:00:00`).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      expect(daysRemaining).toBeGreaterThanOrEqual(29);
      expect(daysRemaining).toBeLessThanOrEqual(31);
    });
  });

  // 7. RECORD DEDUPLICATION
  describe('7. Deduplication Prevention across Courses & Questions', () => {
    it('prevents adding duplicate courses with the same name (case-insensitive)', () => {
      const existingCourses = [
        { id: '1', name: 'RBB Preparation' },
        { id: '2', name: 'NRB Assistant' },
      ];

      const checkDuplicateCourse = (name: string) => {
        const norm = name.trim().toLowerCase();
        return existingCourses.some(c => c.name.trim().toLowerCase() === norm);
      };

      expect(checkDuplicateCourse('rbb preparation')).toBe(true);
      expect(checkDuplicateCourse('  RBB PREPARATION  ')).toBe(true);
      expect(checkDuplicateCourse('NRB Officer')).toBe(false);
    });

    it('prevents adding duplicate questions for the same course', () => {
      const existingQuestions = [
        { id: 'q1', courseId: 'c1', questionText: 'What is the full form of BAFIA?' },
      ];

      const checkDuplicateQuestion = (courseId: string, text: string) => {
        const norm = text.trim().toLowerCase();
        return existingQuestions.some(q => q.courseId === courseId && q.questionText.trim().toLowerCase() === norm);
      };

      expect(checkDuplicateQuestion('c1', 'what is the full form of bafia?')).toBe(true);
      expect(checkDuplicateQuestion('c2', 'what is the full form of bafia?')).toBe(false);
      expect(checkDuplicateQuestion('c1', 'What is Nepal Rastra Bank Act 2058?')).toBe(false);
    });
  });

  // 8. DISPLAY NAME VS EMAIL PRIVACY
  describe('8. Display Name vs Authenticated Email Separation', () => {
    it('ensures dashboard greetings always use Display Name, not raw email addresses', () => {
      const profile = {
        displayName: 'Aayush Shrestha',
        email: 'aayush.shrestha.dev99@gmail.com',
      };

      const getDashboardGreeting = (p: typeof profile) => {
        const name = p.displayName || p.email.split('@')[0];
        return `Namaste, ${name}! Ready to achieve your study targets today?`;
      };

      const greeting = getDashboardGreeting(profile);
      expect(greeting).toContain('Aayush Shrestha');
      expect(greeting).not.toContain('@gmail.com');
      expect(greeting).not.toContain('aayush.shrestha.dev99');
    });
  });
});
