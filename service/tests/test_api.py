import io
import pytest
from fastapi.testclient import TestClient
from service.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "StudyDashboard" in data["service"]
    assert "ocrAvailable" in data

def test_import_mcq_endpoint_with_nrb_pdf():
    pdf_path = "tests/fixtures/NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf"
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    response = client.post(
        "/api/import/mcq",
        files={"file": ("NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf", pdf_bytes, "application/pdf")},
        data={"targetId": "target-123", "subjectId": "subj-456"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["fileName"] == "NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf"
    assert data["pages"] == 8
    assert data["questionsDetected"] == 50
    assert len(data["questions"]) == 50
    assert data["questions"][0]["number"] == 1
    assert data["questions"][0]["correctAnswer"] == "C"
    assert data["questions"][0]["targetId"] == "target-123"
    assert data["questions"][0]["subjectId"] == "subj-456"

def test_import_invalid_file_extension():
    response = client.post(
        "/api/import/mcq",
        files={"file": ("malicious.exe", b"invalid binary", "application/octet-stream")}
    )
    assert response.status_code == 400
    assert "Unsupported file extension" in response.json()["detail"]

def test_import_empty_file():
    response = client.post(
        "/api/import/mcq",
        files={"file": ("empty.pdf", b"", "application/pdf")}
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]
