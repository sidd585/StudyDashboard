import os
import pytest
from service.extractor.pipeline import extract_from_pdf_bytes
from service.parser.state_machine import parse_mcq_stream
from service.validator.question_validator import validate_all_questions

PDF_PATH = "tests/fixtures/NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf"

@pytest.fixture
def pdf_bytes():
    if not os.path.exists(PDF_PATH):
        # Check download folder fallback
        alt_path = "C:/Users/3395/Downloads/NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf"
        if os.path.exists(alt_path):
            with open(alt_path, "rb") as f:
                return f.read()
        pytest.skip(f"Test PDF not found at {PDF_PATH}")
    with open(PDF_PATH, "rb") as f:
        return f.read()

def test_nrb_psc_pdf_full_regression(pdf_bytes):
    # 1. Extraction Pipeline
    extraction = extract_from_pdf_bytes(pdf_bytes)
    assert extraction.total_pages == 8

    # 2. State-Machine Parsing
    raw_questions, answer_map = parse_mcq_stream(extraction.lines)
    
    # 3. Validation
    response = validate_all_questions(
        questions=raw_questions,
        total_pages=extraction.total_pages,
        native_pages=extraction.native_pages,
        ocr_pages=extraction.ocr_pages,
        file_name="NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf"
    )

    questions = response.questions
    diagnostics = response.diagnostics

    # Assert exactly 50 MCQs detected
    assert len(questions) == 50
    assert diagnostics.totalDetected == 50
    assert diagnostics.hasSequentialNumbers is True
    assert diagnostics.missingNumbers == []
    assert diagnostics.duplicateNumbers == []

    # Question Numbers must be exactly 1 through 50
    q_numbers = [q.number for q in questions]
    assert q_numbers == list(range(1, 51))

    # Q1 Verification
    q1 = next((q for q in questions if q.number == 1), None)
    assert q1 is not None
    assert q1.question == "Which of the following is a component of physical geography?"
    assert q1.options["A"] == "Population density"
    assert q1.options["B"] == "Political boundaries"
    assert q1.options["C"] == "Landforms"
    assert q1.options["D"] == "Trade routes"
    assert q1.correctAnswer == "C"
    assert q1.answerStatus == "KNOWN"
    assert q1.section == "Geography, Population & Environment"

    # Q2 Verification (separate from Q1)
    q2 = next((q for q in questions if q.number == 2), None)
    assert q2 is not None
    assert "highest altitude" in q2.question
    assert q2.options["C"] == "Mountain"
    assert q2.correctAnswer == "C"

    # Cross-page Q16 (starts page 2, continues page 3)
    q16 = next((q for q in questions if q.number == 16), None)
    assert q16 is not None
    assert q16.sourcePageStart == 2
    assert q16.sourcePageEnd == 3
    assert q16.options["B"] == "Constitution"
    assert q16.correctAnswer == "B"

    # Cross-page Q33 (starts page 4, continues page 5)
    q33 = next((q for q in questions if q.number == 33), None)
    assert q33 is not None
    assert "Electronic/digital technologies" in q33.options["A"]
    assert q33.correctAnswer == "A"

    # Cross-page Q41 (starts page 5, continues page 6)
    q41 = next((q for q in questions if q.number == 41), None)
    assert q41 is not None
    assert q41.options == {"A": "25", "B": "40", "C": "50", "D": "75"}
    assert q41.correctAnswer == "C"

    # Answer Key Verification for mandatory checklist
    expected_answers = {
        1: "C",
        2: "C",
        3: "B",
        10: "D",
        25: "A",
        41: "C",
        48: "C",
        49: "B",
        50: "A",
    }

    for num, expected_ans in expected_answers.items():
        q = next((item for item in questions if item.number == num), None)
        assert q is not None, f"Question #{num} not found"
        assert q.correctAnswer == expected_ans, f"Q{num} answer expected {expected_ans}, got {q.correctAnswer}"

    # Verify no page markers or answer key markers leaked
    for q in questions:
        assert "--- Page" not in q.question
        assert "ANSWER KEY" not in q.question
        for opt_val in q.options.values():
            assert "--- Page" not in opt_val
            assert "ANSWER KEY" not in opt_val

    # Nepali font corruption detection (Q49 and Q50)
    q49 = next((q for q in questions if q.number == 49), None)
    q50 = next((q for q in questions if q.number == 50), None)
    assert q49 is not None
    assert q50 is not None
    # If native text had glyph corruption, it should be marked for review with low confidence
    if "IIII" in q49.question or "■" in q49.question:
        assert q49.status == "NEEDS_REVIEW"
        assert q49.confidence == "LOW"
