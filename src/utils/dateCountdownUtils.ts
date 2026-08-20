import { differenceInDays, differenceInHours, differenceInMinutes, format, isBefore, parseISO, startOfDay } from 'date-fns';

export interface ExamCountdownResult {
  hasExamDate: boolean;
  isPast: boolean;
  isToday: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  formattedCountdown: string;
  formattedExamDate: string;
  urgency: 'urgent' | 'warning' | 'normal' | 'past';
  badgeColorClass: string;
}

/**
 * Calculate countdown and status for an exam date string (YYYY-MM-DD or ISO)
 */
export function getExamCountdown(examDateStr?: string | null): ExamCountdownResult {
  if (!examDateStr) {
    return {
      hasExamDate: false,
      isPast: false,
      isToday: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      formattedCountdown: 'No Exam Date',
      formattedExamDate: 'Not Scheduled',
      urgency: 'normal',
      badgeColorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    };
  }

  try {
    const examDate = typeof examDateStr === 'string' && examDateStr.includes('T')
      ? parseISO(examDateStr)
      : new Date(`${examDateStr.split('T')[0]}T00:00:00`);

    const now = new Date();
    const today = startOfDay(now);
    const examDay = startOfDay(examDate);

    const formattedExamDate = format(examDate, 'MMM d, yyyy');

    // If today is exam day
    if (examDay.getTime() === today.getTime()) {
      return {
        hasExamDate: true,
        isPast: false,
        isToday: true,
        daysRemaining: 0,
        hoursRemaining: 0,
        minutesRemaining: 0,
        formattedCountdown: '🎉 Exam Today!',
        formattedExamDate,
        urgency: 'urgent',
        badgeColorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse font-extrabold',
      };
    }

    // If exam date is in the past
    if (isBefore(examDay, today)) {
      const daysAgo = Math.abs(differenceInDays(today, examDay));
      return {
        hasExamDate: true,
        isPast: true,
        isToday: false,
        daysRemaining: -daysAgo,
        hoursRemaining: 0,
        minutesRemaining: 0,
        formattedCountdown: `Completed (${daysAgo}d ago)`,
        formattedExamDate,
        urgency: 'past',
        badgeColorClass: 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      };
    }

    // Future exam date
    const totalDays = differenceInDays(examDate, now);
    const totalHours = differenceInHours(examDate, now);
    const remainingHours = totalHours % 24;
    const totalMinutes = differenceInMinutes(examDate, now);

    let countdownText = '';
    let urgency: 'urgent' | 'warning' | 'normal' = 'normal';
    let badgeClass = 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50';

    if (totalDays === 0) {
      countdownText = `${remainingHours}h remaining`;
      urgency = 'urgent';
      badgeClass = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 font-bold';
    } else if (totalDays === 1) {
      countdownText = 'Tomorrow';
      urgency = 'urgent';
      badgeClass = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 font-bold';
    } else if (totalDays <= 7) {
      countdownText = `${totalDays} days left`;
      urgency = 'urgent';
      badgeClass = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 font-bold';
    } else if (totalDays <= 30) {
      countdownText = `${totalDays} days left`;
      urgency = 'warning';
      badgeClass = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 font-bold';
    } else {
      const months = Math.floor(totalDays / 30);
      const remDays = totalDays % 30;
      countdownText = months > 0 && remDays > 0 ? `${months}m ${remDays}d left (${totalDays}d)` : `${totalDays} days left`;
      urgency = 'normal';
      badgeClass = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 font-bold';
    }

    return {
      hasExamDate: true,
      isPast: false,
      isToday: false,
      daysRemaining: totalDays,
      hoursRemaining: totalHours,
      minutesRemaining: totalMinutes,
      formattedCountdown: countdownText,
      formattedExamDate,
      urgency,
      badgeColorClass: badgeClass,
    };
  } catch (e) {
    return {
      hasExamDate: false,
      isPast: false,
      isToday: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      formattedCountdown: 'Invalid Date',
      formattedExamDate: 'Invalid Date',
      urgency: 'normal',
      badgeColorClass: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  }
}

/**
 * Format current date & day of week for Dashboard header
 */
export function getFormattedDateAndDay(date: Date = new Date()): {
  dayName: string;
  formattedDate: string;
  fullDateString: string;
  timeString: string;
} {
  return {
    dayName: format(date, 'EEEE'), // e.g. "Thursday"
    formattedDate: format(date, 'd MMMM yyyy'), // e.g. "20 August 2026"
    fullDateString: format(date, 'EEEE, d MMMM yyyy'), // e.g. "Thursday, 20 August 2026"
    timeString: format(date, 'h:mm a'), // e.g. "6:55 AM"
  };
}
