import { describe, it, expect } from 'vitest';
import { sendStudyReminderEmail, sendDailySummaryEmail } from '../src/services/emailService';

describe('Email Service (Asia/Kathmandu Reminders & Summaries)', () => {
  it('should format 15-minute advance reminder email properly', async () => {
    const res = await sendStudyReminderEmail({
      userId: '11111111-1111-1111-1111-111111111111',
      userName: 'Primary Account',
      recipientEmail: 'user1@studydashboard.local',
      targetName: 'RBB IT',
      plannedStartTime: '19:00',
      plannedDurationMinutes: 45,
      todayTargetMinutes: 90,
      todayCompletedMinutes: 45,
    });

    expect(res.subject).toContain('RBB IT starts in 15 minutes');
    expect(res.textContent).toContain('Target for today: 1h 30m');
    expect(res.textContent).toContain('Completed so far: 45m');
  });

  it('should format 10 PM daily summary email with target breakdowns and MCQ accuracy', async () => {
    const res = await sendDailySummaryEmail({
      userId: '11111111-1111-1111-1111-111111111111',
      userName: 'Primary Account',
      recipientEmail: 'user1@studydashboard.local',
      dateStr: '2026-08-18',
      totalStudyMinutes: 205, // 3h 25m
      targetBreakdowns: [
        { targetName: 'RBB IT', studiedMinutes: 80, plannedMinutes: 90, isCompleted: false },
        { targetName: 'NRB Assistant', studiedMinutes: 55, plannedMinutes: 60, isCompleted: false },
        { targetName: 'AI Course', studiedMinutes: 45, plannedMinutes: 45, isCompleted: true },
        { targetName: 'College', studiedMinutes: 25, plannedMinutes: 45, isCompleted: false },
      ],
      mcqStats: {
        attempted: 68,
        correct: 54,
        wrong: 14,
        accuracy: 79,
      },
      dailyGoalCompletionPercent: 85,
      status: 'Almost There',
      statusExplanation: '3h 25m studied, 85% of daily target reached.',
      tomorrowFirstSession: {
        targetName: 'RBB IT',
        startTime: '7:00 PM',
      }
    });

    expect(res.subject).toContain('3h 25m Completed — Almost There');
    expect(res.textContent).toContain('Total Study: 3h 25m');
    expect(res.textContent).toContain('• AI Course: 45m / 45m ✓');
    expect(res.textContent).toContain('68 Attempted');
    expect(res.textContent).toContain('54 Correct, 14 Wrong');
    expect(res.textContent).toContain('79% Accuracy');
    expect(res.textContent).toContain('Tomorrow\'s Plan: RBB IT at 7:00 PM');
  });
});
