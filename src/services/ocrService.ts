// Lazy-loaded PDF and OCR extraction utilities

export interface ExtractionProgress {
  status: string;
  progress: number; // 0 to 100
  currentPage?: number;
  totalPages?: number;
}

/**
 * Extracts selectable text directly from a PDF file using PDF.js
 */
export async function extractTextFromPDF(
  file: File | ArrayBuffer,
  onProgress?: (p: ExtractionProgress) => void
): Promise<{ text: string; pages: { pageNumber: number; text: string }[] }> {
  onProgress?.({ status: 'Loading PDF engine...', progress: 10 });
  
  // Dynamic import of pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker source to CDN or local blob for standalone operation
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  }

  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
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
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pagesData.push({ pageNumber: i, text: pageText });
    fullText += `\n\n--- Page ${i} ---\n` + pageText;
  }

  onProgress?.({ status: 'PDF Text Extraction Complete', progress: 100 });
  return { text: fullText, pages: pagesData };
}

/**
 * Performs OCR on an image file (PNG, JPG, JPEG) using lazy-loaded Tesseract.js
 */
export async function performImageOCR(
  imageSource: File | Blob | string,
  onProgress?: (p: ExtractionProgress) => void
): Promise<string> {
  onProgress?.({ status: 'Initializing OCR Engine (Tesseract.js)...', progress: 10 });

  // Dynamically load Tesseract only when OCR is explicitly requested!
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

