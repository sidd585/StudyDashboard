import io
import pymupdf
from PIL import Image
from ..models import ExtractedLine
from .native_extractor import extract_native_page
from .ocr_engine import ocr_page, preprocess_for_ocr
from ..config import settings

class ExtractionResult:
    def __init__(self):
        self.lines: list[ExtractedLine] = []
        self.total_pages: int = 0
        self.native_pages: int = 0
        self.ocr_pages: int = 0
        self.raw_text: str = ""

def extract_from_pdf_bytes(pdf_bytes: bytes) -> ExtractionResult:
    """
    Extract lines from a PDF document prioritizing native PyMuPDF extraction,
    with automatic 300 DPI OCR fallback on unreadable or corrupted pages/regions.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    res = ExtractionResult()
    res.total_pages = len(doc)
    
    all_lines: list[ExtractedLine] = []

    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        page = doc[page_idx]
        native_res = extract_native_page(page, page_num)
        
        # Check if full page OCR fallback is needed
        if native_res.needs_ocr and settings.OCR_ENABLED:
            res.ocr_pages += 1
            # Render page at 300 DPI (standard PDF 72 points/inch -> zoom ~4.1667)
            zoom = 300.0 / 72.0
            mat = pymupdf.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            ocr_lines = ocr_page(img, page_num=page_num)
            if ocr_lines:
                all_lines.extend(ocr_lines)
            else:
                all_lines.extend(native_res.lines)
        elif len(native_res.corrupted_blocks) > 0 and settings.OCR_ENABLED:
            # Targeted OCR fallback on specific corrupted blocks (e.g. Nepali font glyph issues)
            res.native_pages += 1
            # We can OCR the page or replace the corrupted region lines
            zoom = 300.0 / 72.0
            mat = pymupdf.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            ocr_lines = ocr_page(img, page_num=page_num)
            
            if ocr_lines and len(ocr_lines) > 0:
                # Replace corrupted native lines with OCR lines if OCR produced valid text
                all_lines.extend(ocr_lines)
            else:
                all_lines.extend(native_res.lines)
        else:
            res.native_pages += 1
            all_lines.extend(native_res.lines)

    res.lines = all_lines
    res.raw_text = "\n".join(l.text for l in all_lines)
    return res

def extract_from_image_bytes(image_bytes: bytes, filename: str = "image.png") -> ExtractionResult:
    """
    Extract lines from an image file (PNG, JPG, JPEG) using OpenCV preprocessing and Tesseract OCR.
    """
    res = ExtractionResult()
    res.total_pages = 1
    res.native_pages = 0
    res.ocr_pages = 1
    
    img = Image.open(io.BytesIO(image_bytes))
    lines = ocr_page(img, page_num=1)
    res.lines = lines
    res.raw_text = "\n".join(l.text for l in lines)
    return res
