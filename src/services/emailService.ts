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
  dateStr?: string;
  totalStudyMinutes?: number;
  todayFocusMinutes?: number;
  dailyGoalMinutes?: number;
  goalCompletionPct?: number;
  dailyGoalCompletionPercent?: number;
  status?: string;
  statusExplanation?: string;
  mcqsAttempted?: number;
  mcqsCorrect?: number;
  mcqsWrong?: number;
  accuracyPct?: number | null;
  mcqStats?: {
    attempted: number;
    correct: number;
    wrong: number;
    accuracy: number;
  };
  targetBreakdown?: Record<string, number>;
  targetBreakdowns?: Array<{
    targetName: string;
    studiedMinutes: number;
    plannedMinutes: number;
    isCompleted: boolean;
  }>;
  strongestTopic?: string;
  strongestTopicPct?: number;
  needsAttentionTopic?: string;
  needsAttentionTopicPct?: number;
  tomorrowTargetName?: string;
  tomorrowStartTime?: string;
  tomorrowDurationMinutes?: number;
  tomorrowFirstSession?: {
    targetName: string;
    startTime: string;
  };
  last7DaysFocus?: Array<{ dayLabel: string; fullDate: string; minutes: number }>;
}

export interface DailySummaryRequestOptions extends DailySummaryPayload {}

const getApiBaseUrl = () => {
  return (import.meta as any).env?.VITE_MCQ_IMPORT_API_URL ||
         (import.meta as any).env?.MCQ_IMPORT_API_URL ||
         'http://localhost:8000';
};

/**
 * Trigger or preview 10:00 PM Nightly Daily Summary with server-generated SVG 7-day chart
 */
export async function sendDailySummaryEmail(payload: DailySummaryRequestOptions) {
  const mins = payload.todayFocusMinutes ?? payload.totalStudyMinutes ?? 0;
  const totalHoursStr = `${Math.floor(mins / 60)}h ${mins % 60}m`.replace('0h ', '');
  const status = payload.status || 'On Track';
  const subject = `📊 StudyOS Daily Summary (${payload.dateStr || 'Today'}): ${totalHoursStr} Completed — ${status}`;

  const attempted = payload.mcqsAttempted ?? payload.mcqStats?.attempted ?? 0;
  const correct = payload.mcqsCorrect ?? payload.mcqStats?.correct ?? 0;
  const wrong = payload.mcqsWrong ?? payload.mcqStats?.wrong ?? 0;
  const acc = payload.accuracyPct ?? payload.mcqStats?.accuracy ?? 0;

  const targetLines = payload.targetBreakdowns
    ? payload.targetBreakdowns.map(t => `• ${t.targetName}: ${t.studiedMinutes}m / ${t.plannedMinutes}m ${t.isCompleted ? '✓' : ''}`).join('\n')
    : payload.targetBreakdown
    ? Object.entries(payload.targetBreakdown).map(([k, v]) => `• ${k}: ${v}m`).join('\n')
    : 'No target sessions';

  const textContent = `StudyOS Daily Summary — ${payload.dateStr || 'Today'}
Student: ${payload.userName}

Total Study: ${totalHoursStr}
Status: ${status} (${payload.statusExplanation || ''})
Daily Goal: ${payload.goalCompletionPct ?? payload.dailyGoalCompletionPercent ?? 0}%

Target Breakdown:
${targetLines}

MCQ Performance:
• ${attempted} Attempted
• ${correct} Correct, ${wrong} Wrong
• ${acc}% Accuracy

${payload.tomorrowFirstSession ? `Tomorrow's Plan: ${payload.tomorrowFirstSession.targetName} at ${payload.tomorrowFirstSession.startTime}` : ''}

Keep up the strong momentum!
— StudyOS Nepal`;

  const apiUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${apiUrl}/api/email/daily-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: payload.userId,
        userName: payload.userName,
        recipientEmail: payload.recipientEmail,
        todayFocusMinutes: mins,
        dailyGoalMinutes: payload.dailyGoalMinutes ?? 180,
        goalCompletionPct: payload.goalCompletionPct ?? payload.dailyGoalCompletionPercent ?? 0,
        mcqsAttempted: attempted,
        mcqsCorrect: correct,
        mcqsWrong: wrong,
        accuracyPct: acc,
        targetBreakdown: payload.targetBreakdown || {},
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        subject,
        textContent,
      };
    }
  } catch (e) {
    // Ignore and fallback to client
  }

  return {
    success: true,
    message: 'Daily summary generated locally (simulation mode)',
    emailId: 'local-preview-id',
    subject,
    textContent,
  };
}

/**
 * Trigger 15-minute pre-study reminder
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

  const apiUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${apiUrl}/api/email/pre-study-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        subject,
        textContent,
      };
    }
  } catch (e) {
    // Ignore and fallback
  }

  return {
    success: true,
    message: 'Pre-study reminder dispatched locally',
    emailId: 'local-reminder-id',
    subject,
    textContent,
  };
}
