import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedLine } from './types';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface PDFExtractionResult {
  lines: ExtractedLine[];
  numPages: number;
  rawText: string;
}

/**
 * Extracts structured line-by-line text tokens preserving page number, Y-position, and horizontal ordering.
 */
export async function extractLinesFromPDF(file: File | ArrayBuffer | Uint8Array): Promise<PDFExtractionResult> {
  let uint8Data: Uint8Array;
  if (file instanceof File) {
    uint8Data = new Uint8Array(await file.arrayBuffer());
  } else if (file instanceof ArrayBuffer) {
    uint8Data = new Uint8Array(file);
  } else if (typeof Uint8Array !== 'undefined' && file instanceof Uint8Array) {
    uint8Data = new Uint8Array(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  } else {
    uint8Data = new Uint8Array(file as any);
  }

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Data,
    useSystemFonts: true,
    disableFontFace: false,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const allLines: ExtractedLine[] = [];
  const fullTextBlocks: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
      fontName?: string;
    }>;

    if (!items || items.length === 0) continue;

    // Group items on the page by vertical Y position (threshold ~3-4px)
    const lineBuckets: Array<{
      y: number;
      items: Array<{ str: string; x: number; fontSize: number }>;
    }> = [];

    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;

      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);
      const fontSize = Math.round(Math.hypot(item.transform[0], item.transform[1]));

      // Find bucket with similar Y (PDF coordinates: higher Y is higher on page)
      let bucket = lineBuckets.find(b => Math.abs(b.y - y) <= 4);
      if (!bucket) {
        bucket = { y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push({ str: item.str, x, fontSize });
    }

    // Sort line buckets from top to bottom (descending Y in PDF coordinates)
    lineBuckets.sort((a, b) => b.y - a.y);

    // Build line strings with sorted items left to right
    for (const bucket of lineBuckets) {
      bucket.items.sort((a, b) => a.x - b.x);
      const lineText = bucket.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) {
        allLines.push({
          pageNumber: pageNum,
          text: lineText,
          x: bucket.items[0]?.x || 0,
          y: bucket.y,
          fontSize: bucket.items[0]?.fontSize || 12,
        });
        fullTextBlocks.push(lineText);
      }
    }
  }

  return {
    lines: allLines,
    numPages,
    rawText: fullTextBlocks.join('\n'),
  };
}
