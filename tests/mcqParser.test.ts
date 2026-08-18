import { describe, it, expect } from 'vitest';
import {
  parseMCQText,
  parseJSONQuestions,
  parseCSVQuestions,
  calculateTextSimilarity,
  checkDuplicate,
} from '../src/services/mcqParser';
import type { Question } from '../src/types';

describe('mcqParser Engine', () => {
  it('should parse standard 4-option MCQs with inline answers and explanations', () => {
    const rawText = `
1. What protocol is used to securely browse the web?
A. FTP
B. SSH
C. HTTPS
D. Telnet
Answer: C
Explanation: HTTPS encrypts communication using TLS/SSL over port 443.

2. Which layer of the OSI model does IP (Internet Protocol) operate at?
(A) Data Link Layer
(B) Network Layer
(C) Transport Layer
(D) Session Layer
Ans: B
Solution: The Internet Protocol operates at Layer 3, which is the Network Layer.
    `;

    const extracted = parseMCQText(rawText);
    expect(extracted.length).toBe(2);

    expect(extracted[0].questionText).toContain('securely browse the web');
    expect(extracted[0].options.length).toBe(4);
    expect(extracted[0].options[0].text).toBe('FTP');
    expect(extracted[0].options[2].text).toBe('HTTPS');
    expect(extracted[0].detectedAnswer).toBe('C');
    expect(extracted[0].explanation).toContain('TLS/SSL');
    expect(extracted[0].confidence).toBe('high');

    expect(extracted[1].questionText).toContain('OSI model does IP');
    expect(extracted[1].options.length).toBe(4);
    expect(extracted[1].detectedAnswer).toBe('B');
    expect(extracted[1].confidence).toBe('high');
  });

  it('should handle MCQs with answer keys provided at the end of the text', () => {
    const rawText = `
1. What is the time complexity of binary search on a sorted array?
A) O(n)
B) O(log n)
C) O(n^2)
D) O(1)

2. Which data structure uses FIFO order?
A) Stack
B) Queue
C) Tree
D) Graph

Answer Key:
1. B
2. B
    `;

    const extracted = parseMCQText(rawText);
    expect(extracted.length).toBe(2);
    expect(extracted[0].detectedAnswer).toBe('B');
    expect(extracted[1].detectedAnswer).toBe('B');
  });

  it('should calculate text similarity and detect duplicate questions accurately', () => {
    const textA = 'What is the default port number for HTTP web traffic?';
    const textB = 'What is the default port number for HTTP web traffic?';
    const textC = 'Which protocol is used for sending email across servers?';

    expect(calculateTextSimilarity(textA, textB)).toBe(1);
    expect(calculateTextSimilarity(textA, textC)).toBeLessThan(0.3);

    const existing: Question[] = [
      {
        id: 'q-1',
        userId: 'user-1',
        targetId: 't-1',
        subjectId: 's-1',
        topicId: 'top-1',
        questionText: 'What is the default port number for HTTP web traffic?',
        options: [{ id: 'A', text: '80' }, { id: 'B', text: '443' }],
        correctOptionId: 'A',
        explanation: '',
        source: 'Mock',
        difficulty: 'easy',
        isShared: true,
        isBookmarked: false,
        isDifficult: false,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
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

    const dupResult = checkDuplicate('What is the default port number for HTTP web traffic?', existing);
    expect(dupResult.isDuplicate).toBe(true);
    expect(dupResult.matchId).toBe('q-1');

    const nonDupResult = checkDuplicate('Explain the Banker algorithm for deadlocks', existing);
    expect(nonDupResult.isDuplicate).toBe(false);
  });

  it('should parse JSON format questions correctly', () => {
    const jsonStr = JSON.stringify([
      {
        question: 'What does CPU stand for?',
        options: ['Central Processing Unit', 'Central Power Unit', 'Core Processing Unit', 'Computer Primary Unit'],
        answer: 'A',
        explanation: 'CPU is the brain of the computer.',
      }
    ]);

    const parsed = parseJSONQuestions(jsonStr);
    expect(parsed.length).toBe(1);
    expect(parsed[0].questionText).toBe('What does CPU stand for?');
    expect(parsed[0].options.length).toBe(4);
    expect(parsed[0].detectedAnswer).toBe('A');
  });

  it('should parse CSV format questions correctly', () => {
    const csvStr = `Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation
"What is 2 + 2?","3","4","5","6","B","Basic arithmetic"`;

    const parsed = parseCSVQuestions(csvStr);
    expect(parsed.length).toBe(1);
    expect(parsed[0].questionText).toBe('What is 2 + 2?');
    expect(parsed[0].options.length).toBe(4);
    expect(parsed[0].detectedAnswer).toBe('B');
    expect(parsed[0].explanation).toBe('Basic arithmetic');
  });
});
