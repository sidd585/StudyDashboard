import re
import cv2
import numpy as np
from PIL import Image
import pytesseract
from pytesseract import Output
from ..models import ExtractedLine
from ..config import settings

def detect_text_quality(text: str) -> float:
    """
    Calculate text quality score from 0.0 to 1.0.
    Penalizes replacement chars, unprintable chars, unicode boxes, and repeating dummy characters (e.g. IIIIII).
    """
    if not text or len(text.strip()) == 0:
        return 0.0

    raw = text.strip()
    total_len = len(raw)
    
    # 1. Count severe corruption glyphs
    corrupt_chars = raw.count('\ufffd') + raw.count('■') + raw.count('□')
    
    # 2. Count repeating placeholder patterns like "IIIIII", "lllllll", "|||||"
    dummy_patterns = re.findall(r'[I|l1]{4,}', raw)
    dummy_char_count = sum(len(p) for p in dummy_patterns)
    
    # 3. Count valid characters (alphanumeric, spaces, punctuation, devanagari range \u0900-\u097F)
    valid_chars = len(re.findall(r'[\w\s\.,\?\!\:\;\-\(\)\/\"\'\%\$\&@#\+\=\<\>\[\]\u0900-\u097F]', raw))
    
    bad_count = corrupt_chars * 2 + dummy_char_count
    score = max(0.0, (valid_chars - bad_count) / max(1, total_len))
    return min(1.0, score)

def deskew_image(image_cv: np.ndarray) -> np.ndarray:
    """
    Detect text orientation/skew angle and rotate to upright.
    """
    try:
        if len(image_cv.shape) == 3:
            gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
        else:
            gray = image_cv.copy()
            
        # Invert colors: text becomes white on black background
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
        
        # Find coordinates of all white pixels
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) < 50:
            return image_cv
            
        angle = cv2.minAreaRect(coords)[-1]
        
        # Correct OpenCV angle logic
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle
            
        # Only deskew if angle is noticeable (>0.5 deg and < 20 deg)
        if 0.5 < abs(angle) < 20.0:
            (h, w) = image_cv.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(image_cv, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
            
        return image_cv
    except Exception:
        return image_cv

def preprocess_for_ocr(image_cv: np.ndarray) -> np.ndarray:
    """
    Intelligent OpenCV preprocessing:
    Grayscale -> Bilateral noise filtering -> CLAHE contrast enhancement -> Otsu thresholding -> Deskew
    """
    if len(image_cv.shape) == 3:
        gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
    else:
        gray = image_cv.copy()

    # 1. Noise reduction preserving edges
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)

    # 2. Contrast enhancement via CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    # 3. Adaptive / Otsu Thresholding
    thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

    # 4. Deskew
    deskewed = deskew_image(thresh)
    return deskewed

def ocr_page(
    image: np.ndarray | Image.Image,
    page_num: int = 1,
    lang: str = "eng+nep",
    psm: int = 6
) -> list[ExtractedLine]:
    """
    Run Tesseract OCR on a page image and return structured ExtractedLine instances.
    """
    if not settings.OCR_ENABLED:
        return []

    # Choose available languages
    target_lang = "eng"
    if "nep" in settings.AVAILABLE_LANGUAGES and "eng" in settings.AVAILABLE_LANGUAGES:
        target_lang = "eng+nep"
    elif "nep" in settings.AVAILABLE_LANGUAGES:
        target_lang = "nep"
    elif "eng" in settings.AVAILABLE_LANGUAGES:
        target_lang = "eng"

    if isinstance(image, Image.Image):
        img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    else:
        img_cv = image

    processed = preprocess_for_ocr(img_cv)
    config = f"--oem 3 --psm {psm}"

    try:
        data = pytesseract.image_to_data(processed, lang=target_lang, config=config, output_type=Output.DICT)
    except Exception:
        try:
            # Fallback to eng if nep package failed
            data = pytesseract.image_to_data(processed, lang="eng", config=config, output_type=Output.DICT)
        except Exception:
            return []

    lines_dict: dict[tuple[int, int], list[tuple[str, int, int, int, int]]] = {}
    n_boxes = len(data['level'])
    
    for i in range(n_boxes):
        text = data['text'][i].strip()
        if not text:
            continue
        block_num = data['block_num'][i]
        line_num = data['line_num'][i]
        x = data['left'][i]
        y = data['top'][i]
        w = data['width'][i]
        h = data['height'][i]
        
        key = (block_num, line_num)
        if key not in lines_dict:
            lines_dict[key] = []
        lines_dict[key].append((text, x, y, x + w, y + h))

    extracted_lines: list[ExtractedLine] = []
    for key, words in lines_dict.items():
        if not words:
            continue
        line_text = " ".join(w[0] for w in words)
        min_x0 = min(w[1] for w in words)
        min_y0 = min(w[2] for w in words)
        max_x1 = max(w[3] for w in words)
        max_y1 = max(w[4] for w in words)

        extracted_lines.append(
            ExtractedLine(
                page=page_num,
                text=line_text,
                x0=float(min_x0),
                y0=float(min_y0),
                x1=float(max_x1),
                y1=float(max_y1),
                source="ocr",
                font_size=float(max_y1 - min_y0),
                is_bold=False
            )
        )

    # Sort lines by vertical position
    extracted_lines.sort(key=lambda l: (l.y0 if l.y0 is not None else 0))
    return extracted_lines
