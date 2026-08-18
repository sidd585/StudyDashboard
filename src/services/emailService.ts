import { Resend } from 'resend';
import { db } from '../db';
import { USER_PROFILES } from '../lib/supabase';
import type { Target, StudySession, StudySchedule } from '../types';

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
const procEnv = typeof process !== 'undefined' ? process.env || {} : {};
const resendApiKey = metaEnv.VITE_RESEND_API_KEY || procEnv.RESEND_API_KEY || '';
const resend = resendApiKey && !resendApiKey.includes('placeholder')
  ? new Resend(resendApiKey)
  : null;

export interface ReminderPayload {
  userId: string;
  userName: string;
  recipientEmail: string;
  targetName: string;
  plannedStartTime: string;
  plannedDurationMinutes: number;
  todayTargetMinutes: number;
  todayCompletedMinutes: number;
}

export interface DailySummaryPayload {
  userId: string;
  userName: string;
  recipientEmail: string;
  dateStr: string;
  totalStudyMinutes: number;
  targetBreakdowns: {
    targetName: string;
    studiedMinutes: number;
    plannedMinutes: number;
    isCompleted: boolean;
  }[];
  mcqStats: {
    attempted: number;
    correct: number;
    wrong: number;
    accuracy: number;
  };
  dailyGoalCompletionPercent: number;
  status: 'On Track' | 'Almost There' | 'Needs Attention';
  statusExplanation: string;
  tomorrowFirstSession?: {
    targetName: string;
    startTime: string;
  };
}

/**
 * Format and send a 15-minute study session reminder
 */
export async function sendStudyReminderEmail(payload: ReminderPayload) {
  const targetHoursStr = `${Math.floor(payload.todayTargetMinutes / 60)}h ${payload.todayTargetMinutes % 60}m`.replace('0h ', '');
  const completedHoursStr = `${Math.floor(payload.todayCompletedMinutes / 60)}h ${payload.todayCompletedMinutes % 60}m`.replace('0h ', '');

  const subject = `⏰ Study Reminder: ${payload.targetName} starts in 15 minutes`;
  const textContent = `Namaste ${payload.userName},

Your planned study session for ${payload.targetName} starts at ${payload.plannedStartTime} (approx 15 minutes from now).

📊 Today's Progress:
• Target for today: ${targetHoursStr}
• Completed so far: ${completedHoursStr}

Get your notes ready and open StudyOS to start your focused session.

— StudyOS Nepal`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
      <div style="display: flex; align-items: center; margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">StudyOS</span>
        <span style="font-size: 11px; background: #312e81; color: #a5b4fc; padding: 2px 8px; border-radius: 9999px; margin-left: 10px; font-weight: 600;">NEPAL</span>
      </div>

      <h2 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 12px 0;">
        ${payload.targetName} starts in 15 minutes
      </h2>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
        Namaste <strong style="color: #e2e8f0;">${payload.userName}</strong>, your scheduled <strong style="color: #6366f1;">${payload.targetName}</strong> session is set for <strong style="color: #e2e8f0;">${payload.plannedStartTime}</strong> (${payload.plannedDurationMinutes} minutes).
      </p>

      <div style="background: #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 24px; border: 1px solid #334155;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #94a3b8; font-size: 13px;">Today's Target:</span>
          <strong style="color: #f8fafc; font-size: 13px;">${targetHoursStr}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #94a3b8; font-size: 13px;">Completed So Far:</span>
          <strong style="color: #10b981; font-size: 13px;">${completedHoursStr}</strong>
        </div>
      </div>

      <a href="http://localhost:5173" style="display: block; text-align: center; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px;">
        Open StudyOS & Start Timer
      </a>
    </div>
  `;

  if (resend) {
    try {
      await resend.emails.send({
        from: 'StudyOS <study@resend.dev>',
        to: payload.recipientEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });
    } catch (err) {
      console.warn('Resend email dispatch error:', err);
    }
  }

  return { subject, textContent };
}

/**
 * Format and send 10:00 PM Asia/Kathmandu Daily Summary Email
 */
export async function sendDailySummaryEmail(payload: DailySummaryPayload) {
  const totalHoursStr = `${Math.floor(payload.totalStudyMinutes / 60)}h ${payload.totalStudyMinutes % 60}m`.replace('0h ', '');
  const subject = `📊 StudyOS Daily Summary (${payload.dateStr}): ${totalHoursStr} Completed — ${payload.status}`;

  const targetLinesText = payload.targetBreakdowns.map(t => {
    const sStr = `${Math.floor(t.studiedMinutes / 60)}h ${t.studiedMinutes % 60}m`.replace('0h ', '');
    const pStr = `${Math.floor(t.plannedMinutes / 60)}h ${t.plannedMinutes % 60}m`.replace('0h ', '');
    return `• ${t.targetName}: ${sStr} / ${pStr} ${t.isCompleted ? '✓' : ''}`;
  }).join('\n');

  const textContent = `StudyOS Daily Summary — ${payload.dateStr}
Student: ${payload.userName}

Total Study: ${totalHoursStr}
Status: ${payload.status} (${payload.statusExplanation})
Daily Goal: ${payload.dailyGoalCompletionPercent}%

Target Breakdown:
${targetLinesText}

MCQ Performance:
• ${payload.mcqStats.attempted} Attempted
• ${payload.mcqStats.correct} Correct, ${payload.mcqStats.wrong} Wrong
• ${payload.mcqStats.accuracy}% Accuracy

${payload.tomorrowFirstSession ? `Tomorrow's Plan: ${payload.tomorrowFirstSession.targetName} at ${payload.tomorrowFirstSession.startTime}` : ''}

Keep up the strong momentum!
— StudyOS Nepal`;

  if (resend) {
    try {
      await resend.emails.send({
        from: 'StudyOS <study@resend.dev>',
        to: payload.recipientEmail,
        subject,
        text: textContent,
      });
    } catch (err) {
      console.warn('Resend daily summary error:', err);
    }
  }

  return { subject, textContent };
}
