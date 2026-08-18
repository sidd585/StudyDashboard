// Lazy-loaded PDF and OCR extraction utilities

export interface ExtractionProgress {
  status: string;
  progress: number; // 0 to 100
  currentPage?: number;
  totalPages?: number;
}

/**
 * Extracts selectable text directly from a PDF file using PDF.js with line-break preservation
 */
export async function extractTextFromPDF(
  file: File | ArrayBuffer,
  onProgress?: (p: ExtractionProgress) => void
): Promise<{ text: string; pages: { pageNumber: number; text: string }[] }> {
  onProgress?.({ status: 'Loading PDF engine...', progress: 10 });

  // Dynamic import of pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist');

  // Configure worker
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '3.11.174'}/build/pdf.worker.min.js`;
  }

  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const pagesData: { pageNumber: number; text: string }[] = [];
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    onProgress?.({
      status: `Extracting text from page ${i} of ${numPages}...`,
      progress: Math.round(10 + (i / numPages) * 80),
      currentPage: i,
      totalPages: numPages,
    });

    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    
    let lastY: number | null = null;
    let pageText = '';

    for (const item of textContent.items as any[]) {
      if (!('str' in item)) continue;
      const str = item.str;
      if (!str && str !== ' ') continue;

      const currentY = item.transform ? Math.round(item.transform[5]) : null;

      if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) >= 4) {
        pageText += '\n' + str;
      } else if (item.hasEOL) {
        pageText += '\n' + str;
      } else {
        if (pageText && !pageText.endsWith('\n') && !pageText.endsWith(' ') && str.trim()) {
          pageText += ' ';
        }
        pageText += str;
      }

      if (currentY !== null) {
        lastY = currentY;
      }
    }

    const cleanedPageText = pageText.trim();
    pagesData.push({ pageNumber: i, text: cleanedPageText });
    fullText += `\n\n--- Page ${i} ---\n` + cleanedPageText;
  }

  onProgress?.({ status: 'PDF Text Extraction Complete', progress: 100 });
  return { text: fullText.trim(), pages: pagesData };
}

/**
 * Performs OCR on an image file (PNG, JPG, JPEG) using lazy-loaded Tesseract.js
 */
export async function performImageOCR(
  imageSource: File | Blob | string,
  onProgress?: (p: ExtractionProgress) => void
): Promise<string> {
  onProgress?.({ status: 'Initializing OCR Engine (Tesseract.js)...', progress: 10 });

  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.({
          status: 'Recognizing text via OCR...',
          progress: Math.round(20 + (m.progress || 0) * 75),
        });
      }
    },
  });

  onProgress?.({ status: 'Processing image...', progress: 30 });
  const ret = await worker.recognize(imageSource);
  await worker.terminate();

  onProgress?.({ status: 'OCR Complete', progress: 100 });
  return ret.data.text;
}

export const extractTextFromImageWithOCR = performImageOCR;
