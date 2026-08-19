import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { useStudyTimer } from '../context/StudyTimerContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  Play,
  Clock,
  BookOpen,
  Sparkles,
  FileText,
  Calendar,
  ChevronRight,
  TrendingUp,
  Target as TargetIcon,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Sliders,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  isKathmanduToday,
  getKathmanduTodayStr,
  getKathmanduDailyAggregates,
} from '../utils/dateUtils';
import { AIStudyBuilderModal } from '../components/ai/AIStudyBuilderModal';
import type { PageId } from '../components/layout/Sidebar';
import type { Target } from '../types';

interface DashboardProps {
  onNavigate: (page: PageId, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();
  const { startSession, openModal: openTimerModal } = useStudyTimer();
  const todayStr = getKathmanduTodayStr();

  // Modal States
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [aiModalTargetId, setAiModalTargetId] = useState<string | undefined>(undefined);

  // 1. Live Queries for Current User
  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).and(t => !t.isArchived).toArray(),
    [currentUser.id]
  ) || [];

  const studySessions = useLiveQuery(
    () => db.studySessions.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const attempts = useLiveQuery(
    () => db.attempts.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const dailyAllocations = useLiveQuery(
    () => db.dailyAllocations.where('userId').equals(currentUser.id).and(a => a.date === todayStr).toArray(),
    [currentUser.id, todayStr]
  ) || [];

  const upcomingSchedules = useLiveQuery(
    () => db.studySchedules
      .where('userId').equals(currentUser.id)
      .and(s => s.date === todayStr && !s.isCompleted)
      .toArray(),
    [currentUser.id, todayStr]
  ) || [];

  // 2. Calculations for Today's Stats (Strict Asia/Kathmandu Day)
  const todaySessions = useMemo(() => studySessions.filter(s => isKathmanduToday(s.startTime)), [studySessions]);
  const todayAttempts = useMemo(() => attempts.filter(a => isKathmanduToday(a.timestamp)), [attempts]);

  // Studied minutes per target today
  const targetStudiedMinutes: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    targets.forEach(t => {
      map[t.id] = todaySessions
        .filter(s => s.targetId === t.id)
        .reduce((sum, s) => sum + (s.focusedMinutes || 0), 0);
    });
    return map;
  }, [targets, todaySessions]);

  const totalStudiedMinutesToday = Object.values(targetStudiedMinutes).reduce((a, b) => a + b, 0);

  // Planned minutes per target today
  const targetPlannedMinutes: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    targets.forEach(t => {
      const alloc = dailyAllocations.find(a => a.targetId === t.id);
      map[t.id] = alloc ? alloc.plannedMinutes : t.dailyGoalMinutes;
    });
    return map;
  }, [targets, dailyAllocations]);

  const totalPlannedMinutesToday = Object.values(targetPlannedMinutes).reduce((a, b) => a + b, 0) || 120;
  const todayGoalCompletion = Math.min(100, Math.round((totalStudiedMinutesToday / totalPlannedMinutesToday) * 100));
  const remainingMinutes = Math.max(0, totalPlannedMinutesToday - totalStudiedMinutesToday);

  // MCQ Stats Today
  const todayAttemptCount = todayAttempts.length;
  const todayCorrectCount = todayAttempts.filter(a => a.isCorrect).length;
  const todayAccuracy = todayAttemptCount > 0 ? Math.round((todayCorrectCount / todayAttemptCount) * 100) : null;

  // Greeting Time of Day
  const currentHour = new Date().getHours();
  const timeOfDayGreeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  // 3. Weekly Progress Data (Last 7 Days Focus Time)
  const dailyAggregates = useMemo(() => getKathmanduDailyAggregates(studySessions, attempts, 7), [studySessions, attempts]);
  const last7DaysChartData = useMemo(() => dailyAggregates.map(d => ({
    day: d.dayLabel,
    fullDate: d.formattedDate,
    hours: Number((d.focusedMinutes / 60).toFixed(1)),
    minutes: d.focusedMinutes,
    mcqs: d.questionsAttempted,
  })), [dailyAggregates]);

  const totalWeeklyFocusMinutes = dailyAggregates.reduce((acc, d) => acc + d.focusedMinutes, 0);
  const weeklyGoalTargetMinutes = totalPlannedMinutesToday * 7 || 840;
  const weeklyGoalPct = Math.min(100, Math.round((totalWeeklyFocusMinutes / weeklyGoalTargetMinutes) * 100));

  // Weekly study minutes per target (Last 7 Days)
  const targetWeeklyMinutes: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const weekSessions = studySessions.filter(s => s.startTime >= sevenDaysAgo);
    targets.forEach(t => {
      map[t.id] = weekSessions
        .filter(s => s.targetId === t.id)
        .reduce((sum, s) => sum + (s.focusedMinutes || 0), 0);
    });
    return map;
  }, [targets, studySessions]);

  const maxWeeklyTargetMins = Math.max(1, ...Object.values(targetWeeklyMinutes));

  // 4. Real Data-Driven AI Coach Recommendation
  const aiRecommendation = useMemo(() => {
    if (attempts.length < 5 && studySessions.length < 2) {
      return {
        title: 'Complete more practice sessions to receive personalized recommendations.',
        actionLabel: 'Start Practice',
        targetId: targets[0]?.id,
      };
    }

    // Check for target with lowest recent accuracy (< 70%)
    for (const target of targets) {
      const targetAttempts = attempts.filter(a => a.targetId === target.id);
      if (targetAttempts.length >= 5) {
        const correct = targetAttempts.filter(a => a.isCorrect).length;
        const acc = Math.round((correct / targetAttempts.length) * 100);
        if (acc < 70) {
          const wrongCount = targetAttempts.length - correct;
          return {
            title: `${target.name} accuracy is ${acc}%.`,
            subtitle: `You answered ${wrongCount} questions incorrectly recently. Suggested: 15-question revision set.`,
            actionLabel: 'Build Practice',
            targetId: target.id,
          };
        }
      }
    }

    // Check for targets unstudied in 3+ days
    for (const target of targets) {
      const targetSessions = studySessions.filter(s => s.targetId === target.id);
      if (targetSessions.length > 0) {
        const lastSession = Math.max(...targetSessions.map(s => s.startTime));
        const daysAgo = Math.floor((Date.now() - lastSession) / 86400000);
        if (daysAgo >= 3) {
          return {
            title: `You haven't studied ${target.name} for ${daysAgo} days.`,
            subtitle: `A focused 25-minute review session will maintain long-term memory retention.`,
            actionLabel: 'Start Revision',
            targetId: target.id,
          };
        }
      }
    }

    return {
      title: 'Strong progress across all active targets today!',
      subtitle: `Recommended: Complete a 15-question mixed exam drill to test retention.`,
      actionLabel: 'Build Practice',
      targetId: targets[0]?.id,
    };
  }, [attempts, studySessions, targets]);

  const nextSession = upcomingSchedules[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-fade-in">
      {/* =========================================================================
          SECTION A: HERO / TODAY SECTION
          Simple, uncluttered greeting + Only TWO Primary Actions + Clean Secondary Actions
         ========================================================================= */}
      <div className="pt-2 pb-1 border-b border-slate-200/80 dark:border-slate-800/80 space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {timeOfDayGreeting}, {currentUser.name} 👋
          </h1>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
            <strong className="text-slate-900 dark:text-white">
              {totalStudiedMinutesToday > 0
                ? `${Math.floor(totalStudiedMinutesToday / 60)}h ${totalStudiedMinutesToday % 60}m focused today.`
                : 'No study recorded yet today.'}
            </strong>{' '}
            {remainingMinutes > 0
              ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m remaining to reach today's goal.`
              : '🎯 Today\'s study goal achieved!'}
          </p>
        </div>

        {/* Primary & Secondary Action Cluster */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* TWO PRIMARY ACTIONS */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              className="px-5 shadow-sm"
              onClick={() => {
                const firstTarget = targets[0];
                if (firstTarget) {
                  startSession(firstTarget.id, undefined, 'Reading');
                } else {
                  openTimerModal();
                }
              }}
            >
              Focus Now
            </Button>

            <Button
              variant="outline"
              size="md"
              leftIcon={<BookOpen className="w-4 h-4" />}
              className="px-5 shadow-xs"
              onClick={() => onNavigate('practice')}
            >
              Practice MCQs
            </Button>
          </div>

          {/* Secondary Quick Actions */}
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Create Practice Set:</span>
            <button
              onClick={() => onNavigate('questions')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-200 transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span>Upload PDF</span>
            </button>
            <button
              onClick={() => {
                setAiModalTargetId(targets[0]?.id);
                setIsAIModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION B: TODAY SNAPSHOT (MAXIMUM 4 COMPACT CARDS)
         ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Focus Time */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Focus Time
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalStudiedMinutesToday >= 60 ? `${Math.floor(totalStudiedMinutesToday / 60)}h ${totalStudiedMinutesToday % 60}m` : `${totalStudiedMinutesToday}m`}
            </span>
            <span className="text-xs text-slate-400">
              / {Math.floor(totalPlannedMinutesToday / 60)}h {totalPlannedMinutesToday % 60}m
            </span>
          </div>
          <ProgressBar progress={todayGoalCompletion} size="xs" />
        </Card>

        {/* Card 2: Daily Goal */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Daily Goal
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {todayGoalCompletion}%
            </span>
            <span className="text-xs text-slate-400">
              {totalStudiedMinutesToday >= totalPlannedMinutesToday ? 'achieved' : 'completed'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {remainingMinutes === 0 ? 'Goal completed 🎉' : `${remainingMinutes}m remaining`}
          </p>
        </Card>

        {/* Card 3: MCQs Today */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            MCQs Today
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {todayAttemptCount}
            </span>
            <span className="text-xs text-slate-400">
              {todayAttemptCount > 0 ? `(${todayCorrectCount} correct)` : 'attempted'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {todayAttemptCount > 0 ? `${todayAttemptCount - todayCorrectCount} review items` : 'No attempts today'}
          </p>
        </Card>

        {/* Card 4: Accuracy */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Accuracy
          </span>
          <div>
            {todayAccuracy !== null ? (
              <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {todayAccuracy}%
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-400">
                No questions practiced yet
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {todayAccuracy !== null ? 'Real accuracy score' : 'Practice to view stats'}
          </p>
        </Card>
      </div>

      {/* =========================================================================
          SECTION C: TODAY'S STUDY PLAN
          Highlights today's active targets with immediate [Start]/[Continue] buttons
         ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <TargetIcon className="w-3.5 h-3.5" />
            <span>Today's Study Plan</span>
          </h2>
          <button
            onClick={() => onNavigate('targets')}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
          >
            View Full Plan <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {targets.length === 0 ? (
          <Card className="p-8 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-3">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Ready to begin your study plan?</h4>
              <p className="text-xs text-slate-500 mt-0.5">Add your target exams, college subjects, or courses to start tracking.</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => onNavigate('targets')}>
              Create Study Target
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {targets.slice(0, 6).map(target => {
              const studiedMins = targetStudiedMinutes[target.id] || 0;
              const plannedMins = targetPlannedMinutes[target.id] || target.dailyGoalMinutes;
              const pct = Math.min(100, Math.round((studiedMins / plannedMins) * 100));

              return (
                <Card
                  key={target.id}
                  className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: target.color || '#6366f1' }}
                        />
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                          {target.name}
                        </h3>
                      </div>
                      <Badge variant={pct >= 100 ? 'success' : pct > 0 ? 'warning' : 'outline'}>
                        {pct}%
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>{studiedMins}m studied</span>
                      <span className="text-slate-400">Goal: {plannedMins}m</span>
                    </div>

                    <ProgressBar progress={pct} size="xs" />
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => onNavigate('practice', { targetId: target.id })}
                      className="text-[11px] font-semibold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      Practice MCQs
                    </button>
                    <Button
                      variant={studiedMins > 0 ? 'outline' : 'primary'}
                      size="xs"
                      leftIcon={<Play className="w-3 h-3 fill-current" />}
                      onClick={() => startSession(target.id, undefined, 'Reading')}
                    >
                      {studiedMins > 0 ? 'Continue' : 'Start'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION D: CREATE / PRACTICE PANEL
          Clearly differentiated workflows for PDF Upload vs AI Study Builder
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Option 1: PDF Upload */}
        <div
          onClick={() => onNavigate('questions')}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs hover:border-blue-500/50 dark:hover:border-blue-500/40 cursor-pointer transition-all flex items-start gap-4 group"
        >
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Upload PDF / Old Questions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Extract official exam papers with deterministic OCR and automated answer keys.
            </p>
          </div>
        </div>

        {/* Option 2: Build with AI */}
        <div
          onClick={() => {
            setAiModalTargetId(targets[0]?.id);
            setIsAIModalOpen(true);
          }}
          className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs hover:border-amber-500/60 cursor-pointer transition-all flex items-start gap-4 group"
        >
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Build with AI
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Research target syllabus, generate balanced blueprint, and create validated MCQs.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION E: YOUR PROGRESS (LAST 7 DAYS FOCUS & TARGET HORIZONTAL BARS)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Last 7 Days Focus Time (Clean Bar Chart) */}
        <Card className="lg:col-span-2 p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Last 7 Days Focus Time</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {Math.floor(totalWeeklyFocusMinutes / 60)}h {totalWeeklyFocusMinutes % 60}m focused this week • {weeklyGoalPct}% weekly goal
              </p>
            </div>
          </div>

          <div className="h-44 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysChartData}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="h" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs space-y-1 shadow-lg">
                          <p className="font-bold text-slate-300">{d.fullDate} ({d.day})</p>
                          <p className="text-brand-400 font-semibold">{Math.floor(d.minutes / 60)}h {d.minutes % 60}m focused</p>
                          <p className="text-slate-400">{d.mcqs} MCQs solved</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Target Weekly Progress (Horizontal Bars instead of confusing donut) */}
        <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Weekly Target Time
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Focus time distribution (Last 7 Days)</p>
          </div>

          <div className="space-y-3.5">
            {targets.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No active targets</p>
            ) : (
              targets.map(t => {
                const mins = targetWeeklyMinutes[t.id] || 0;
                const pct = Math.min(100, Math.round((mins / maxWeeklyTargetMins) * 100));

                return (
                  <div key={t.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                        {t.name}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {Math.floor(mins / 60)}h {mins % 60}m
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(4, pct)}%`,
                          backgroundColor: t.color || '#6366f1',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* =========================================================================
          SECTION F: AI COACH
          Data-grounded recommendation derived strictly from user performance
         ========================================================================= */}
      <Card className="p-5 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-brand-500/5 to-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  AI Coach
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {aiRecommendation.title}
              </h4>
              {aiRecommendation.subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {aiRecommendation.subtitle}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="self-start sm:self-center"
            onClick={() => {
              if (aiRecommendation.targetId) {
                setAiModalTargetId(aiRecommendation.targetId);
                setIsAIModalOpen(true);
              } else {
                onNavigate('practice');
              }
            }}
          >
            {aiRecommendation.actionLabel}
          </Button>
        </div>
      </Card>

      {/* =========================================================================
          SECTION G & H: UP NEXT & UPCOMING SESSIONS
         ========================================================================= */}
      {nextSession && (
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Up Next</span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {nextSession.startTime} • {nextSession.title} ({nextSession.durationMinutes}m)
              </h4>
            </div>
          </div>
          <Button
            variant="primary"
            size="xs"
            leftIcon={<Play className="w-3 h-3 fill-current" />}
            onClick={() => startSession(nextSession.targetId, undefined, 'Reading')}
          >
            Start Early
          </Button>
        </Card>
      )}

      {/* AI Study Builder Modal */}
      <AIStudyBuilderModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        initialTargetId={aiModalTargetId}
        onStartPractice={(targetId) => onNavigate('practice', { targetId })}
      />
    </div>
  );
};
