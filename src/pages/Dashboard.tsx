import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useStudyTimer } from '../context/StudyTimerContext';
import { courseService } from '../services/courseService';
import { studySessionService } from '../services/studySessionService';
import { practiceService } from '../services/practiceService';
import { plannerService } from '../services/plannerService';
import { type CloudCourse, type CloudStudySession, type CloudPlannerSession } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  Play,
  Clock,
  BookOpen,
  Calendar,
  ChevronRight,
  TrendingUp,
  Target as TargetIcon,
  CheckCircle2,
  BarChart3,
  Upload,
  WifiOff,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { format, subDays } from 'date-fns';
import type { PageId } from '../components/layout/Sidebar';

interface DashboardProps {
  onNavigate: (page: PageId, state?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();
  const { startSession, openModal: openTimerModal } = useStudyTimer();

  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [todaySessions, setTodaySessions] = useState<CloudStudySession[]>([]);
  const [weekSessions, setWeekSessions] = useState<CloudStudySession[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<CloudPlannerSession[]>([]);
  const [todayAttemptCount, setTodayAttemptCount] = useState(0);
  const [todayCorrectCount, setTodayCorrectCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Live Asia/Kathmandu Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Cloud Dashboard Data
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [loadedCourses, todaySess, weekSess, practiceSess, plannerSess] = await Promise.all([
          courseService.getCourses(),
          studySessionService.getTodaySessions(),
          studySessionService.getLast7DaysSessions(),
          practiceService.getTodayPracticeSessions(),
          plannerService.getPlannerSessions(),
        ]);

        if (!isMounted) return;

        setCourses(loadedCourses);
        setTodaySessions(todaySess);
        setWeekSessions(weekSess);

        // Aggregate practice attempts
        let totalAttempts = 0;
        let totalCorrect = 0;
        practiceSess.forEach(p => {
          totalAttempts += (p.correct_count + p.wrong_count + p.unanswered_count);
          totalCorrect += p.correct_count;
        });
        setTodayAttemptCount(totalAttempts);
        setTodayCorrectCount(totalCorrect);

        // Upcoming planner sessions
        const nowIso = new Date().toISOString();
        const future = plannerSess.filter(s => s.start_time >= nowIso && !s.is_completed);
        setUpcomingSchedules(future.slice(0, 3));
      } catch (err) {
        console.error('Error loading dashboard cloud data:', err);
      }
    }

    loadDashboardData();
    return () => { isMounted = false; };
  }, [currentUser.id]);

  // Calculations for Today
  const totalStudiedMinutesToday = useMemo(() => {
    return Math.round(todaySessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);
  }, [todaySessions]);

  const totalPlannedMinutesToday = currentUser.dailyGoalMinutes || 120;
  const todayGoalCompletion = Math.min(100, Math.round((totalStudiedMinutesToday / (totalPlannedMinutesToday || 1)) * 100));
  const remainingMinutes = Math.max(0, totalPlannedMinutesToday - totalStudiedMinutesToday);

  const todayAccuracy = todayAttemptCount > 0
    ? Math.round((todayCorrectCount / todayAttemptCount) * 100)
    : null;

  // Format Time of Day Greeting
  const nepaliTimeFormatted = useMemo(() => {
    return format(currentTime, 'EEEE, d MMMM yyyy · h:mm a');
  }, [currentTime]);

  const timeOfDayGreeting = useMemo(() => {
    const hours = currentTime.getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime]);

  // Last 7 Days Focus Chart Data
  const last7DaysChartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const targetDate = subDays(new Date(), 6 - i);
      const dayLabel = format(targetDate, 'EEE');
      const dateString = format(targetDate, 'yyyy-MM-dd');

      const dayMins = weekSessions
        .filter(s => s.started_at.startsWith(dateString))
        .reduce((sum, s) => sum + s.duration_seconds, 0) / 60;

      return {
        day: dayLabel,
        minutes: Math.round(dayMins),
        hours: Number((dayMins / 60).toFixed(1)),
        fullDate: format(targetDate, 'MMM d'),
      };
    });
  }, [weekSessions]);

  const totalWeeklyFocusMinutes = useMemo(() => {
    return last7DaysChartData.reduce((acc, curr) => acc + curr.minutes, 0);
  }, [last7DaysChartData]);

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  const handleStartCourseFocus = (course: CloudCourse) => {
    startSession(course.id);
    openTimerModal();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc]">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2.5">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>You're offline. StudyDashboard data is safely stored in the cloud. Reconnect to continue.</span>
        </div>
      )}

      {/* ================= HERO: TODAY'S FOCUS ================= */}
      <div className="rounded-2xl bg-[#fbfcfe] dark:bg-[#141824] p-6 sm:p-7 border border-[#e2e8f0] dark:border-[#23293d] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            {/* Live Clock & Nepal Time */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef2f6] dark:bg-[#1f2538] text-xs font-semibold text-[#64748b] dark:text-[#9496a8] border border-[#e2e8f0] dark:border-[#2b334d]">
              <span className="w-2 h-2 rounded-full bg-[#5b5bd6] animate-pulse" />
              <span>{nepaliTimeFormatted}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight">
              {timeOfDayGreeting}, {currentUser.name.split(' ')[0]} 👋
            </h1>

            <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#9496a8] font-medium leading-relaxed">
              {totalStudiedMinutesToday > 0 ? (
                <>
                  <span className="font-bold text-[#5b5bd6] dark:text-[#8282ea]">{formatMins(totalStudiedMinutesToday)}</span> focused today
                  {remainingMinutes > 0 ? (
                    <> · <span className="font-bold text-[#172033] dark:text-white">{formatMins(remainingMinutes)} remaining</span> to reach your daily goal</>
                  ) : (
                    <> · <span className="text-[#12b76a] font-bold">🎉 Daily goal achieved!</span></>
                  )}
                </>
              ) : (
                <>You haven't logged a study session today. Start small and build momentum.</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Action Button */}
            <Button
              variant="primary"
              size="lg"
              className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold shadow-xs px-6"
              leftIcon={<Play className="w-4 h-4 fill-white" />}
              onClick={() => openTimerModal()}
            >
              Focus Now
            </Button>

            {/* Secondary Quieter Actions */}
            <Button
              variant="outline"
              size="lg"
              className="bg-white dark:bg-[#181d2f] hover:bg-[#f8fafc] text-[#334155] dark:text-[#cbd5e1] border-[#e2e8f0] dark:border-[#2b334d] font-semibold text-xs shadow-xs"
              leftIcon={<BookOpen className="w-4 h-4 text-[#5b5bd6]" />}
              onClick={() => onNavigate('practice')}
            >
              Practice MCQs
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="bg-white dark:bg-[#181d2f] hover:bg-[#f8fafc] text-[#334155] dark:text-[#cbd5e1] border-[#e2e8f0] dark:border-[#2b334d] font-semibold text-xs shadow-xs"
              leftIcon={<Upload className="w-4 h-4 text-[#0284c7]" />}
              onClick={() => onNavigate('questions', { openUpload: true })}
            >
              Upload PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ================= 4 CLEAN SNAPSHOT CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Focus Time */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Focus Time</span>
            <Clock className="w-4 h-4 text-[#5b5bd6]" />
          </div>
          <div className="text-2xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
            {formatMins(totalStudiedMinutesToday)}
          </div>
          <p className="text-[11px] text-[#64748b] mt-1 font-medium">Goal: {formatMins(totalPlannedMinutesToday)}</p>
        </Card>

        {/* 2. Daily Goal */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Daily Goal</span>
            <TargetIcon className="w-4 h-4 text-[#12b76a]" />
          </div>
          <div className="text-2xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
            {todayGoalCompletion}%
          </div>
          <div className="mt-2">
            <ProgressBar progress={todayGoalCompletion} size="sm" color={todayGoalCompletion >= 100 ? 'bg-[#12b76a]' : 'bg-[#5b5bd6]'} />
          </div>
        </Card>

        {/* 3. MCQs Today */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">MCQs Today</span>
            <BookOpen className="w-4 h-4 text-[#0284c7]" />
          </div>
          <div className="text-2xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
            {todayAttemptCount}
          </div>
          <p className="text-[11px] text-[#64748b] mt-1 font-medium">
            {todayCorrectCount > 0 ? `${todayCorrectCount} correct answers` : 'No attempts logged today'}
          </p>
        </Card>

        {/* 4. Accuracy */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Accuracy</span>
            <TrendingUp className="w-4 h-4 text-[#f79009]" />
          </div>
          <div className="text-2xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
            {todayAccuracy !== null ? `${todayAccuracy}%` : '—'}
          </div>
          <p className="text-[11px] text-[#64748b] mt-1 font-medium">
            {todayAccuracy !== null ? (todayAccuracy >= 75 ? 'Strong recall' : 'Review recommended') : 'No questions practiced yet'}
          </p>
        </Card>
      </div>

      {/* ================= MAIN CONTENT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Study Plan */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc]">Today's Study Plan</h3>
                <p className="text-xs text-[#64748b] dark:text-[#9496a8]">Pick a course or subject to start your focused study session</p>
              </div>
              <button
                onClick={() => onNavigate('targets')}
                className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea] hover:underline flex items-center gap-1"
              >
                <span>Manage Courses</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {courses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {courses.map(course => (
                  <Card
                    key={course.id}
                    className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-3 hover:border-[#5b5bd6]/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: course.color || '#5b5bd6' }}
                        />
                        <div>
                          <h4 className="font-bold text-sm text-[#172033] dark:text-[#f8f9fc]">{course.name}</h4>
                          <p className="text-[11px] text-[#64748b] font-medium">
                            Daily Goal: {formatMins(course.daily_goal_minutes)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-bold text-xs bg-white dark:bg-[#181d2f] text-[#5b5bd6] dark:text-[#8282ea] border-[#e2e8f0] dark:border-[#2b334d] hover:bg-[#eef2f6]"
                      leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                      onClick={() => handleStartCourseFocus(course)}
                    >
                      Start Focus
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-xs text-[#64748b] border-[#e2e8f0] dark:border-[#23293d]">
                <p>No active courses configured yet.</p>
                <button
                  onClick={() => onNavigate('targets')}
                  className="mt-2 text-[#5b5bd6] font-bold hover:underline inline-flex items-center gap-1"
                >
                  + Add Your First Course
                </button>
              </Card>
            )}
          </div>
        </div>

        {/* Right 1 Col: Next Session & 7-Day Chart */}
        <div className="space-y-6">
          {/* Next Scheduled Session */}
          <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#5b5bd6]" />
                <span>Next Scheduled Session</span>
              </h3>
              <button
                onClick={() => onNavigate('planner')}
                className="text-xs text-[#5b5bd6] dark:text-[#8282ea] hover:underline font-semibold"
              >
                Planner →
              </button>
            </div>

            {upcomingSchedules.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172033] dark:text-[#f8f9fc]">
                    {upcomingSchedules[0].title}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5b5bd6]/10 text-[#5b5bd6]">
                    {format(new Date(upcomingSchedules[0].start_time), 'h:mm a')}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748b]">
                  Duration: {upcomingSchedules[0].duration_minutes}m • 15m reminder active
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2 text-xs font-bold"
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                  onClick={() => {
                    startSession(upcomingSchedules[0].course_id);
                    openTimerModal();
                  }}
                >
                  Start Early
                </Button>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#64748b]">
                <p>Nothing else planned today.</p>
                <button
                  onClick={() => onNavigate('planner')}
                  className="mt-2 text-[#5b5bd6] dark:text-[#8282ea] font-bold hover:underline"
                >
                  + Add to Planner
                </button>
              </div>
            )}
          </Card>

          {/* Last 7 Days Bar Chart */}
          <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#12b76a]" />
                <span>Last 7 Days</span>
              </h3>
              <span className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea]">
                Weekly total: {formatMins(totalWeeklyFocusMinutes)}
              </span>
            </div>

            {totalWeeklyFocusMinutes > 0 ? (
              <div className="h-36 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7DaysChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} unit="h" />
                    <Tooltip
                      cursor={{ fill: 'rgba(91, 91, 214, 0.08)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#172033] text-white text-xs p-2 rounded-lg shadow-lg border border-slate-700">
                              <p className="font-bold">{data.day} ({data.fullDate})</p>
                              <p className="text-[#8282ea] mt-0.5">{formatMins(data.minutes)} focused</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="hours" fill="#5b5bd6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#64748b]">
                <p>Your study activity will appear here after your first Focus Session.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
