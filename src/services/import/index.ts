import { extractLinesFromPDF } from './pdfExtractor';
import { parseMCQLines } from './mcqStateMachineParser';
import { validateImportCandidates } from './questionValidator';
import type { ImportResult, ParsedMCQCandidate, ExtractedLine } from './types';

export * from './types';
export * from './pdfExtractor';
export * from './mcqStateMachineParser';
export * from './answerKeyParser';
export * from './textQuality';
export * from './questionValidator';

export interface ImportEngineOptions {
  defaultTargetId?: string;
  defaultSubjectId?: string;
  sourceFileName?: string;
}

/**
 * Main entry point: Import MCQs from a PDF file preserving page structures, cross-page flows, and answer keys.
 */
export async function importMCQsFromPDF(
  file: File | ArrayBuffer | Uint8Array,
  options?: ImportEngineOptions
): Promise<ImportResult> {
  const { lines, numPages, rawText } = await extractLinesFromPDF(file);
  const { questions } = parseMCQLines(lines, options);
  return validateImportCandidates(questions, numPages, rawText);
}

/**
 * Import MCQs from raw pasted text or markdown.
 */
export function importMCQsFromText(
  text: string,
  options?: ImportEngineOptions
): ImportResult {
  const rawLines = text.split(/\r?\n/);
  const lines: ExtractedLine[] = rawLines.map((line, idx) => ({
    pageNumber: 1,
    text: line,
    x: 0,
    y: rawLines.length - idx,
    fontSize: 12,
  }));

  const { questions } = parseMCQLines(lines, options);
  return validateImportCandidates(questions, 1, text);
}
