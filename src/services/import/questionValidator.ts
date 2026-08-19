import type { ParsedMCQCandidate, ImportDiagnostics, ImportResult } from './types';

/**
 * Validates a list of extracted MCQ candidates and generates structural diagnostics.
 */
export function validateImportCandidates(
  questions: ParsedMCQCandidate[],
  numPages: number,
  rawText: string
): ImportResult {
  const totalDetected = questions.length;
  const validCount = questions.filter(q => q.status === 'valid').length;
  const needsReviewCount = questions.filter(q => q.status === 'needs_review' || q.status === 'answer_unknown').length;
  const answersMappedCount = questions.filter(q => q.detectedAnswer !== null).length;

  // Check sequence of original question numbers
  const detectedNumbers = questions.map(q => q.originalQuestionNumber).filter(n => !isNaN(n));
  const numberSet = new Set(detectedNumbers);

  const duplicateNumbers: number[] = [];
  const seen = new Set<number>();
  for (const num of detectedNumbers) {
    if (seen.has(num)) {
      duplicateNumbers.push(num);
    }
    seen.add(num);
  }

  const minNum = detectedNumbers.length > 0 ? Math.min(...detectedNumbers) : 1;
  const maxNum = detectedNumbers.length > 0 ? Math.max(...detectedNumbers) : totalDetected;

  const missingNumbers: number[] = [];
  for (let i = minNum; i <= maxNum; i++) {
    if (!numberSet.has(i)) {
      missingNumbers.push(i);
    }
  }

  const hasSequentialNumbers = missingNumbers.length === 0 && duplicateNumbers.length === 0;

  const diagnostics: ImportDiagnostics = {
    totalPages: numPages,
    nativePages: numPages,
    ocrPages: 0,
    totalDetected,
    validCount,
    needsReviewCount,
    answersMappedCount,
    hasSequentialNumbers,
    missingNumbers,
    duplicateNumbers,
  };

  return {
    questions,
    diagnostics,
    rawText,
  };
}
