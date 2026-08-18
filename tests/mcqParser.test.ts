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
  it('should parse standard 4-option MCQs with inline answers and NO explanation without guessing', () => {
    const rawText = `
1. Which device connects different networks?
A. Hub
B. Router
C. Repeater
D. Switch
Answer: B
    `;

    const extracted = parseMCQText(rawText);
    expect(extracted.length).toBe(1);

    expect(extracted[0].questionText).toBe('Which device connects different networks?');
    expect(extracted[0].options.length).toBe(4);
    expect(extracted[0].options[0].text).toBe('Hub');
    expect(extracted[0].options[1].text).toBe('Router');
    expect(extracted[0].options[2].text).toBe('Repeater');
    expect(extracted[0].options[3].text).toBe('Switch');
    expect(extracted[0].detectedAnswer).toBe('B');
    // Critical: Explanation MUST be blank if not in source!
    expect(extracted[0].explanation).toBe('');
    expect(extracted[0].status).toBe('valid');
  });

  it('should mark question as Answer Unknown when no answer is provided and NEVER guess', () => {
    const rawText = `
1. What is the primary objective of monetary policy in Nepal?
A. Price stability and balance of payments
B. Maximizing government debt
C. Printing unlimited currency notes
D. Controlling private company wages
    `;

    const extracted = parseMCQText(rawText);
    expect(extracted.length).toBe(1);
    expect(extracted[0].questionText).toContain('primary objective of monetary policy in Nepal');
    expect(extracted[0].options.length).toBe(4);
    expect(extracted[0].detectedAnswer).toBeNull();
    expect(extracted[0].status).toBe('answer_unknown');
    expect(extracted[0].explanation).toBe('');
  });

  it('should parse NRB / PSC Pre-Qualifying Exam format with section headings and trailing ANSWER KEY', () => {
    const rawNRBExamText = `
NRB / PSC PRE-QUALIFYING EXAM
50 MCQs — General Studies, Public Management & Basic Competency
Practice Set 1

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

ANSWER KEY
1. C 2. C
    `;

    const extracted = parseMCQText(rawNRBExamText);
    expect(extracted.length).toBe(2);

    expect(extracted[0].questionText).toBe('Which of the following is a component of physical geography?');
    expect(extracted[0].options.length).toBe(4);
    expect(extracted[0].options[2].text).toBe('Landforms');
    expect(extracted[0].detectedAnswer).toBe('C');
    expect(extracted[0].status).toBe('valid');

    expect(extracted[1].questionText).toBe('Which physiographic region of Nepal generally has the highest altitude?');
    expect(extracted[1].options.length).toBe(4);
    expect(extracted[1].options[2].text).toBe('Mountain');
    expect(extracted[1].detectedAnswer).toBe('C');
    expect(extracted[1].status).toBe('valid');
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
Ans: C
Solution: Job Specification is person-oriented and identifies the qualities needed to perform the job.
    `;

    const extracted = parseMCQText(rawRBBText);
    expect(extracted.length).toBe(2);

    // Q1
    expect(extracted[0].questionText).toBe('A written statement describing the duties, responsibilities and reporting relationships of a position is called:');
    expect(extracted[0].options.length).toBe(4);
    expect(extracted[0].detectedAnswer).toBe('B');
    expect(extracted[0].explanation).toBe('A Job Description explains the job, including its purpose, duties, authority and reporting relationship.');

    // Q2
    expect(extracted[1].questionText).toBe('Which document mainly states the education, experience, knowledge and skills required from a jobholder?');
    expect(extracted[1].options.length).toBe(4);
    expect(extracted[1].detectedAnswer).toBe('C');
    expect(extracted[1].explanation).toBe('Job Specification is person-oriented and identifies the qualities needed to perform the job.');
  });

  it('should parse JSON and CSV formats cleanly', () => {
    const jsonStr = JSON.stringify([
      {
        question: 'Under BAFIA 2073, what is Class A bank called?',
        options: ['Commercial Bank', 'Development Bank', 'Finance Company', 'Microfinance'],
        answer: 'A',
      }
    ]);
    const parsedJson = parseJSONQuestions(jsonStr);
    expect(parsedJson.length).toBe(1);
    expect(parsedJson[0].options[0].text).toBe('Commercial Bank');
    expect(parsedJson[0].detectedAnswer).toBe('A');

    const csvStr = 'Question,Option A,Option B,Option C,Option D,Answer,Explanation\n"What is 2+2?","1","2","3","4","D",""';
    const parsedCsv = parseCSVQuestions(csvStr);
    expect(parsedCsv.length).toBe(1);
    expect(parsedCsv[0].options[3].text).toBe('4');
    expect(parsedCsv[0].detectedAnswer).toBe('D');
  });

  it('should calculate text similarity and detect duplicate questions accurately', () => {
    const textA = 'What is the default port number for HTTP web traffic?';
    const textB = 'What is the default port number for HTTP web traffic?';
    const textC = 'Which protocol is used for sending email across servers?';

    expect(calculateTextSimilarity(textA, textB)).toBe(1);
    expect(calculateTextSimilarity(textA, textC)).toBeLessThan(0.3);
  });
});
