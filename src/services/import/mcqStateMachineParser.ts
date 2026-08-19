import type {
  ExtractedLine,
  ParsedMCQCandidate,
  ExtractedOption,
  QuestionStatus,
  ExtractionConfidence,
} from './types';
import { parseAnswerKeyText } from './answerKeyParser';
import { analyzeTextQuality } from './textQuality';

interface RawBuildingQuestion {
  originalNumber: number;
  questionLines: string[];
  options: Map<'A' | 'B' | 'C' | 'D', string[]>;
  inlineAnswer: 'A' | 'B' | 'C' | 'D' | null;
  explanationLines: string[];
  sourceSection?: string;
  sourcePageStart: number;
  sourcePageEnd: number;
  rawSnippetLines: string[];
}

const SECTION_HEADER_PATTERNS = [
  /^(?:Section|Chapter|Part|Set)\s+\d+/i,
  /^\d{1,2}\.\s+(?:Geography|History|Culture|Social|Economic|Constitution|Governance|International|Science|Technology|Public\s+Health|Office|Public\s+Institutions|Applied\s+Mathematics|English|Nepali|Language|Management|General\s+Studies)/i,
  /^NRB\s*\/\s*PSC\s+PRE-QUALIFYING/i,
  /^RASTRIYA\s+BANIJYA\s+BANK/i,
  /^\d+\s+questions\s*×\s*\d+\s*marks/i,
  /^Suggested\s+time/i,
  /^Exam\s+note/i,
];

const OPTION_LINE_REGEX = /^\s*(?:\(?([A-Da-d])[\.\)\:\-–—\s]\s*)(.*)$/;
const INLINE_OPTION_SPLIT_REGEX = /(?:^|\s)(?:\(?([A-Da-d])[\.\)\:\-–—]\s*)([^\(\n\r]+?)(?=(?:\s\(?[A-Da-d][\.\)\:\-–—])|$)/g;

/**
 * Deterministic State Machine Parser consuming normalized line tokens across pages.
 */
export function parseMCQLines(
  lines: ExtractedLine[],
  options?: { defaultTargetId?: string; defaultSubjectId?: string; sourceFileName?: string }
): { questions: ParsedMCQCandidate[]; answerKeyMap: Map<number, 'A' | 'B' | 'C' | 'D'>; answerKeyRawText: string } {
  const buildingList: RawBuildingQuestion[] = [];
  let currentQuestion: RawBuildingQuestion | null = null;
  let currentSection = '';
  let currentState: 'SEEKING' | 'QUESTION' | 'OPTION_A' | 'OPTION_B' | 'OPTION_C' | 'OPTION_D' | 'EXPLANATION' = 'SEEKING';
  let inAnswerKeySection = false;
  const answerKeyLines: string[] = [];

  // Helper to finalize and push the currently building question
  const finalizeCurrentQuestion = () => {
    if (currentQuestion) {
      // Must have some question text or at least 1 option
      const hasContent = currentQuestion.questionLines.length > 0 || currentQuestion.options.size > 0;
      if (hasContent) {
        buildingList.push(currentQuestion);
      }
      currentQuestion = null;
      currentState = 'SEEKING';
    }
  };

  // Helper to check if a line is a section header rather than a question
  const isSectionHeading = (lineText: string, lineIndex: number): boolean => {
    const clean = lineText.trim();

    // 1. If the next line starts with Option A, this line is an MCQ Question, NEVER a section heading!
    if (lineIndex + 1 < lines.length) {
      const nextLine = lines[lineIndex + 1].text.trim();
      if (/^\s*(?:\(?A[\.\)\:\-–—\s])/i.test(nextLine)) {
        return false;
      }
    }

    // 2. If this line contains inline options (A. ... B. ...), it's an MCQ Question!
    if (/(?:^|\s)\(?A[\.\)\:\-–—].*(?:^|\s)\(?B[\.\)\:\-–—]/i.test(clean)) {
      return false;
    }

    // 3. Document header notices
    if (/^NRB\s*\/\s*PSC\s+PRE-QUALIFYING|^RASTRIYA\s+BANIJYA\s+BANK|^\d+\s+questions\s*×\s*\d+\s*marks|^Suggested\s+time|^Exam\s+note/i.test(clean)) {
      return true;
    }

    // 4. If line ends with question punctuation (? or :), it is a question statement
    if (/[?:;]$/.test(clean)) {
      return false;
    }

    // 5. Numbered section headings: "1. Geography, Population & Environment", "8. Public Institutions"
    // Must be short (< 60 chars) and followed by a numbered question before any option A
    const numMatch = clean.match(/^(\d{1,2})[\.\)\:\-]\s+([^?:]+)$/);
    if (numMatch && clean.length < 60) {
      for (let nextIdx = lineIndex + 1; nextIdx < Math.min(lines.length, lineIndex + 6); nextIdx++) {
        const nextClean = lines[nextIdx].text.trim();
        // If we hit an option before hitting another question number, it was a question
        if (/^\s*(?:\(?A[\.\)\:\-–—\s])/i.test(nextClean)) {
          return false;
        }
        const nextNumMatch = nextClean.match(/^(\d{1,3})[\.\)\:\-]\s+/);
        if (nextNumMatch) {
          return true;
        }
      }
    }

    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const rawLine = lineObj.text.trim();
    if (!rawLine) continue;

    // 1. Check for ANSWER KEY section header
    if (/^ANSWER\s+KEY|^Answer\s+Keys?|^Answers\s*:/i.test(rawLine)) {
      finalizeCurrentQuestion();
      inAnswerKeySection = true;
      answerKeyLines.push(rawLine);
      continue;
    }

    if (inAnswerKeySection) {
      answerKeyLines.push(rawLine);
      continue;
    }

    // 2. Check for section headings
    if (isSectionHeading(rawLine, i)) {
      currentSection = rawLine;
      continue;
    }

    // 3. Check for Question Start pattern: e.g. "1. Statement", "1) Statement", "Q1. Statement"
    const qMatch = rawLine.match(/^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[\.\)\:\-]\s+(.*)$/i);
    if (qMatch) {
      const qNum = parseInt(qMatch[1], 10);
      const afterNum = qMatch[2].trim();

      // Check if afterNum actually starts with options directly (e.g. "1. A. OptionA B. OptionB")
      finalizeCurrentQuestion();

      currentQuestion = {
        originalNumber: qNum,
        questionLines: [],
        options: new Map<'A' | 'B' | 'C' | 'D', string[]>(),
        inlineAnswer: null,
        explanationLines: [],
        sourceSection: currentSection,
        sourcePageStart: lineObj.pageNumber,
        sourcePageEnd: lineObj.pageNumber,
        rawSnippetLines: [rawLine],
      };

      currentState = 'QUESTION';

      // Check if this line has inline options: "What is X? A. First B. Second..."
      const inlineMatches = Array.from(afterNum.matchAll(INLINE_OPTION_SPLIT_REGEX));
      if (inlineMatches.length >= 2) {
        // Extract statement part before option A
        const firstOptIndex = afterNum.search(/(?:^|\s)\(?[A-Da-d][\.\)\:\-–—]/);
        if (firstOptIndex > 0) {
          const qTextPart = afterNum.substring(0, firstOptIndex).trim();
          currentQuestion.questionLines.push(qTextPart);
        }

        // Add inline options
        for (const optMatch of inlineMatches) {
          const letter = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          const optText = optMatch[2].trim();
          currentQuestion.options.set(letter, [optText]);
          currentState = `OPTION_${letter}` as any;
        }
      } else {
        currentQuestion.questionLines.push(afterNum);
      }
      continue;
    }

    // 4. If we don't have an active question, ignore orphaned text before question 1
    if (!currentQuestion) {
      continue;
    }

    currentQuestion.sourcePageEnd = lineObj.pageNumber;
    currentQuestion.rawSnippetLines.push(rawLine);

    // 5. Check for Inline Answer / Explanation headers:
    const ansMatch = rawLine.match(/^(?:Answer|Ans|Correct(?:\s+Answer)?)\s*[\:\.\-\=–—]\s*\(?([A-Da-d])\)?/i);
    if (ansMatch) {
      currentQuestion.inlineAnswer = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      continue;
    }

    const expMatch = rawLine.match(/^(?:Explanation|Solution|Sol|Note)\s*[\:\.\-\=–—]\s*(.*)$/i);
    if (expMatch) {
      currentState = 'EXPLANATION';
      if (expMatch[1].trim()) {
        currentQuestion.explanationLines.push(expMatch[1].trim());
      }
      continue;
    }

    // 6. Check for Option line start: e.g. "A. Option Text", "(B) Option Text", "C) Option Text"
    const optLineMatch = rawLine.match(OPTION_LINE_REGEX);
    if (optLineMatch) {
      const letter = optLineMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      const optContent = optLineMatch[2].trim();

      // Check if this single line contains multiple options side-by-side (e.g. "A. Terai   B. Hill   C. Mountain   D. Inner Terai")
      const inlineOpts = Array.from(rawLine.matchAll(INLINE_OPTION_SPLIT_REGEX));
      if (inlineOpts.length >= 2) {
        for (const m of inlineOpts) {
          const optLetter = m[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          const optText = m[2].trim();
          currentQuestion.options.set(optLetter, [optText]);
          currentState = `OPTION_${optLetter}` as any;
        }
      } else {
        currentState = `OPTION_${letter}` as any;
        const existing = currentQuestion.options.get(letter) || [];
        existing.push(optContent);
        currentQuestion.options.set(letter, existing);
      }
      continue;
    }

    // 7. Multi-line continuation: Append to current active state
    if (currentState === 'QUESTION') {
      currentQuestion.questionLines.push(rawLine);
    } else if (currentState.startsWith('OPTION_')) {
      const optLetter = currentState.replace('OPTION_', '') as 'A' | 'B' | 'C' | 'D';
      const existing = currentQuestion.options.get(optLetter) || [];
      existing.push(rawLine);
      currentQuestion.options.set(optLetter, existing);
    } else if (currentState === 'EXPLANATION') {
      currentQuestion.explanationLines.push(rawLine);
    }
  }

  // Finalize last question
  finalizeCurrentQuestion();

  // Parse Answer Key Text
  const answerKeyRawText = answerKeyLines.join('\n');
  const answerKeyMap = parseAnswerKeyText(answerKeyRawText);

  // Transform raw building questions into final candidates with validation
  const candidates: ParsedMCQCandidate[] = buildingList.map((bq, idx) => {
    let cleanQuestionText = bq.questionLines.join(' ').trim();
    // Strip any trailing Answer / Explanation strings if leaked into question
    cleanQuestionText = cleanQuestionText
      .replace(/(?:Answer|Ans|Correct(?:\s+Answer)?)[\s\:\.\-\=]+[A-D].*$/i, '')
      .replace(/(?:Explanation|Solution|Sol)[\s\:\.\-\=]+.*$/i, '')
      .trim();

    const optionsList: ExtractedOption[] = [];
    const letters: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
    for (const letter of letters) {
      const optLines = bq.options.get(letter);
      if (optLines && optLines.length > 0) {
        optionsList.push({
          id: letter,
          text: optLines.join(' ').trim(),
        });
      }
    }

    // Detected Answer: First from separate Answer Key by original number, then from inline
    let detectedAnswer = answerKeyMap.get(bq.originalNumber) || bq.inlineAnswer || null;
    let explanation = bq.explanationLines.join(' ').trim();

    // Text quality analysis
    const quality = analyzeTextQuality(cleanQuestionText + ' ' + optionsList.map(o => o.text).join(' '));
    const issues: string[] = [...quality.issues];

    let status: QuestionStatus = 'valid';
    let confidence: ExtractionConfidence = 'high';
    let extractionMethod: 'native' | 'ocr' | 'mixed' = 'native';

    if (quality.isCorrupted) {
      status = 'needs_review';
      confidence = 'low';
      extractionMethod = 'mixed';
    }

    if (optionsList.length < 4) {
      status = 'needs_review';
      confidence = 'medium';
      issues.push(`Detected ${optionsList.length} of 4 expected options.`);
    }

    if (!detectedAnswer) {
      if (status === 'valid') status = 'answer_unknown';
      issues.push('No correct answer detected in answer key or document.');
    } else {
      const hasMatchingOption = optionsList.some(o => o.id === detectedAnswer);
      if (!hasMatchingOption) {
        status = 'needs_review';
        confidence = 'low';
        issues.push(`Answer '${detectedAnswer}' has no matching option text.`);
      }
    }

    const approved = status === 'valid' && confidence === 'high';

    return {
      tempId: `candidate-${Date.now()}-${idx}-${bq.originalNumber}`,
      originalQuestionNumber: bq.originalNumber,
      questionText: cleanQuestionText,
      options: optionsList,
      detectedAnswer,
      explanation,
      sourceSection: bq.sourceSection,
      sourcePageStart: bq.sourcePageStart,
      sourcePageEnd: bq.sourcePageEnd,
      sourceFileName: options?.sourceFileName,
      confidence,
      status,
      extractionMethod,
      rawSourceSnippet: bq.rawSnippetLines.join('\n'),
      issues,
      approved,
      targetId: options?.defaultTargetId,
      subjectId: options?.defaultSubjectId,
    };
  });

  return {
    questions: candidates,
    answerKeyMap,
    answerKeyRawText,
  };
}
