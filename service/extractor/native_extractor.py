import pymupdf
from ..models import ExtractedLine
from .ocr_engine import detect_text_quality

class PageExtractionResult:
    def __init__(self, page_num: int):
        self.page_num = page_num
        self.lines: list[ExtractedLine] = []
        self.quality_score: float = 1.0
        self.needs_ocr: bool = False
        self.corrupted_blocks: list[tuple[float, float, float, float]] = []

def extract_native_page(page: pymupdf.Page, page_num: int) -> PageExtractionResult:
    """
    Extract structured text blocks, lines, bounding boxes, font sizes and quality metrics from a PDF page using PyMuPDF.
    """
    res = PageExtractionResult(page_num=page_num)
    
    # Extract text with detailed layout dictionary
    page_dict = page.get_text("dict")
    raw_text = page.get_text("text")
    
    overall_quality = detect_text_quality(raw_text)
    res.quality_score = overall_quality
    
    # If the page has almost no text or very low quality, mark the whole page for OCR fallback
    if len(raw_text.strip()) < 20 or overall_quality < 0.35:
        res.needs_ocr = True

    blocks = page_dict.get("blocks", [])
    for block in blocks:
        # Block type 0 is text
        if block.get("type") == 0:
            bbox = block.get("bbox", (0, 0, 0, 0))
            block_lines_text = []
            
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                line_text = "".join(span.get("text", "") for span in spans).strip()
                if not line_text:
                    continue
                
                block_lines_text.append(line_text)
                
                # Compute line font properties
                font_sizes = [span.get("size", 12.0) for span in spans if span.get("size")]
                avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 12.0
                
                # Check if spans have bold flag (flag & 2 != 0 or 'bold' in font name)
                is_bold = any(
                    (span.get("flags", 0) & 2 != 0) or ("bold" in span.get("font", "").lower())
                    for span in spans
                )
                
                line_bbox = line.get("bbox", bbox)
                
                res.lines.append(
                    ExtractedLine(
                        page=page_num,
                        text=line_text,
                        x0=float(line_bbox[0]),
                        y0=float(line_bbox[1]),
                        x1=float(line_bbox[2]),
                        y1=float(line_bbox[3]),
                        source="native",
                        font_size=float(avg_font_size),
                        is_bold=is_bold
                    )
                )

            # Check if this specific block is corrupted (e.g. Nepali font glyph issues)
            block_full_text = " ".join(block_lines_text)
            block_quality = detect_text_quality(block_full_text)
            if block_quality < 0.65 and len(block_full_text) > 5:
                res.corrupted_blocks.append((bbox[0], bbox[1], bbox[2], bbox[3]))

    # Sort lines in reading order (top-to-bottom, left-to-right)
    res.lines.sort(key=lambda l: (l.y0 if l.y0 is not None else 0, l.x0 if l.x0 is not None else 0))
    return res
