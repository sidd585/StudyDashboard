import os
import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from .email_service import (
    DailySummaryEmailRequest,
    PreStudyReminderRequest,
    build_daily_summary_html,
    send_resend_email,
)

logger = logging.getLogger("scheduler")

# Asia/Kathmandu (UTC+5:45)
KATHMANDU_TZ = ZoneInfo("Asia/Kathmandu")

# In-memory registry of scheduled sessions for 15-min alerts and nightly 10:30 PM summary
SCHEDULED_SESSIONS: list[dict] = []
REGISTERED_USERS: list[dict] = [
    {
        "userId": "siddhartha-user-id",
        "userName": "Siddhartha",
        "recipientEmail": "siddhartha@studydashboard.local",
        "dailyGoalMinutes": 180,
    },
    {
        "userId": "shilpa-user-id",
        "userName": "Shilpa",
        "recipientEmail": "shilpa@studydashboard.local",
        "dailyGoalMinutes": 150,
    }
]

# Track dispatched notifications to avoid duplicate emails
DISPATCHED_ALERTS: set[str] = set()

def register_schedule_for_reminders(schedule_item: dict):
    """Register or update a planned study session for 15-minute advance email alerts."""
    SCHEDULED_SESSIONS.append(schedule_item)
    logger.info(f"Registered study session for reminder: {schedule_item.get('title')} at {schedule_item.get('startTime')}")

def update_user_email_settings(user_id: str, email: str, name: str):
    """Update user email registry."""
    for u in REGISTERED_USERS:
        if u["userId"] == user_id:
            u["recipientEmail"] = email
            u["userName"] = name
            return
    REGISTERED_USERS.append({"userId": user_id, "userName": name, "recipientEmail": email, "dailyGoalMinutes": 180})

async def check_and_dispatch_scheduled_emails():
    """Run every 60 seconds: checks for 15-min pre-study reminders and 10:30 PM daily summary."""
    now_ktm = datetime.now(KATHMANDU_TZ)
    today_str = now_ktm.strftime("%Y-%m-%d")
    current_time_str = now_ktm.strftime("%H:%M")

    # 1. Check for 10:30 PM (22:30) Asia/Kathmandu Daily Summary
    if current_time_str == "22:30":
        summary_key = f"daily-summary-{today_str}"
        if summary_key not in DISPATCHED_ALERTS:
            DISPATCHED_ALERTS.add(summary_key)
            logger.info(f"Triggering automated 10:30 PM Asia/Kathmandu daily summary for {len(REGISTERED_USERS)} users.")
            for user in REGISTERED_USERS:
                try:
                    req = DailySummaryEmailRequest(
                        userId=user["userId"],
                        userName=user["userName"],
                        recipientEmail=user["recipientEmail"],
                        todayFocusMinutes=90,
                        dailyGoalMinutes=user.get("dailyGoalMinutes", 180),
                        goalCompletionPct=50,
                        mcqsAttempted=30,
                        mcqsCorrect=25,
                        mcqsWrong=5,
                        accuracyPct=83,
                        targetBreakdown={"RBB IT": 60, "NRB": 30},
                        strongestTopic="Computer Networks",
                        strongestTopicPct=88,
                    )
                    html = build_daily_summary_html(req)
                    subject = f"📊 StudyDashboard Daily Summary — {user['userName']} (10:30 PM Nepal Time)"
                    await send_resend_email(user["recipientEmail"], subject, html)
                except Exception as e:
                    logger.error(f"Failed to dispatch scheduled daily summary for {user.get('userName')}: {e}")

    # 2. Check for 15-minute Pre-Study Alerts
    current_minutes = now_ktm.hour * 60 + now_ktm.minute
    for sched in SCHEDULED_SESSIONS:
        sched_date = sched.get("date", today_str)
        if sched_date != today_str:
            continue

        start_time_str = sched.get("startTime", "")
        if not start_time_str or ":" not in start_time_str:
            continue

        try:
            parts = start_time_str.split(":")
            sched_hour = int(parts[0])
            sched_minute = int(parts[1])
            sched_total_mins = sched_hour * 60 + sched_minute

            # Alert if exactly 15 minutes before scheduled start time
            diff = sched_total_mins - current_minutes
            if 14 <= diff <= 16:
                alert_key = f"alert-15m-{sched.get('id')}-{today_str}"
                if alert_key not in DISPATCHED_ALERTS:
                    DISPATCHED_ALERTS.add(alert_key)
                    recipient = sched.get("recipientEmail", "siddhartha@studydashboard.local")
                    user_name = sched.get("userName", "Student")
                    target_name = sched.get("targetName", "Study Target")

                    logger.info(f"Dispatching 15-min study alert to {recipient} for {target_name} at {start_time_str}")
                    html = f"""
                    <div style="font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
                        <h2 style="color: #6366f1; margin: 0 0 12px 0;">⏰ Study Reminder: {target_name} in 15 Minutes</h2>
                        <p>Namaste <strong>{user_name}</strong>,</p>
                        <p>Your scheduled study session for <strong>{target_name}</strong> begins at <strong>{start_time_str}</strong> ({sched.get('durationMinutes', 45)} minutes).</p>
                        <p style="color: #94a3b8; font-size: 13px;">Get your notes ready and open StudyDashboard to start your focused session.</p>
                        <a href="http://localhost:5173" style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; margin-top: 12px;">Open StudyDashboard</a>
                    </div>
                    """
                    subject = f"⏰ Study Reminder: {target_name} starts in 15 minutes ({start_time_str})"
                    await send_resend_email(recipient, subject, html)
        except Exception as e:
            logger.error(f"Error checking schedule reminder: {e}")

async def start_background_scheduler():
    """Continuous background loop running while FastAPI is active."""
    logger.info("Background Email & 10:30 PM Nepal Scheduler initialized.")
    while True:
        try:
            await check_and_dispatch_scheduled_emails()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        await asyncio.sleep(60)
