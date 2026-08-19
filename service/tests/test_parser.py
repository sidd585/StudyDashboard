import pytest
from service.models import ExtractedLine, MCQQuestion
from service.parser.state_machine import parse_mcq_stream
from service.parser.section_detector import is_section_heading
from service.parser.answer_key_parser import parse_answer_key_text, is_answer_key_header
from service.validator.question_validator import validate_question, validate_all_questions

def test_question_start_formats():
    lines = [
        ExtractedLine(page=1, text="1. What is the capital of Nepal?", source="native"),
        ExtractedLine(page=1, text="A. Kathmandu", source="native"),
        ExtractedLine(page=1, text="B. Pokhara", source="native"),
        ExtractedLine(page=1, text="C. Lalitpur", source="native"),
        ExtractedLine(page=1, text="D. Biratnagar", source="native"),
        ExtractedLine(page=1, text="2) Which river is the longest in Nepal?", source="native"),
        ExtractedLine(page=1, text="A. Koshi", source="native"),
        ExtractedLine(page=1, text="B. Karnali", source="native"),
        ExtractedLine(page=1, text="C. Gandaki", source="native"),
        ExtractedLine(page=1, text="D. Mahakali", source="native"),
        ExtractedLine(page=1, text="Q3. What is Mount Everest called in Nepali?", source="native"),
        ExtractedLine(page=1, text="(A) Sagarmatha", source="native"),
        ExtractedLine(page=1, text="(B) Annapurna", source="native"),
        ExtractedLine(page=1, text="(C) Manaslu", source="native"),
        ExtractedLine(page=1, text="(D) Lhotse", source="native"),
    ]
    questions, _ = parse_mcq_stream(lines)
    assert len(questions) == 3
    assert questions[0].number == 1
    assert "capital of Nepal" in questions[0].question
    assert questions[0].options["A"] == "Kathmandu"
    assert questions[1].number == 2
    assert questions[1].options["B"] == "Karnali"
    assert questions[2].number == 3
    assert questions[2].options["A"] == "Sagarmatha"

def test_section_heading_detection():
    line = ExtractedLine(page=1, text="1. Geography, Population & Environment", source="native")
    next_lines = [
        ExtractedLine(page=1, text="1. Which of the following is a component of physical geography?", source="native"),
        ExtractedLine(page=1, text="A. Population density", source="native"),
    ]
    is_sec, title = is_section_heading(line, next_lines, expected_q_num=1)
    assert is_sec is True
    assert "Geography, Population & Environment" in title

    # Mid-document section heading (e.g. section 6 before Q26)
    line_mid = ExtractedLine(page=4, text="6. Science, Technology, Public Health & Current Affairs", source="native")
    next_lines_mid = [
        ExtractedLine(page=4, text="26. The SI unit of length is:", source="native"),
    ]
    is_sec_mid, title_mid = is_section_heading(line_mid, next_lines_mid, expected_q_num=26)
    assert is_sec_mid is True
    assert "Science, Technology" in title_mid

def test_multiline_question_and_options():
    lines = [
        ExtractedLine(page=1, text="1. The process of evaluating an applicant's creditworthiness", source="native"),
        ExtractedLine(page=1, text="and financial capability before loan disbursement is termed as:", source="native"),
        ExtractedLine(page=1, text="A. Comprehensive credit appraisal and risk analysis", source="native"),
        ExtractedLine(page=1, text="carried out by credit officers", source="native"),
        ExtractedLine(page=1, text="B. Simple account balance inquiry", source="native"),
        ExtractedLine(page=1, text="C. Asset liquidation", source="native"),
        ExtractedLine(page=1, text="D. Branch auditing", source="native"),
    ]
    questions, _ = parse_mcq_stream(lines)
    assert len(questions) == 1
    assert "creditworthiness and financial capability" in questions[0].question
    assert "Comprehensive credit appraisal and risk analysis carried out by credit officers" in questions[0].options["A"]

def test_inline_options():
    lines = [
        ExtractedLine(page=1, text="41. What is 50% of 100?", source="native"),
        ExtractedLine(page=1, text="A. 25   B. 40   C. 50   D. 75", source="native"),
    ]
    questions, _ = parse_mcq_stream(lines)
    assert len(questions) == 1
    assert questions[0].options == {
        "A": "25",
        "B": "40",
        "C": "50",
        "D": "75"
    }

def test_cross_page_continuation():
    lines = [
        ExtractedLine(page=2, text="16. The supreme law of Nepal is the:", source="native"),
        ExtractedLine(page=2, text="A. Civil Code", source="native"),
        # Page boundary occurs here without ending question
        ExtractedLine(page=3, text="B. Constitution", source="native"),
        ExtractedLine(page=3, text="C. Parliament Act", source="native"),
        ExtractedLine(page=3, text="D. Local Government Act", source="native"),
        ExtractedLine(page=3, text="17. Nepal follows which form of government?", source="native"),
        ExtractedLine(page=3, text="A. Unitary", source="native"),
        ExtractedLine(page=3, text="B. Federal", source="native"),
        ExtractedLine(page=3, text="C. Monarchy", source="native"),
        ExtractedLine(page=3, text="D. Dictatorship", source="native"),
    ]
    questions, _ = parse_mcq_stream(lines)
    assert len(questions) == 2
    q16 = questions[0]
    assert q16.number == 16
    assert q16.sourcePageStart == 2
    assert q16.sourcePageEnd == 3
    assert len(q16.options) == 4
    assert q16.options["B"] == "Constitution"

def test_answer_key_parser():
    raw_key = """
    ANSWER KEY
    1. C    2. C    3. B    4. A    5. A    6. C    7. C    8. D    9. B    10. D
    11. B    12. B    13. B    14. C    15. B    16. B    17. B    18. B    19. B    20. B
    21. A    22. B    23. A    24. A    25. A    26. C    27. A    28. B    29. A    30. A
    """
    assert is_answer_key_header("ANSWER KEY") is True
    answers = parse_answer_key_text(raw_key)
    assert answers[1] == "C"
    assert answers[2] == "C"
    assert answers[3] == "B"
    assert answers[10] == "D"
    assert answers[25] == "A"
    assert answers[26] == "C"

def test_missing_answer_never_guessed():
    lines = [
        ExtractedLine(page=1, text="1. Sample question without answer key?", source="native"),
        ExtractedLine(page=1, text="A. Option 1", source="native"),
        ExtractedLine(page=1, text="B. Option 2", source="native"),
        ExtractedLine(page=1, text="C. Option 3", source="native"),
        ExtractedLine(page=1, text="D. Option 4", source="native"),
    ]
    questions, _ = parse_mcq_stream(lines)
    assert len(questions) == 1
    assert questions[0].correctAnswer is None
    assert questions[0].answerStatus == "UNKNOWN"

def test_duplicate_and_malformed_question_validation():
    q_dup = MCQQuestion(
        number=1,
        question="Duplicate question test?",
        options={"A": "One", "B": "Two", "C": "Three", "D": "Four"},
        correctAnswer="A",
        answerStatus="KNOWN"
    )
    validated_dup = validate_question(q_dup, seen_numbers={1})
    assert "Duplicate question number #1." in validated_dup.issues
    assert validated_dup.status == "NEEDS_REVIEW"

    q_malformed = MCQQuestion(
        number=2,
        question="Too short",
        options={"A": "Only one option"},
        correctAnswer=None,
        answerStatus="UNKNOWN"
    )
    validated_mal = validate_question(q_malformed, seen_numbers=set())
    assert any("Fewer than 2 options" in iss for iss in validated_mal.issues)
    assert validated_mal.status == "NEEDS_REVIEW"
