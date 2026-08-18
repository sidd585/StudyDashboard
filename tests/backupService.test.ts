import { describe, it, expect } from 'vitest';
import { validateBackupData, exportQuestionsToCSV } from '../src/services/backupService';
import type { Question } from '../src/types';

describe('backupService', () => {
  it('should validate standard StudyOS backup files', () => {
    const validJson = JSON.stringify({
      version: 2,
      app: 'StudyOS-Nepal',
      exportedAt: '2026-08-18T20:00:00.000Z',
      data: {
        targets: [{ id: 't-1', userId: 'u-1', name: 'RBB IT', type: 'Competitive Exam', color: '#6366f1', icon: 'Target', dailyGoalMinutes: 90, weeklyGoalMinutes: 600, targetQuestionGoal: 30, isArchived: false, createdAt: 0, updatedAt: 0 }],
        subjects: [],
        topics: [],
        questions: [
          {
            id: 'q-1',
            userId: 'u-1',
            targetId: 't-1',
            subjectId: 's-1',
            topicId: 'top-1',
            questionText: 'What is a subnet mask?',
            options: [{ id: 'A', text: '255.255.255.0' }, { id: 'B', text: '192.168.1.1' }],
            correctOptionId: 'A',
            explanation: '',
            source: 'Test',
            difficulty: 'easy',
            isShared: true,
            isBookmarked: false,
            isDifficult: false,
            tags: [],
            createdAt: 0,
            updatedAt: 0,
            stats: {
              totalAttempts: 0,
              correctAttempts: 0,
              wrongAttempts: 0,
              consecutiveCorrect: 0,
              easeFactor: 2.5,
              intervalDays: 1,
            }
          }
        ],
        attempts: [],
        quizSessions: [],
        studySessions: [],
        dailyAllocations: [],
        studySchedules: [],
        materials: [],
      }
    });

    const result = validateBackupData(validJson);
    expect(result.isValid).toBe(true);
    expect(result.preview?.targetCount).toBe(1);
    expect(result.preview?.questionCount).toBe(1);
  });

  it('should reject corrupted or invalid backup JSON', () => {
    const invalidJson = '{"notAStudyOSBackup": true}';
    const result = validateBackupData(invalidJson);
    expect(result.isValid).toBe(false);
  });

  it('should export questions to valid CSV format', () => {
    const questions: Question[] = [
      {
        id: 'q-1',
        userId: 'u-1',
        targetId: 't-1',
        subjectId: 's-1',
        topicId: 'top-1',
        questionText: 'What is 10 + 20?',
        options: [
          { id: 'A', text: '30' },
          { id: 'B', text: '40' },
        ],
        correctOptionId: 'A',
        explanation: 'Simple math',
        source: 'Math Test',
        year: 2024,
        difficulty: 'easy',
        isShared: true,
        isBookmarked: false,
        isDifficult: false,
        tags: ['math', 'arithmetic'],
        createdAt: 0,
        updatedAt: 0,
        stats: {
          totalAttempts: 0,
          correctAttempts: 0,
          wrongAttempts: 0,
          consecutiveCorrect: 0,
          easeFactor: 2.5,
          intervalDays: 1,
        }
      }
    ];

    const csv = exportQuestionsToCSV(questions);
    expect(csv).toContain('Question,Option A,Option B');
    expect(csv).toContain('"What is 10 + 20?"');
    expect(csv).toContain('"30"');
    expect(csv).toContain('"A"');
  });
});
