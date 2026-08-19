import os
import logging
from typing import Literal
from pydantic import BaseModel, Field
import httpx

logger = logging.getLogger("email_service")

class DailyFocusDay(BaseModel):
    dayLabel: str
    fullDate: str
    minutes: int

class DailySummaryEmailRequest(BaseModel):
    userId: str
    userName: str
    recipientEmail: str
    todayFocusMinutes: int
    dailyGoalMinutes: int
    goalCompletionPct: int
    mcqsAttempted: int
    mcqsCorrect: int
    mcqsWrong: int
    accuracyPct: int | None = None
    targetBreakdown: dict[str, int] = Field(default_factory=dict)
    strongestTopic: str | None = None
    strongestTopicPct: int | None = None
    needsAttentionTopic: str | None = None
    needsAttentionTopicPct: int | None = None
    tomorrowTargetName: str | None = None
    tomorrowStartTime: str | None = None
    tomorrowDurationMinutes: int | None = None
    last7DaysFocus: list[DailyFocusDay] = Field(default_factory=list)

class PreStudyReminderRequest(BaseModel):
    userId: str
    userName: str
    recipientEmail: str
    targetName: str
    plannedStartTime: str
    plannedDurationMinutes: int
    todayTargetMinutes: int
    todayCompletedMinutes: int

class EmailSendResponse(BaseModel):
    success: bool
    message: str
    emailId: str | None = None
    previewHtml: str | None = None

def generate_7day_chart_svg(days: list[DailyFocusDay]) -> str:
    """Generate a lightweight, clean, server-side SVG bar chart for HTML emails."""
    if not days:
        days = [
            DailyFocusDay(dayLabel="Sun", fullDate="", minutes=0),
            DailyFocusDay(dayLabel="Mon", fullDate="", minutes=0),
            DailyFocusDay(dayLabel="Tue", fullDate="", minutes=0),
            DailyFocusDay(dayLabel="Wed", fullDate="", minutes=0),
            DailyFocusDay(dayLabel="Thu", fullDate="", minutes=0),
            DailyFocusDay(dayLabel="Fri", fullDate="", minutes=0),
            DailyFocusDay(dayLabel="Sat", fullDate="", minutes=0),
        ]

    max_mins = max(1, max(d.minutes for d in days))
    chart_height = 100
    chart_width = 350
    bar_width = 30
    gap = (chart_width - (len(days) * bar_width)) / (len(days) + 1)

    svg_bars = []
    for i, d in enumerate(days):
        x = gap + i * (bar_width + gap)
        h = max(4, int((d.minutes / max_mins) * (chart_height - 30)))
        y = chart_height - 20 - h
        hrs_text = f"{d.minutes}m" if d.minutes < 60 else f"{d.minutes/60:.1f}h"
        color = "#6366f1" if d.minutes > 0 else "#cbd5e1"

        svg_bars.append(f"""
        <g>
            <rect x="{x:.1f}" y="{y:.1f}" width="{bar_width}" height="{h}" rx="4" fill="{color}" />
            <text x="{x + bar_width/2:.1f}" y="{y - 4:.1f}" text-anchor="middle" font-size="10" font-family="Helvetica, Arial, sans-serif" fill="#64748b">{hrs_text}</text>
            <text x="{x + bar_width/2:.1f}" y="{chart_height - 4:.1f}" text-anchor="middle" font-size="11" font-family="Helvetica, Arial, sans-serif" font-weight="bold" fill="#334155">{d.dayLabel}</text>
        </g>
        """)

    return f"""
    <svg width="{chart_width}" height="{chart_height}" viewBox="0 0 {chart_width} {chart_height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="{chart_width}" height="{chart_height}" fill="#f8fafc" rx="8" />
        {''.join(svg_bars)}
    </svg>
    """

def build_daily_summary_html(req: DailySummaryEmailRequest) -> str:
    """Build high-clarity responsive HTML email for nightly study summary."""
    chart_svg = generate_7day_chart_svg(req.last7DaysFocus)
    
    # Target breakdown rows
    target_rows = ""
    if req.targetBreakdown:
        for t_name, mins in req.targetBreakdown.items():
            hrs_formatted = f"{mins // 60}h {mins % 60}m" if mins >= 60 else f"{mins}m"
            target_rows += f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; font-size: 13px; color: #334155; font-weight: 600;">{t_name}</td>
                <td style="padding: 8px 0; font-size: 13px; color: #6366f1; font-weight: bold; text-align: right;">{hrs_formatted}</td>
            </tr>
            """
    else:
        target_rows = "<tr><td colspan='2' style='padding: 8px 0; font-size: 13px; color: #94a3b8;'>No target sessions recorded today.</td></tr>"

    focus_formatted = f"{req.todayFocusMinutes // 60}h {req.todayFocusMinutes % 60}m" if req.todayFocusMinutes >= 60 else f"{req.todayFocusMinutes}m"
    goal_formatted = f"{req.dailyGoalMinutes // 60}h {req.dailyGoalMinutes % 60}m" if req.dailyGoalMinutes >= 60 else f"{req.dailyGoalMinutes}m"

    tomorrow_section = ""
    if req.tomorrowTargetName and req.tomorrowStartTime:
        tomorrow_section = f"""
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; margin-top: 20px;">
            <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: bold; color: #16a34a; letter-spacing: 0.5px;">Upcoming Tomorrow</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: bold; color: #1e293b;">{req.tomorrowTargetName}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">Scheduled for {req.tomorrowStartTime} ({req.tomorrowDurationMinutes or 45} minutes)</p>
        </div>
        """

    accuracy_text = f"{req.accuracyPct}%" if req.accuracyPct is not None else "—"

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <!-- Header -->
            <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #6366f1; letter-spacing: 0.5px;">StudyDashboard • Asia/Kathmandu (10:00 PM)</p>
                <h2 style="margin: 4px 0 0 0; font-size: 20px; color: #0f172a;">Daily Summary — {req.userName}</h2>
            </div>

            <!-- Stats Grid -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="width: 50%; padding: 10px; background: #f8fafc; border-radius: 10px; border: 1px solid #edf2f7;">
                        <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b;">Focus Time</span>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #0f172a;">{focus_formatted} <span style="font-size: 12px; color: #94a3b8; font-weight: normal;">/ {goal_formatted}</span></p>
                    </td>
                    <td style="width: 8px;"></td>
                    <td style="width: 50%; padding: 10px; background: #f8fafc; border-radius: 10px; border: 1px solid #edf2f7;">
                        <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b;">Goal Progress</span>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #16a34a;">{req.goalCompletionPct}%</p>
                    </td>
                </tr>
                <tr><td colspan="3" style="height: 8px;"></td></tr>
                <tr>
                    <td style="width: 50%; padding: 10px; background: #f8fafc; border-radius: 10px; border: 1px solid #edf2f7;">
                        <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b;">MCQs Today</span>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #0f172a;">{req.mcqsAttempted} <span style="font-size: 11px; color: #16a34a;">({req.mcqsCorrect}✓)</span></p>
                    </td>
                    <td style="width: 8px;"></td>
                    <td style="width: 50%; padding: 10px; background: #f8fafc; border-radius: 10px; border: 1px solid #edf2f7;">
                        <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b;">Accuracy</span>
                        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #6366f1;">{accuracy_text}</p>
                    </td>
                </tr>
            </table>

            <!-- Target Breakdown -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Target Breakdown</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    {target_rows}
                </table>
            </div>

            <!-- Strengths & Weaknesses -->
            {(f'''
            <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 10px; padding: 10px; margin-bottom: 16px;">
                <p style="margin: 0; font-size: 12px; color: #9d174d;"><strong>Needs Attention:</strong> {req.needsAttentionTopic} ({req.needsAttentionTopicPct}%)</p>
            </div>
            ''' if req.needsAttentionTopic else '')}

            <!-- Server-Generated 7-Day Chart -->
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Last 7 Days Consistency</h4>
                <div style="text-align: center;">
                    {chart_svg}
                </div>
            </div>

            {tomorrow_section}

            <!-- Footer -->
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">StudyDashboard • Siddhartha & Shilpa Daily Study Tracker</p>
            </div>
        </div>
    </body>
    </html>
    """

async def send_resend_email(to_email: str, subject: str, html_body: str) -> tuple[bool, str | None]:
    """Send email via Resend API if RESEND_API_KEY is configured on server."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.info(f"RESEND_API_KEY not configured. Email preview generated for '{to_email}'.")
        return True, "simulated-preview-id"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "StudyDashboard <study@resend.dev>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html_body,
                },
            )
            if res.status_code in (200, 201):
                data = res.json()
                return True, data.get("id")
            else:
                logger.error(f"Resend API error: {res.status_code} {res.text}")
                return False, None
    except Exception as e:
        logger.error(f"Failed to dispatch email via Resend: {e}")
        return False, None
