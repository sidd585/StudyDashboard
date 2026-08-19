import re
from typing import Literal

ANSWER_KEY_HEADER_REGEX = re.compile(
    r'^\s*(?:ANSWER\s*KEY|ANSWERS?|SOLUTIONS?|CORRECT\s*ANSWERS?|KEY\s*ANSWERS?)\b',
    re.IGNORECASE
)

# Pattern 1: "1. C", "1) B", "1: A", "1 - D", "1. (C)", "1.(C)"
PAIR_REGEX_1 = re.compile(r'(?:Q\.?|Question\s*)?(\d+)[\.\:\)\-\s]+\(?([A-Da-d])\)?(?:\s+|$|,|;)')

# Pattern 2: "1-C", "1:C", "1.C" (compact)
PAIR_REGEX_2 = re.compile(r'(?:Q\.?|Question\s*)?(\d+)[\.\:\-\=]\s*([A-Da-d])\b')

def is_answer_key_header(text: str) -> bool:
    """Check if line is an answer key header."""
    return bool(ANSWER_KEY_HEADER_REGEX.search(text.strip()))

def parse_answer_key_text(text: str) -> dict[int, Literal["A", "B", "C", "D"]]:
    """
    Extract mapping of question numbers to answer options (A, B, C, D) from answer key text.
    Supports inline grids, multiline lists, dash/colon separated items, and compact pairs.
    """
    answers: dict[int, Literal["A", "B", "C", "D"]] = {}
    if not text:
        return answers

    # Look for pair patterns
    # Match standard spaced pairs first
    for match in PAIR_REGEX_1.finditer(text):
        q_num = int(match.group(1))
        ans_letter = match.group(2).upper()
        if ans_letter in ('A', 'B', 'C', 'D'):
            answers[q_num] = ans_letter  # type: ignore

    # If few pairs found, try compact regex
    if len(answers) < 5:
        for match in PAIR_REGEX_2.finditer(text):
            q_num = int(match.group(1))
            ans_letter = match.group(2).upper()
            if ans_letter in ('A', 'B', 'C', 'D'):
                answers[q_num] = ans_letter  # type: ignore

    return answers
