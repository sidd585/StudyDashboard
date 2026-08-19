import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useStudyTimer } from '../context/StudyTimerContext';
import { plannerService, type PlannerSessionInput } from '../services/plannerService';
import { courseService } from '../services/courseService';
import { type CloudCourse, type CloudSubject, type CloudTopic, type CloudPlannerSession } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle2,
  Trash2,
  Bell,
  ChevronLeft,
  ChevronRight,
  Play,
  Layers,
  BookOpen,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addYears,
  subYears,
  getDay,
} from 'date-fns';

export type PlannerViewMode = 'day' | 'week' | 'month' | 'year';
export type RepeatOption = 'once' | 'daily' | 'selected_days' | 'weekly';

export const Planner: React.FC = () => {
  const { currentUser } = useUser();
  const { startSession, openModal: openTimerModal } = useStudyTimer();

  const [viewMode, setViewMode] = useState<PlannerViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState<CloudPlannerSession[]>([]);
  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [subjects, setSubjects] = useState<CloudSubject[]>([]);
  const [topics, setTopics] = useState<CloudTopic[]>([]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState('');
  
  // Date & Time inputs
  const [startDateStr, setStartDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDateStr, setEndDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [sessionStartTime, setSessionStartTime] = useState<string>('19:00');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(45);

  // Repeat & Reminder options
  const [repeatOption, setRepeatOption] = useState<RepeatOption>('once');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(15);
  const [isSaving, setIsSaving] = useState(false);

  // Load courses & schedules
  const loadData = async () => {
    try {
      const [allCourses, allSchedules] = await Promise.all([
        courseService.getCourses(),
        plannerService.getPlannerSessions(),
      ]);
      setCourses(allCourses);
      if (allCourses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(allCourses[0].id);
      }
      setSchedules(allSchedules);
    } catch (err) {
      console.error('Error loading planner data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  // Load subjects & topics when selected course changes
  useEffect(() => {
    async function loadHierarchy() {
      if (!selectedCourseId) {
        setSubjects([]);
        setTopics([]);
        return;
      }
      const [subs, tops] = await Promise.all([
        courseService.getSubjects(selectedCourseId),
        courseService.getTopics(selectedCourseId, selectedSubjectId || undefined),
      ]);
      setSubjects(subs);
      setTopics(tops);
    }
    loadHierarchy();
  }, [selectedCourseId, selectedSubjectId]);

  // Handle Save Session with repeat generation
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;

    setIsSaving(true);
    try {
      const activeCourseName = courses.find(c => c.id === selectedCourseId)?.name || 'Study Session';
      const activeSubName = subjects.find(s => s.id === selectedSubjectId)?.name;
      const activeTopicName = topics.find(t => t.id === selectedTopicId)?.name;

      const finalTitle = sessionTitle.trim() ||
        (activeTopicName ? `${activeTopicName} (${activeSubName || activeCourseName})` :
        (activeSubName ? `${activeSubName} Study` : `${activeCourseName} Session`));

      const reminderEnabled = reminderMinutesBefore > 0;
      const startD = new Date(startDateStr);
      const endD = new Date(endDateStr);

      const sessionInputs: PlannerSessionInput[] = [];

      if (repeatOption === 'once') {
        const startDateTime = new Date(`${startDateStr}T${sessionStartTime}:00`);
        sessionInputs.push({
          courseId: selectedCourseId,
          subjectId: selectedSubjectId || null,
          topicId: selectedTopicId || null,
          title: finalTitle,
          date: startDateStr,
          startTime: startDateTime.toISOString(),
          durationMinutes: sessionDurationMinutes,
          reminderEnabled,
          reminderMinutesBefore,
        });
      } else {
        // Multi-day loop between startD and endD
        const days = eachDayOfInterval({ start: startD, end: endD });

        days.forEach(day => {
          const dayIndex = getDay(day); // 0 = Sun, 1 = Mon ...
          let shouldInclude = false;

          if (repeatOption === 'daily') {
            shouldInclude = true;
          } else if (repeatOption === 'weekly') {
            shouldInclude = dayIndex === getDay(startD);
          } else if (repeatOption === 'selected_days') {
            shouldInclude = selectedDaysOfWeek.includes(dayIndex);
          }

          if (shouldInclude) {
            const curDateStr = format(day, 'yyyy-MM-dd');
            const startDateTime = new Date(`${curDateStr}T${sessionStartTime}:00`);
            sessionInputs.push({
              courseId: selectedCourseId,
              subjectId: selectedSubjectId || null,
              topicId: selectedTopicId || null,
              title: finalTitle,
              date: curDateStr,
              startTime: startDateTime.toISOString(),
              durationMinutes: sessionDurationMinutes,
              reminderEnabled,
              reminderMinutesBefore,
            });
          }
        });
      }

      if (sessionInputs.length === 1) {
        const created = await plannerService.createPlannerSession(sessionInputs[0]);
        if (created) setSchedules(prev => [...prev, created]);
      } else if (sessionInputs.length > 1) {
        const createdList = await plannerService.createPlannerSessionsBatch(sessionInputs);
        if (createdList.length > 0) setSchedules(prev => [...prev, ...createdList]);
      }

      setIsAddModalOpen(false);
      setSessionTitle('');
    } catch (err) {
      console.error('Error saving planner session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle completion
  const handleToggleComplete = async (schedule: CloudPlannerSession) => {
    const nextState = !schedule.is_completed;
    const success = await plannerService.toggleComplete(schedule.id, nextState);
    if (success) {
      setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, is_completed: nextState } : s));
    }
  };

  // Delete session
  const handleDeleteSession = async (scheduleId: string) => {
    const success = await plannerService.deleteSession(scheduleId);
    if (success) {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    }
  };

  // Start Focus from Plan
  const handleStartFocusFromPlan = (plan: CloudPlannerSession) => {
    startSession(
      plan.course_id,
      plan.subject_id || null,
      plan.topic_id || null,
      null
    );
    openTimerModal();
  };

  // Date Navigation Helpers
  const handlePrev = () => {
    if (viewMode === 'day') setCurrentDate(d => subDays(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => subDays(d, 7));
    else if (viewMode === 'month') setCurrentDate(d => subMonths(d, 1));
    else if (viewMode === 'year') setCurrentDate(d => subYears(d, 1));
  };

  const handleNext = () => {
    if (viewMode === 'day') setCurrentDate(d => addDays(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => addDays(d, 7));
    else if (viewMode === 'month') setCurrentDate(d => addMonths(d, 1));
    else if (viewMode === 'year') setCurrentDate(d => addYears(d, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // View Title Text
  const currentViewTitle = useMemo(() => {
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    return format(currentDate, 'yyyy');
  }, [viewMode, currentDate]);

  // Week Days Array
  const currentWeekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [currentDate]);

  // Month Days Array
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Year Months Summary Array (12 months)
  const yearMonths = useMemo(() => {
    const yearStart = startOfYear(currentDate);
    return Array.from({ length: 12 }).map((_, i) => {
      const mDate = addMonths(yearStart, i);
      const mStr = format(mDate, 'yyyy-MM');
      const mSchedules = schedules.filter(s => {
        const sDate = s.date || s.start_time.split('T')[0];
        return sDate.startsWith(mStr);
      });
      const totalMins = mSchedules.reduce((sum, s) => sum + (s.duration_minutes || 45), 0);
      return {
        monthDate: mDate,
        monthName: format(mDate, 'MMMM'),
        sessionCount: mSchedules.length,
        totalHours: Number((totalMins / 60).toFixed(1)),
      };
    });
  }, [currentDate, schedules]);

  const toggleDayOfWeek = (dayIdx: number) => {
    setSelectedDaysOfWeek(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#101828] dark:text-[#f8f9fc] transition-colors">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#5b5bd6]" />
            <span>Study Planner & Timetable</span>
          </h1>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
            Plan your learning journey for Day, Week, Month, or Year with automated reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Day / Week / Month / Year Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d]">
            {(['day', 'week', 'month', 'year'] as PlannerViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] dark:text-[#8282ea] shadow-xs'
                    : 'text-[#64748b] dark:text-[#9496a8] hover:text-[#101828]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            size="sm"
            className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold text-xs shadow-xs"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setStartDateStr(format(currentDate, 'yyyy-MM-dd'));
              setEndDateStr(format(currentDate, 'yyyy-MM-dd'));
              setIsAddModalOpen(true);
            }}
          >
            + Create Plan
          </Button>
        </div>
      </div>

      {/* View Navigation Bar */}
      <Card className="p-4 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#2b334d] hover:bg-[#f8fafc] dark:hover:bg-[#1f2538] text-[#64748b]"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#2b334d] hover:bg-[#f8fafc] dark:hover:bg-[#1f2538] text-[#64748b]"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs font-bold bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#2b334d]"
          >
            Today
          </Button>
        </div>

        <h2 className="text-sm sm:text-base font-bold text-[#101828] dark:text-[#f8f9fc]">
          {currentViewTitle}
        </h2>

        <div className="text-xs font-medium text-[#64748b] hidden sm:block">
          {schedules.length} Total Scheduled Sessions
        </div>
      </Card>

      {/* ================= 1. WEEK VIEW (MAIN VIEW) ================= */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {currentWeekDays.map((day, idx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySchedules = schedules.filter(s => {
              if (s.date) return s.date === dateStr;
              if (s.start_time) return s.start_time.startsWith(dateStr);
              return false;
            });
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={idx}
                className={`rounded-2xl p-3.5 border flex flex-col min-h-[300px] transition-colors ${
                  isToday
                    ? 'bg-[#5b5bd6]/5 border-[#5b5bd6]/40 shadow-xs'
                    : 'bg-white dark:bg-[#141824] border-[#e2e8f0] dark:border-[#23293d]'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0] dark:border-[#23293d] mb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] dark:text-[#9496a8]">
                      {format(day, 'EEE')}
                    </span>
                    <h3 className={`text-sm font-extrabold ${isToday ? 'text-[#5b5bd6]' : 'text-[#101828] dark:text-[#f8f9fc]'}`}>
                      {format(day, 'MMM d')}
                    </h3>
                  </div>
                  {isToday && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#5b5bd6] text-white">
                      Today
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {daySchedules.map(sch => {
                    const course = courses.find(c => c.id === sch.course_id);
                    return (
                      <div
                        key={sch.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 transition-all ${
                          sch.is_completed
                            ? 'bg-emerald-500/10 border-emerald-500/30 opacity-75'
                            : 'bg-[#f8fafc] dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#2b334d] hover:border-[#5b5bd6]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#5b5bd6] dark:text-[#8282ea] truncate max-w-[90px]">
                              {course?.name || 'Course'}
                            </span>
                            <span className="text-[10px] text-[#64748b]">
                              {format(new Date(sch.start_time), 'h:mm a')}
                            </span>
                          </div>

                          <h4 className={`font-bold text-[#101828] dark:text-[#f8f9fc] line-clamp-2 ${sch.is_completed ? 'line-through text-[#64748b]' : ''}`}>
                            {sch.title}
                          </h4>

                          <p className="text-[10px] text-[#64748b] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{sch.duration_minutes}m</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#e2e8f0] dark:border-[#2b334d]">
                          <button
                            onClick={() => handleToggleComplete(sch)}
                            className={`p-1 rounded-lg transition-colors ${
                              sch.is_completed ? 'text-emerald-600 font-bold' : 'text-[#94a3b8] hover:text-emerald-600'
                            }`}
                            title={sch.is_completed ? 'Mark as incomplete' : 'Mark completed'}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleStartFocusFromPlan(sch)}
                            className="px-2 py-0.5 rounded-lg bg-[#5b5bd6]/10 hover:bg-[#5b5bd6] text-[#5b5bd6] hover:text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
                            title="Start Focus with this session"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Focus</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSession(sch.id)}
                            className="p-1 text-[#94a3b8] hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {daySchedules.length === 0 && (
                    <div className="text-center py-6 text-[11px] text-[#94a3b8]">
                      Free day
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= 2. DAY VIEW (HOURLY TIMELINE) ================= */}
      {viewMode === 'day' && (
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">
              Schedule for {format(currentDate, 'EEEE, MMMM d')}
            </h3>
            <Button
              variant="primary"
              size="sm"
              className="bg-[#5b5bd6] text-white font-bold text-xs"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setStartDateStr(format(currentDate, 'yyyy-MM-dd'));
                setEndDateStr(format(currentDate, 'yyyy-MM-dd'));
                setIsAddModalOpen(true);
              }}
            >
              + Add Session
            </Button>
          </div>

          {(() => {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const daySchedules = schedules.filter(s => {
              if (s.date) return s.date === dateStr;
              if (s.start_time) return s.start_time.startsWith(dateStr);
              return false;
            });

            if (daySchedules.length === 0) {
              return (
                <div className="py-12 text-center text-xs text-[#64748b] border border-dashed border-[#e2e8f0] dark:border-[#2b334d] rounded-2xl space-y-2">
                  <p>No study sessions scheduled for this day.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-[#181d2f] text-[#5b5bd6] border-[#e2e8f0] dark:border-[#2b334d] font-bold"
                    onClick={() => {
                      setStartDateStr(format(currentDate, 'yyyy-MM-dd'));
                      setEndDateStr(format(currentDate, 'yyyy-MM-dd'));
                      setIsAddModalOpen(true);
                    }}
                  >
                    Schedule a Study Session
                  </Button>
                </div>
              );
            }

            return (
              <div className="space-y-3 pt-2">
                {daySchedules.map(sch => {
                  const course = courses.find(c => c.id === sch.course_id);
                  return (
                    <div
                      key={sch.id}
                      className="p-4 rounded-2xl border border-[#e2e8f0] dark:border-[#23293d] bg-[#f8fafc] dark:bg-[#181d2f] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-[#5b5bd6]/10 text-[#5b5bd6] font-bold text-xs">
                            {format(new Date(sch.start_time), 'h:mm a')}
                          </span>
                          <span className="text-xs font-bold text-[#64748b]">
                            {course?.name}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">
                          {sch.title}
                        </h4>
                        <p className="text-xs text-[#64748b]">Duration: {sch.duration_minutes} minutes</p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-[#5b5bd6] text-white font-bold text-xs shadow-xs"
                          leftIcon={<Play className="w-3.5 h-3.5 fill-white" />}
                          onClick={() => handleStartFocusFromPlan(sch)}
                        >
                          Start Focus
                        </Button>
                        <button
                          onClick={() => handleToggleComplete(sch)}
                          className={`p-2 rounded-xl border border-[#e2e8f0] dark:border-[#2b334d] transition-colors ${
                            sch.is_completed ? 'text-emerald-600 bg-emerald-50' : 'text-[#94a3b8] hover:text-emerald-600'
                          }`}
                          title="Toggle completion"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(sch.id)}
                          className="p-2 text-[#94a3b8] hover:text-rose-600 rounded-xl border border-[#e2e8f0] dark:border-[#2b334d] transition-colors"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      )}

      {/* ================= 3. MONTH VIEW (CALENDAR GRID) ================= */}
      {viewMode === 'month' && (
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#64748b] dark:text-[#9496a8] pb-2 border-b border-[#e2e8f0] dark:border-[#23293d]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Month Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const daySchedules = schedules.filter(s => {
                if (s.date) return s.date === dateStr;
                if (s.start_time) return s.start_time.startsWith(dateStr);
                return false;
              });
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode('day');
                  }}
                  className={`p-2.5 rounded-xl border min-h-[90px] flex flex-col justify-between cursor-pointer hover:border-[#5b5bd6] transition-all ${
                    isToday
                      ? 'bg-[#5b5bd6]/10 border-[#5b5bd6]'
                      : 'bg-[#f8fafc] dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#2b334d]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'text-[#5b5bd6]' : 'text-[#101828] dark:text-[#f8f9fc]'}`}>
                      {format(day, 'd')}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-[#5b5bd6]" />
                    )}
                  </div>

                  <div className="space-y-1">
                    {daySchedules.slice(0, 2).map(s => (
                      <div
                        key={s.id}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-[#141824] text-[#5b5bd6] dark:text-[#8282ea] truncate shadow-xs"
                      >
                        {s.title}
                      </div>
                    ))}
                    {daySchedules.length > 2 && (
                      <span className="text-[9px] text-[#64748b] font-semibold">
                        +{daySchedules.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ================= 4. YEAR VIEW (MONTH-WISE OVERVIEW) ================= */}
      {viewMode === 'year' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {yearMonths.map((m, idx) => (
            <Card
              key={idx}
              onClick={() => {
                setCurrentDate(m.monthDate);
                setViewMode('month');
              }}
              className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-3 cursor-pointer hover:border-[#5b5bd6] hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">{m.monthName}</h3>
                <CalendarDays className="w-4 h-4 text-[#5b5bd6]" />
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-extrabold text-[#5b5bd6] dark:text-[#8282ea]">
                  {m.sessionCount}
                </div>
                <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                  Planned sessions ({m.totalHours} hours)
                </p>
              </div>

              <div className="text-[11px] font-bold text-[#5b5bd6] hover:underline flex items-center gap-1 pt-1">
                <span>View month schedule</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ================= MODAL: CREATE STUDY PLAN ================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Study Session"
        size="md"
      >
        <form onSubmit={handleSaveSession} className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          {/* 1. Course Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Course *</label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Subject & Topic Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Subject / Paper</label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
              >
                <option value="">All Subjects / General</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Topic</label>
              <select
                value={selectedTopicId}
                onChange={e => setSelectedTopicId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
              >
                <option value="">General Topic</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Session Title (Optional custom title) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Session Title / Goal (Optional)</label>
            <input
              type="text"
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              placeholder="e.g. Practice Compound Interest MCQs, Revise Banking Laws"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          {/* 4. Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Start Date</label>
              <input
                type="date"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                End Date {repeatOption === 'once' ? '(Same day)' : ''}
              </label>
              <input
                type="date"
                value={endDateStr}
                onChange={e => setEndDateStr(e.target.value)}
                disabled={repeatOption === 'once'}
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* 5. Study Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Study Time</label>
              <input
                type="time"
                value={sessionStartTime}
                onChange={e => setSessionStartTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Duration (Minutes)</label>
              <input
                type="number"
                min={15}
                max={360}
                value={sessionDurationMinutes}
                onChange={e => setSessionDurationMinutes(parseInt(e.target.value) || 45)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none font-semibold"
              />
            </div>
          </div>

          {/* 6. Repeat Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Repeat Option</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'once', label: 'Once' },
                { id: 'daily', label: 'Daily' },
                { id: 'selected_days', label: 'Selected Days' },
                { id: 'weekly', label: 'Weekly' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setRepeatOption(opt.id as RepeatOption);
                    if (opt.id === 'once') setEndDateStr(startDateStr);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    repeatOption === opt.id
                      ? 'bg-[#5b5bd6] text-white border-[#5b5bd6]'
                      : 'bg-white dark:bg-[#181d2f] border-[#d0d5dd] dark:border-[#2b334d] text-[#64748b]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Days checkboxes if repeatOption === 'selected_days' */}
          {repeatOption === 'selected_days' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <span className="text-xs font-bold">Select Active Days:</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { idx: 1, label: 'Mon' },
                  { idx: 2, label: 'Tue' },
                  { idx: 3, label: 'Wed' },
                  { idx: 4, label: 'Thu' },
                  { idx: 5, label: 'Fri' },
                  { idx: 6, label: 'Sat' },
                  { idx: 0, label: 'Sun' },
                ].map(d => {
                  const isChecked = selectedDaysOfWeek.includes(d.idx);
                  return (
                    <button
                      key={d.idx}
                      type="button"
                      onClick={() => toggleDayOfWeek(d.idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        isChecked
                          ? 'bg-[#5b5bd6] text-white border-[#5b5bd6]'
                          : 'bg-white dark:bg-[#141824] border-[#d0d5dd] dark:border-[#2b334d] text-[#64748b]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7. Reminder Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[#5b5bd6]" />
              <span>Email Reminder Before Session</span>
            </label>
            <select
              value={reminderMinutesBefore}
              onChange={e => setReminderMinutesBefore(parseInt(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
            >
              <option value={15}>15 minutes before (Default)</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={0}>No reminder</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving || !selectedCourseId}
              className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
            >
              {isSaving ? 'Scheduling...' : 'Save Plan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
