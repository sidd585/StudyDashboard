import type { Difficulty } from '../../types';

export interface ExtractedLine {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  isBold?: boolean;
}

export type ExtractionConfidence = 'high' | 'medium' | 'low';
export type QuestionStatus = 'valid' | 'needs_review' | 'answer_unknown';

export interface ExtractedOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface ParsedMCQCandidate {
  tempId: string;
  originalQuestionNumber: number;
  questionText: string;
  options: ExtractedOption[];
  detectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
  explanation: string;
  sourceSection?: string;
  sourcePageStart: number;
  sourcePageEnd: number;
  sourceFileName?: string;
  confidence: ExtractionConfidence;
  status: QuestionStatus;
  extractionMethod: 'native' | 'ocr' | 'mixed';
  rawSourceSnippet: string;
  issues: string[];
  approved: boolean;
  targetId?: string;
  subjectId?: string;
  topicId?: string;
  difficulty?: Difficulty;
}

export interface ImportDiagnostics {
  totalPages: number;
  nativePages: number;
  ocrPages: number;
  totalDetected: number;
  validCount: number;
  needsReviewCount: number;
  answersMappedCount: number;
  hasSequentialNumbers: boolean;
  missingNumbers: number[];
  duplicateNumbers: number[];
}

export interface ImportResult {
  questions: ParsedMCQCandidate[];
  diagnostics: ImportDiagnostics;
  rawText: string;
}
