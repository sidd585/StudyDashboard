import React, { useState } from 'react';
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
  BookOpenCheck,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Calendar,
  Sparkles,
  ChevronRight,
  BarChart3,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { ResetModal } from '../components/common/ResetModal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  isKathmanduToday,
  getKathmanduTodayStr,
  getKathmanduDailyAggregates,
  getKathmanduMonthlyAggregates,
} from '../utils/dateUtils';
import type { PageId } from '../components/layout/Sidebar';
import type { Target } from '../types';

interface DashboardProps {
  onNavigate: (page: PageId, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();
  const { startSession } = useStudyTimer();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [analyticsView, setAnalyticsView] = useState<'daily' | 'monthly'>('daily');
  const todayStr = getKathmanduTodayStr();

  // 1. Live Queries for current user
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

  // Edit allocation modal state
  const [isEditingAllocations, setIsEditingAllocations] = useState(false);
  const [allocationInputs, setAllocationInputs] = useState<Record<string, number>>({});

  // 2. Calculations for Today's Stats (Strictly Asia/Kathmandu Calendar Day)
  const todaySessions = studySessions.filter(s => isKathmanduToday(s.startTime));
  const todayAttempts = attempts.filter(a => isKathmanduToday(a.timestamp));

  // Time studied per target today (in minutes)
  const targetStudiedMinutes: Record<string, number> = {};
  targets.forEach(t => {
    targetStudiedMinutes[t.id] = todaySessions
      .filter(s => s.targetId === t.id)
      .reduce((sum, s) => sum + (s.focusedMinutes || 0), 0);
  });

  const totalStudiedMinutesToday = Object.values(targetStudiedMinutes).reduce((a, b) => a + b, 0);

  // Planned minutes per target today
  const targetPlannedMinutes: Record<string, number> = {};
  targets.forEach(t => {
    const alloc = dailyAllocations.find(a => a.targetId === t.id);
    targetPlannedMinutes[t.id] = alloc ? alloc.plannedMinutes : t.dailyGoalMinutes;
  });

  const totalPlannedMinutesToday = Object.values(targetPlannedMinutes).reduce((a, b) => a + b, 0) || 1;
  const todayGoalCompletion = Math.min(100, Math.round((totalStudiedMinutesToday / totalPlannedMinutesToday) * 100));

  // MCQ Stats Today
  const todayAttemptCount = todayAttempts.length;
  const todayCorrectCount = todayAttempts.filter(a => a.isCorrect).length;
  const todayWrongCount = todayAttemptCount - todayCorrectCount;
  const todayAccuracy = todayAttemptCount > 0 ? Math.round((todayCorrectCount / todayAttemptCount) * 100) : null;

  // Focus Rating Today
  const ratedSessions = todaySessions.filter(s => s.focusRating);
  const avgFocusRating = ratedSessions.length > 0
    ? (ratedSessions.reduce((sum, s) => sum + (s.focusRating || 0), 0) / ratedSessions.length).toFixed(1)
    : null;

  // 3. Simple Study Effectiveness Status
  let status: 'On Track' | 'Almost There' | 'Needs Attention' = 'On Track';
  let statusExplanation = '';

  if (todayGoalCompletion >= 80 && (todayAttemptCount === 0 || (todayAccuracy && todayAccuracy >= 75))) {
    status = 'On Track';
    statusExplanation = `${Math.floor(totalStudiedMinutesToday / 60)}h ${totalStudiedMinutesToday % 60}m / ${Math.floor(totalPlannedMinutesToday / 60)}h ${totalPlannedMinutesToday % 60}m completed (${todayGoalCompletion}%), ${todayAccuracy !== null ? `${todayAccuracy}% MCQ accuracy` : 'solid focus pace'}.`;
  } else if (todayGoalCompletion >= 50 || (todayAccuracy && todayAccuracy >= 60)) {
    status = 'Almost There';
    statusExplanation = `${todayGoalCompletion}% of daily study goal completed so far. A focused 30-minute session will put you on track.`;
  } else {
    status = 'Needs Attention';
    statusExplanation = `You have completed ${todayGoalCompletion}% of today's target. Start your next planned target session to build momentum.`;
  }

  // 4. Historical Analytics (Preserved permanently by local Kathmandu date)
  const dailyAggregates = getKathmanduDailyAggregates(studySessions, attempts, 7);
  const monthlyAggregates = getKathmanduMonthlyAggregates(studySessions, attempts);

  const last7DaysChartData = dailyAggregates.map(d => ({
    day: d.dayLabel,
    fullDate: d.formattedDate,
    hours: Number((d.focusedMinutes / 60).toFixed(1)),
    minutes: d.focusedMinutes,
    mcqs: d.questionsAttempted,
  }));

  // Target Breakdown Pie
  const targetPieData = targets.map(t => ({
    name: t.name,
    value: targetStudiedMinutes[t.id] || 0,
    color: t.color,
  })).filter(t => t.value > 0);

  const displayPieData = targetPieData.length > 0 ? targetPieData : targets.map(t => ({
    name: t.name,
    value: t.dailyGoalMinutes,
    color: t.color,
  }));

  // Save Allocation Handler
  const handleSaveAllocations = async () => {
    for (const target of targets) {
      const mins = allocationInputs[target.id] ?? target.dailyGoalMinutes;
      await db.dailyAllocations.put({
        id: `alloc-${currentUser.id}-${target.id}-${todayStr}`,
        userId: currentUser.id,
        targetId: target.id,
        date: todayStr,
        plannedMinutes: mins,
        createdAt: Date.now(),
      });
    }
    setIsEditingAllocations(false);
  };

  const openAllocationEditor = () => {
    const inputs: Record<string, number> = {};
    targets.forEach(t => {
      inputs[t.id] = targetPlannedMinutes[t.id] || t.dailyGoalMinutes;
    });
    setAllocationInputs(inputs);
    setIsEditingAllocations(true);
  };

  const nextSession = upcomingSchedules[0];

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Next Study Session Banner (if scheduled) */}
      {nextSession && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-600/20 via-brand-500/10 to-slate-900 border border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-brand-600 dark:text-brand-400 tracking-wider">Next Study Session Today</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{nextSession.title} at {nextSession.startTime} ({nextSession.durationMinutes}m)</h4>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            onClick={() => startSession(nextSession.targetId, undefined, 'Reading')}
          >
            Start Now
          </Button>
        </div>
      )}

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Welcome back, {currentUser.name}</span>
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">• Asia/Kathmandu (UTC+5:45)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your personal study targets and real-time progress for today.
          </p>
        </div>
      </div>

      {/* 2. Simple Study Effectiveness Status Banner */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl border ${
              status === 'On Track'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : status === 'Almost There'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}>
              {status === 'On Track' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : status === 'Almost There' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <TrendingUp className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today's Study Status</span>
                <Badge variant={status === 'On Track' ? 'success' : status === 'Almost There' ? 'warning' : 'danger'}>
                  {status}
                </Badge>
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200 mt-1">
                {statusExplanation}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sliders className="w-3.5 h-3.5" />}
              onClick={openAllocationEditor}
            >
              Adjust Daily Goals
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
              onClick={() => {
                const firstTarget = targets[0];
                if (firstTarget) {
                  startSession(firstTarget.id, undefined, 'Reading');
                }
              }}
            >
              Start Focus Session
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Metrics Summary Grid (Today's Strict Stats) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Focus Time Today */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Today's Focus Time</span>
            <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {Math.floor(totalStudiedMinutesToday / 60)}h {totalStudiedMinutesToday % 60}m
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              / {Math.floor(totalPlannedMinutesToday / 60)}h {totalPlannedMinutesToday % 60}m
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar progress={todayGoalCompletion} size="xs" />
          </div>
        </Card>

        {/* Metric 2: Daily Goal Completion */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Daily Goal Progress</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{todayGoalCompletion}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">completed</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
            {totalStudiedMinutesToday >= totalPlannedMinutesToday ? '🎯 Goal achieved today!' : `${totalPlannedMinutesToday - totalStudiedMinutesToday}m remaining`}
          </p>
        </Card>

        {/* Metric 3: MCQs Solved Today */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Today's MCQs</span>
            <BookOpenCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{todayAttemptCount}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {todayAttemptCount > 0 ? `(${todayCorrectCount} correct, ${todayWrongCount} wrong)` : 'questions'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
            Accuracy: <strong className="text-slate-900 dark:text-white">{todayAccuracy !== null ? `${todayAccuracy}%` : '—'}</strong>
          </p>
        </Card>

        {/* Metric 4: Focus Rating Today */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Focus Rating</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-500">
              {avgFocusRating !== null ? `${avgFocusRating} ★` : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {ratedSessions.length > 0 ? `(${ratedSessions.length} sessions)` : 'No sessions yet'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
            {ratedSessions.length > 0 ? 'Self-rated study efficiency' : 'Starts after today\'s focus timer'}
          </p>
        </Card>
      </div>

      {/* 4. Active Targets Study Status (Today's Progress vs Daily Plan) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span>Today's Target Progress</span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({targets.length} active)</span>
          </h3>
          <Button variant="ghost" size="xs" onClick={() => onNavigate('targets')}>
            Manage Targets ➔
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {targets.map(target => {
            const studiedMins = targetStudiedMinutes[target.id] || 0;
            const plannedMins = targetPlannedMinutes[target.id] || target.dailyGoalMinutes;
            const pct = Math.min(100, Math.round((studiedMins / plannedMins) * 100));

            return (
              <Card
                key={target.id}
                className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: target.color }}
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                        {target.name}
                      </span>
                    </div>
                    <Badge variant={pct >= 100 ? 'success' : pct > 0 ? 'warning' : 'outline'}>
                      {pct}%
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between text-xs text-slate-600 dark:text-slate-300 mb-2">
                    <span>
                      {Math.floor(studiedMins / 60)}h {studiedMins % 60}m studied
                    </span>
                    <span className="text-slate-400">
                      Goal: {Math.floor(plannedMins / 60)}h {plannedMins % 60}m
                    </span>
                  </div>

                  <ProgressBar progress={pct} size="xs" />
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => onNavigate('practice', { targetId: target.id })}
                    className="text-[11px] font-semibold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    MCQs
                  </button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-xs"
                    leftIcon={<Play className="w-3 h-3 fill-current text-emerald-500" />}
                    onClick={() => startSession(target.id, undefined, 'Reading')}
                  >
                    Study
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 5. Historical Analytics Charts (Daily, Weekly, Monthly) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Last 7 Days Actual Historical Study Time */}
        <Card className="lg:col-span-2 p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Historical Study Activity</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real recorded focus sessions across calendar days (Asia/Kathmandu).
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setAnalyticsView('daily')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  analyticsView === 'daily'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setAnalyticsView('monthly')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  analyticsView === 'monthly'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly Summary
              </button>
            </div>
          </div>

          {analyticsView === 'daily' ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7DaysChartData}>
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="h" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs space-y-1 shadow-lg">
                            <p className="font-bold text-slate-300">{data.fullDate} ({data.day})</p>
                            <p className="text-brand-400 font-semibold">Study Time: {Math.floor(data.minutes / 60)}h {data.minutes % 60}m</p>
                            <p className="text-slate-400">MCQs Solved: {data.mcqs}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="hours" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {monthlyAggregates.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  No historical study records yet. Real study sessions will appear here as you log study time.
                </div>
              ) : (
                monthlyAggregates.map(m => (
                  <div
                    key={m.monthKey}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{m.monthLabel}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {m.activeDaysCount} active study days • {m.totalAttempts} MCQs solved ({m.accuracy}% accuracy)
                      </p>
                    </div>
                    <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                      {m.totalHoursFormatted}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>

        {/* Chart 2: Target Time Breakdown */}
        <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Target Distribution</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Daily planned goal distribution across targets</p>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {displayPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="p-2 rounded-xl bg-slate-900 text-white text-xs border border-slate-700">
                          <p className="font-bold">{data.name}</p>
                          <p className="text-slate-300">{data.value} mins</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Daily Time Allocation Modal */}
      {isEditingAllocations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <Card className="w-full max-w-md p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Daily Target Time Allocation</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Customize planned study minutes for each target today.
            </p>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {targets.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                    {t.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step={15}
                      value={allocationInputs[t.id] ?? t.dailyGoalMinutes}
                      onChange={e => setAllocationInputs({
                        ...allocationInputs,
                        [t.id]: Math.max(0, parseInt(e.target.value) || 0)
                      })}
                      className="w-20 px-2.5 py-1 text-xs text-right rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                    />
                    <span className="text-xs text-slate-400">m</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsEditingAllocations(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveAllocations}>
                Save Goals
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 2-Step Reset Modal */}
      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={(msg) => setResetMessage(msg)}
      />
    </div>
  );
};
