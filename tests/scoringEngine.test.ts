import { describe, it, expect } from 'vitest';
import {
  calculateQuizResults,
  shuffleQuestionOptions,
} from '../src/services/scoringEngine';
import type { QuizSession, Question, QuestionOption } from '../src/types';

describe('scoringEngine', () => {
  const sampleQuestions: Question[] = [
    {
      id: 'q-1',
      userId: 'user-1',
      targetId: 't-1',
      subjectId: 's-1',
      topicId: 'top-1',
      questionText: 'Question 1',
      options: [
        { id: 'A', text: 'Opt A' },
        { id: 'B', text: 'Opt B' },
        { id: 'C', text: 'Opt C' },
        { id: 'D', text: 'Opt D' },
      ],
      correctOptionId: 'B',
      explanation: '',
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
      },
    },
    {
      id: 'q-2',
      userId: 'user-1',
      targetId: 't-1',
      subjectId: 's-1',
      topicId: 'top-1',
      questionText: 'Question 2',
      options: [
        { id: 'A', text: 'Opt A' },
        { id: 'B', text: 'Opt B' },
      ],
      correctOptionId: 'A',
      explanation: '',
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
      },
    },
    {
      id: 'q-3',
      userId: 'user-1',
      targetId: 't-1',
      subjectId: 's-1',
      topicId: 'top-1',
      questionText: 'Question 3',
      options: [
        { id: 'A', text: 'Opt A' },
        { id: 'B', text: 'Opt B' },
      ],
      correctOptionId: 'B',
      explanation: '',
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
      },
    },
    {
      id: 'q-4',
      userId: 'user-1',
      targetId: 't-1',
      subjectId: 's-1',
      topicId: 'top-1',
      questionText: 'Question 4',
      options: [
        { id: 'A', text: 'Opt A' },
        { id: 'B', text: 'Opt B' },
      ],
      correctOptionId: 'A',
      explanation: '',
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
      },
    },
  ];

  const questionsMap = new Map(sampleQuestions.map(q => [q.id, q]));
  const targetsMap = new Map([['t-1', 'RBB IT']]);
  const subjectsMap = new Map([['s-1', 'Computer Networks']]);
  const topicsMap = new Map([['top-1', 'Switching Technology']]);

  it('should calculate gross score, negative penalty, and net score correctly', () => {
    const session: QuizSession = {
      id: 's-1',
      userId: 'user-1',
      targetId: 't-1',
      title: 'Exam 1',
      mode: 'exam',
      status: 'completed',
      config: {
        mode: 'exam',
        title: 'Exam 1',
        targetId: 't-1',
        subjectIds: [],
        topicIds: [],
        questionCount: 4,
        marksPerCorrect: 1,
        negativeMarks: 0.25,
        shuffleQuestions: false,
        shuffleOptions: false,
        immediateFeedback: false,
      },
      questionIds: ['q-1', 'q-2', 'q-3', 'q-4'],
      answers: {
        'q-1': { selectedOptionId: 'B', isMarkedForReview: false, responseTimeMs: 10000 },
        'q-2': { selectedOptionId: 'A', isMarkedForReview: false, responseTimeMs: 12000 },
        'q-3': { selectedOptionId: 'A', isMarkedForReview: false, responseTimeMs: 15000 },
      },
      currentQuestionIndex: 3,
      startedAt: 0,
      completedAt: 0,
      totalTimeSpentMs: 37000,
    };

    const results = calculateQuizResults(session, questionsMap, targetsMap, subjectsMap, topicsMap);

    expect(results.totalQuestions).toBe(4);
    expect(results.correctCount).toBe(2);
    expect(results.wrongCount).toBe(1);
    expect(results.unansweredCount).toBe(1);
    expect(results.accuracy).toBe(67);
    expect(results.grossScore).toBe(2);
    expect(results.negativeMarks).toBe(0.25);
    expect(results.netScore).toBe(1.75);
  });

  it('should preserve correct answer reference when shuffling options', () => {
    const original: Question = {
      ...sampleQuestions[0],
      options: [
        { id: 'A', text: 'Alpha' },
        { id: 'B', text: 'Beta' },
        { id: 'C', text: 'Gamma' },
        { id: 'D', text: 'Delta' },
      ],
      correctOptionId: 'B',
    };

    const shuffled = shuffleQuestionOptions(original);
    expect(shuffled.options.length).toBe(4);

    const betaOption = shuffled.options.find((o: QuestionOption) => o.text === 'Beta');
    expect(betaOption).toBeDefined();
    expect(betaOption?.id).toBe(shuffled.correctOptionId);
  });
});
