import os
import time
import logging
from typing import Annotated
import pymupdf
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import ImportResponse, HealthResponse
from .extractor.pipeline import extract_from_pdf_bytes, extract_from_image_bytes
from .parser.state_machine import parse_mcq_stream
from .validator.question_validator import validate_all_questions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mcq_service")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Dedicated Python FastAPI MCQ & Document Processing Service"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint for deployment monitoring."""
    tess_version = None
    if settings.OCR_ENABLED and settings.TESSERACT_CMD:
        try:
            import pytesseract
            tess_version = str(pytesseract.get_tesseract_version())
        except Exception:
            pass

    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        ocrAvailable=settings.OCR_ENABLED,
        tesseractVersion=tess_version,
        availableLanguages=settings.AVAILABLE_LANGUAGES
    )

@app.post("/api/import/mcq", response_model=ImportResponse)
async def import_mcqs(
    file: Annotated[UploadFile, File(description="PDF or image file to extract MCQs from")],
    targetId: Annotated[str | None, Form()] = None,
    subjectId: Annotated[str | None, Form()] = None,
    topicId: Annotated[str | None, Form()] = None,
):
    """
    Main extraction endpoint:
    Processes uploaded PDF or Image file, runs native extraction / OCR fallback,
    parses MCQs via state machine, detects section headings, parses answer keys,
    and returns strictly validated structured JSON.
    """
    start_time = time.time()
    filename = file.filename or "uploaded_file.pdf"
    ext = os.path.splitext(filename)[1].lower()

    # 1. File Safety & Format Validation
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Read content
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB."
        )

    # 2. Extract Document Content
    try:
        if ext == ".pdf":
            # Verify PDF is valid and not password-protected
            try:
                test_doc = pymupdf.open(stream=contents, filetype="pdf")
                if test_doc.is_encrypted:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Password-protected PDFs are not supported. Please remove the password and try again."
                    )
                if len(test_doc) == 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="PDF file contains 0 pages."
                    )
                test_doc.close()
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Corrupted or invalid PDF file: {str(e)}"
                )

            extraction_result = extract_from_pdf_bytes(contents)
        else:
            # Image file
            extraction_result = extract_from_image_bytes(contents, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during document extraction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}"
        )

    # 3. State-Machine MCQ Parsing
    try:
        raw_questions, answer_map = parse_mcq_stream(extraction_result.lines)
    except Exception as e:
        logger.error(f"Error during MCQ parsing: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MCQ state-machine parsing failed: {str(e)}"
        )

    # Attach optional metadata
    for q in raw_questions:
        if targetId:
            q.targetId = targetId
        if subjectId:
            q.subjectId = subjectId
        if topicId:
            q.topicId = topicId

    # 4. Strict Validation
    response = validate_all_questions(
        questions=raw_questions,
        total_pages=extraction_result.total_pages,
        native_pages=extraction_result.native_pages,
        ocr_pages=extraction_result.ocr_pages,
        file_name=filename
    )

    elapsed_time = time.time() - start_time
    logger.info(
        f"Processed '{filename}': Pages={response.pages} (Native={response.nativePages}, OCR={response.ocrPages}), "
        f"Questions={response.questionsDetected} (Valid={response.validQuestions}, NeedsReview={response.needsReview}), "
        f"AnswersMapped={response.answersMapped}, Time={elapsed_time:.2f}s"
    )

    return response

# ==================== AI Study Builder Endpoints ====================

from .ai_service import (
    ResearchRequest, ResearchResponse, research_syllabus_and_topics,
    BlueprintRequest, BlueprintResponse, create_practice_blueprint,
    GenerateQuestionsRequest, GenerateQuestionsResponse, generate_ai_mcqs
)

@app.post("/api/ai/research", response_model=ResearchResponse)
async def api_ai_research(req: ResearchRequest):
    """Analyze target syllabus and return verified topics and sources."""
    try:
        return await research_syllabus_and_topics(req)
    except Exception as e:
        logger.error(f"AI research failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI research failed: {str(e)}")

@app.post("/api/ai/blueprint", response_model=BlueprintResponse)
def api_ai_blueprint(req: BlueprintRequest):
    """Generate structured practice blueprint with balanced topic and difficulty splits."""
    try:
        return create_practice_blueprint(req)
    except Exception as e:
        logger.error(f"AI blueprint failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI blueprint failed: {str(e)}")

# ==================== Email Reporting Endpoints ====================

from .email_service import (
    DailySummaryEmailRequest, PreStudyReminderRequest, EmailSendResponse,
    build_daily_summary_html, send_resend_email
)

@app.post("/api/email/daily-summary", response_model=EmailSendResponse)
async def api_email_daily_summary(req: DailySummaryEmailRequest):
    """Generate nightly study summary email with 7-day server chart."""
    try:
        html = build_daily_summary_html(req)
        subject = f"StudyDashboard Daily Summary — {req.userName} ({req.todayFocusMinutes}m focused)"
        success, email_id = await send_resend_email(req.recipientEmail, subject, html)
        return EmailSendResponse(
            success=success,
            message="Nightly study summary generated successfully",
            emailId=email_id,
            previewHtml=html
        )
    except Exception as e:
        logger.error(f"Daily summary email error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate daily summary: {str(e)}")

@app.post("/api/email/pre-study-reminder", response_model=EmailSendResponse)
async def api_email_pre_study_reminder(req: PreStudyReminderRequest):
    """Send 15-minute pre-study reminder email."""
    try:
        html = f"""
        <div style="font-family: sans-serif; padding: 20px; background: #f8fafc; border-radius: 12px;">
            <h2 style="color: #6366f1;">Upcoming Study Session in 15 Minutes</h2>
            <p>Hi <strong>{req.userName}</strong>,</p>
            <p>Your study session for <strong>{req.targetName}</strong> is scheduled to begin at <strong>{req.plannedStartTime}</strong> ({req.plannedDurationMinutes} minutes).</p>
            <p>Today's progress: {req.todayCompletedMinutes}m / {req.todayTargetMinutes}m completed.</p>
        </div>
        """
        subject = f"Upcoming Study Session: {req.targetName} at {req.plannedStartTime}"
        success, email_id = await send_resend_email(req.recipientEmail, subject, html)
        return EmailSendResponse(
            success=success,
            message="Pre-study reminder dispatched successfully",
            emailId=email_id,
            previewHtml=html
        )
    except Exception as e:
        logger.error(f"Pre-study reminder email error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to dispatch reminder: {str(e)}")

