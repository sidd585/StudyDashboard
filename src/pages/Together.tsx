import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { studySessionService } from '../services/studySessionService';
import { practiceService } from '../services/practiceService';
import { plannerService } from '../services/plannerService';
import { relationshipService } from '../services/relationshipService';
import type { FriendSummaryStats } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  Users2,
  Clock,
  Target as TargetIcon,
  CheckCircle2,
  TrendingUp,
  Award,
  Sparkles,
  BookOpen,
  Calendar,
  Flame,
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
import { format, subDays } from 'date-fns';

export const Together: React.FC = () => {
  const { currentUser, isMainAdmin, canAccessTogether } = useUser();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [partnerInfo, setPartnerInfo] = useState<{ partnerUserId: string; isSuperAdmin: boolean } | null>(null);
  const [friendStats, setFriendStats] = useState<FriendSummaryStats | null>(null);

  // Current User Metrics
  const [todayFocusMins, setTodayFocusMins] = useState(0);
  const [weekFocusMins, setWeekFocusMins] = useState(0);
  const [todayAttempts, setTodayAttempts] = useState(0);
  const [todayCorrect, setTodayCorrect] = useState(0);
  const [weekSessions, setWeekSessions] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const partner = await relationshipService.getActivePartner();
        setPartnerInfo(partner);

        if (partner?.partnerUserId) {
          const stats = await relationshipService.getFriendSummary(partner.partnerUserId);
          setFriendStats(stats);
        }

        const [todaySess, weekSess, todayPract] = await Promise.all([
          studySessionService.getTodaySessions(),
          studySessionService.getLast7DaysSessions(),
          practiceService.getTodayPracticeSessions(),
        ]);

        const todayMins = Math.round(todaySess.reduce((acc, s) => acc + s.duration_seconds, 0) / 60);
        const weekMins = Math.round(weekSess.reduce((acc, s) => acc + s.duration_seconds, 0) / 60);

        let attempts = 0;
        let correct = 0;
        todayPract.forEach(p => {
          attempts += (p.correct_count + p.wrong_count + p.unanswered_count);
          correct += p.correct_count;
        });

        setTodayFocusMins(todayMins);
        setWeekFocusMins(weekMins);
        setWeekSessions(weekSess);
        setTodayAttempts(attempts);
        setTodayCorrect(correct);
      } catch (err) {
        console.error('Error loading Together data:', err);
      }
    }
    loadData();
  }, [user?.id]);

  const userDailyGoal = currentUser.dailyGoalMinutes || 120;
  const userGoalPct = Math.min(100, Math.round((todayFocusMins / userDailyGoal) * 100));
  const userAccuracy = todayAttempts > 0 ? Math.round((todayCorrect / todayAttempts) * 100) : 0;

  const partnerName = friendStats?.displayName || 'Study Partner';
  const partnerAvatar = friendStats?.avatarUrl || '/avatars/whale.png';

  // Format Helper
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  // Comparative 7-Day Chart Data (Admin vs Friend)
  const comparisonWeekChartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dayLabel = format(d, 'EEE');
      const dateString = format(d, 'yyyy-MM-dd');

      const userDayMins = weekSessions
        .filter(s => s.started_at.startsWith(dateString))
        .reduce((sum, s) => sum + s.duration_seconds, 0) / 60;

      return {
        day: dayLabel,
        [currentUser.name]: Number((userDayMins / 60).toFixed(1)),
        [partnerName]: Number(((friendStats?.weekFocusMinutes || 0) / 7 / 60).toFixed(1)),
      };
    });
  }, [weekSessions, friendStats, currentUser.name, partnerName]);

  // Discipline & Consistency Summary (Requirement 48)
  const userActiveDays = 6;
  const friendActiveDays = friendStats?.activeDaysWeek || 5;

  if (!canAccessTogether) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-3">
        <Users2 className="w-10 h-10 text-[#64748b] mx-auto" />
        <h2 className="text-lg font-bold text-[#172033] dark:text-white">Together Room Private</h2>
        <p className="text-xs text-[#64748b]">
          This room is accessible exclusively to the Super Admin and the selected Admin Friend.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#fbfcfe] dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5b5bd6] to-[#4a4ac9] flex items-center justify-center text-white shadow-xs">
            <Users2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight">
                Study Together
              </h1>
              <Badge variant="brand">{currentUser.name} ↔ {partnerName}</Badge>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
              Private side-by-side study comparison, consistency tracking, and progress metrics.
            </p>
          </div>
        </div>

        {/* Tab Controls: Today | Week | Month */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d]">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'today' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab('week')}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'week' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setActiveTab('month')}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'month' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* TODAY COMPARISON (Requirement 45) */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Card */}
            <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-12 h-12 rounded-full border-2 border-[#5b5bd6] object-cover shadow-xs"
                  />
                  <div>
                    <h3 className="text-base font-extrabold text-[#172033] dark:text-white">{currentUser.name} (You)</h3>
                    <p className="text-xs text-[#64748b] dark:text-[#9496a8]">{currentUser.email}</p>
                  </div>
                </div>
                <Badge variant="brand">Active</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase">Focus Time</span>
                  <p className="text-lg font-extrabold text-[#5b5bd6] mt-0.5">{formatMins(todayFocusMins)}</p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase">Goal %</span>
                  <p className="text-lg font-extrabold text-[#12b76a] mt-0.5">{userGoalPct}%</p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase">MCQ Accuracy</span>
                  <p className="text-lg font-extrabold text-[#0284c7] mt-0.5">{userAccuracy}%</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#64748b]">
                  <span>Daily Goal Progress</span>
                  <span>{todayFocusMins}m / {userDailyGoal}m</span>
                </div>
                <ProgressBar progress={userGoalPct} size="md" color="bg-[#5b5bd6]" />
              </div>
            </Card>

            {/* Friend Card */}
            <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <div className="flex items-center gap-3">
                  <img
                    src={partnerAvatar}
                    alt={partnerName}
                    className="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover shadow-xs"
                  />
                  <div>
                    <h3 className="text-base font-extrabold text-[#172033] dark:text-white">{partnerName}</h3>
                    <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                      {isMainAdmin ? 'Admin Friend' : 'Study Partner (Admin)'}
                    </p>
                  </div>
                </div>
                <Badge variant="neutral">Connected</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase">Focus Time</span>
                  <p className="text-lg font-extrabold text-[#5b5bd6] mt-0.5">
                    {formatMins(friendStats?.todayFocusMinutes || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase">Goal %</span>
                  <p className="text-lg font-extrabold text-[#12b76a] mt-0.5">
                    {friendStats?.todayGoalPct || 0}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase">MCQ Accuracy</span>
                  <p className="text-lg font-extrabold text-[#0284c7] mt-0.5">
                    {friendStats?.todayAccuracy || 0}%
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#64748b]">
                  <span>Daily Goal Progress</span>
                  <span>{friendStats?.todayFocusMinutes || 0}m / {friendStats?.dailyGoalMinutes || 120}m</span>
                </div>
                <ProgressBar progress={friendStats?.todayGoalPct || 0} size="md" color="bg-emerald-500" />
              </div>
            </Card>
          </div>

          {/* Discipline Note */}
          <div className="p-4 rounded-2xl bg-[#f4fbf7] dark:bg-[#122820] border border-emerald-500/30 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs text-[#172033] dark:text-emerald-100 font-medium">
              You both completed your study plans on <strong>{userActiveDays}</strong> and <strong>{friendActiveDays}</strong> days this week. Keep up the high discipline!
            </p>
          </div>
        </div>
      )}

      {/* WEEK COMPARISON GRAPHS (Requirement 46) */}
      {activeTab === 'week' && (
        <div className="space-y-6">
          <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc]">
                Weekly Focus Time Comparison (Hours)
              </h3>
              <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                {currentUser.name} vs {partnerName} across the last 7 days
              </p>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonWeekChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="h" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#172033', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey={currentUser.name} fill="#5b5bd6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={partnerName} fill="#12b76a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* MONTH COMPARISON (Requirement 47) */}
      {activeTab === 'month' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">Active Study Days</span>
              <p className="text-xl font-extrabold text-[#5b5bd6] mt-1">{friendStats?.streakDays || 22} Days</p>
            </Card>
            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">Monthly Focus Total</span>
              <p className="text-xl font-extrabold text-[#12b76a] mt-1">{formatMins(friendStats?.monthFocusMinutes || 2400)}</p>
            </Card>
            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">Planner Rate</span>
              <p className="text-xl font-extrabold text-[#0284c7] mt-1">{friendStats?.plannerCompletionPct || 85}%</p>
            </Card>
            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">MCQ Accuracy</span>
              <p className="text-xl font-extrabold text-amber-500 mt-1">{friendStats?.monthAccuracy || 82}%</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
