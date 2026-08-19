import pytest
from service.email_service import (
    DailySummaryEmailRequest,
    DailyFocusDay,
    generate_7day_chart_svg,
    build_daily_summary_html,
)

def test_generate_7day_chart_svg():
    days = [
        DailyFocusDay(dayLabel="Sun", fullDate="2026-08-13", minutes=60),
        DailyFocusDay(dayLabel="Mon", fullDate="2026-08-14", minutes=90),
        DailyFocusDay(dayLabel="Tue", fullDate="2026-08-15", minutes=45),
        DailyFocusDay(dayLabel="Wed", fullDate="2026-08-16", minutes=120),
        DailyFocusDay(dayLabel="Thu", fullDate="2026-08-17", minutes=0),
        DailyFocusDay(dayLabel="Fri", fullDate="2026-08-18", minutes=110),
        DailyFocusDay(dayLabel="Sat", fullDate="2026-08-19", minutes=50),
    ]
    svg = generate_7day_chart_svg(days)
    assert "<svg" in svg
    assert "</svg>" in svg
    assert "Sun" in svg
    assert "Sat" in svg

def test_build_daily_summary_html():
    req = DailySummaryEmailRequest(
        userId="sid-123",
        userName="Siddhartha",
        recipientEmail="siddhartha@example.com",
        todayFocusMinutes=134,
        dailyGoalMinutes=180,
        goalCompletionPct=75,
        mcqsAttempted=68,
        mcqsCorrect=54,
        mcqsWrong=14,
        accuracyPct=79,
        targetBreakdown={
            "RBB IT": 65,
            "NRB Economics": 44,
            "AI Course": 25
        },
        strongestTopic="Networking",
        strongestTopicPct=86,
        needsAttentionTopic="Database",
        needsAttentionTopicPct=58,
        tomorrowTargetName="RBB IT / Networking",
        tomorrowStartTime="7:00 PM",
        tomorrowDurationMinutes=45
    )
    html = build_daily_summary_html(req)
    assert "Daily Summary — Siddhartha" in html
    assert "2h 14m" in html
    assert "75%" in html
    assert "68" in html
    assert "54✓" in html
    assert "79%" in html
    assert "RBB IT" in html
    assert "Networking" in html
    assert "Database" in html
    assert "<svg" in html
