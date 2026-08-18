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
  Flame,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import type { PageId } from '../components/layout/Sidebar';
import type { Target } from '../types';

interface DashboardProps {
  onNavigate: (page: PageId, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();
  const { startSession, openModal } = useStudyTimer();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

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

  // 2. Calculations for Today's Stats
  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = endOfDay(new Date()).getTime();

  const todaySessions = studySessions.filter(s => s.startTime >= todayStart && s.startTime <= todayEnd);
  const todayAttempts = attempts.filter(a => a.timestamp >= todayStart && a.timestamp <= todayEnd);

  // Time studied per target today (in minutes)
  const targetStudiedMinutes: Record<string, number> = {};
  targets.forEach(t => {
    targetStudiedMinutes[t.id] = todaySessions
      .filter(s => s.targetId === t.id)
      .reduce((sum, s) => sum + s.focusedMinutes, 0);
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
  const todayAccuracy = todayAttemptCount > 0 ? Math.round((todayCorrectCount / todayAttemptCount) * 100) : 0;

  // Average Focus Rating Today
  const ratedSessions = todaySessions.filter(s => s.focusRating);
  const avgFocusRating = ratedSessions.length > 0
    ? (ratedSessions.reduce((sum, s) => sum + (s.focusRating || 0), 0) / ratedSessions.length).toFixed(1)
    : '4.5';

  // 3. Simple Study Effectiveness Status
  let status: 'On Track' | 'Almost There' | 'Needs Attention' = 'On Track';
  let statusExplanation = '';

  if (todayGoalCompletion >= 80 && (todayAttemptCount === 0 || todayAccuracy >= 75)) {
    status = 'On Track';
    statusExplanation = `${Math.floor(totalStudiedMinutesToday / 60)}h ${totalStudiedMinutesToday % 60}m / ${Math.floor(totalPlannedMinutesToday / 60)}h ${totalPlannedMinutesToday % 60}m completed (${todayGoalCompletion}%), ${todayAttemptCount > 0 ? `${todayAccuracy}% MCQ accuracy` : 'solid focus pace'}.`;
  } else if (todayGoalCompletion >= 50 || (todayAttemptCount > 0 && todayAccuracy >= 60)) {
    status = 'Almost There';
    statusExplanation = `${todayGoalCompletion}% of daily study goal completed so far. A focused 30-minute session will put you on track.`;
  } else {
    status = 'Needs Attention';
    statusExplanation = `You have completed ${todayGoalCompletion}% of today's target. Start your next planned target session to build momentum.`;
  }

  // 4. Chart 1: Last 7 Days Study Time
  const last7DaysData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayKey = format(d, 'yyyy-MM-dd');
    const dayLabel = format(d, 'EEE');
    const dStart = startOfDay(d).getTime();
    const dEnd = endOfDay(d).getTime();
    const dayMins = studySessions
      .filter(s => s.startTime >= dStart && s.startTime <= dEnd)
      .reduce((sum, s) => sum + s.focusedMinutes, 0);

    return {
      day: dayLabel,
      hours: Number((dayMins / 60).toFixed(1)),
      minutes: dayMins,
    };
  });

  // Chart 2: Target Time Breakdown
  const targetPieData = targets.map(t => ({
    name: t.name,
    value: targetStudiedMinutes[t.id] || 0,
    color: t.color,
  })).filter(t => t.value > 0);

  // Fallback pie if today no study yet
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
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-600/20 via-indigo-600/10 to-slate-900 border border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-brand-400 tracking-wider">Next Study Session Today</span>
              <h4 className="text-sm font-bold text-white">{nextSession.title} at {nextSession.startTime} ({nextSession.durationMinutes}m)</h4>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            onClick={() => startSession(nextSession.targetId, nextSession.subjectId)}
          >
            Start Now
          </Button>
        </div>
      )}

      {/* Personalized Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Welcome back, <span className="text-brand-400">{currentUser.name}</span> 👋
          </h2>
          <p className="text-xs text-slate-400">Track your daily study targets, solve MCQs, and stay consistent.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-slate-700 text-slate-300"
            onClick={() => onNavigate('settings')}
          >
            Reset Progress / Streak (0)
          </Button>
        </div>
      </div>

      {/* 2. Simple Study Effectiveness Status Banner */}
      <Card className="p-5 border-slate-800 bg-slate-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl border ${
              status === 'On Track'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : status === 'Almost There'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {status === 'On Track' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`text-base font-bold ${
                  status === 'On Track' ? 'text-emerald-400' : status === 'Almost There' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  Status: {status}
                </span>
                <Badge variant={status === 'On Track' ? 'success' : status === 'Almost There' ? 'warning' : 'danger'}>
                  {todayGoalCompletion}% Goal Completed
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">{statusExplanation}</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Focus Time</p>
              <p className="text-lg font-bold text-white">
                {Math.floor(totalStudiedMinutesToday / 60)}h {totalStudiedMinutesToday % 60}m
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">MCQ Accuracy</p>
              <p className="text-lg font-bold text-emerald-400">
                {todayAttemptCount > 0 ? `${todayAccuracy}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Focus Rating</p>
              <p className="text-lg font-bold text-amber-400 flex items-center gap-1">
                <span>{avgFocusRating}</span>
                <span className="text-xs text-slate-400">/ 5</span>
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Daily Time Allocation Section ("How much time do I want to give each Target today?") */}
      <Card className="p-5 border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-400" />
              <span>Today's Time Allocation</span>
            </h3>
            <p className="text-xs text-slate-400">
              Planned: <span className="font-semibold text-slate-200">{Math.floor(totalPlannedMinutesToday / 60)}h {totalPlannedMinutesToday % 60}m</span> | 
              Actual: <span className="font-semibold text-emerald-400">{Math.floor(totalStudiedMinutesToday / 60)}h {totalStudiedMinutesToday % 60}m</span> | 
              Remaining: <span className="font-semibold text-amber-400">{Math.max(0, Math.floor((totalPlannedMinutesToday - totalStudiedMinutesToday) / 60))}h {Math.max(0, (totalPlannedMinutesToday - totalStudiedMinutesToday) % 60)}m</span>
            </p>
          </div>

          <Button
            variant="outline"
            size="xs"
            onClick={isEditingAllocations ? handleSaveAllocations : openAllocationEditor}
          >
            {isEditingAllocations ? 'Save Allocation' : 'Adjust Today’s Time'}
          </Button>
        </div>

        {/* Allocation Sliders / View */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {targets.map(target => {
            const studied = targetStudiedMinutes[target.id] || 0;
            const planned = isEditingAllocations
              ? (allocationInputs[target.id] ?? target.dailyGoalMinutes)
              : (targetPlannedMinutes[target.id] || target.dailyGoalMinutes);
            const pct = Math.min(100, Math.round((studied / planned) * 100));

            return (
              <div key={target.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: target.color }} />
                    <span className="font-semibold text-xs text-slate-200 truncate">{target.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-brand-400">{pct}%</span>
                </div>

                {isEditingAllocations ? (
                  <div className="mt-2">
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Plan:</span>
                      <span className="font-semibold text-white">{Math.floor(planned / 60)}h {planned % 60}m</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="240"
                      step="15"
                      value={planned}
                      onChange={e => setAllocationInputs({ ...allocationInputs, [target.id]: Number(e.target.value) })}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                      <span>{Math.floor(studied / 60)}h {studied % 60}m</span>
                      <span>Goal: {Math.floor(planned / 60)}h {planned % 60}m</span>
                    </div>
                    <ProgressBar progress={pct} size="sm" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 4. "MY TARGETS TODAY" — Core Interactive Cards */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-bold text-white tracking-tight">My Targets Today</h2>
          <Button
            variant="ghost"
            size="xs"
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('targets')}
          >
            Manage All Targets
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map(target => {
            const studied = targetStudiedMinutes[target.id] || 0;
            const planned = targetPlannedMinutes[target.id] || target.dailyGoalMinutes;
            const pct = Math.min(100, Math.round((studied / planned) * 100));
            const isCompleted = studied >= planned;

            return (
              <Card key={target.id} className="p-5 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm"
                        style={{ backgroundColor: target.color }}
                      >
                        {target.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white leading-tight">{target.name}</h3>
                        <span className="text-[11px] text-slate-400">{target.type}</span>
                      </div>
                    </div>

                    {isCompleted && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed ✓</span>
                      </Badge>
                    )}
                  </div>

                  {/* Progress Bar & Numbers */}
                  <div className="space-y-1.5 my-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">
                        Studied: <strong className="text-white">{Math.floor(studied / 60)}h {studied % 60}m</strong>
                      </span>
                      <span className="text-slate-400">
                        Goal: <strong className="text-slate-200">{Math.floor(planned / 60)}h {planned % 60}m</strong>
                      </span>
                    </div>
                    <ProgressBar progress={pct} size="md" />
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800">
                  <Button
                    variant="primary"
                    size="xs"
                    leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                    onClick={() => startSession(target.id)}
                    className="w-full"
                  >
                    Start Study
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    leftIcon={<BookOpenCheck className="w-3.5 h-3.5" />}
                    onClick={() => onNavigate('practice', { targetId: target.id })}
                    className="w-full"
                  >
                    Practice
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => onNavigate('questions', { targetId: target.id, openCreate: true })}
                    className="w-full"
                  >
                    Add MCQ
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onNavigate('targets', { targetId: target.id })}
                    className="w-full text-slate-400 hover:text-white"
                  >
                    Progress
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 5. 4 ESSENTIAL CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Study Time (Last 7 Days) */}
        <Card className="p-5 border-slate-800">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-400" />
            <span>Study Time (Last 7 Days)</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">Daily hours dedicated to focused targets</p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="h" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: any) => [`${val} Hours`, 'Study Time']}
                />
                <Bar dataKey="hours" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Target Time Breakdown */}
        <Card className="p-5 border-slate-800">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Target Time Distribution</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">Minutes allocated across active targets</p>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {displayPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: any) => [`${val} Minutes`, 'Time']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            {displayPieData.map(item => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
