import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { studySessionService } from '../services/studySessionService';
import { practiceService } from '../services/practiceService';
import { relationshipService } from '../services/relationshipService';
import type { FriendSummaryStats } from '../types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  Users2,
  Sparkles,
  Award,
  Flame,
  CheckCircle2,
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

const PARTNER_COLORS = ['#12b76a', '#0284c7', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

export const Together: React.FC = () => {
  const { currentUser, isMainAdmin, canAccessTogether } = useUser();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [partners, setPartners] = useState<{
    partnerUserId: string;
    partnerName: string;
    avatarUrl: string;
    role: string;
    isSuperAdmin: boolean;
  }[]>([]);
  const [partnersStats, setPartnersStats] = useState<FriendSummaryStats[]>([]);

  // Current User Metrics
  const [todayFocusMins, setTodayFocusMins] = useState(0);
  const [weekFocusMins, setWeekFocusMins] = useState(0);
  const [todayAttempts, setTodayAttempts] = useState(0);
  const [todayCorrect, setTodayCorrect] = useState(0);
  const [weekSessions, setWeekSessions] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const allPartners = await relationshipService.getAllActivePartners();
        setPartners(allPartners);

        if (allPartners.length > 0) {
          const statsList = await Promise.all(
            allPartners.map(p => relationshipService.getFriendSummary(p.partnerUserId))
          );
          setPartnersStats(statsList.filter(Boolean) as FriendSummaryStats[]);
        } else {
          setPartnersStats([]);
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

  // Format Helper
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  // Comparative 7-Day Chart Data (You + All Friends)
  const comparisonWeekChartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dayLabel = format(d, 'EEE');
      const dateString = format(d, 'yyyy-MM-dd');

      const userDayMins = weekSessions
        .filter(s => s.started_at.startsWith(dateString))
        .reduce((sum, s) => sum + s.duration_seconds, 0) / 60;

      const row: Record<string, any> = {
        day: dayLabel,
        [currentUser.name]: Number((userDayMins / 60).toFixed(1)),
      };

      partnersStats.forEach(p => {
        row[p.displayName] = Number(((p.weekFocusMinutes || 0) / 7 / 60).toFixed(1));
      });

      return row;
    });
  }, [weekSessions, partnersStats, currentUser.name]);

  if (!canAccessTogether) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-3">
        <Users2 className="w-10 h-10 text-[#64748b] mx-auto" />
        <h2 className="text-lg font-bold text-[#172033] dark:text-white">Together Room Private</h2>
        <p className="text-xs text-[#64748b]">
          This room is accessible to the Super Admin, Sub-Admins, and connected Study Friends.
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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight">
                Study Together
              </h1>
              <Badge variant="brand">
                {currentUser.name} {partners.length > 0 ? `+ ${partners.length} Partner${partners.length > 1 ? 's' : ''}` : '(Room Ready)'}
              </Badge>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
              Live side-by-side study comparison, consistency tracking, and group focus metrics.
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

      {/* TODAY COMPARISON GRID (Supports 1, 2, 3, 4, 5+ Friends) */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                    <p className="text-xs text-[#64748b] dark:text-[#9496a8]">{currentUser.email || currentUser.role}</p>
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

            {/* Friend Cards for All Connected Partners */}
            {partnersStats.map((pStat, index) => {
              const partnerColor = PARTNER_COLORS[index % PARTNER_COLORS.length];
              return (
                <Card
                  key={pStat.userId}
                  className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-5"
                >
                  <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#23293d]">
                    <div className="flex items-center gap-3">
                      <img
                        src={pStat.avatarUrl || '/avatars/whale.png'}
                        alt={pStat.displayName}
                        className="w-12 h-12 rounded-full border-2 object-cover shadow-xs"
                        style={{ borderColor: partnerColor }}
                      />
                      <div>
                        <h3 className="text-base font-extrabold text-[#172033] dark:text-white">{pStat.displayName}</h3>
                        <p className="text-xs text-[#64748b] dark:text-[#9496a8]">Connected Friend</p>
                      </div>
                    </div>
                    <Badge variant="neutral">Connected</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                      <span className="text-[10px] font-bold text-[#64748b] uppercase">Focus Time</span>
                      <p className="text-lg font-extrabold text-[#5b5bd6] mt-0.5">
                        {formatMins(pStat.todayFocusMinutes || 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                      <span className="text-[10px] font-bold text-[#64748b] uppercase">Goal %</span>
                      <p className="text-lg font-extrabold text-[#12b76a] mt-0.5">
                        {pStat.todayGoalPct || 0}%
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
                      <span className="text-[10px] font-bold text-[#64748b] uppercase">MCQ Accuracy</span>
                      <p className="text-lg font-extrabold text-[#0284c7] mt-0.5">
                        {pStat.todayAccuracy || 0}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-[#64748b]">
                      <span>Daily Goal Progress</span>
                      <span>{pStat.todayFocusMinutes || 0}m / {pStat.dailyGoalMinutes || 120}m</span>
                    </div>
                    <ProgressBar progress={pStat.todayGoalPct || 0} size="md" color="bg-emerald-500" />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Group Discipline & Streak Card */}
          <div className="p-4 rounded-2xl bg-[#f4fbf7] dark:bg-[#122820] border border-emerald-500/30 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs text-[#172033] dark:text-emerald-100 font-medium">
              Study Together group has <strong>{partnersStats.length + 1} active learners</strong>. Keep up daily consistency and focus targets!
            </p>
          </div>
        </div>
      )}

      {/* WEEK COMPARISON GRAPHS */}
      {activeTab === 'week' && (
        <div className="space-y-6">
          <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc]">
                Weekly Focus Time Comparison (Hours)
              </h3>
              <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                Comparing your study time against connected friends over the last 7 days
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
                  {partnersStats.map((p, idx) => (
                    <Bar
                      key={p.userId}
                      dataKey={p.displayName}
                      fill={PARTNER_COLORS[idx % PARTNER_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* MONTH COMPARISON LEADERBOARD */}
      {activeTab === 'month' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Current user summary */}
            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-bold">{currentUser.name} (You)</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#64748b]">Month Focus:</span>
                  <p className="font-bold text-[#5b5bd6]">{formatMins(weekFocusMins * 4)}</p>
                </div>
                <div>
                  <span className="text-[#64748b]">MCQ Accuracy:</span>
                  <p className="font-bold text-[#12b76a]">{userAccuracy}%</p>
                </div>
              </div>
            </Card>

            {/* Partners summaries */}
            {partnersStats.map(p => (
              <Card key={p.userId} className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#5b5bd6]" />
                  <h4 className="text-sm font-bold">{p.displayName}</h4>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#64748b]">Month Focus:</span>
                    <p className="font-bold text-[#5b5bd6]">{formatMins(p.monthFocusMinutes || 0)}</p>
                  </div>
                  <div>
                    <span className="text-[#64748b]">MCQ Accuracy:</span>
                    <p className="font-bold text-[#12b76a]">{p.monthAccuracy || 0}%</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
