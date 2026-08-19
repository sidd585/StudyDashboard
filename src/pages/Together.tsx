import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { studySessionService } from '../services/studySessionService';
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
import { format, subDays } from 'date-fns';

export const Together: React.FC = () => {
  const { currentUser } = useUser();
  const { user } = useAuth();

  // Primary user metrics
  const [todayFocusMins, setTodayFocusMins] = useState(0);
  const [weekFocusMins, setWeekFocusMins] = useState(0);

  useEffect(() => {
    async function loadTogetherData() {
      try {
        const [todaySess, weekSess] = await Promise.all([
          studySessionService.getTodaySessions(),
          studySessionService.getLast7DaysSessions(),
        ]);

        const todayMins = Math.round(todaySess.reduce((acc, s) => acc + s.duration_seconds, 0) / 60);
        const weekMins = Math.round(weekSess.reduce((acc, s) => acc + s.duration_seconds, 0) / 60);

        setTodayFocusMins(todayMins);
        setWeekFocusMins(weekMins);
      } catch (err) {
        console.error('Error loading Together data:', err);
      }
    }

    loadTogetherData();
  }, [user?.id]);

  const partnerName = currentUser.name.toLowerCase().includes('shilpa') ? 'Siddhartha' : 'Shilpa';
  const partnerAvatar = currentUser.name.toLowerCase().includes('shilpa') ? '/avatars/panda.png' : '/avatars/whale.png';

  // Last 7 days comparative data (simulated comparative curve for partner until friend joins active session)
  const comparisonData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayLabel = format(d, 'EEE');
    return {
      day: dayLabel,
      [currentUser.name]: Number((todayFocusMins / 60).toFixed(1)),
      [partnerName]: 0,
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc]">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#fbfcfe] dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5b5bd6] to-[#4a4ac9] flex items-center justify-center text-white shadow-xs">
            <Users2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#172033] dark:text-[#f8f9fc] tracking-tight">Study Together Room</h2>
              <Badge variant="brand">Siddhartha & Shilpa</Badge>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
              Friendly shared accountability room for <strong>Siddhartha</strong> and <strong>Shilpa</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#64748b] dark:text-[#9496a8] bg-[#f8fafc] dark:bg-[#181d2f] px-3.5 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#2b334d]">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Universal progress metrics (time, consistency, accuracy)</span>
        </div>
      </div>

      {/* Side-by-Side Today Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current User Card */}
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#e2e8f0] dark:border-[#23293d]">
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-11 h-11 rounded-full border-2 border-[#5b5bd6] bg-white dark:bg-[#141824] object-cover shadow-xs"
              />
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc] leading-tight">{currentUser.name} (You)</h3>
                <p className="text-xs text-[#64748b] dark:text-[#9496a8]">{currentUser.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              <Flame className="w-3.5 h-3.5" />
              <span>Active</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-[#5b5bd6]" />
                <span>Today's Focus</span>
              </div>
              <div className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
                {Math.floor(todayFocusMins / 60)}h {todayFocusMins % 60}m
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mb-1">
                <HelpCircle className="w-3.5 h-3.5 text-[#0284c7]" />
                <span>7-Day Focus</span>
              </div>
              <div className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
                {Math.floor(weekFocusMins / 60)}h {weekFocusMins % 60}m
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-[#64748b] font-semibold mb-1.5">
              <span>Daily Target Progress</span>
              <span className="text-[#5b5bd6] font-bold">
                {Math.min(100, Math.round((todayFocusMins / (currentUser.dailyGoalMinutes || 120)) * 100))}%
              </span>
            </div>
            <ProgressBar
              progress={Math.min(100, Math.round((todayFocusMins / (currentUser.dailyGoalMinutes || 120)) * 100))}
              size="md"
              color="bg-[#5b5bd6]"
            />
          </div>
        </Card>

        {/* Study Partner Card */}
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#e2e8f0] dark:border-[#23293d]">
            <div className="flex items-center gap-3">
              <img
                src={partnerAvatar}
                alt={partnerName}
                className="w-11 h-11 rounded-full border-2 border-sky-500 bg-white dark:bg-[#141824] object-cover shadow-xs"
              />
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc] leading-tight">{partnerName}</h3>
                <p className="text-xs text-[#64748b] dark:text-[#9496a8]">Study Partner</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
              <span>Connected</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>Today's Focus</span>
              </div>
              <div className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
                0h 0m
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mb-1">
                <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
                <span>7-Day Focus</span>
              </div>
              <div className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
                0h 0m
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-[#64748b] font-semibold mb-1.5">
              <span>Daily Target Progress</span>
              <span className="text-sky-600 font-bold">0%</span>
            </div>
            <ProgressBar progress={0} size="md" color="bg-sky-500" />
          </div>
        </Card>
      </div>

      {/* 7-Day Comparison Chart */}
      <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#5b5bd6]" />
            <h3 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc]">7-Day Study Comparison (Hours)</h3>
          </div>
          <span className="text-xs text-[#64748b]">Real-time cloud sync</span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="h" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#172033',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Bar dataKey={currentUser.name} fill="#5b5bd6" radius={[4, 4, 0, 0]} />
              <Bar dataKey={partnerName} fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
