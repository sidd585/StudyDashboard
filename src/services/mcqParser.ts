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
 * Preprocesses raw text by expanding inline options (e.g. "A. Cat B. Dog" -> newlines)
 */
export function preprocessMCQText(text: string): string {
  return text
    // Replace page markers
    .replace(/--- Page \d+ ---/g, '')
    // Ensure option letters have a newline if placed mid-sentence
    .replace(/([^\n])\s+([A-D]\.\s+)/g, '$1\n$2')
    .replace(/([^\n])\s+(\([A-D]\)\s+)/g, '$1\n$2')
    .replace(/([^\n])\s+((?:Answer|Ans)[\s\:\-\=]+[A-D])/gi, '$1\n$2')
    .replace(/([^\n])\s+((?:Explanation|Exp|Solution|Sol)[\s\:\-\=]+)/gi, '$1\n$2');
}

/**
 * Main regex-based robust MCQ text parser.
 * Handles diverse formats from PDFs, OCR, textbooks, and past papers.
 */
export function parseMCQText(rawText: string, options: ParseOptions = {}): ExtractedQuestion[] {
  if (!rawText || !rawText.trim()) return [];

  const preprocessed = preprocessMCQText(rawText);

  // Check if there is an answer key table at the bottom
  const answerKeyMap = extractAnswerKeyMap(preprocessed);

  // Regex patterns for Question start
  const questionStartRegex = /^(?:(?:Q(?:uestion)?\.?\s*)?(\d{1,4})[\.\)\:\-]\s*|(?:Q\s*(\d{1,4})\s*[\.\:\-]?\s*))/i;

  // Regex patterns for Options (A-H, or 1-8 in parentheses)
  const optionRegex = /^(?:\(([A-H1-8])\)|\[([A-H1-8])\]|([A-H1-8])[\.\)\:\-]\s*)\s*(.*)/i;

  // Regex for inline answers (e.g. Answer: B, Ans: C)
  const inlineAnswerRegex = /(?:Answer|Ans|Correct(?:\s+Answer)?|Key|Correct\s*Option)[\s\:\.\-\=]+[\(\[]?\s*([A-H1-8])\s*[\)\]]?/i;

  // Regex for explanation
  const explanationRegex = /(?:Explanation|Exp|Solution|Sol|Note|Reason)[\s\:\.\-\=]+([\s\S]*)/i;

  const rawBlocks = splitIntoQuestionBlocks(preprocessed, questionStartRegex);
  const extractedQuestions: ExtractedQuestion[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const parsed = parseSingleBlock(block, i + 1, answerKeyMap, inlineAnswerRegex, optionRegex, explanationRegex, options);
    if (parsed && parsed.options.length >= 2) {
      extractedQuestions.push(parsed);
    }
  }

  return extractedQuestions;
}

/**
 * Splits text into raw question blocks based on question numbering
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
 * Extracts a map of question number -> correct answer from trailing key sections
 */
function extractAnswerKeyMap(text: string): Map<string, string> {
  const map = new Map<string, string>();
  
  // Find where answer key section starts
  const keySectionMatch = text.match(/(?:answer\s*key|rapid\s*answer\s*key|answer\s*sheet|answers\s*key)\b[\s\S]*$/i);
  if (keySectionMatch) {
    const keyText = keySectionMatch[0];
    
    // Pattern 1: "1. C 2. C 3. B" or "1.C 2.C" or "1: C" or "1-B 2-C"
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
 * Parses an individual question block into structured options, answer, and explanation
 */
function parseSingleBlock(
  blockText: string,
  indexFallback: number,
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

    // Check for inline answer
    const ansMatch = line.match(inlineAnswerRegex);
    if (ansMatch) {
      detectedAnswer = normalizeOptionLetter(ansMatch[1]);
      continue;
    }

    // Check for explanation
    const expMatch = line.match(explanationRegex);
    if (expMatch) {
      parsingExplanation = true;
      parsingOptions = false;
      explanation = expMatch[1].trim();
      continue;
    }

    if (parsingExplanation) {
      explanation += ' ' + line;
      continue;
    }

    // Check for option start
    const optMatch = line.match(optionRegex);
    if (optMatch) {
      // Save previous option if any
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

  // Save the last trailing option
  if (currentOptionId && currentOptionText.length > 0) {
    parsedOptions.push({
      id: currentOptionId,
      text: currentOptionText.join(' ').trim(),
    });
  }

  // If no options found, this block was a section header or remark, not an MCQ!
  if (parsedOptions.length < 2) {
    return null;
  }

  // Check answer from trailing answer key map if not detected inline
  if (!detectedAnswer && answerKeyMap.has(qNum)) {
    detectedAnswer = answerKeyMap.get(qNum) || null;
  }

  const finalQuestionText = questionTextLines.join(' ').trim();
  if (!finalQuestionText) return null;

  // Determine parsing quality issues
  const parsingIssues: string[] = [];
  if (!detectedAnswer) {
    parsingIssues.push('Correct answer not found (defaults to A). Please review.');
  }
  if (parsedOptions.length < 4) {
    parsingIssues.push(`Only ${parsedOptions.length} options detected.`);
  }

  const confidenceLevel: 'high' | 'medium' | 'low' =
    detectedAnswer && parsedOptions.length >= 4 ? 'high' : 'medium';

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
    detectedAnswer: detectedAnswer || 'A',
    explanation: explanation || '',
    confidence: confidenceLevel,
    hasParsingIssues: parsingIssues.length > 0,
    parsingIssues,
    approved: true,
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
    return list.map((item: any, idx: number) => ({
      tempId: `json-${Date.now()}-${idx}`,
      questionText: item.question || item.questionText || item.text || '',
      options: Array.isArray(item.options)
        ? item.options.map((opt: any, oIdx: number) => typeof opt === 'string'
            ? { id: String.fromCharCode(65 + oIdx), text: opt }
            : { id: opt.id || String.fromCharCode(65 + oIdx), text: opt.text || '' })
        : [
            { id: 'A', text: item.optionA || item.a || '' },
            { id: 'B', text: item.optionB || item.b || '' },
            { id: 'C', text: item.optionC || item.c || '' },
            { id: 'D', text: item.optionD || item.d || '' },
          ],
      detectedAnswer: item.answer || item.correctOptionId || item.correctAnswer || 'A',
      explanation: item.explanation || '',
      confidence: 'high' as const,
      hasParsingIssues: false,
      parsingIssues: [],
      approved: true,
      difficulty: item.difficulty || 'medium',
      source: item.source || 'JSON Import',
    }));
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
    if (row.length >= 6) {
      questions.push({
        tempId: `csv-${Date.now()}-${i}`,
        questionText: row[0].trim(),
        options: [
          { id: 'A', text: row[1]?.trim() || '' },
          { id: 'B', text: row[2]?.trim() || '' },
          { id: 'C', text: row[3]?.trim() || '' },
          { id: 'D', text: row[4]?.trim() || '' },
        ],
        detectedAnswer: (row[5]?.trim().toUpperCase() || 'A'),
        explanation: row[6]?.trim() || '',
        confidence: 'high' as const,
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
