import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { USER_PROFILES } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  Users2,
  Flame,
  Clock,
  HelpCircle,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export const Together: React.FC = () => {
  const sidProfile = USER_PROFILES.siddhartha;
  const shilpaProfile = USER_PROFILES.shilpa;

  // Live queries for both users
  const allSessions = useLiveQuery(() => db.studySessions.toArray(), []) || [];
  const allAttempts = useLiveQuery(() => db.attempts.toArray(), []) || [];
  const allTargets = useLiveQuery(() => db.targets.toArray(), []) || [];

  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = endOfDay(new Date()).getTime();

  // Helper calculation for a specific user profile
  const getUserMetrics = (userId: string) => {
    const userSessions = allSessions.filter(s => s.userId === userId);
    const userAttempts = allAttempts.filter(a => a.userId === userId);
    const userTargets = allTargets.filter(t => t.userId === userId && !t.isArchived);

    // Today's stats
    const todaySessions = userSessions.filter(s => s.startTime >= todayStart && s.startTime <= todayEnd);
    const todayAttempts = userAttempts.filter(a => a.timestamp >= todayStart && a.timestamp <= todayEnd);

    const todayStudyMins = todaySessions.reduce((sum, s) => sum + s.focusedMinutes, 0);
    const todayQuestionsAttempted = todayAttempts.length;
    const todayCorrectQuestions = todayAttempts.filter(a => a.isCorrect).length;
    const todayAccuracy = todayQuestionsAttempted > 0
      ? Math.round((todayCorrectQuestions / todayQuestionsAttempted) * 100)
      : 0;

    const totalTargetMinsToday = userTargets.reduce((sum, t) => sum + t.dailyGoalMinutes, 0) || 1;
    const todayGoalPct = Math.min(100, Math.round((todayStudyMins / totalTargetMinsToday) * 100));

    // 7-day stats
    const weekStart = subDays(new Date(), 6).getTime();
    const weekSessions = userSessions.filter(s => s.startTime >= weekStart);
    const weekStudyMins = weekSessions.reduce((sum, s) => sum + s.focusedMinutes, 0);

    const streak = userSessions.length === 0 ? 0 : new Set(
      userSessions.map(s => new Date(s.startTime).toDateString())
    ).size;

    const status: 'On Track' | 'Almost There' | 'Needs Attention' =
      todayGoalPct >= 80 ? 'On Track' : todayGoalPct >= 50 ? 'Almost There' : 'Needs Attention';

    return {
      todayStudyMins,
      todayStudyFormatted: `${Math.floor(todayStudyMins / 60)}h ${todayStudyMins % 60}m`,
      todayQuestionsAttempted,
      todayCorrectQuestions,
      todayAccuracy,
      todayGoalPct,
      weekStudyMins,
      streak,
      status,
    };
  };

  const sidMetrics = getUserMetrics(sidProfile.id);
  const shilpaMetrics = getUserMetrics(shilpaProfile.id);

  // 7-day comparative study hours chart
  const weeklyComparisonData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayLabel = format(d, 'EEE');
    const dStart = startOfDay(d).getTime();
    const dEnd = endOfDay(d).getTime();

    const u1Mins = allSessions
      .filter(s => s.userId === sidProfile.id && s.startTime >= dStart && s.startTime <= dEnd)
      .reduce((sum, s) => sum + s.focusedMinutes, 0);

    const u2Mins = allSessions
      .filter(s => s.userId === shilpaProfile.id && s.startTime >= dStart && s.startTime <= dEnd)
      .reduce((sum, s) => sum + s.focusedMinutes, 0);

    return {
      day: dayLabel,
      Siddhartha: Number((u1Mins / 60).toFixed(1)),
      Shilpa: Number((u2Mins / 60).toFixed(1)),
    };
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/30 via-sky-900/20 to-slate-900 border border-blue-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Users2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Study Together Room</h2>
              <Badge variant="brand">Siddhartha & Shilpa</Badge>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Friendly shared accountability room for <strong>Siddhartha</strong> and <strong>Shilpa</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Universal progress metrics (time, consistency, accuracy)</span>
        </div>
      </div>

      {/* Mutual Reset Alert Banner if requested */}
      {typeof window !== 'undefined' && localStorage.getItem('studydashboard_pending_reset') && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-xs font-bold text-amber-300">
                Shared Progress Reset Request Pending
              </p>
              <p className="text-[11px] text-slate-300">
                {JSON.parse(localStorage.getItem('studydashboard_pending_reset') || '{}').requestedBy || 'Your study partner'} has requested to reset all study time and streaks back to Day 0 (Fresh Start).
              </p>
            </div>
          </div>
          <a href="#/settings" className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors text-center">
            Review in Settings
          </a>
        </Card>
      )}

      {/* Side-by-Side Today Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Siddhartha Card */}
        <Card className="p-6 border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/40 hover:border-brand-500/40 transition-all">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <img
                src={sidProfile.avatarUrl}
                alt={sidProfile.name}
                className="w-11 h-11 rounded-full border-2 border-brand-500 bg-slate-800"
              />
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Siddhartha</h3>
                <p className="text-xs text-slate-400">RBB IT & Banking Track</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                sidMetrics.status === 'On Track'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : sidMetrics.status === 'Almost There'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {sidMetrics.status}
              </span>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                <Flame className="w-3.5 h-3.5" />
                <span>{sidMetrics.streak}d</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  <span>Today's Study</span>
                </div>
                <p className="text-lg font-black text-white">{sidMetrics.todayStudyFormatted}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                  <span>MCQ Accuracy</span>
                </div>
                <p className="text-lg font-black text-white">{sidMetrics.todayAccuracy}%</p>
                <p className="text-[10px] text-slate-400">{sidMetrics.todayQuestionsAttempted} attempted</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-1.5">
                <span>Daily Target Goal Completion</span>
                <span className="text-brand-400 font-bold">{sidMetrics.todayGoalPct}%</span>
              </div>
              <ProgressBar progress={sidMetrics.todayGoalPct} size="md" />
            </div>
          </div>
        </Card>

        {/* 2. Shilpa Card */}
        <Card className="p-6 border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/40 hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <img
                src={shilpaProfile.avatarUrl}
                alt={shilpaProfile.name}
                className="w-11 h-11 rounded-full border-2 border-pink-500 bg-slate-800"
              />
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Shilpa</h3>
                <p className="text-xs text-slate-400">NRB & RBB Administration Track</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                shilpaMetrics.status === 'On Track'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : shilpaMetrics.status === 'Almost There'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {shilpaMetrics.status}
              </span>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                <Flame className="w-3.5 h-3.5" />
                <span>{shilpaMetrics.streak}d</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  <span>Today's Study</span>
                </div>
                <p className="text-lg font-black text-white">{shilpaMetrics.todayStudyFormatted}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                  <span>MCQ Accuracy</span>
                </div>
                <p className="text-lg font-black text-white">{shilpaMetrics.todayAccuracy}%</p>
                <p className="text-[10px] text-slate-400">{shilpaMetrics.todayQuestionsAttempted} attempted</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-1.5">
                <span>Daily Target Goal Completion</span>
                <span className="text-pink-400 font-bold">{shilpaMetrics.todayGoalPct}%</span>
              </div>
              <ProgressBar progress={shilpaMetrics.todayGoalPct} size="md" color="bg-pink-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly Comparative Study-Hours Chart */}
      <Card className="p-6 border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Weekly Focused Study Time Comparison (Hours)</h3>
          </div>
          <span className="text-xs text-slate-400">Last 7 Days</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="h" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Siddhartha" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Shilpa" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
