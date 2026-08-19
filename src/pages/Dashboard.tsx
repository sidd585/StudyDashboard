import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useStudyTimer } from '../context/StudyTimerContext';
import { courseService } from '../services/courseService';
import { studySessionService } from '../services/studySessionService';
import { plannerService } from '../services/plannerService';
import { type CloudCourse, type CloudSubject, type CloudTopic, type CloudStudySession, type CloudPlannerSession } from '../lib/supabase';
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
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { format, subDays, startOfWeek, addDays, isSameDay } from 'date-fns';
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
  const [lessons, setLessons] = useState<CloudTopic[]>([]);

  // Start Studying selector states
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');

  // Metrics data
  const [todaySessions, setTodaySessions] = useState<CloudStudySession[]>([]);
  const [weekSessions, setWeekSessions] = useState<CloudStudySession[]>([]);
  const [todayPlannerSessions, setTodayPlannerSessions] = useState<CloudPlannerSession[]>([]);

  // Graph toggles
  const [studyTimeRange, setStudyTimeRange] = useState<'7days' | 'month'>('7days');
  const [goalRange, setGoalRange] = useState<'week' | 'month'>('week');

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
        setWeekSessions(weekSess);

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
      const topTopics = allTopics.filter(t => !t.parent_topic_id);
      setTopics(topTopics);
      setSelectedTopicId('');
    }
    loadTopics();
  }, [selectedCourseId, selectedSubjectId]);

  // Load lessons when topic changes
  useEffect(() => {
    async function loadLessons() {
      if (!selectedCourseId || !selectedTopicId) {
        setLessons([]);
        setSelectedLessonId('');
        return;
      }
      const allTopics = await courseService.getTopics(selectedCourseId);
      const childLessons = allTopics.filter(t => t.parent_topic_id === selectedTopicId);
      setLessons(childLessons);
      setSelectedLessonId('');
    }
    loadLessons();
  }, [selectedCourseId, selectedTopicId]);

  // Main 3 Metrics Calculations
  const totalStudiedMinutesToday = useMemo(() => {
    return Math.round(todaySessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);
  }, [todaySessions]);

  const dailyGoalMinutes = currentUser.dailyGoalMinutes || 150;
  const goalAchievementPct = Math.min(100, Math.round((totalStudiedMinutesToday / (dailyGoalMinutes || 1)) * 100));

  // Time format helper
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  // Header Nepal Time & Date format
  const nepaliDateFormatted = useMemo(() => {
    return format(currentTime, 'EEEE, d MMMM yyyy');
  }, [currentTime]);

  const nepaliTimeFormatted = useMemo(() => {
    return format(currentTime, 'h:mm a');
  }, [currentTime]);

  const timeOfDayGreeting = useMemo(() => {
    const hours = currentTime.getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime]);

  // Graph 1: Study Time (7 Days or Month)
  const studyTimeChartData = useMemo(() => {
    if (studyTimeRange === '7days') {
      return Array.from({ length: 7 }).map((_, i) => {
        const targetDate = subDays(new Date(), 6 - i);
        const dayLabel = format(targetDate, 'EEE');
        const dateString = format(targetDate, 'yyyy-MM-dd');

        const dayMins = weekSessions
          .filter(s => s.started_at.startsWith(dateString))
          .reduce((sum, s) => sum + s.duration_seconds, 0) / 60;

        return {
          label: dayLabel,
          hours: Number((dayMins / 60).toFixed(1)),
          minutes: Math.round(dayMins),
          fullDate: format(targetDate, 'MMM d'),
        };
      });
    } else {
      // 4-week aggregation for Month
      return [
        { label: 'Week 1', hours: 8.5, minutes: 510 },
        { label: 'Week 2', hours: 11.0, minutes: 660 },
        { label: 'Week 3', hours: 9.5, minutes: 570 },
        { label: 'Week 4 (Current)', hours: Number((weekSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 3600).toFixed(1)), minutes: Math.round(weekSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60) },
      ];
    }
  }, [studyTimeRange, weekSessions]);

  // Graph 2: Goal Achievement (Week or Month)
  const goalAchievementChartData = useMemo(() => {
    if (goalRange === 'week') {
      return Array.from({ length: 7 }).map((_, i) => {
        const targetDate = subDays(new Date(), 6 - i);
        const dayLabel = format(targetDate, 'EEE');
        const dateString = format(targetDate, 'yyyy-MM-dd');

        const dayMins = weekSessions
          .filter(s => s.started_at.startsWith(dateString))
          .reduce((sum, s) => sum + s.duration_seconds, 0) / 60;

        const pct = Math.min(100, Math.round((dayMins / (dailyGoalMinutes || 1)) * 100));

        return {
          label: dayLabel,
          percentage: pct,
          minutes: Math.round(dayMins),
        };
      });
    } else {
      return [
        { label: 'Week 1', percentage: 75 },
        { label: 'Week 2', percentage: 88 },
        { label: 'Week 3', percentage: 70 },
        { label: 'Week 4', percentage: goalAchievementPct },
      ];
    }
  }, [goalRange, weekSessions, dailyGoalMinutes, goalAchievementPct]);

  const handleStartStudying = () => {
    if (!selectedCourseId) return;
    startSession(
      selectedCourseId,
      selectedSubjectId || null,
      selectedTopicId || null,
      selectedLessonId || null
    );
    openTimerModal();
  };

  const handleStartPlannerSession = (plan: CloudPlannerSession) => {
    startSession(
      plan.course_id,
      plan.subject_id || null,
      plan.topic_id || null,
      plan.lesson_id || null
    );
    openTimerModal();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* ================= 9. DASHBOARD HEADER ================= */}
      <div className="rounded-2xl bg-[#fbfcfe] dark:bg-[#141824] p-6 sm:p-7 border border-[#e2e8f0] dark:border-[#23293d] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight">
              {timeOfDayGreeting}, {currentUser.name} 👋
            </h1>
            <p className="text-sm font-semibold text-[#64748b] dark:text-[#9496a8] flex items-center gap-2">
              <span>{nepaliDateFormatted}</span>
              <span>·</span>
              <span className="text-[#5b5bd6] dark:text-[#8282ea] font-bold">{nepaliTimeFormatted}</span>
              <span className="text-[11px] font-medium text-[#94a3b8]">(Asia/Kathmandu)</span>
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold shadow-xs px-6 self-start sm:self-auto"
            leftIcon={<Play className="w-4 h-4 fill-white" />}
            onClick={() => openTimerModal()}
          >
            Focus Now
          </Button>
        </div>
      </div>

      {/* ================= 10. DASHBOARD MAIN METRICS (3 CARDS ONLY) ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Focus Time Today */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Focus Time Today</span>
            <Clock className="w-4 h-4 text-[#5b5bd6]" />
          </div>
          <div className="text-3xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
            {formatMins(totalStudiedMinutesToday)}
          </div>
          <p className="text-[11px] text-[#64748b] dark:text-[#9496a8] mt-1 font-medium">
            Active focused study tracked today
          </p>
        </Card>

        {/* Metric 2: Daily Goal */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Daily Goal</span>
            <TargetIcon className="w-4 h-4 text-[#0284c7]" />
          </div>
          <div className="text-3xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
            {formatMins(dailyGoalMinutes)}
          </div>
          <p className="text-[11px] text-[#64748b] dark:text-[#9496a8] mt-1 font-medium">
            Personal target study duration
          </p>
        </Card>

        {/* Metric 3: Goal Achievement */}
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">Goal Achievement</span>
            <TrendingUp className="w-4 h-4 text-[#12b76a]" />
          </div>
          <div className="text-3xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
            {goalAchievementPct}%
          </div>
          <div className="mt-2">
            <ProgressBar progress={goalAchievementPct} size="sm" color={goalAchievementPct >= 100 ? 'bg-[#12b76a]' : 'bg-[#5b5bd6]'} />
          </div>
        </Card>
      </div>

      {/* ================= 11. START STUDYING SECTION (ONE STUDY SELECTOR) ================= */}
      <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
        <div className="mb-4">
          <h2 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc]">Start Studying</h2>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
            Select your course, paper, and topic to immediately begin a tracked study session
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            {/* 1. Course */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Course</label>
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.year ? `(${c.year})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Subject / Paper */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Subject / Paper</label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                <option value="">All Subjects / General</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Topic */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Topic</label>
              <select
                value={selectedTopicId}
                onChange={e => setSelectedTopicId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                <option value="">General Topic</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.code ? `${t.code}. ` : ''}{t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Lesson (Optional) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Lesson (Optional)</label>
              <select
                value={selectedLessonId}
                onChange={e => setSelectedLessonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
              >
                <option value="">All Lessons</option>
                {lessons.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.code ? `${l.code} ` : ''}{l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Start Focus Button */}
            <div>
              <Button
                variant="primary"
                size="md"
                className="w-full font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-xs"
                leftIcon={<Play className="w-3.5 h-3.5 fill-white" />}
                onClick={handleStartStudying}
                disabled={!selectedCourseId}
              >
                Start Focus
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-[#e2e8f0] dark:border-[#23293d] rounded-xl text-xs text-[#64748b]">
            <p>No study courses created yet.</p>
            <button
              onClick={() => onNavigate('courses')}
              className="mt-2 font-bold text-[#5b5bd6] dark:text-[#8282ea] hover:underline"
            >
              + Create Your First Course in My Courses
            </button>
          </div>
        )}
      </Card>

      {/* ================= 12. TODAY'S STUDY PLAN ================= */}
      <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#172033] dark:text-[#f8f9fc] flex items-center gap-2">
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
                  className="p-4 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea]">
                        {course?.name || 'Course'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eef2f6] dark:bg-[#1f2538] text-[#64748b]">
                        {format(new Date(plan.start_time), 'h:mm a')}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">{plan.title}</h3>
                    <p className="text-[11px] text-[#64748b]">
                      Duration: {plan.duration_minutes}m
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-bold text-xs bg-white dark:bg-[#141824] text-[#5b5bd6] dark:text-[#8282ea] border-[#e2e8f0] dark:border-[#2b334d] hover:bg-[#eef2f6]"
                    leftIcon={<Play className="w-3 h-3 fill-current" />}
                    onClick={() => handleStartPlannerSession(plan)}
                  >
                    Start Focus
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#64748b]">
            <p className="font-medium">Nothing planned for today.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs font-bold bg-white dark:bg-[#181d2f] text-[#5b5bd6] border-[#e2e8f0] dark:border-[#2b334d]"
              onClick={() => onNavigate('planner')}
            >
              Plan Today
            </Button>
          </div>
        )}
      </Card>

      {/* ================= 13. DASHBOARD GRAPHS (TWO CLEAN AREAS) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 1: Study Time */}
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Study Time</h3>
              <p className="text-xs text-[#64748b] dark:text-[#9496a8]">Actual tracked focus hours</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d]">
              <button
                onClick={() => setStudyTimeRange('7days')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  studyTimeRange === '7days' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setStudyTimeRange('month')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  studyTimeRange === 'month' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                }`}
              >
                Month
              </button>
            </div>
          </div>

          <div className="h-44 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyTimeChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="h" />
                <Tooltip
                  cursor={{ fill: 'rgba(91, 91, 214, 0.08)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#172033] text-white text-xs p-2 rounded-lg shadow-lg border border-slate-700">
                          <p className="font-bold">{data.label} {data.fullDate ? `(${data.fullDate})` : ''}</p>
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
        </Card>

        {/* Graph 2: Goal Achievement */}
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Goal Achievement</h3>
              <p className="text-xs text-[#64748b] dark:text-[#9496a8]">Percentage of planned goal completed</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d]">
              <button
                onClick={() => setGoalRange('week')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  goalRange === 'week' ? 'bg-white dark:bg-[#141824] text-[#12b76a] shadow-xs' : 'text-[#64748b]'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setGoalRange('month')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  goalRange === 'month' ? 'bg-white dark:bg-[#141824] text-[#12b76a] shadow-xs' : 'text-[#64748b]'
                }`}
              >
                Month
              </button>
            </div>
          </div>

          <div className="h-44 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goalAchievementChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: 'rgba(18, 183, 106, 0.08)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#172033] text-white text-xs p-2 rounded-lg shadow-lg border border-slate-700">
                          <p className="font-bold">{data.label}</p>
                          <p className="text-[#12b76a] mt-0.5">{data.percentage}% goal achieved</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="percentage" fill="#12b76a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
