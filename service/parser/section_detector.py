import re
from ..models import ExtractedLine

SECTION_KEYWORDS = [
    r'\bsection\b', r'\bpart\b', r'\bunit\b', r'\bmodule\b',
    r'\bgeography\b', r'\bpopulation\b', r'\benvironment\b',
    r'\beconomy\b', r'\bbanking\b', r'\bmanagement\b',
    r'\bconstitution\b', r'\blaw\b', r'\bscience\b',
    r'\btechnology\b', r'\bpublic health\b', r'\bcurrent affairs\b',
    r'\bmathematics\b', r'\benglish\b', r'\bnepali\b', r'\bcompetence\b',
    r'\bgeneral knowledge\b', r'\bgk\b', r'\baptitude\b'
]

QUESTION_STARTERS = [
    r'^which\b', r'^what\b', r'^who\b', r'^where\b', r'^when\b',
    r'^why\b', r'^how\b', r'^choose\b', r'^select\b', r'^identify\b',
    r'^consider\b', r'^find\b', r'^calculate\b', r'^if\b', r'^an\s+item\b',
    r'^the\s+(?:following|supreme|si|process|term|ratio|average|probability)\b'
]

def clean_section_title(text: str) -> str:
    """Strip leading numbering (e.g., '1. Geography...' -> 'Geography...')."""
    return re.sub(r'^(?:section|part|unit|module)?\s*\d+[\.\:\)\-]?\s*', '', text, flags=re.IGNORECASE).strip()

def is_section_heading(
    line: ExtractedLine,
    next_lines: list[ExtractedLine],
    expected_q_num: int
) -> tuple[bool, str | None]:
    """
    Determine if a line is a section heading rather than an MCQ question.
    Returns (True, cleaned_title) if it's a section heading, else (False, None).
    """
    raw = line.text.strip()
    if not raw:
        return False, None

    # Check for explicit keywords like "Section 1: General Studies", "PART A - ..."
    if re.match(r'^(?:SECTION|PART|UNIT|MODULE)\s+[A-Z0-9]+[\:\.\-]?\s*', raw, re.IGNORECASE):
        return True, clean_section_title(raw)

    # Match numbered pattern: e.g. "1. Geography, Population & Environment" or "6. Science, Technology..."
    num_match = re.match(r'^(\d+)[\.\:\)]\s+(.*)$', raw)
    if not num_match:
        return False, None

    number_in_line = int(num_match.group(1))
    title_part = num_match.group(2).strip()

    # If the text ends with a question mark, it's almost certainly a question
    if title_part.endswith('?') or '?' in title_part:
        return False, None

    # If it starts with question words (Which, What, Who, Choose, etc.), it's a question
    if any(re.search(pat, title_part, re.IGNORECASE) for pat in QUESTION_STARTERS):
        return False, None

    # Check if title contains section keywords
    has_section_keyword = any(re.search(pat, title_part, re.IGNORECASE) for pat in SECTION_KEYWORDS)

    # Case 1: At the start of document, e.g. "1. Geography..." followed shortly by "1. Which of the following..."
    if expected_q_num <= 1 and number_in_line == 1:
        for nl in next_lines[:5]:
            # If a subsequent line also starts with "1." or "Q1."
            if re.match(r'^(?:Q\.?|Question\s*)?1[\.\:\)]\s+', nl.text.strip(), re.IGNORECASE):
                return True, clean_section_title(raw)
        if has_section_keyword:
            return True, clean_section_title(raw)

    # Case 2: In the middle of document, section number does not match expected sequence
    # E.g., expected is 26, but line is "6. Science, Technology..."
    if number_in_line != expected_q_num:
        # Check if next lines contain the actual expected question number
        for nl in next_lines[:3]:
            if re.match(rf'^(?:Q\.?|Question\s*)?{expected_q_num}[\.\:\)]\s+', nl.text.strip(), re.IGNORECASE):
                return True, clean_section_title(raw)
        if has_section_keyword and number_in_line < expected_q_num:
            return True, clean_section_title(raw)

    return False, None
