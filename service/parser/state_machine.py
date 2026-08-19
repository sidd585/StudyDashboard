import re
from typing import Literal
from ..models import ExtractedLine, MCQQuestion
from .section_detector import is_section_heading
from .answer_key_parser import is_answer_key_header, parse_answer_key_text

# Regex patterns for matching question starters
QUESTION_START_REGEX = re.compile(
    r'^(?:Q\.?|Question\s*)?(\d+)[\.\:\)\-]\s*(.*)$',
    re.IGNORECASE
)

# Regex for matching single option line start
OPTION_START_REGEX = re.compile(
    r'^(?:\(?([A-Da-d])\)[\.\:\s]|\(?([A-Da-d])\.\s*|\b([A-Da-d])[\.\:\)]\s+)(.*)$'
)

# Regex for detecting inline options on a single line
INLINE_OPTIONS_REGEX = re.compile(
    r'(?:^|\s+)(?:\(?([A-Da-d])\)[\.\:\s]|\(?([A-Da-d])\.\s*|\b([A-Da-d])[\.\:\)]\s+)(.*?)(?=(?:\s+\(?([A-Da-d])\)[\.\:\s]|\s+\(?([A-Da-d])\.\s*|\s+\b([A-Da-d])[\.\:\)]\s+)|$)'
)

# Ignored exam header / noise patterns
HEADER_NOISE_PATTERNS = [
    re.compile(r'NRB\s*/\s*PSC\s+PRE-QUALIFYING\s+EXAM', re.IGNORECASE),
    re.compile(r'\d+\s+MCQs?\s*[\–\—\-]\s*General\s+Studies', re.IGNORECASE),
    re.compile(r'Practice\s+Set\s+\d+', re.IGNORECASE),
    re.compile(r'\d+\s+questions?\s*[\–\—\-\*]\s*\d+\s+marks', re.IGNORECASE),
    re.compile(r'Suggested\s+time\:\s*\d+\s+minutes', re.IGNORECASE),
    re.compile(r'Exam\s+note\:\s*The\s+uploaded\s+syllabus', re.IGNORECASE),
    re.compile(r'^Page\s+\d+\s+of\s+\d+', re.IGNORECASE),
]

class BuilderQuestion:
    def __init__(self, number: int, start_page: int, section: str | None = None):
        self.number = number
        self.statement_lines: list[str] = []
        self.options: dict[str, list[str]] = {'A': [], 'B': [], 'C': [], 'D': []}
        self.start_page = start_page
        self.end_page = start_page
        self.section = section
        self.raw_snippets: list[str] = []
        self.sources: set[str] = set()

    def get_statement(self) -> str:
        return " ".join(l.strip() for l in self.statement_lines if l.strip()).strip()

    def get_options_dict(self) -> dict[str, str]:
        res = {}
        for opt in ('A', 'B', 'C', 'D'):
            opt_text = " ".join(l.strip() for l in self.options[opt] if l.strip()).strip()
            if opt_text:
                res[opt] = opt_text
        return res

    def get_raw_snippet(self) -> str:
        return "\n".join(self.raw_snippets).strip()

    def get_extraction_method(self) -> Literal["native", "ocr", "mixed"]:
        if "ocr" in self.sources and "native" in self.sources:
            return "mixed"
        elif "ocr" in self.sources:
            return "ocr"
        return "native"

def is_noise_line(text: str) -> bool:
    """Check if line matches common exam header/footer noise."""
    t = text.strip()
    if not t:
        return True
    return any(p.search(t) for p in HEADER_NOISE_PATTERNS)

def parse_mcq_stream(lines: list[ExtractedLine]) -> tuple[list[MCQQuestion], dict[int, str]]:
    """
    Deterministic State-Machine parser for MCQ extraction from an ordered stream of lines.
    """
    questions: list[BuilderQuestion] = []
    current_q: BuilderQuestion | None = None
    state: Literal[
        "SEEKING_QUESTION",
        "READING_QUESTION",
        "READING_OPTION_A",
        "READING_OPTION_B",
        "READING_OPTION_C",
        "READING_OPTION_D",
        "ANSWER_KEY"
    ] = "SEEKING_QUESTION"

    current_section: str | None = None
    current_opt: str | None = None
    answer_key_lines: list[str] = []
    expected_q_num = 1

    i = 0
    total_lines = len(lines)

    while i < total_lines:
        line = lines[i]
        text = line.text.strip()

        if not text:
            i += 1
            continue

        # 1. Check if Answer Key section begins
        if is_answer_key_header(text) or state == "ANSWER_KEY":
            state = "ANSWER_KEY"
            answer_key_lines.append(text)
            i += 1
            continue

        # 2. Skip header noise
        if is_noise_line(text):
            i += 1
            continue

        # 3. Check for Section Heading (e.g. "1. Geography...", "6. Science...")
        is_sec, sec_title = is_section_heading(line, lines[i+1:i+6], expected_q_num)
        if is_sec:
            current_section = sec_title
            i += 1
            continue

        # 4. Check for New Question Start (e.g. "1. Which of the following...")
        q_match = QUESTION_START_REGEX.match(text)
        if q_match:
            number_val = int(q_match.group(1))
            statement_rest = q_match.group(2).strip()

            # Verify it's a genuine question start (matches expected or monotonically increases)
            # and isn't just an option like "1." if preceded by something else
            is_valid_q_start = (
                number_val == expected_q_num or
                (number_val > expected_q_num and number_val <= expected_q_num + 3) or
                (expected_q_num == 1)
            )

            if is_valid_q_start:
                # Finalize previous question
                if current_q:
                    questions.append(current_q)

                current_q = BuilderQuestion(
                    number=number_val,
                    start_page=line.page,
                    section=current_section
                )
                current_q.end_page = line.page
                current_q.sources.add(line.source)
                current_q.raw_snippets.append(text)

                if statement_rest:
                    current_q.statement_lines.append(statement_rest)

                expected_q_num = number_val + 1
                state = "READING_QUESTION"
                current_opt = None
                i += 1
                continue

        # 5. If we have an active question, check for Option starts (A., B., C., D.)
        if current_q is not None:
            # Check for inline options on this single line (e.g. "A. 25   B. 30   C. 35   D. 40")
            inline_matches = list(INLINE_OPTIONS_REGEX.finditer(text))
            if len(inline_matches) >= 2:
                current_q.end_page = line.page
                current_q.sources.add(line.source)
                current_q.raw_snippets.append(text)

                for m in inline_matches:
                    opt_letter = (m.group(1) or m.group(2) or m.group(3) or "").upper()
                    opt_val = m.group(4).strip()
                    if opt_letter in ('A', 'B', 'C', 'D'):
                        current_q.options[opt_letter].append(opt_val)
                        current_opt = opt_letter

                state = f"READING_OPTION_{current_opt}" if current_opt else "READING_OPTION_D"
                i += 1
                continue

            # Check single option start on line (e.g. "A. Population density")
            opt_match = OPTION_START_REGEX.match(text)
            if opt_match:
                opt_letter = (opt_match.group(1) or opt_match.group(2) or opt_match.group(3) or "").upper()
                opt_text = opt_match.group(4).strip()

                if opt_letter in ('A', 'B', 'C', 'D'):
                    current_opt = opt_letter
                    state = f"READING_OPTION_{opt_letter}"  # type: ignore
                    current_q.end_page = line.page
                    current_q.sources.add(line.source)
                    current_q.raw_snippets.append(text)
                    current_q.options[opt_letter].append(opt_text)
                    i += 1
                    continue

            # Continuation lines
            current_q.end_page = line.page
            current_q.sources.add(line.source)
            current_q.raw_snippets.append(text)

            if state == "READING_QUESTION":
                current_q.statement_lines.append(text)
            elif current_opt and current_opt in current_q.options:
                current_q.options[current_opt].append(text)

        i += 1

    if current_q:
        questions.append(current_q)

    # Parse Answer Key if any lines gathered
    raw_answer_key = "\n".join(answer_key_lines)
    answer_map = parse_answer_key_text(raw_answer_key)

    # Convert BuilderQuestions to MCQQuestions
    mcq_results: list[MCQQuestion] = []
    for bq in questions:
        q_options = bq.get_options_dict()
        q_statement = bq.get_statement()
        correct_ans = answer_map.get(bq.number)

        mcq_results.append(
            MCQQuestion(
                number=bq.number,
                question=q_statement,
                options=q_options,
                correctAnswer=correct_ans,
                answerStatus="KNOWN" if correct_ans else "UNKNOWN",
                section=bq.section,
                sourcePageStart=bq.start_page,
                sourcePageEnd=bq.end_page,
                extractionMethod=bq.get_extraction_method(),
                confidence="HIGH",
                status="VALID",
                rawSnippet=bq.get_raw_snippet(),
                explanation="",
                issues=[]
            )
        )

    return mcq_results, answer_map
