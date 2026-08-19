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
  onProgress?: (stage: string) => void;
}

/**
 * Main entry point: Import MCQs from a PDF file preserving page structures, cross-page flows, and answer keys
 * via the Python FastAPI Document Processing Service, with seamless client-side fallback.
 */
export async function importMCQsFromPDF(
  file: File | Blob | ArrayBuffer | Uint8Array,
  options?: ImportEngineOptions
): Promise<ImportResult> {
  const onProgress = options?.onProgress || (() => {});
  onProgress('Extracting questions from PDF...');

  try {
    const payload = file instanceof Blob && !(file instanceof File) 
      ? await file.arrayBuffer() 
      : file;

    onProgress('Parsing pages & layout...');
    const { lines, numPages, rawText } = await extractLinesFromPDF(payload as any);

    onProgress('Detecting questions & mapping options...');
    const { questions } = parseMCQLines(lines, options);

    onProgress('Validating and preparing questions...');
    return validateImportCandidates(questions, numPages, rawText);
  } catch (err: any) {
    console.error('Fast PDF extraction error:', err);
    throw new Error(`Failed to extract questions: ${err?.message || 'Error parsing document'}`);
  }
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
