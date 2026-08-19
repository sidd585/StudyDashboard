import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateUserSettings } from '../db';
import { resetAllProgressToZero } from '../db/seed';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ResetModal } from '../components/common/ResetModal';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import {
  Mail,
  Database,
  Download,
  ShieldCheck,
  RotateCcw,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { sendDailySummaryEmail } from '../services/emailService';
import { exportBackupData } from '../services/backupService';
import { format, startOfDay, endOfDay } from 'date-fns';

export const SettingsContent: React.FC = () => {
  const { activeProfileKey, currentUser, switchUser } = useUser();
  
  const settings = useLiveQuery(() => db.userSettings.get(currentUser.id), [currentUser.id]);

  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(currentUser.email || '');
  const [isReminder15m, setIsReminder15m] = useState(true);
  const [isDaily10pm, setIsDaily10pm] = useState(true);
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(3);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setRecipientEmail(settings.recipientEmail || currentUser.email || '');
      setIsReminder15m(settings.reminder15minEnabled ?? true);
      setIsDaily10pm(settings.dailySummary10pmEnabled ?? true);
    } else {
      setRecipientEmail(currentUser.email || '');
    }
  }, [settings, currentUser]);

  const handleThemeChange = (mode: 'dark' | 'light') => {
    setThemeMode(mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studydashboard_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studydashboard_theme', 'light');
    }
  };

  const handleSaveSettings = async () => {
    await updateUserSettings(currentUser.id, {
      recipientEmail,
      reminder15minEnabled: isReminder15m,
      dailySummary10pmEnabled: isDaily10pm,
    });
    setEmailStatus('Preferences saved successfully.');
    setTimeout(() => setEmailStatus(null), 3000);
  };

  const handleTest10pmSummary = async () => {
    setEmailStatus('Generating study statistics and dispatching 10 PM Daily Summary...');

    const todayStart = startOfDay(new Date()).getTime();
    const todayEnd = endOfDay(new Date()).getTime();

    const targets = await db.targets.where('userId').equals(currentUser.id).toArray();
    const sessions = await db.studySessions
      .where('userId').equals(currentUser.id)
      .and(s => s.startTime >= todayStart && s.startTime <= todayEnd)
      .toArray();

    const attempts = await db.attempts
      .where('userId').equals(currentUser.id)
      .and(a => a.timestamp >= todayStart && a.timestamp <= todayEnd)
      .toArray();

    const targetBreakdowns = targets.map(t => {
      const studied = sessions.filter(s => s.targetId === t.id).reduce((sum, s) => sum + s.focusedMinutes, 0);
      return {
        targetName: t.name,
        studiedMinutes: studied,
        plannedMinutes: t.dailyGoalMinutes,
        isCompleted: studied >= t.dailyGoalMinutes,
      };
    });

    const totalStudy = sessions.reduce((sum, s) => sum + s.focusedMinutes, 0);
    const totalGoal = targets.reduce((sum, t) => sum + t.dailyGoalMinutes, 0) || 1;
    const goalPct = Math.min(100, Math.round((totalStudy / totalGoal) * 100));

    const attempted = attempts.length;
    const correct = attempts.filter(a => a.isCorrect).length;
    const wrong = attempted - correct;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    const status: 'On Track' | 'Almost There' | 'Needs Attention' =
      goalPct >= 80 ? 'On Track' : goalPct >= 50 ? 'Almost There' : 'Needs Attention';

    const result = await sendDailySummaryEmail({
      userId: currentUser.id,
      userName: currentUser.name,
      recipientEmail,
      dateStr: format(new Date(), 'yyyy-MM-dd'),
      totalStudyMinutes: totalStudy,
      targetBreakdowns,
      mcqStats: {
        attempted,
        correct,
        wrong,
        accuracy,
      },
      dailyGoalCompletionPercent: goalPct,
      status,
      statusExplanation: `${totalStudy}m studied today, ${goalPct}% of daily target reached.`,
    });

    setEmailStatus(`Daily Summary dispatched: "${result.subject}"`);
    setTimeout(() => setEmailStatus(null), 5000);
  };

  const handleExportBackup = async () => {
    const jsonStr = await exportBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyDashboard-Backup-${currentUser.name}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus('Backup exported successfully.');
    setTimeout(() => setBackupStatus(null), 3000);
  };

  return (
    <div className="max-w-4xl space-y-6 pb-12 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Settings & Preferences</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage profile, timezone, themes, automated email reminders, and study progress.
        </p>
      </div>

      {resetMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{resetMessage}</span>
        </div>
      )}

      {/* 1. Active Profile Section */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span>Profile & Active User</span>
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-12 h-12 rounded-full border-2 border-brand-500 bg-slate-100 dark:bg-slate-800"
            />
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.email}</p>
              <Badge variant="brand" className="mt-1">Active Study Profile</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeProfileKey === 'siddhartha' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => switchUser('siddhartha')}
            >
              Siddhartha View
            </Button>
            <Button
              variant={activeProfileKey === 'shilpa' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => switchUser('shilpa')}
            >
              Shilpa View
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Study Preferences & Timezone */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span>Study Preferences</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Timezone (Real Calendar Rollover)
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Asia/Kathmandu (UTC+5:45)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Daily progress rolls over at 00:00 Nepal Time.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Default Daily Goal
            </label>
            <select
              value={dailyGoalHours}
              onChange={e => setDailyGoalHours(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            >
              <option value={2}>2 Hours / day</option>
              <option value={3}>3 Hours / day</option>
              <option value={4}>4 Hours / day</option>
              <option value={5}>5 Hours / day</option>
              <option value={6}>6 Hours / day</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 3. Appearance (Light / Dark Theme) */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-500" />
          <span>Appearance & Color Theme</span>
        </h3>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              themeMode === 'light'
                ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-950 dark:text-brand-300 ring-1 ring-brand-500'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Light Mode (Clean Slate)</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              themeMode === 'dark'
                ? 'bg-slate-800 border-brand-500 text-white ring-1 ring-brand-500'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Dark Mode (Midnight Slate)</span>
          </button>
        </div>
      </Card>

      {/* 4. Data & Progress (Reset All Study Progress) */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-rose-500" />
          <span>Data & Progress: Reset All Study Progress</span>
        </h3>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          This will permanently remove your study sessions, MCQ attempts, progress statistics and streak history. Your Targets, Subjects, Questions, Materials and Settings will remain.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="danger"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => setIsResetModalOpen(true)}
          >
            Reset Progress / Streak
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={async () => {
              if (window.confirm("Wipe ALL study history, streaks, and attempts for BOTH Siddhartha & Shilpa back to 0?")) {
                await resetAllProgressToZero('all');
                localStorage.setItem('studydashboard_is_reset_v5', 'true');
                window.location.reload();
              }
            }}
          >
            Instant Wipe Both to Day 0
          </Button>
        </div>
      </Card>

      {/* 5. Automated Email Reminders & 10 PM Summary Settings */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              <span>Automated Email Reminders & Daily Summary</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Scheduled in timezone: <strong>Asia/Kathmandu (UTC+5:45)</strong></p>
          </div>
        </div>

        {emailStatus && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            {emailStatus}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Recipient Email Address</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isReminder15m}
                onChange={e => setIsReminder15m(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Send 15-minute advance reminder before scheduled study sessions</span>
            </label>

            <label className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isDaily10pm}
                onChange={e => setIsDaily10pm(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Send 10:00 PM Asia/Kathmandu Daily Summary Email</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="primary" size="sm" onClick={handleSaveSettings}>
              Save Email Preferences
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Mail className="w-3.5 h-3.5" />} onClick={handleTest10pmSummary}>
              Send Test 10 PM Daily Summary Now
            </Button>
          </div>
        </div>
      </Card>

      {/* 6. Local Backup & Export */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-500" />
          <span>Local Backup & Export</span>
        </h3>

        {backupStatus && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            {backupStatus}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportBackup}
          >
            Export Full JSON Backup
          </Button>
        </div>
      </Card>

      {/* 2-Step Verification Reset Modal */}
      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={(msg) => {
          setResetMessage(msg);
          setTimeout(() => setResetMessage(null), 5000);
        }}
      />
    </div>
  );
};

export const Settings: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Settings unavailable">
      <SettingsContent />
    </ErrorBoundary>
  );
};
