import re
from ..models import MCQQuestion, ImportDiagnostics, ImportResponse
from ..extractor.ocr_engine import detect_text_quality

CORRUPT_GLYPH_REGEX = re.compile(r'[\ufffd■□]|\b[I|l1]{4,}\b')
LEAKED_Q_REGEX = re.compile(r'\b(?:1[0-9]|2[0-9]|3[0-9]|4[0-9]|50)\.\s+[A-Z]')

def validate_question(q: MCQQuestion, seen_numbers: set[int]) -> MCQQuestion:
    """
    Validate a single MCQ against strict structural rules and assign confidence/status.
    """
    issues: list[str] = []
    
    # 1. Question text validation
    if not q.question or len(q.question.strip()) < 5:
        issues.append("Question statement is missing or too short.")

    # Check for leaked page headers or answer key text in question
    if "ANSWER KEY" in q.question.upper():
        issues.append("Answer key leaked into question statement.")
    if "--- PAGE" in q.question.upper():
        issues.append("Page marker leaked into question statement.")
    if LEAKED_Q_REGEX.search(q.question):
        issues.append("Possible embedded subsequent question detected in question statement.")

    # Check for corruption in question text
    q_quality = detect_text_quality(q.question)
    if q_quality < 0.60 or CORRUPT_GLYPH_REGEX.search(q.question):
        issues.append("Corrupted font or OCR glyphs detected in question statement.")

    # 2. Options validation
    opt_keys = list(q.options.keys())
    if len(opt_keys) < 2:
        issues.append("Fewer than 2 options detected.")
    elif len(opt_keys) < 4:
        issues.append(f"Only {len(opt_keys)} options detected (expected 4).")

    for opt_id, opt_text in q.options.items():
        if not opt_text.strip():
            issues.append(f"Option {opt_id} is empty.")
        if "ANSWER KEY" in opt_text.upper():
            issues.append(f"Answer key leaked into option {opt_id}.")
        if "--- PAGE" in opt_text.upper():
            issues.append(f"Page marker leaked into option {opt_id}.")
        if LEAKED_Q_REGEX.search(opt_text):
            issues.append(f"Possible embedded subsequent question detected in option {opt_id}.")
        
        opt_quality = detect_text_quality(opt_text)
        if opt_quality < 0.60 or CORRUPT_GLYPH_REGEX.search(opt_text):
            issues.append(f"Corrupted font or OCR glyphs detected in option {opt_id}.")

    # 3. Duplicate question number
    if q.number in seen_numbers:
        issues.append(f"Duplicate question number #{q.number}.")

    # 4. Correct answer validity
    if q.correctAnswer:
        if q.correctAnswer not in ('A', 'B', 'C', 'D'):
            issues.append(f"Invalid answer '{q.correctAnswer}'.")
            q.correctAnswer = None
            q.answerStatus = "UNKNOWN"
        elif q.correctAnswer not in q.options:
            issues.append(f"Answer '{q.correctAnswer}' references a nonexistent option.")
    else:
        q.answerStatus = "UNKNOWN"

    # 5. Determine Confidence and Status
    q.issues = issues
    if len(issues) == 0:
        q.confidence = "HIGH"
        q.status = "VALID"
    elif any("Corrupted" in iss or "Fewer than 2" in iss or "missing" in iss for iss in issues):
        q.confidence = "LOW"
        q.status = "NEEDS_REVIEW"
    elif any("Only 3" in iss or "Duplicate" in iss or "embedded" in iss for iss in issues):
        q.confidence = "MEDIUM"
        q.status = "NEEDS_REVIEW"
    else:
        q.confidence = "MEDIUM"
        q.status = "VALID"

    return q

def validate_all_questions(
    questions: list[MCQQuestion],
    total_pages: int,
    native_pages: int,
    ocr_pages: int,
    file_name: str
) -> ImportResponse:
    """
    Validate all extracted questions and construct full ImportResponse with diagnostics.
    """
    seen_numbers: set[int] = set()
    validated_questions: list[MCQQuestion] = []
    duplicate_numbers: list[int] = []

    for q in questions:
        if q.number in seen_numbers:
            duplicate_numbers.append(q.number)
        validated = validate_question(q, seen_numbers)
        seen_numbers.add(q.number)
        validated_questions.append(validated)

    # Sort questions by question number
    validated_questions.sort(key=lambda x: x.number)

    extracted_numbers = [q.number for q in validated_questions]
    max_num = max(extracted_numbers) if extracted_numbers else 0
    min_num = min(extracted_numbers) if extracted_numbers else 1
    
    expected_full_set = set(range(1, max_num + 1)) if max_num > 0 else set()
    missing_numbers = sorted(list(expected_full_set - seen_numbers))
    has_sequential = len(missing_numbers) == 0 and len(duplicate_numbers) == 0 and len(validated_questions) > 0

    valid_count = sum(1 for q in validated_questions if q.status == "VALID")
    needs_review_count = sum(1 for q in validated_questions if q.status == "NEEDS_REVIEW" or q.status == "INVALID")
    answers_mapped_count = sum(1 for q in validated_questions if q.correctAnswer is not None)

    diagnostics = ImportDiagnostics(
        totalPages=total_pages,
        nativePages=native_pages,
        ocrPages=ocr_pages,
        totalDetected=len(validated_questions),
        validCount=valid_count,
        needsReviewCount=needs_review_count,
        answersMappedCount=answers_mapped_count,
        hasSequentialNumbers=has_sequential,
        missingNumbers=missing_numbers,
        duplicateNumbers=duplicate_numbers,
    )

    return ImportResponse(
        fileName=file_name,
        pages=total_pages,
        nativePages=native_pages,
        ocrPages=ocr_pages,
        questionsDetected=len(validated_questions),
        validQuestions=valid_count,
        needsReview=needs_review_count,
        answersMapped=answers_mapped_count,
        questions=validated_questions,
        diagnostics=diagnostics
    )
