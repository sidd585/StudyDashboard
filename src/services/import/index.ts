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
  onProgress('Reading PDF...');

  const apiUrl = (import.meta as any).env?.VITE_MCQ_IMPORT_API_URL || 
                 (import.meta as any).env?.MCQ_IMPORT_API_URL || 
                 'http://localhost:8000';

  const formData = new FormData();
  let uploadBlob: Blob;
  let filename = options?.sourceFileName || 'document.pdf';

  if (file instanceof File) {
    uploadBlob = file;
    filename = file.name;
  } else if (file instanceof Blob) {
    uploadBlob = file;
  } else {
    uploadBlob = new Blob([file as BlobPart], { type: 'application/pdf' });
  }

  formData.append('file', uploadBlob, filename);
  if (options?.defaultTargetId) formData.append('targetId', options.defaultTargetId);
  if (options?.defaultSubjectId) formData.append('subjectId', options.defaultSubjectId);

  try {
    onProgress('Analyzing pages...');
    const res = await fetch(`${apiUrl}/api/import/mcq`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errJson.detail || `Server error (${res.status})`);
    }

    onProgress('Detecting questions & mapping answers...');
    const data = await res.json();
    onProgress('Validating...');

    const questions: ParsedMCQCandidate[] = (data.questions || []).map((q: any) => ({
      tempId: `tmp-${Date.now()}-${q.number}-${Math.random().toString(36).substr(2, 6)}`,
      originalQuestionNumber: q.number,
      questionText: q.question,
      options: [
        { id: 'A', text: q.options?.A || '' },
        { id: 'B', text: q.options?.B || '' },
        { id: 'C', text: q.options?.C || '' },
        { id: 'D', text: q.options?.D || '' },
      ],
      detectedAnswer: (q.correctAnswer as 'A' | 'B' | 'C' | 'D') || null,
      explanation: q.explanation || '',
      sourceSection: q.section || undefined,
      sourcePageStart: q.sourcePageStart || 1,
      sourcePageEnd: q.sourcePageEnd || 1,
      sourceFileName: data.fileName || filename,
      confidence: (q.confidence?.toLowerCase() || 'high') as 'high' | 'medium' | 'low',
      status: q.status === 'VALID' ? 'valid' : (q.answerStatus === 'UNKNOWN' ? 'answer_unknown' : 'needs_review'),
      extractionMethod: (q.extractionMethod || 'native') as 'native' | 'ocr' | 'mixed',
      rawSourceSnippet: q.rawSnippet || '',
      issues: q.issues || [],
      approved: q.status === 'VALID' && q.confidence === 'HIGH',
      targetId: q.targetId || options?.defaultTargetId,
      subjectId: q.subjectId || options?.defaultSubjectId,
      topicId: q.topicId,
    }));

    onProgress('Ready for review');

    return {
      questions,
      diagnostics: {
        totalPages: data.pages || 1,
        nativePages: data.nativePages || 0,
        ocrPages: data.ocrPages || 0,
        totalDetected: data.questionsDetected || questions.length,
        validCount: data.validQuestions || 0,
        needsReviewCount: data.needsReview || 0,
        answersMappedCount: data.answersMapped || 0,
        hasSequentialNumbers: data.diagnostics?.hasSequentialNumbers ?? true,
        missingNumbers: data.diagnostics?.missingNumbers || [],
        duplicateNumbers: data.diagnostics?.duplicateNumbers || [],
      },
      rawText: '',
    };
  } catch (err: any) {
    console.warn('Python MCQ import service call failed, attempting client fallback:', err);
    try {
      const fallbackPayload = file instanceof Blob && !(file instanceof File) 
        ? await file.arrayBuffer() 
        : file;
      const { lines, numPages, rawText } = await extractLinesFromPDF(fallbackPayload as any);
      const { questions } = parseMCQLines(lines, options);
      return validateImportCandidates(questions, numPages, rawText);
    } catch (fallbackErr) {
      throw new Error(`Import failed: ${err.message || 'Could not connect to Python MCQ Import service.'}`);
    }
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
