import asyncio
import pytest
from service.ai_service import (
    ResearchRequest,
    research_syllabus_and_topics,
    BlueprintRequest,
    create_practice_blueprint,
    GenerateQuestionsRequest,
    generate_ai_mcqs,
    CandidateQuestionModel,
    validate_ai_candidate,
)

def test_ai_research_syllabus():
    req = ResearchRequest(targetName="RBB IT Level 5", topic="All Topics")
    res = asyncio.run(research_syllabus_and_topics(req))
    assert res.officialSyllabusFound is True
    assert len(res.observedTopics) > 0
    assert len(res.sources) >= 3
    assert any("Networking" in t.topic or "Database" in t.topic for t in res.observedTopics)

def test_ai_practice_blueprint():
    req = BlueprintRequest(
        targetId="t1",
        targetName="RBB IT",
        topic="Networking & Switching",
        questionCount=25,
        difficulty="medium",
        style="past_pattern"
    )
    bp = create_practice_blueprint(req)
    assert bp.totalQuestions == 25
    assert bp.topic == "Networking & Switching"
    assert sum(bp.difficultyDistribution.values()) == 25
    assert sum(bp.styleDistribution.values()) == 25

def test_generate_ai_mcqs():
    req = GenerateQuestionsRequest(
        targetId="t1",
        targetName="RBB IT",
        topic="Networking & Switching",
        questionCount=10,
        difficulty="medium",
        style="past_pattern"
    )
    res = asyncio.run(generate_ai_mcqs(req))
    assert res.totalGenerated == 10
    assert res.validatedCount >= 8
    assert len(res.questions) == 10
    
    q1 = res.questions[0]
    assert q1.correctAnswer in ("A", "B", "C", "D")
    assert len(q1.options) == 4
    assert q1.origin in ("AI_PAST_PATTERN", "AI_GENERATED")
    assert q1.status == "VALIDATED"

def test_validate_ai_candidate_detects_flaws():
    seen = set()
    # Flawed question with missing option
    bad_candidate = CandidateQuestionModel(
        tempId="test-bad",
        number=1,
        question="Short",
        options={"A": "Option 1", "B": "Option 2", "C": ""},
        correctAnswer="D",
        explanation="",
        topic="General",
        difficulty="medium",
        origin="AI_GENERATED",
        status="VALIDATED",
        issues=[],
        approved=True
    )
    validated = validate_ai_candidate(bad_candidate, seen)
    assert validated.status != "VALIDATED"
    assert len(validated.issues) > 0
