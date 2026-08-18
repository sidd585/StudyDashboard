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
 * Main regex-based robust MCQ text parser.
 * Handles diverse formats from PDFs, OCR, textbooks, and past papers.
 */
export function parseMCQText(rawText: string, options: ParseOptions = {}): ExtractedQuestion[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  // Check if there is an answer key table at the bottom (e.g. "Answer Key: 1. A, 2. B" or "ANSWERS: 1-A 2-C")
  const answerKeyMap = extractAnswerKeyMap(fullText);

  // Regex patterns for Question start
  // Matches "1.", "1)", "Q1.", "Q1:", "Q.1", "Question 1:", "Question 1.", "1 - "
  const questionStartRegex = /^(?:(?:Q(?:uestion)?\.?\s*)?(\d{1,4})[\.\)\:\-]\s*|(?:Q\s*(\d{1,4})\s*[\.\:\-]?\s*))/i;

  // Regex patterns for Options (A-H, or 1-8 in parentheses)
  // Matches "A.", "A)", "(A)", "[A]", "a.", "a)", "(a)", "1.", "(1)", "1)"
  const optionRegex = /^(?:\(([A-H1-8])\)|\[([A-H1-8])\]|([A-H1-8])[\.\)\:\-]\s*)\s*(.*)/i;

  // Regex for inline answers
  // Matches "Answer: C", "Ans: (B)", "Ans - C", "Correct Answer: D", "Key: A", "Ans. B", "Answer: [B]"
  const inlineAnswerRegex = /(?:Answer|Ans|Correct(?:\s+Answer)?|Key|Correct\s*Option)[\s\:\.\-\=]+[\(\[]?\s*([A-H1-8])\s*[\)\]]?/i;

  // Regex for explanation
  const explanationRegex = /(?:Explanation|Exp|Solution|Sol|Note|Reason)[\s\:\.\-\=]+([\s\S]*)/i;

  const rawBlocks = splitIntoQuestionBlocks(fullText, questionStartRegex);
  const extractedQuestions: ExtractedQuestion[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const parsed = parseSingleBlock(block, i + 1, answerKeyMap, inlineAnswerRegex, optionRegex, explanationRegex, options);
    if (parsed) {
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

    // Check if line looks like an answer key table at the bottom
    if (/^(?:answer\s*keys?|answers|solutions)\s*[:\-]/i.test(trimmed)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      break; // End of questions, rest is answer key
    }

    if (questionStartRegex.test(trimmed) && currentBlock.length > 0) {
      // Check if current block has at least some content
      blocks.push(currentBlock.join('\n'));
      currentBlock = [trimmed];
    } else {
      currentBlock.push(trimmed);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  // Fallback: If no blocks detected with question numbers, try splitting by double newlines or option patterns
  if (blocks.length <= 1 && text.length > 100) {
    const doubleNewlineBlocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 10);
    if (doubleNewlineBlocks.length > 1) {
      return doubleNewlineBlocks;
    }
  }

  return blocks;
}

/**
 * Extracts a map of question number -> correct answer from trailing key sections
 */
function extractAnswerKeyMap(text: string): Map<string, string> {
  const map = new Map<string, string>();
  // Looks for patterns like "1. A", "1-B", "1(C)", "1: D", "Q1: A" in answer blocks
  const keySectionMatch = text.match(/(?:answers?|solutions?|answer\s*keys?)\s*[:\-\n]([\s\S]+)$/i);
  if (keySectionMatch) {
    const keyText = keySectionMatch[1];
    const pairRegex = /(?:Q\.?\s*)?(\d{1,4})[\.\s\:\-\)]+[\(\[]?([A-H])[\)\]]?/gi;
    let match: RegExpExecArray | null;
    while ((match = pairRegex.exec(keyText)) !== null) {
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
      // Check if line contains inline multiple options (e.g. "A) Apple  B) Banana  C) Orange  D) Grape")
      const multiOptCheck = parseInlineOptions(line);
      if (multiOptCheck.length > 1) {
        for (const opt of multiOptCheck) {
          parsedOptions.push(opt);
        }
        currentOptionId = null;
        currentOptionText = [];
      } else {
        currentOptionText.push(line);
      }
    } else {
      // Check if this line actually contains all options inline on a single line!
      const inlineOpts = parseInlineOptions(line);
      if (inlineOpts.length >= 2) {
        parsingOptions = true;
        for (const opt of inlineOpts) {
          parsedOptions.push(opt);
        }
      } else {
        questionTextLines.push(line);
      }
    }
  }

  // Flush remaining option
  if (currentOptionId && currentOptionText.length > 0) {
    parsedOptions.push({
      id: currentOptionId,
      text: currentOptionText.join(' ').trim(),
    });
  }

  // If answer was not inline, check the trailing answer key map
  if (!detectedAnswer && answerKeyMap.has(qNum)) {
    detectedAnswer = answerKeyMap.get(qNum) || null;
  }

  const questionText = questionTextLines.join(' ').trim();
  if (!questionText && parsedOptions.length === 0) {
    return null;
  }

  // Map 1, 2, 3, 4 options to A, B, C, D if numeric
  const standardizedOptions = standardizeOptionLetters(parsedOptions);

  // Calculate confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let confidenceReason = '';

  if (standardizedOptions.length >= 4 && detectedAnswer) {
    confidence = 'high';
    confidenceReason = 'Question, 4 options, and answer detected clearly';
  } else if (standardizedOptions.length >= 2 && detectedAnswer) {
    confidence = 'medium';
    confidenceReason = `${standardizedOptions.length} options found with answer`;
  } else if (standardizedOptions.length >= 2 && !detectedAnswer) {
    confidence = 'medium';
    confidenceReason = `${standardizedOptions.length} options found (Answer unknown)`;
  } else {
    confidence = 'low';
    confidenceReason = 'Incomplete option structure detected';
  }

  return {
    tempId: `ext-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    rawQuestionNumber: qNum,
    questionText: questionText || 'Untitled Question',
    options: standardizedOptions,
    detectedAnswer: detectedAnswer || null,
    explanation: explanation.trim(),
    confidence,
    confidenceReason,
    targetId: options.defaultTargetId,
    subjectId: options.defaultSubjectId,
    topicId: options.defaultTopicId,
    approved: true, // Default checked in review list
  };
}

/**
 * Parses multiple options present on a single line
 * e.g. "(A) Alpha (B) Beta (C) Gamma (D) Delta"
 */
function parseInlineOptions(line: string): { id: string; text: string }[] {
  const results: { id: string; text: string }[] = [];
  const regex = /(?:\(([A-H1-8])\)|\[([A-H1-8])\]|(?:\b|^)([A-H1-8])[\.\)\:\-])\s*([^\(\)\[\]]+?)(?=(?:\([A-H1-8]\)|\[[A-H1-8]\]|\b[A-H1-8][\.\)\:\-])|$)/gi;
  
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const rawId = match[1] || match[2] || match[3];
    const text = match[4].trim();
    if (rawId && text) {
      results.push({
        id: normalizeOptionLetter(rawId),
        text,
      });
    }
  }
  return results;
}

function normalizeOptionLetter(char: string): string {
  const c = char.trim().toUpperCase();
  const numToLetter: Record<string, string> = {
    '1': 'A',
    '2': 'B',
    '3': 'C',
    '4': 'D',
    '5': 'E',
    '6': 'F',
  };
  return numToLetter[c] || c;
}

function standardizeOptionLetters(options: { id: string; text: string }[]): { id: string; text: string }[] {
  const standardLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  return options.map((opt, idx) => {
    // If id is not already an A-H letter, assign sequential letter
    const id = /^[A-H]$/i.test(opt.id) ? opt.id.toUpperCase() : standardLetters[idx] || String(idx + 1);
    return { id, text: opt.text };
  });
}

/**
 * Parses JSON format questions (supporting StudyOS native format or generic MCQ schema)
 */
export function parseJSONQuestions(jsonString: string, options: ParseOptions = {}): ExtractedQuestion[] {
  try {
    const data = JSON.parse(jsonString);
    const list = Array.isArray(data) ? data : data.questions || [];
    return list.map((item: any, idx: number) => {
      const opts: { id: string; text: string }[] = [];
      if (Array.isArray(item.options)) {
        item.options.forEach((o: any, oIdx: number) => {
          if (typeof o === 'string') {
            opts.push({ id: ['A', 'B', 'C', 'D', 'E'][oIdx] || String(oIdx + 1), text: o });
          } else if (o && typeof o === 'object') {
            opts.push({ id: o.id || ['A', 'B', 'C', 'D', 'E'][oIdx], text: o.text || '' });
          }
        });
      } else if (typeof item.options === 'object' && item.options !== null) {
        Object.entries(item.options).forEach(([k, v]) => {
          opts.push({ id: k.toUpperCase(), text: String(v) });
        });
      }

      const answer = item.correctOptionId || item.answer || item.correctAnswer || item.correct || null;

      return {
        tempId: `json-${Date.now()}-${idx}`,
        rawQuestionNumber: String(idx + 1),
        questionText: item.questionText || item.question || 'Untitled Question',
        options: opts,
        detectedAnswer: answer ? String(answer).toUpperCase() : null,
        explanation: item.explanation || item.notes || '',
        confidence: opts.length >= 2 ? 'high' : 'medium',
        targetId: item.targetId || options.defaultTargetId,
        subjectId: item.subjectId || options.defaultSubjectId,
        topicId: item.topicId || options.defaultTopicId,
        tags: Array.isArray(item.tags) ? item.tags : [],
        approved: true,
      };
    });
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${(err as Error).message}`);
  }
}

/**
 * Parses standard CSV with columns:
 * Question, Option A, Option B, Option C, Option D, Correct Answer, Explanation, Subject, Topic, Tags
 */
export function parseCSVQuestions(csvText: string, options: ParseOptions = {}): ExtractedQuestion[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Simple CSV parser handling quotes
  const parseLine = (line: string): string[] => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row.map(r => r.replace(/^"|"$/g, '').trim());
  };

  const header = parseLine(lines[0]).map(h => h.toLowerCase());
  const qIdx = header.findIndex(h => h.includes('question'));
  const aIdx = header.findIndex(h => h.includes('option a') || h === 'a');
  const bIdx = header.findIndex(h => h.includes('option b') || h === 'b');
  const cIdx = header.findIndex(h => h.includes('option c') || h === 'c');
  const dIdx = header.findIndex(h => h.includes('option d') || h === 'd');
  const ansIdx = header.findIndex(h => h.includes('answer') || h.includes('correct'));
  const expIdx = header.findIndex(h => h.includes('explanation') || h.includes('solution'));

  const startIndex = qIdx !== -1 ? 1 : 0;
  const results: ExtractedQuestion[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    if (row.length < 2) continue;

    const questionText = qIdx !== -1 ? row[qIdx] : row[0];
    if (!questionText) continue;

    const opts: { id: string; text: string }[] = [];
    if (aIdx !== -1 && row[aIdx]) opts.push({ id: 'A', text: row[aIdx] });
    if (bIdx !== -1 && row[bIdx]) opts.push({ id: 'B', text: row[bIdx] });
    if (cIdx !== -1 && row[cIdx]) opts.push({ id: 'C', text: row[cIdx] });
    if (dIdx !== -1 && row[dIdx]) opts.push({ id: 'D', text: row[dIdx] });

    // Fallback if header wasn't found
    if (opts.length === 0 && row.length >= 5) {
      if (row[1]) opts.push({ id: 'A', text: row[1] });
      if (row[2]) opts.push({ id: 'B', text: row[2] });
      if (row[3]) opts.push({ id: 'C', text: row[3] });
      if (row[4]) opts.push({ id: 'D', text: row[4] });
    }

    const detectedAnswer = ansIdx !== -1 && row[ansIdx] ? row[ansIdx].toUpperCase().trim() : (row[5] ? row[5].toUpperCase().trim() : null);
    const explanation = expIdx !== -1 && row[expIdx] ? row[expIdx] : (row[6] || '');

    results.push({
      tempId: `csv-${Date.now()}-${i}`,
      rawQuestionNumber: String(i),
      questionText,
      options: opts,
      detectedAnswer: detectedAnswer && /^[A-H]$/.test(detectedAnswer) ? detectedAnswer : null,
      explanation,
      confidence: opts.length >= 4 ? 'high' : 'medium',
      targetId: options.defaultTargetId,
      subjectId: options.defaultSubjectId,
      topicId: options.defaultTopicId,
      approved: true,
    });
  }

  return results;
}
