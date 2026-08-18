import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  Trash2,
  Bell,
  Mail,
  Sparkles,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { sendStudyReminderEmail } from '../services/emailService';
import type { StudySchedule } from '../types';

export const Planner: React.FC = () => {
  const { currentUser } = useUser();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).and(t => !t.isArchived).toArray(),
    [currentUser.id]
  ) || [];

  const schedules = useLiveQuery(
    () => db.studySchedules.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('19:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [notes, setNotes] = useState('');
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId || !title.trim()) return;

    const id = `sched-${Date.now()}`;
    await db.studySchedules.put({
      id,
      userId: currentUser.id,
      targetId: selectedTargetId,
      subjectId: selectedSubjectId || undefined,
      title: title.trim(),
      date,
      startTime,
      durationMinutes,
      notes: notes.trim() || undefined,
      isCompleted: false,
      emailReminderSent: false,
      createdAt: Date.now(),
    });

    setTitle('');
    setNotes('');
    setIsCreateModalOpen(false);
  };

  const handleToggleComplete = async (schedule: StudySchedule) => {
    await db.studySchedules.update(schedule.id, {
      isCompleted: !schedule.isCompleted,
    });
  };

  const handleDelete = async (id: string) => {
    await db.studySchedules.delete(id);
  };

  const handleTestReminder = async (schedule: StudySchedule) => {
    const targetObj = targets.find(t => t.id === schedule.targetId);
    setReminderStatus('Dispatching 15m reminder via Resend...');

    await sendStudyReminderEmail({
      userId: currentUser.id,
      userName: currentUser.name,
      recipientEmail: currentUser.email,
      targetName: targetObj?.name || 'Study Target',
      plannedStartTime: schedule.startTime,
      plannedDurationMinutes: schedule.durationMinutes,
      todayTargetMinutes: targetObj?.dailyGoalMinutes || 60,
      todayCompletedMinutes: 45,
    });

    setReminderStatus('Reminder email sent successfully!');
    setTimeout(() => setReminderStatus(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Study Planner & Reminders</h2>
          <p className="text-xs text-slate-400">
            Schedule your target sessions in Asia/Kathmandu timezone with automated 15m pre-study email reminders.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            if (targets.length > 0 && !selectedTargetId) setSelectedTargetId(targets[0].id);
            setIsCreateModalOpen(true);
          }}
        >
          Schedule Session
        </Button>
      </div>

      {reminderStatus && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <span>{reminderStatus}</span>
        </div>
      )}

      {/* Schedules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.length === 0 ? (
          <Card className="p-12 text-center border-slate-800 space-y-3 col-span-2">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No scheduled sessions</h3>
            <p className="text-xs text-slate-500">Plan your daily target study blocks to receive timely email reminders.</p>
          </Card>
        ) : (
          schedules.map(sched => {
            const targetObj = targets.find(t => t.id === sched.targetId);
            const isToday = sched.date === todayStr;

            return (
              <Card
                key={sched.id}
                className={`p-5 border-slate-800 transition-all ${
                  sched.isCompleted ? 'opacity-60 bg-slate-900/30' : 'bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: targetObj?.color || '#6366f1' }}
                    />
                    <div>
                      <h4 className={`text-sm font-bold ${sched.isCompleted ? 'line-through text-slate-400' : 'text-white'}`}>
                        {sched.title}
                      </h4>
                      <p className="text-[11px] text-slate-400">{targetObj?.name || 'Study Target'}</p>
                    </div>
                  </div>

                  <Badge variant={isToday ? 'brand' : 'outline'}>
                    {sched.date === todayStr ? 'Today' : sched.date}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300 mb-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{sched.startTime}</span>
                  </span>
                  <span>•</span>
                  <span>{sched.durationMinutes} Minutes</span>
                  {sched.notes && (
                    <>
                      <span>•</span>
                      <span className="truncate text-slate-400">{sched.notes}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    onClick={() => handleToggleComplete(sched)}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      sched.isCompleted ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{sched.isCompleted ? 'Completed' : 'Mark Done'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestReminder(sched)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                      title="Send 15m Email Reminder now"
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(sched.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Create Schedule Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule Study Session"
      >
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target *</label>
            <select
              required
              value={selectedTargetId}
              onChange={e => setSelectedTargetId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="">Select Target</option>
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Session Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Computer Networks Revision & MCQs"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Duration (Minutes)</label>
            <input
              type="number"
              min="15"
              step="15"
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Plan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Key sections to complete..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!selectedTargetId}>
              Save Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
