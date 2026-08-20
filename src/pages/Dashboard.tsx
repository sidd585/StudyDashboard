import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useStudyTimer } from '../context/StudyTimerContext';
import { courseService } from '../services/courseService';
import { studySessionService } from '../services/studySessionService';
import { plannerService } from '../services/plannerService';
import { type CloudCourse, type CloudSubject, type CloudTopic, type CloudStudySession, type CloudPlannerSession } from '../lib/supabase';
import { getExamCountdown, getFormattedDateAndDay } from '../utils/dateCountdownUtils';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  Play,
  Clock,
  Target as TargetIcon,
  TrendingUp,
  Calendar,
  ChevronRight,
  BookOpen,
  Plus,
  BarChart3,
  Flame,
  CheckCircle2,
  Hourglass,
  CalendarDays,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { PageId } from '../components/layout/Sidebar';

interface DashboardProps {
  onNavigate: (page: PageId, state?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useUser();
  const { startSession, openModal: openTimerModal } = useStudyTimer();

  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [subjects, setSubjects] = useState<CloudSubject[]>([]);
  const [topics, setTopics] = useState<CloudTopic[]>([]);

  // Start Studying selector states
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  // Metrics data
  const [todaySessions, setTodaySessions] = useState<CloudStudySession[]>([]);
  const [weeklySessions, setWeeklySessions] = useState<CloudStudySession[]>([]);
  const [todayPlannerSessions, setTodayPlannerSessions] = useState<CloudPlannerSession[]>([]);

  // Chart view toggle ('weekly' | 'course')
  const [chartView, setChartView] = useState<'weekly' | 'course'>('weekly');

  // Live Asia/Kathmandu Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Cloud Dashboard Data
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [loadedCourses, todaySess, weekSess, plannerSess] = await Promise.all([
          courseService.getCourses(),
          studySessionService.getTodaySessions(),
          studySessionService.getLast7DaysSessions(),
          plannerService.getPlannerSessions(),
        ]);

        if (!isMounted) return;

        setCourses(loadedCourses);
        if (loadedCourses.length > 0 && !selectedCourseId) {
          setSelectedCourseId(loadedCourses[0].id);
        }

        setTodaySessions(todaySess);
        setWeeklySessions(weekSess);

        // Filter planner sessions for TODAY
        const todayDateStr = format(new Date(), 'yyyy-MM-dd');
        const plannedForToday = plannerSess.filter(s => {
          if (s.date) return s.date === todayDateStr;
          if (s.start_time) return s.start_time.startsWith(todayDateStr);
          return false;
        });
        setTodayPlannerSessions(plannedForToday);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      }
    }

    loadDashboardData();
    return () => { isMounted = false; };
  }, [currentUser.id]);

  // Load subjects when selected course changes
  useEffect(() => {
    async function loadSubjects() {
      if (!selectedCourseId) {
        setSubjects([]);
        setSelectedSubjectId('');
        return;
      }
      const loaded = await courseService.getSubjects(selectedCourseId);
      setSubjects(loaded);
      setSelectedSubjectId('');
    }
    loadSubjects();
  }, [selectedCourseId]);

  // Load topics when subject/course changes
  useEffect(() => {
    async function loadTopics() {
      if (!selectedCourseId) {
        setTopics([]);
        setSelectedTopicId('');
        return;
      }
      const allTopics = await courseService.getTopics(selectedCourseId, selectedSubjectId || undefined);
      setTopics(allTopics);
      setSelectedTopicId('');
    }
    loadTopics();
  }, [selectedCourseId, selectedSubjectId]);

  // Total Studied Minutes Today
  const totalStudiedMinutesToday = useMemo(() => {
    return Math.round(todaySessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);
  }, [todaySessions]);

  // Total daily target from all courses or user profile
  const totalDailyTargetMinutes = useMemo(() => {
    if (courses.length > 0) {
      return courses.reduce((sum, c) => sum + (c.daily_goal_minutes || 60), 0);
    }
    return currentUser.dailyGoalMinutes || 60;
  }, [courses, currentUser.dailyGoalMinutes]);

  const goalAchievementPct = Math.min(100, Math.round((totalStudiedMinutesToday / (totalDailyTargetMinutes || 1)) * 100));

  // Course-specific study minutes today helper
  const getCourseStudyMinutesToday = (courseId: string) => {
    const courseSessions = todaySessions.filter(s => s.course_id === courseId);
    return Math.round(courseSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);
  };

  // Weekly 7-Day Chart Data
  const weeklyChartData = useMemo(() => {
    const days = [];
    const allSessions = [...weeklySessions, ...todaySessions];
    // Deduplicate sessions by id
    const uniqueMap = new Map<string, CloudStudySession>();
    allSessions.forEach(s => uniqueMap.set(s.id, s));
    const deduped = Array.from(uniqueMap.values());

    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLabel = format(d, 'EEE'); // Mon, Tue, etc.

      const daySessions = deduped.filter(s => s.started_at && s.started_at.startsWith(dateStr));
      const studiedMins = Math.round(daySessions.reduce((acc, s) => acc + s.duration_seconds, 0) / 60);

      days.push({
        day: dayLabel,
        date: dateStr,
        studied: studiedMins,
        target: totalDailyTargetMinutes || 60,
      });
    }
    return days;
  }, [weeklySessions, todaySessions, totalDailyTargetMinutes]);

  // Course Breakdown Chart Data
  const courseBreakdownData = useMemo(() => {
    return courses.map(c => {
      const studied = getCourseStudyMinutesToday(c.id);
      return {
        name: c.name.length > 15 ? `${c.name.substring(0, 15)}...` : c.name,
        fullName: c.name,
        studied: studied,
        target: c.daily_goal_minutes || 60,
        color: c.color || '#5b5bd6',
      };
    });
  }, [courses, todaySessions]);

  // Time format helper
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  // Header Nepal Time & Date format with Day & Date
  const dateDayInfo = useMemo(() => getFormattedDateAndDay(currentTime), [currentTime]);

  const userDisplayName = useMemo(() => {
    if (!currentUser.name || currentUser.name.includes('@')) {
      return 'Student';
    }
    return currentUser.name;
  }, [currentUser.name]);

  const timeOfDayGreeting = useMemo(() => {
    const hours = currentTime.getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime]);

  const handleStartStudying = (courseId?: string, subjectId?: string, topicId?: string) => {
    const targetCourse = courseId || selectedCourseId;
    if (!targetCourse) {
      openTimerModal();
      return;
    }
    startSession(
      targetCourse,
      subjectId || selectedSubjectId || null,
      topicId || selectedTopicId || null,
      null
    );
    openTimerModal();
  };

  const handleStartPlannerSession = (plan: CloudPlannerSession) => {
    startSession(
      plan.course_id,
      plan.subject_id || null,
      plan.topic_id || null,
      null
    );
    openTimerModal();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#101828] dark:text-[#f8f9fc] transition-colors">
      {/* 1. Header Banner with prominent Day / Date */}
      <div className="rounded-2xl bg-white dark:bg-[#141824] p-6 sm:p-7 border border-[#e2e8f0] dark:border-[#23293d] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#5b5bd6]/10 text-[#5b5bd6] dark:text-[#8282ea] border border-[#5b5bd6]/20">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{dateDayInfo.dayName}</span>
              </span>
              <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8]">
                {dateDayInfo.formattedDate}
              </span>
              <span className="text-[#94a3b8] dark:text-[#64748b]">·</span>
              <span className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea]">
                {dateDayInfo.timeString} (Asia/Kathmandu)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight">
              {timeOfDayGreeting}, {userDisplayName} 👋
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#64748b] dark:text-[#9496a8]">
              Ready for focused learning today? Track your targets, countdown exams, and build momentum.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold shadow-xs px-6 self-start sm:self-auto shrink-0"
            leftIcon={<Play className="w-4 h-4 fill-white" />}
            onClick={() => handleStartStudying()}
          >
            Start Focus
          </Button>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Today's Actual Study Time */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Today's Study Time</span>
            <Clock className="w-4 h-4 text-[#5b5bd6]" />
          </div>
          <div className="text-3xl font-extrabold text-[#101828] dark:text-[#f8f9fc]">
            {formatMins(totalStudiedMinutesToday)}
          </div>
          <p className="text-[11px] text-[#64748b] dark:text-[#9496a8] mt-1 font-medium">
            Actual tracked focused study today
          </p>
        </Card>

        {/* Metric 2: Daily Target */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Minimum Daily Target</span>
            <TargetIcon className="w-4 h-4 text-[#0284c7]" />
          </div>
          <div className="text-3xl font-extrabold text-[#101828] dark:text-[#f8f9fc]">
            {formatMins(totalDailyTargetMinutes)}
          </div>
          <p className="text-[11px] text-[#64748b] dark:text-[#9496a8] mt-1 font-medium">
            Combined daily target across your courses
          </p>
        </Card>

        {/* Metric 3: Target Progress */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Daily Goal Progress</span>
            <TrendingUp className="w-4 h-4 text-[#12b76a]" />
          </div>
          <div className="text-3xl font-extrabold text-[#101828] dark:text-[#f8f9fc]">
            {goalAchievementPct}%
          </div>
          <div className="mt-2">
            <ProgressBar progress={goalAchievementPct} size="sm" color={goalAchievementPct >= 100 ? 'bg-[#12b76a]' : 'bg-[#5b5bd6]'} />
          </div>
        </Card>
      </div>

      {/* 3. STUDY PROGRESS GRAPH & ANALYTICS SECTION */}
      <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#101828] dark:text-[#f8f9fc] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#5b5bd6]" />
              <span>Study Progress Analytics & Activity Graph</span>
            </h2>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
              Daily focus minutes tracking vs target over the last 7 days
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#f8fafc] dark:bg-[#181d2f] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#2b334d] self-start sm:self-auto">
            <button
              onClick={() => setChartView('weekly')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                chartView === 'weekly'
                  ? 'bg-[#5b5bd6] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#101828] dark:hover:text-white'
              }`}
            >
              7-Day Trend
            </button>
            <button
              onClick={() => setChartView('course')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                chartView === 'course'
                  ? 'bg-[#5b5bd6] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#101828] dark:hover:text-white'
              }`}
            >
              Course Breakdown
            </button>
          </div>
        </div>

        {/* Chart Container */}
        <div className="h-64 sm:h-72 w-full pt-2">
          {chartView === 'weekly' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStudied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b5bd6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5b5bd6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  tickLine={false}
                />
                <YAxis
                  unit="m"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#181d2f',
                    border: '1px solid #2b334d',
                    borderRadius: '12px',
                    color: '#f8f9fc',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  formatter={(value: any, name: string) => [
                    `${value} mins`,
                    name === 'studied' ? 'Focused Time' : 'Daily Target',
                  ]}
                  labelFormatter={(label: string, payload: any[]) => {
                    const item = payload?.[0]?.payload;
                    return item ? `${item.day} (${item.date})` : label;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="studied"
                  stroke="#5b5bd6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorStudied)"
                  name="studied"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseBreakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  tickLine={false}
                />
                <YAxis
                  unit="m"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#181d2f',
                    border: '1px solid #2b334d',
                    borderRadius: '12px',
                    color: '#f8f9fc',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  formatter={(value: any, name: string) => [
                    `${value} mins`,
                    name === 'studied' ? "Today's Study" : 'Target',
                  ]}
                />
                <Bar dataKey="studied" fill="#5b5bd6" radius={[6, 6, 0, 0]} name="studied" />
                <Bar dataKey="target" fill="#0284c7" opacity={0.4} radius={[6, 6, 0, 0]} name="target" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* 4. User's Created Courses Section with Exam Countdowns */}
      <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#101828] dark:text-[#f8f9fc] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#5b5bd6]" />
              <span>Your Courses & Exam Countdowns</span>
            </h2>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
              Active study courses with daily targets and live countdown to exam dates
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="text-xs font-bold bg-white dark:bg-[#181d2f] text-[#5b5bd6] border-[#e2e8f0] dark:border-[#2b334d]"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('courses')}
          >
            Manage Courses
          </Button>
        </div>

        {courses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {courses.map(c => {
              const studiedMins = getCourseStudyMinutesToday(c.id);
              const targetMins = c.daily_goal_minutes || 60;
              const pct = Math.min(100, Math.round((studiedMins / targetMins) * 100));
              const countdown = getExamCountdown(c.exam_date);

              return (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl border border-[#e2e8f0] dark:border-[#23293d] bg-[#f8fafc] dark:bg-[#181d2f] flex flex-col justify-between gap-4 shadow-xs hover:border-[#5b5bd6]/40 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color || '#5b5bd6' }} />
                        <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc] truncate" title={c.name}>
                          {c.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold text-[#5b5bd6] dark:text-[#8282ea] shrink-0">
                        {studiedMins}/{targetMins}m
                      </span>
                    </div>

                    {/* Exam Date & Live Countdown Badge */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      {countdown.hasExamDate ? (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] border font-bold ${countdown.badgeColorClass}`}>
                          <Hourglass className="w-3.5 h-3.5 shrink-0" />
                          <span>{countdown.formattedCountdown}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => onNavigate('courses')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#5b5bd6] hover:bg-[#5b5bd6]/10 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Set Exam Date</span>
                        </button>
                      )}

                      {countdown.hasExamDate && (
                        <span className="text-[10px] font-medium text-[#64748b] dark:text-[#9496a8]">
                          {countdown.formattedExamDate}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#64748b] dark:text-[#9496a8]">
                        <span>Today's Progress</span>
                        <span>{pct}%</span>
                      </div>
                      <ProgressBar progress={pct} size="sm" color={pct >= 100 ? 'bg-[#12b76a]' : 'bg-[#5b5bd6]'} />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-bold bg-white dark:bg-[#141824] text-[#5b5bd6] dark:text-[#8282ea] border-[#e2e8f0] dark:border-[#2b334d] hover:bg-[#5b5bd6] hover:text-white transition-colors"
                    leftIcon={<Play className="w-3 h-3 fill-current" />}
                    onClick={() => handleStartStudying(c.id)}
                  >
                    Start Focus
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center border border-dashed border-[#e2e8f0] dark:border-[#23293d] rounded-xl text-xs text-[#64748b] space-y-2">
            <p>No study courses created yet.</p>
            <Button
              variant="primary"
              size="sm"
              className="bg-[#5b5bd6] text-white font-bold"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('courses')}
            >
              Create Course
            </Button>
          </div>
        )}
      </Card>

      {/* 5. Quick Study Launcher */}
      <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#101828] dark:text-[#f8f9fc]">Quick Focus Launcher</h2>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
            Select Course, Subject, and Topic to jump right into a focused study session
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            {/* 1. Course */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Course</label>
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Subject */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                <option value="">All Subjects / General</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </div>

            {/* 3. Topic */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Topic</label>
              <select
                value={selectedTopicId}
                onChange={e => setSelectedTopicId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                <option value="">General Topic</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Start Focus Button */}
            <div>
              <Button
                variant="primary"
                size="md"
                className="w-full font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-xs"
                leftIcon={<Play className="w-3.5 h-3.5 fill-white" />}
                onClick={() => handleStartStudying()}
                disabled={!selectedCourseId}
              >
                Start Focus
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* 6. Today's Study Plan */}
      <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#101828] dark:text-[#f8f9fc] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5b5bd6]" />
              <span>Today's Study Plan</span>
            </h2>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8]">Scheduled timetable sessions for today</p>
          </div>
          <button
            onClick={() => onNavigate('planner')}
            className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea] hover:underline flex items-center gap-1"
          >
            <span>Open Planner</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayPlannerSessions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {todayPlannerSessions.map(plan => {
              const course = courses.find(c => c.id === plan.course_id);
              return (
                <div
                  key={plan.id}
                  className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea]">
                        {course?.name || 'Course'}
                      </span>
                      <span className="text-[10px] font-mono text-[#64748b]">
                        {plan.duration_minutes}m target
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">{plan.title}</h4>
                    <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                      {plan.start_time ? new Date(plan.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                      {plan.end_time ? ` - ${new Date(plan.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full text-xs font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-xs"
                    leftIcon={<Play className="w-3.5 h-3.5 fill-white" />}
                    onClick={() => handleStartPlannerSession(plan)}
                  >
                    Start Focus
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#64748b]">
            No study sessions scheduled for today in your planner.
          </div>
        )}
      </Card>
    </div>
  );
};
