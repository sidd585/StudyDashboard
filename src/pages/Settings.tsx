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
  User,
  Sun,
  Moon,
  Clock,
  Mail,
  Database,
  RotateCcw,
  Download,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { sendDailySummaryEmail } from '../services/emailService';
import { exportBackupData } from '../services/backupService';
import { format, startOfDay, endOfDay } from 'date-fns';
import { DAILY_PALETTES, applyDailyTheme } from '../utils/dailyTheme';

type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'preferences'
  | 'email'
  | 'data';

export const SettingsContent: React.FC = () => {
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const settings = useLiveQuery(() => db.userSettings.get(currentUser.id), [currentUser.id]);

  // Form states
  const [recipientEmail, setRecipientEmail] = useState(currentUser.email || '');
  const [isReminder15m, setIsReminder15m] = useState(true);
  const [isDaily10pm, setIsDaily10pm] = useState(true);
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(3);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  // Status banners
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
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

  const handleSavePreferences = async () => {
    await updateUserSettings(currentUser.id, {
      recipientEmail,
      reminder15minEnabled: isReminder15m,
      dailySummary10pmEnabled: isDaily10pm,
    });
    setSaveStatus('Settings successfully saved and persisted.');
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleTest10pmSummary = async () => {
    setEmailStatus('Generating study statistics and dispatching 10:00 PM Daily Summary...');

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

    const totalStudy = sessions.reduce((sum, s) => sum + s.focusedMinutes, 0);
    const totalGoal = targets.reduce((sum, t) => sum + t.dailyGoalMinutes, 0) || 120;
    const goalPct = Math.min(100, Math.round((totalStudy / totalGoal) * 100));

    const attempted = attempts.length;
    const correct = attempts.filter(a => a.isCorrect).length;
    const wrong = attempted - correct;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;

    const targetBreakdown: Record<string, number> = {};
    targets.forEach(t => {
      targetBreakdown[t.name] = sessions.filter(s => s.targetId === t.id).reduce((sum, s) => sum + s.focusedMinutes, 0);
    });

    const result = await sendDailySummaryEmail({
      userId: currentUser.id,
      userName: currentUser.name,
      recipientEmail,
      todayFocusMinutes: totalStudy,
      dailyGoalMinutes: totalGoal,
      goalCompletionPct: goalPct,
      mcqsAttempted: attempted,
      mcqsCorrect: correct,
      mcqsWrong: wrong,
      accuracyPct: accuracy,
      targetBreakdown,
    });

    setEmailStatus(`Daily Summary dispatched: "${result.message}"`);
    setTimeout(() => setEmailStatus(null), 5000);
  };

  const handleExportBackup = async () => {
    const jsonStr = await exportBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studydashboard-backup-${currentUser.id}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    setBackupStatus('Backup exported successfully.');
    setTimeout(() => setBackupStatus(null), 4000);
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'preferences', label: 'Study Preferences', icon: Sliders },
    { id: 'email', label: 'Email & Reminders', icon: Mail },
    { id: 'data', label: 'Data & Progress', icon: Database },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Settings & Preferences</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure profile, email reminders, timer defaults, and backup data.
        </p>
      </div>

      {saveStatus && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: PROFILE ================= */}
      {activeTab === 'profile' && (
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-6">
          <div className="flex items-center gap-4">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-16 h-16 rounded-full border border-slate-300 dark:border-slate-700 object-cover shadow-xs"
            />
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">{currentUser.name}</h4>
              <p className="text-xs text-slate-500">{currentUser.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="brand">
                  Role: {currentUser.role}
                </Badge>
                <span className="text-xs text-slate-500">
                  Goal: {Math.floor(currentUser.dailyGoalMinutes / 60)}h {currentUser.dailyGoalMinutes % 60}m/day
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ================= TAB 2: APPEARANCE ================= */}
      {activeTab === 'appearance' && (
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Color Mode</h3>
            <p className="text-xs text-slate-500">Choose between clean Light Slate or Midnight Dark mode.</p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-semibold transition-all ${
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
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-semibold transition-all ${
                  themeMode === 'dark'
                    ? 'bg-slate-800 border-brand-500 text-white ring-1 ring-brand-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Dark Mode (Midnight Slate)</span>
              </button>
            </div>
          </div>

          {/* Daily Rotating Color Refresh */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
                  <span>Daily Color Refresh (Dynamic Accent)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  App colors refresh dynamically every day so studying stays visually exciting.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  localStorage.setItem('studydashboard_custom_theme_day', 'auto');
                  applyDailyTheme();
                  setSaveStatus('Theme set to automatic daily rotation!');
                  setTimeout(() => setSaveStatus(null), 3000);
                }}
              >
                Reset to Auto-Daily
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
              {Object.entries(DAILY_PALETTES).map(([dayKey, pal]) => {
                const dayNum = Number(dayKey);
                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => {
                      applyDailyTheme(dayNum);
                      setSaveStatus(`Theme changed to ${pal.dayName} (${pal.name})!`);
                      setTimeout(() => setSaveStatus(null), 3000);
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 text-left transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{pal.dayName}</span>
                      <span
                        className="w-4 h-4 rounded-full border border-white/40 shadow-xs shrink-0"
                        style={{ backgroundColor: pal.previewColor }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold" style={{ color: pal.previewColor }}>{pal.name}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{pal.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ================= TAB 3: STUDY PREFERENCES ================= */}
      {activeTab === 'preferences' && (
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Study Preferences & Timezone</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Calendar Timezone (Asia/Kathmandu)
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Asia/Kathmandu (UTC+5:45)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Midnight rollover strictly calculates Nepal calendar days.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Daily Goal
              </label>
              <select
                value={dailyGoalHours}
                onChange={e => setDailyGoalHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value={2}>2 Hours / day</option>
                <option value={3}>3 Hours / day</option>
                <option value={4}>4 Hours / day</option>
                <option value={5}>5 Hours / day</option>
                <option value={6}>6 Hours / day</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="primary" size="sm" onClick={handleSavePreferences}>
              Save Preferences
            </Button>
          </div>
        </Card>
      )}

      {/* ================= TAB 4: EMAIL & REMINDERS ================= */}
      {activeTab === 'email' && (
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                <span>Automated Email Reminders & Nightly Summary</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Scheduled in timezone: <strong>Asia/Kathmandu (UTC+5:45)</strong></p>
            </div>
          </div>

          {emailStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              {emailStatus}
            </div>
          )}

          <div className="space-y-4">
            {/* Sender Address Info Banner */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Email Sender Configuration:</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Emails are securely dispatched via Resend from: <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 font-mono font-bold">StudyDashboard &lt;study@resend.dev&gt;</code> (or your custom domain set in <code className="font-mono">RESEND_FROM_EMAIL</code>).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recipient Email Address (Where you receive your alerts)
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                className="w-full sm:w-80 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReminder15m}
                  onChange={e => setIsReminder15m(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Enable 15-minute advance reminder before scheduled study sessions</span>
              </label>

              <label className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDaily10pm}
                  onChange={e => setIsDaily10pm(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Enable 10:30 PM Asia/Kathmandu Daily Summary Email (with 7-day focus chart)</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="primary" size="sm" onClick={handleSavePreferences}>
                Save Email Preferences
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Mail className="w-3.5 h-3.5" />} onClick={handleTest10pmSummary}>
                Send Test 10:30 PM Summary
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ================= TAB 5: DATA & PROGRESS ================= */}
      {activeTab === 'data' && (
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            <span>Data Management & Study Reset</span>
          </h3>

          {backupStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              {backupStatus}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Backup & Export
              </h4>
              <p className="text-xs text-slate-500 mb-2">Export your study history, questions, and targets to a JSON backup.</p>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportBackup}
              >
                Export JSON Backup
              </Button>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">
                Reset Study Progress (Fresh Start)
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Permanently wipes study sessions, streaks, and MCQ attempts back to Day 0. Your targets, subjects, and questions remain intact.
              </p>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => setIsResetModalOpen(true)}
              >
                Reset Progress / Streak
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 2-Step Verification Reset Modal */}
      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={(msg) => {
          setSaveStatus(msg);
          setTimeout(() => setSaveStatus(null), 5000);
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
