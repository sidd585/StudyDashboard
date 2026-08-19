import os
import shutil
from pathlib import Path
import pytesseract

class Settings:
    PROJECT_NAME: str = "StudyDashboard MCQ Import Service"
    VERSION: str = "2.0.0"
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: set[str] = {".pdf", ".png", ".jpg", ".jpeg"}
    ALLOWED_MIME_TYPES: set[str] = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
    }
    
    # Tesseract configuration
    TESSERACT_CMD: str | None = None
    TESSDATA_DIR: str | None = None
    AVAILABLE_LANGUAGES: list[str] = []
    OCR_ENABLED: bool = False

    # CORS configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()

def configure_tesseract():
    """Detect and configure Tesseract OCR binary and language files."""
    custom_cmd = os.environ.get("TESSERACT_CMD")
    if custom_cmd and os.path.exists(custom_cmd):
        pytesseract.pytesseract.tesseract_cmd = custom_cmd
        settings.TESSERACT_CMD = custom_cmd
    else:
        system_cmd = shutil.which("tesseract")
        if system_cmd:
            pytesseract.pytesseract.tesseract_cmd = system_cmd
            settings.TESSERACT_CMD = system_cmd
        else:
            candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
                "/usr/bin/tesseract",
                "/usr/local/bin/tesseract",
            ]
            for c in candidates:
                if os.path.exists(c):
                    pytesseract.pytesseract.tesseract_cmd = c
                    settings.TESSERACT_CMD = c
                    break

    # Check if executable works
    if settings.TESSERACT_CMD:
        try:
            langs = pytesseract.get_languages(config="")
            settings.AVAILABLE_LANGUAGES = langs
            settings.OCR_ENABLED = True
        except Exception:
            settings.OCR_ENABLED = False
    else:
        settings.OCR_ENABLED = False

configure_tesseract()
