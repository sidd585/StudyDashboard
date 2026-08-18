import type { ExtractedQuestion, Question } from '../types';

export interface ParseOptions {
  defaultTargetId?: string;
  defaultSubjectId?: string;
  defaultTopicId?: string;
  sourceName?: string;
}

/**
 * Normalizes text for comparison by removing punctuation and extra whitespace.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Jaccard similarity between two strings based on word sets.
 */
export function calculateTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeText(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeText(b).split(' ').filter(w => w.length > 2));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersection++;
    }
  }
  
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks an extracted question against an existing list of questions for duplicates.
 */
export function checkDuplicate(
  extractedText: string,
  existingQuestions: Question[],
  threshold = 0.75
): { isDuplicate: boolean; matchId?: string; matchText?: string } {
  const normExtracted = normalizeText(extractedText);
  if (!normExtracted) return { isDuplicate: false };

  for (const q of existingQuestions) {
    const normExisting = normalizeText(q.questionText);
    if (normExtracted === normExisting) {
      return { isDuplicate: true, matchId: q.id, matchText: q.questionText };
    }
    const similarity = calculateTextSimilarity(extractedText, q.questionText);
    if (similarity >= threshold) {
      return { isDuplicate: true, matchId: q.id, matchText: q.questionText };
    }
  }

  return { isDuplicate: false };
}

/**
 * Preprocesses raw text by breaking merged lines and standardizing markers.
 */
export function preprocessMCQText(text: string): string {
  return text
    // Replace page markers but track page numbers
    .replace(/--- Page (\d+) ---/g, '\n\n[[PAGE:$1]]\n\n')
    // Break questions that are squished onto the same line (e.g. "Answer: A 11. GDP stands for:")
    .replace(/([^\n])\s+((?:Q(?:uestion)?\.?\s*)?\d{1,4}[\.\)\:\-]\s+[A-Z])/gi, '$1\n\n$2')
    // Ensure option letters have a newline if placed mid-sentence (e.g. "A. First B. Second")
    .replace(/([^\n])\s+([A-D]\.\s+)/g, '$1\n$2')
    .replace(/([^\n])\s+([A-D]\)\s+)/g, '$1\n$2')
    .replace(/([^\n])\s+(\([A-D]\)\s+)/g, '$1\n$2')
    .replace(/([^\n])\s+((?:Answer|Ans|Correct(?:\s+Answer)?)[\s\:\.\-\=]+[A-D])/gi, '$1\n$2')
    .replace(/([^\n])\s+((?:Explanation|Exp|Solution|Sol)[\s\:\.\-\=]+)/gi, '$1\n$2');
}

/**
 * Main deterministic MCQ parser.
 * Faithfully extracts Question Text, Options (A, B, C, D), Correct Answer, and Explanation.
 * NEVER invents or hallucinates missing content.
 */
export function parseMCQText(rawText: string, options: ParseOptions = {}): ExtractedQuestion[] {
  if (!rawText || !rawText.trim()) return [];

  const preprocessed = preprocessMCQText(rawText);

  // Check if there is an answer key table at the bottom of the document
  const answerKeyMap = extractAnswerKeyMap(preprocessed);

  // Regex patterns for Question start
  const questionStartRegex = /^(?:(?:Q(?:uestion)?\.?\s*)?(\d{1,4})[\.\)\:\-]\s*|(?:Q\s*(\d{1,4})\s*[\.\:\-]?\s*))/i;

  // Regex patterns for Options (A-H, or 1-8 in parentheses)
  const optionRegex = /^(?:\(([A-H1-8])\)|\[([A-H1-8])\]|([A-H1-8])[\.\)\:\-]\s*)\s*(.*)/i;

  // Regex for inline answers (e.g. Answer: B, Ans: C, Correct Answer - D, Answer-B)
  const inlineAnswerRegex = /^(?:Answer|Ans|Correct(?:\s+Answer)?|Key|Correct\s*Option)[\s\:\.\-\=]+[\(\[]?\s*([A-H1-8])\s*[\)\]]?/i;

  // Regex for explanation start
  const explanationRegex = /^(?:Explanation|Exp|Solution|Sol|Note|Reason)[\s\:\.\-\=]+([\s\S]*)/i;

  const rawBlocks = splitIntoQuestionBlocks(preprocessed, questionStartRegex);
  const extractedQuestions: ExtractedQuestion[] = [];

  let currentPage = 1;

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];

    // Check if block contains page transition
    const pageMatch = block.match(/\[\[PAGE:(\d+)\]\]/);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10) || currentPage;
    }

    const cleanBlock = block.replace(/\[\[PAGE:\d+\]\]/g, '').trim();
    if (!cleanBlock) continue;

    const parsed = parseSingleBlock(
      cleanBlock,
      i + 1,
      currentPage,
      answerKeyMap,
      inlineAnswerRegex,
      optionRegex,
      explanationRegex,
      options
    );

    if (parsed) {
      extractedQuestions.push(parsed);
    }
  }

  return extractedQuestions;
}

/**
 * Splits text into raw question blocks based on question numbering.
 */
function splitIntoQuestionBlocks(text: string, questionStartRegex: RegExp): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line is the start of the trailing Answer Key table at the bottom
    if (/^(?:answer\s*key|rapid\s*answer\s*key|answer\s*sheet|answers\s*key)\b/i.test(trimmed) || /^ANSWERS\s*$/i.test(trimmed)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      break; // End of questions, rest is answer key table
    }

    if (questionStartRegex.test(trimmed) && currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
      currentBlock = [trimmed];
    } else {
      currentBlock.push(trimmed);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks;
}

/**
 * Extracts a map of question number -> correct answer from trailing answer key sections.
 */
function extractAnswerKeyMap(text: string): Map<string, string> {
  const map = new Map<string, string>();
  
  const keySectionMatch = text.match(/(?:answer\s*key|rapid\s*answer\s*key|answer\s*sheet|answers\s*key)\b[\s\S]*$/i);
  if (keySectionMatch) {
    const keyText = keySectionMatch[0];
    
    // Pattern 1: "1. C 2. C 3. B" or "1: C" or "1-B 2-C"
    const pairRegex1 = /(?:Q\.?\s*)?(\d{1,4})[\.\s\:\-\)]+[\(\[]?([A-D])[\)\]]?/gi;
    let match: RegExpExecArray | null;
    while ((match = pairRegex1.exec(keyText)) !== null) {
      map.set(match[1], match[2].toUpperCase());
    }

    // Pattern 2: "1-B 2-C 3-B 4-A" in tables
    const pairRegex2 = /(\d{1,4})-([A-D])/gi;
    while ((match = pairRegex2.exec(keyText)) !== null) {
      map.set(match[1], match[2].toUpperCase());
    }
  }
  return map;
}

/**
 * Parses an individual question block into structured question text, options, answer, and explanation.
 */
function parseSingleBlock(
  blockText: string,
  indexFallback: number,
  sourcePage: number,
  answerKeyMap: Map<string, string>,
  inlineAnswerRegex: RegExp,
  optionRegex: RegExp,
  explanationRegex: RegExp,
  options: ParseOptions
): ExtractedQuestion | null {
  const lines = blockText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let qNum = String(indexFallback);
  let questionTextLines: string[] = [];
  const parsedOptions: { id: string; text: string }[] = [];
  let detectedAnswer: string | null = null;
  let explanation = '';

  let parsingOptions = false;
  let parsingExplanation = false;
  let currentOptionId: string | null = null;
  let currentOptionText: string[] = [];

  // Extract Question Number from first line if present
  const firstLine = lines[0];
  const qNumMatch = firstLine.match(/^(?:(?:Q(?:uestion)?\.?\s*)?(\d{1,4})[\.\)\:\-]\s*|(?:Q\s*(\d{1,4})\s*[\.\:\-]?\s*))(.*)/i);
  let startLineIndex = 0;

  if (qNumMatch) {
    qNum = qNumMatch[1] || qNumMatch[2] || String(indexFallback);
    const restOfFirstLine = (qNumMatch[3] || '').trim();
    if (restOfFirstLine) {
      questionTextLines.push(restOfFirstLine);
    }
    startLineIndex = 1;
  }

  for (let i = startLineIndex; i < lines.length; i++) {
    const line = lines[i];

    // Check for inline answer (e.g. Answer: B, Ans: C)
    const ansMatch = line.match(inlineAnswerRegex);
    if (ansMatch) {
      // Save last option if open
      if (currentOptionId && currentOptionText.length > 0) {
        parsedOptions.push({
          id: currentOptionId,
          text: currentOptionText.join(' ').trim(),
        });
        currentOptionId = null;
        currentOptionText = [];
      }
      detectedAnswer = normalizeOptionLetter(ansMatch[1]);
      parsingOptions = false;
      continue;
    }

    // Check for explanation start
    const expMatch = line.match(explanationRegex);
    if (expMatch) {
      if (currentOptionId && currentOptionText.length > 0) {
        parsedOptions.push({
          id: currentOptionId,
          text: currentOptionText.join(' ').trim(),
        });
        currentOptionId = null;
        currentOptionText = [];
      }
      parsingExplanation = true;
      parsingOptions = false;
      explanation = expMatch[1].trim();
      continue;
    }

    if (parsingExplanation) {
      explanation += ' ' + line;
      continue;
    }

    // Check for option start (A., B., C., D.)
    const optMatch = line.match(optionRegex);
    if (optMatch) {
      // Save previous option
      if (currentOptionId && currentOptionText.length > 0) {
        parsedOptions.push({
          id: currentOptionId,
          text: currentOptionText.join(' ').trim(),
        });
        currentOptionText = [];
      }

      parsingOptions = true;
      const rawOptId = optMatch[1] || optMatch[2] || optMatch[3];
      currentOptionId = normalizeOptionLetter(rawOptId);
      currentOptionText = [optMatch[4] || ''];
      continue;
    }

    if (parsingOptions && currentOptionId) {
      currentOptionText.push(line);
    } else {
      questionTextLines.push(line);
    }
  }

  // Save trailing option
  if (currentOptionId && currentOptionText.length > 0) {
    parsedOptions.push({
      id: currentOptionId,
      text: currentOptionText.join(' ').trim(),
    });
  }

  // Check answer from trailing answer key map if not detected inline
  if (!detectedAnswer && answerKeyMap.has(qNum)) {
    detectedAnswer = answerKeyMap.get(qNum) || null;
  }

  // Clean final question text and strip any stray "Answer: X" or "Explanation:" if accidentally included
  let finalQuestionText = questionTextLines.join(' ').trim();
  finalQuestionText = finalQuestionText
    .replace(/(?:Answer|Ans|Correct(?:\s+Answer)?)[\s\:\.\-\=]+[A-D].*$/i, '')
    .replace(/(?:Explanation|Solution|Sol)[\s\:\.\-\=]+.*$/i, '')
    .trim();

  // If question text is empty, check if first option actually had the question text
  if (!finalQuestionText && parsedOptions.length > 0) {
    return null; // Header or remark
  }

  // An item must have at least 2 options and a question statement to be an MCQ
  if (parsedOptions.length < 2 || !finalQuestionText || finalQuestionText.length < 5) {
    return null;
  }

  // Validate status
  const parsingIssues: string[] = [];
  let status: 'valid' | 'needs_review' | 'answer_unknown' = 'valid';

  // Validate detected answer matches an existing option
  if (detectedAnswer) {
    const hasMatchingOption = parsedOptions.some(o => o.id === detectedAnswer);
    if (!hasMatchingOption) {
      status = 'needs_review';
      parsingIssues.push(`Detected answer '${detectedAnswer}' does not match any available option.`);
      detectedAnswer = null;
    }
  } else {
    status = 'answer_unknown';
    parsingIssues.push('Correct answer was not specified in the document (marked Answer Unknown).');
  }

  return {
    tempId: `extracted-${Date.now()}-${indexFallback}-${Math.random().toString(36).substring(2, 6)}`,
    rawQuestionNumber: qNum,
    questionText: finalQuestionText,
    options: parsedOptions.length > 0 ? parsedOptions : [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ],
    detectedAnswer: detectedAnswer || null, // Stored as null if unknown! NEVER guessed!
    explanation: explanation ? explanation.trim() : '', // Stored as empty string if not in PDF! NEVER guessed!
    sourcePage,
    confidence: status === 'valid' ? 'high' : status === 'answer_unknown' ? 'medium' : 'low',
    hasParsingIssues: parsingIssues.length > 0,
    parsingIssues,
    status,
    rawSourceText: blockText,
    approved: status === 'valid' || status === 'answer_unknown',
    targetId: options.defaultTargetId,
    subjectId: options.defaultSubjectId,
    topicId: options.defaultTopicId,
    source: options.sourceName || 'Imported MCQ Document',
    difficulty: 'medium',
  };
}

/**
 * Normalizes option identifiers like 1->A, a->A, etc.
 */
function normalizeOptionLetter(char: string): string {
  const map: Record<string, string> = {
    '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E', '6': 'F',
    'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F',
    'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D', 'e': 'E', 'f': 'F',
  };
  return map[char.toUpperCase()] || 'A';
}

/**
 * Parses JSON question dumps
 */
export function parseJSONQuestions(jsonString: string): ExtractedQuestion[] {
  try {
    const data = JSON.parse(jsonString);
    const list = Array.isArray(data) ? data : data.questions || [];
    return list.map((item: any, idx: number) => {
      const options = Array.isArray(item.options)
        ? item.options.map((opt: any, oIdx: number) => typeof opt === 'string'
            ? { id: String.fromCharCode(65 + oIdx), text: opt }
            : { id: opt.id || String.fromCharCode(65 + oIdx), text: opt.text || '' })
        : [
            { id: 'A', text: item.optionA || item.a || '' },
            { id: 'B', text: item.optionB || item.b || '' },
            { id: 'C', text: item.optionC || item.c || '' },
            { id: 'D', text: item.optionD || item.d || '' },
          ];

      const detectedAnswer = item.answer || item.correctOptionId || item.correctAnswer || null;
      const status = detectedAnswer ? 'valid' : 'answer_unknown';

      return {
        tempId: `json-${Date.now()}-${idx}`,
        questionText: item.question || item.questionText || item.text || '',
        options,
        detectedAnswer,
        explanation: item.explanation || '',
        confidence: 'high' as const,
        status,
        hasParsingIssues: false,
        parsingIssues: [],
        approved: true,
        difficulty: item.difficulty || 'medium',
        source: item.source || 'JSON Import',
      };
    });
  } catch (err) {
    console.error('Failed to parse JSON questions:', err);
    return [];
  }
}

/**
 * Parses CSV question formats
 */
export function parseCSVQuestions(csvText: string): ExtractedQuestion[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const questions: ExtractedQuestion[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length >= 5) {
      const detectedAnswer = row[5]?.trim() ? row[5].trim().toUpperCase() : null;
      const status = detectedAnswer ? 'valid' : 'answer_unknown';

      questions.push({
        tempId: `csv-${Date.now()}-${i}`,
        questionText: row[0].trim(),
        options: [
          { id: 'A', text: row[1]?.trim() || '' },
          { id: 'B', text: row[2]?.trim() || '' },
          { id: 'C', text: row[3]?.trim() || '' },
          { id: 'D', text: row[4]?.trim() || '' },
        ],
        detectedAnswer,
        explanation: row[6]?.trim() || '',
        confidence: 'high' as const,
        status,
        hasParsingIssues: false,
        parsingIssues: [],
        approved: true,
        difficulty: 'medium',
        source: 'CSV Import',
      });
    }
  }

  return questions;
}

function parseCSVRow(rowText: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
