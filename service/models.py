from typing import Literal
from pydantic import BaseModel, Field

class ExtractedLine(BaseModel):
    page: int
    text: str
    x0: float | None = None
    y0: float | None = None
    x1: float | None = None
    y1: float | None = None
    source: Literal["native", "ocr"] = "native"
    font_size: float | None = None
    is_bold: bool = False

class MCQQuestion(BaseModel):
    number: int
    question: str
    options: dict[str, str] = Field(default_factory=dict)
    correctAnswer: str | None = None
    answerStatus: Literal["KNOWN", "UNKNOWN"] = "UNKNOWN"
    section: str | None = None
    sourcePageStart: int = 1
    sourcePageEnd: int = 1
    extractionMethod: Literal["native", "ocr", "mixed"] = "native"
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = "HIGH"
    status: Literal["VALID", "NEEDS_REVIEW", "INVALID"] = "VALID"
    rawSnippet: str = ""
    explanation: str = ""
    issues: list[str] = Field(default_factory=list)
    targetId: str | None = None
    subjectId: str | None = None
    topicId: str | None = None

class ImportDiagnostics(BaseModel):
    totalPages: int
    nativePages: int
    ocrPages: int
    totalDetected: int
    validCount: int
    needsReviewCount: int
    answersMappedCount: int
    hasSequentialNumbers: bool
    missingNumbers: list[int] = Field(default_factory=list)
    duplicateNumbers: list[int] = Field(default_factory=list)

class ImportResponse(BaseModel):
    fileName: str
    pages: int
    nativePages: int
    ocrPages: int
    questionsDetected: int
    validQuestions: int
    needsReview: int
    answersMapped: int
    questions: list[MCQQuestion]
    diagnostics: ImportDiagnostics | None = None

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    ocrAvailable: bool
    tesseractVersion: str | None = None
    availableLanguages: list[str] = Field(default_factory=list)
