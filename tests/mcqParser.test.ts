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

    expect(extracted[1].questionText).toContain('OSI model does IP');
    expect(extracted[1].options.length).toBe(4);
    expect(extracted[1].detectedAnswer).toBe('B');
  });

  it('should parse NRB / PSC Pre-Qualifying Exam format with section headings and trailing ANSWER KEY', () => {
    const rawNRBExamText = `
NRB / PSC PRE-QUALIFYING EXAM
50 MCQs — General Studies, Public Management & Basic Competency
Practice Set 1
50 questions × 2 marks = 100 marks | Suggested time: 45 minutes

1. Geography, Population & Environment

1. Which of the following is a component of physical geography?
A. Population density
B. Political boundaries
C. Landforms
D. Trade routes

2. Which physiographic region of Nepal generally has the highest altitude?
A. Terai
B. Hill
C. Mountain
D. Inner Terai

3. The movement of people from one place to another is known as:
A. Urbanization
B. Migration
C. Industrialization
D. Diversification

2. History, Culture & Social System

6. The Industrial Revolution first began in:
A. France
B. Germany
C. Britain
D. United States

ANSWER KEY
1. C 2. C 3. B 4. A 5. A 6. C 7. C 8. D 9. B 10. D
11. B 12. B 13. B 14. C 15. B 16. B 17. B 18. B 19. B 20. B
    `;

    const extracted = parseMCQText(rawNRBExamText);
    expect(extracted.length).toBe(4);

    // Q1
    expect(extracted[0].questionText).toContain('component of physical geography');
    expect(extracted[0].options.length).toBe(4);
    expect(extracted[0].options[2].text).toBe('Landforms');
    expect(extracted[0].detectedAnswer).toBe('C');

    // Q2
    expect(extracted[1].questionText).toContain('highest altitude');
    expect(extracted[1].options.length).toBe(4);
    expect(extracted[1].options[2].text).toBe('Mountain');
    expect(extracted[1].detectedAnswer).toBe('C');

    // Q3
    expect(extracted[2].questionText).toContain('movement of people');
    expect(extracted[2].detectedAnswer).toBe('B');

    // Q6
    expect(extracted[3].questionText).toContain('Industrial Revolution');
    expect(extracted[3].options[2].text).toBe('Britain');
    expect(extracted[3].detectedAnswer).toBe('C');
  });

  it('should parse RBB Bank Level 5 IT MCQs with topic headings and inline explanation', () => {
    const rawRBBText = `
RASTRIYA BANIJYA BANK LIMITED
Level 5 Senior Assistant (Information Technology)
Chapter 4: Organizational Behavior

4.1 Job Description, Terms of Reference and Responsibilities
Important questions: 12

1. A written statement describing the duties, responsibilities and reporting relationships of a position is called:
A. Job Specification
B. Job Description
C. Terms of Reference
D. Performance appraisal
Answer: B
Explanation: A Job Description explains the job, including its purpose, duties, authority and reporting relationship.

2. Which document mainly states the education, experience, knowledge and skills required from a jobholder?
A. Job Description
B. Terms of Reference
C. Job Specification
D. Organization chart
Answer: C
Explanation: Job Specification is person-oriented and identifies the qualities needed to perform the job.

3. TOR stands for:
A. Transfer of Responsibility
B. Terms of Reference
C. Test of Recruitment
D. Type of Reporting
Answer: B
Explanation: TOR means Terms of Reference.
    `;

    const extracted = parseMCQText(rawRBBText);
    expect(extracted.length).toBe(3);

    // Q1
    expect(extracted[0].questionText).toContain('written statement describing the duties');
    expect(extracted[0].options.length).toBe(4);
    expect(extracted[0].detectedAnswer).toBe('B');
    expect(extracted[0].explanation).toContain('Job Description explains the job');

    // Q2
    expect(extracted[1].questionText).toContain('education, experience, knowledge and skills');
    expect(extracted[1].options.length).toBe(4);
    expect(extracted[1].detectedAnswer).toBe('C');
    expect(extracted[1].explanation).toContain('Job Specification is person-oriented');

    // Q3
    expect(extracted[2].questionText).toContain('TOR stands for');
    expect(extracted[2].detectedAnswer).toBe('B');
  });

  it('should parse JSON dumps cleanly', () => {
    const jsonStr = JSON.stringify([
      {
        question: 'Under BAFIA 2073, what is Class A bank called?',
        options: ['Commercial Bank', 'Development Bank', 'Finance Company', 'Microfinance'],
        answer: 'A',
      }
    ]);
    const parsed = parseJSONQuestions(jsonStr);
    expect(parsed.length).toBe(1);
    expect(parsed[0].options[0].text).toBe('Commercial Bank');
    expect(parsed[0].detectedAnswer).toBe('A');
  });

  it('should parse CSV formats cleanly', () => {
    const csvStr = 'Question,Option A,Option B,Option C,Option D,Answer,Explanation\n"What is 2+2?","1","2","3","4","D","Math fact"';
    const parsed = parseCSVQuestions(csvStr);
    expect(parsed.length).toBe(1);
    expect(parsed[0].options[3].text).toBe('4');
    expect(parsed[0].detectedAnswer).toBe('D');
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
          totalAttempts: 1,
          correctAttempts: 1,
          wrongAttempts: 0,
          consecutiveCorrect: 1,
          easeFactor: 2.5,
          intervalDays: 1,
        }
      }
    ];

    const dup = checkDuplicate(textA, existing);
    expect(dup.isDuplicate).toBe(true);
    expect(dup.matchId).toBe('q-1');
  });
});
