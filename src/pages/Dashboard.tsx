import React, { useMemo } from 'react';
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
  FileText,
  Calendar,
  ChevronRight,
  TrendingUp,
  Target as TargetIcon,
  CheckCircle2,
  BarChart3,
  Layers,
  Upload,
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
import type { PageId } from '../components/layout/Sidebar';
import type { Target } from '../types';

interface DashboardProps {
  onNavigate: (page: PageId, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();
  const { startSession, openModal: openTimerModal } = useStudyTimer();
  const todayStr = getKathmanduTodayStr();

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

  // Format Helper
  const formatMins = (mins: number) => {
    if (mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  const handleStartTargetFocus = (target: Target) => {
    startSession(target.id);
    openTimerModal();
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16 max-w-7xl mx-auto">
      {/* ================= HERO: TODAY'S FOCUS ================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-50/70 via-slate-50 to-white dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-850 p-6 sm:p-8 border border-brand-200/80 dark:border-slate-800 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100/80 dark:bg-brand-950/60 text-xs font-bold text-brand-800 dark:text-brand-300 border border-brand-300/60 dark:border-brand-800/80">
              <span className="w-2 h-2 rounded-full bg-brand-600 dark:bg-brand-400 animate-pulse" />
              <span>Asia/Kathmandu Time (UTC+5:45)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {timeOfDayGreeting}, {currentUser.name.split(' ')[0]} 👋
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {totalStudiedMinutesToday > 0 ? (
                <>
                  <span className="font-bold text-brand-700 dark:text-brand-400">{formatMins(totalStudiedMinutesToday)}</span> focused today
                  {remainingMinutes > 0 ? (
                    <> • <span className="font-bold text-slate-900 dark:text-white">{formatMins(remainingMinutes)} remaining</span> to reach daily goal</>
                  ) : (
                    <> • <span className="text-emerald-600 dark:text-emerald-400 font-bold">🎉 Daily goal achieved!</span></>
                  )}
                </>
              ) : (
                <>You haven't logged study focus today. Ready to begin your session?</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="lg"
              className="font-bold shadow-md text-white"
              leftIcon={<Play className="w-4 h-4 fill-white" />}
              onClick={() => openTimerModal()}
            >
              Focus Now
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-bold shadow-xs"
              leftIcon={<BookOpen className="w-4 h-4 text-brand-600 dark:text-brand-400" />}
              onClick={() => onNavigate('practice')}
            >
              Practice MCQs
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-bold shadow-xs"
              leftIcon={<FileText className="w-4 h-4 text-blue-500" />}
              onClick={() => onNavigate('questions', { openUpload: true })}
            >
              Upload PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ================= 4 CLEAN SNAPSHOT CARDS (CUBIC STYLE) ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Focus Time */}
        <Card className="p-5 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs hover:border-[#7f56d9]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#475467] dark:text-[#9496a8] uppercase tracking-wider">Focus Time</span>
            <div className="w-9 h-9 rounded-xl bg-[#f4ebff] dark:bg-[#2c1c5f] text-[#7f56d9] flex items-center justify-center shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc]">
            {formatMins(totalStudiedMinutesToday)}
          </div>
          <p className="text-[11px] text-[#667085] mt-1 font-medium">Goal: {formatMins(totalPlannedMinutesToday)}</p>
        </Card>

        {/* 2. Daily Goal */}
        <Card className="p-5 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs hover:border-[#12b76a]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#475467] dark:text-[#9496a8] uppercase tracking-wider">Daily Goal</span>
            <div className="w-9 h-9 rounded-xl bg-[#ecfdf3] dark:bg-[#054f31] text-[#12b76a] flex items-center justify-center shadow-xs">
              <TargetIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc]">
            {todayGoalCompletion}%
          </div>
          <div className="mt-2.5">
            <ProgressBar progress={todayGoalCompletion} size="sm" color={todayGoalCompletion >= 100 ? 'bg-[#12b76a]' : 'bg-[#7f56d9]'} />
          </div>
        </Card>

        {/* 3. MCQs Today */}
        <Card className="p-5 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs hover:border-[#0284c7]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#475467] dark:text-[#9496a8] uppercase tracking-wider">MCQs Today</span>
            <div className="w-9 h-9 rounded-xl bg-[#f0f9ff] dark:bg-[#0c4a6e] text-[#0284c7] flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc]">
            {todayAttemptCount}
          </div>
          <p className="text-[11px] text-[#667085] mt-1 font-medium">
            {todayCorrectCount > 0 ? `${todayCorrectCount} correct answers` : 'No attempts logged today'}
          </p>
        </Card>

        {/* 4. Accuracy */}
        <Card className="p-5 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs hover:border-[#f79009]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#475467] dark:text-[#9496a8] uppercase tracking-wider">Accuracy</span>
            <div className="w-9 h-9 rounded-xl bg-[#fffaeb] dark:bg-[#4e2d09] text-[#f79009] flex items-center justify-center shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc]">
            {todayAccuracy !== null ? `${todayAccuracy}%` : '—'}
          </div>
          <p className="text-[11px] text-[#667085] mt-1 font-medium">
            {todayAccuracy !== null ? (todayAccuracy >= 75 ? 'Strong recall' : 'Review recommended') : 'No questions practiced yet'}
          </p>
        </Card>
      </div>

      {/* ================= MAIN CONTENT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Study Plan & Focus Shortcuts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Study Plan Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#101828] dark:text-[#f8f9fc]">Today's Study Plan</h3>
                <p className="text-xs text-[#475467] dark:text-[#9496a8]">Pick a course or subject to start your focused study session</p>
              </div>
              <button
                onClick={() => onNavigate('targets')}
                className="text-xs font-bold text-[#6941c6] dark:text-[#b692f6] hover:underline flex items-center gap-1"
              >
                <span>Manage Courses</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {targets.map(target => {
                const studied = targetStudiedMinutes[target.id] || 0;
                const planned = targetPlannedMinutes[target.id] || target.dailyGoalMinutes;
                const pct = Math.min(100, Math.round((studied / planned) * 100));
                const isComplete = studied >= planned;

                return (
                  <Card
                    key={target.id}
                    className="p-5 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4 hover:border-[#7f56d9]/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: target.color || '#7f56d9' }}
                        />
                        <div>
                          <h4 className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">{target.name}</h4>
                          <p className="text-[11px] text-[#667085] font-medium">
                            {formatMins(studied)} / {formatMins(planned)}
                          </p>
                        </div>
                      </div>

                      {isComplete ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#ecfdf3] text-[#027a48] border border-[#a6f4c5] text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#475467] dark:text-[#9496a8]">{pct}%</span>
                      )}
                    </div>

                    <ProgressBar progress={pct} size="sm" color={isComplete ? 'bg-[#12b76a]' : 'bg-[#7f56d9]'} />

                    <Button
                      variant={isComplete ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full font-bold text-xs"
                      leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                      onClick={() => handleStartTargetFocus(target)}
                    >
                      {studied > 0 ? 'Continue Focus' : 'Start Focus'}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Practice & Question Bank Quick Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-5 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] border-l-4 border-l-[#7f56d9] flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-2 text-[#6941c6] dark:text-[#b692f6] font-bold text-sm mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span>MCQ Practice & Tests</span>
                </div>
                <p className="text-xs text-[#475467] dark:text-[#9496a8] mb-3">
                  Test your knowledge by topic, mix multiple topics, or run real timed exams with instant scoring.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold bg-white dark:bg-[#1a1f30] text-[#344054] dark:text-[#eceef2] border-[#d0d5dd] dark:border-[#344054]"
                leftIcon={<Play className="w-3.5 h-3.5 text-[#7f56d9]" />}
                onClick={() => onNavigate('practice')}
              >
                Open Practice Room →
              </Button>
            </Card>

            <Card className="p-5 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] border-l-4 border-l-[#0284c7] flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-2 text-[#0284c7] dark:text-[#38bdf8] font-bold text-sm mb-1">
                  <Upload className="w-4 h-4" />
                  <span>Upload Question Papers</span>
                </div>
                <p className="text-xs text-[#475467] dark:text-[#9496a8] mb-3">
                  Upload PDF question sheets to store them directly into your question bank and start testing immediately.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold bg-white dark:bg-[#1a1f30] text-[#344054] dark:text-[#eceef2] border-[#d0d5dd] dark:border-[#344054]"
                leftIcon={<Upload className="w-3.5 h-3.5 text-[#0284c7]" />}
                onClick={() => onNavigate('questions', { openUpload: true })}
              >
                Upload PDF →
              </Button>
            </Card>
          </div>
        </div>

        {/* Right 1 Col: Upcoming Schedule & Weekly Progress */}
        <div className="space-y-6">
          {/* Upcoming Session */}
          <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                <span>Next Scheduled Session</span>
              </h3>
              <button
                onClick={() => onNavigate('planner')}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                Planner →
              </button>
            </div>

            {upcomingSchedules.length > 0 ? (
              <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-900 dark:text-brand-200">
                    {upcomingSchedules[0].title}
                  </span>
                  <Badge variant="brand" size="sm">{upcomingSchedules[0].startTime}</Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Duration: {upcomingSchedules[0].durationMinutes} minutes • 15m reminder active
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                  onClick={() => {
                    startSession(upcomingSchedules[0].targetId);
                    openTimerModal();
                  }}
                >
                  Start Early
                </Button>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                <p>No remaining study sessions scheduled for today.</p>
                <button
                  onClick={() => onNavigate('planner')}
                  className="mt-2 text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                >
                  + Add to Planner
                </button>
              </div>
            )}
          </Card>

          {/* Last 7 Days Study Graph */}
          <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span>Last 7 Days Focus</span>
              </h3>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                {formatMins(totalWeeklyFocusMinutes)} total
              </span>
            </div>

            <div className="h-36 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7DaysChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} unit="h" />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg border border-slate-800">
                            <p className="font-bold">{data.day} ({data.fullDate})</p>
                            <p className="text-brand-300 mt-0.5">{formatMins(data.minutes)} focused</p>
                            <p className="text-slate-400">{data.mcqs} MCQs attempted</p>
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
        </div>
      </div>
    </div>
  );
};
