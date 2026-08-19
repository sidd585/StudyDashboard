import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
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
  BookOpen,
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

export const Planner: React.FC = () => {
  const { currentUser } = useUser();

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
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
  const [sessionDate, setSessionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [sessionStartTime, setSessionStartTime] = useState<string>('19:00');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(45);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(15);

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
        courseService.getTopics(selectedCourseId),
      ]);
      setSubjects(subs);
      setTopics(tops.filter(t => !t.parent_topic_id));
    }
    loadHierarchy();
  }, [selectedCourseId]);

  // Week days array
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

  // Handle Add Session
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !sessionTitle.trim()) return;

    const startDateTime = new Date(`${sessionDate}T${sessionStartTime}:00`);

    const created = await plannerService.createPlannerSession({
      courseId: selectedCourseId,
      topicId: selectedTopicId || null,
      title: sessionTitle.trim(),
      startTime: startDateTime.toISOString(),
      durationMinutes: sessionDurationMinutes,
      reminderEnabled,
    });

    if (created) {
      setSchedules(prev => [...prev, created]);
      setIsAddModalOpen(false);
      setSessionTitle('');
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#5b5bd6]" />
            <span>Study Planner & Timetable</span>
          </h1>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
            Plan your weekly and daily study sessions with automated 15-minute reminders.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Day / Week / Month Toggles */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d]">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'day' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'week' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'month' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
              }`}
            >
              Month
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold text-xs"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add Session
          </Button>
        </div>
      </div>

      {/* Week Navigation Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[#fbfcfe] dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="bg-white dark:bg-[#181d2f] text-xs font-bold p-1.5"
            onClick={() => setCurrentWeekStart(prev => addDays(prev, -7))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs sm:text-sm font-bold text-[#172033] dark:text-white">
            Week of {format(currentWeekStart, 'MMMM d, yyyy')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="bg-white dark:bg-[#181d2f] text-xs font-bold p-1.5"
            onClick={() => setCurrentWeekStart(prev => addDays(prev, 7))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <button
          onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="text-xs font-bold text-[#5b5bd6] hover:underline"
        >
          Today
        </button>
      </div>

      {/* 7-DAY WEEKLY TIMETABLE LAYOUT (Requirement 40) */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, new Date());
          const dateStr = format(day, 'yyyy-MM-dd');

          const daySessions = schedules.filter(s => {
            if (s.date) return s.date === dateStr;
            if (s.start_time) return s.start_time.startsWith(dateStr);
            return false;
          });

          return (
            <div
              key={idx}
              className={`rounded-2xl border p-3 flex flex-col gap-2.5 min-h-[320px] transition-colors shadow-xs ${
                isToday
                  ? 'bg-[#f4f6fa] dark:bg-[#1a1f30] border-[#5b5bd6]/40 shadow-indigo-500/5'
                  : 'bg-[#fbfcfe] dark:bg-[#141824] border-[#e2e8f0] dark:border-[#23293d]'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <div>
                  <span className={`text-xs font-extrabold ${isToday ? 'text-[#5b5bd6] dark:text-[#8282ea]' : 'text-[#172033] dark:text-[#f8f9fc]'}`}>
                    {format(day, 'EEEE')}
                  </span>
                  <p className="text-[10px] text-[#64748b] font-medium">{format(day, 'MMM d')}</p>
                </div>
                {isToday && (
                  <span className="w-2 h-2 rounded-full bg-[#5b5bd6] animate-pulse" />
                )}
              </div>

              {/* Sessions List */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {daySessions.map(session => {
                  const course = courses.find(c => c.id === session.course_id);
                  return (
                    <div
                      key={session.id}
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all shadow-xs ${
                        session.is_completed
                          ? 'bg-[#f8fafc] dark:bg-[#181d2f]/40 border-emerald-500/30 opacity-75'
                          : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#2b334d]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-[11px] text-[#5b5bd6] truncate">
                          {course?.name || 'Course'}
                        </span>
                        <button
                          onClick={() => handleToggleComplete(session)}
                          className={`p-0.5 rounded transition-colors ${
                            session.is_completed ? 'text-emerald-600' : 'text-[#cbd5e1] hover:text-emerald-600'
                          }`}
                          title={session.is_completed ? 'Mark incomplete' : 'Mark completed'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h5 className={`font-bold text-xs leading-tight line-clamp-2 ${
                        session.is_completed ? 'line-through text-[#64748b]' : 'text-[#172033] dark:text-[#f8f9fc]'
                      }`}>
                        {session.title}
                      </h5>

                      <div className="flex items-center justify-between text-[10px] text-[#64748b] pt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#5b5bd6]" />
                          {format(new Date(session.start_time), 'h:mm a')}
                        </span>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="hover:text-rose-600 p-0.5"
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {daySessions.length === 0 && (
                  <div className="h-full flex items-center justify-center py-8 text-center text-[11px] text-[#94a3b8]">
                    No sessions
                  </div>
                )}
              </div>

              {/* Quick Add Button */}
              <button
                onClick={() => {
                  setSessionDate(dateStr);
                  setIsAddModalOpen(true);
                }}
                className="w-full py-1 rounded-xl text-[11px] font-bold text-[#5b5bd6] hover:bg-[#eef2f6] dark:hover:bg-[#181d2f] border border-dashed border-[#e2e8f0] dark:border-[#23293d] transition-colors"
              >
                + Plan Session
              </button>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL: ADD PLANNER SESSION (Requirement 41) ================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Study Session"
        size="md"
      >
        <form onSubmit={handleSaveSession} className="space-y-3.5 text-[#172033] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Session Title *
            </label>
            <input
              type="text"
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              placeholder="e.g. Prompt Engineering, Banking Laws, Database Normalization"
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                Course *
              </label>
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-semibold outline-none"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                Topic (Optional)
              </label>
              <select
                value={selectedTopicId}
                onChange={e => setSelectedTopicId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-semibold outline-none"
              >
                <option value="">General Topic</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.code ? `${t.code}. ` : ''}{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="space-y-1">
              <label className="block font-bold">Date *</label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-bold">Start Time *</label>
              <input
                type="time"
                value={sessionStartTime}
                onChange={e => setSessionStartTime(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-bold">Duration (Mins)</label>
              <input
                type="number"
                value={sessionDurationMinutes}
                onChange={e => setSessionDurationMinutes(parseInt(e.target.value) || 45)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-xs">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#5b5bd6]" />
              <span className="font-bold">15m Pre-Study Reminder Email</span>
            </div>
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={e => setReminderEnabled(e.target.checked)}
              className="w-4 h-4 text-[#5b5bd6] rounded"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" className="bg-[#5b5bd6] text-white font-bold">Save Schedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
