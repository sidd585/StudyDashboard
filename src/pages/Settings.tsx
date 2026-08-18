import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateUserSettings } from '../db';
import { useUser } from '../context/UserContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ResetModal } from '../components/common/ResetModal';
import {
  Mail,
  Database,
  Download,
  ShieldCheck,
  RotateCcw,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { sendDailySummaryEmail } from '../services/emailService';
import { exportBackupData } from '../services/backupService';
import { format, startOfDay, endOfDay } from 'date-fns';

export const Settings: React.FC = () => {
  const { activeProfileKey, currentUser, switchUser } = useUser();
  
  // Direct table query (avoid async functions inside useLiveQuery)
  const settings = useLiveQuery(() => db.userSettings.get(currentUser.id), [currentUser.id]);

  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(currentUser.email);
  const [isReminder15m, setIsReminder15m] = useState(true);
  const [isDaily10pm, setIsDaily10pm] = useState(true);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setRecipientEmail(settings.recipientEmail || currentUser.email);
      setIsReminder15m(settings.reminder15minEnabled);
      setIsDaily10pm(settings.dailySummary10pmEnabled);
    } else {
      setRecipientEmail(currentUser.email);
    }
  }, [settings, currentUser]);

  const handleSaveSettings = async () => {
    await updateUserSettings(currentUser.id, {
      recipientEmail,
      reminder15minEnabled: isReminder15m,
      dailySummary10pmEnabled: isDaily10pm,
    });
    setEmailStatus('Preferences saved successfully.');
    setTimeout(() => setEmailStatus(null), 3000);
  };

  // Test 10 PM Daily Summary Email trigger
  const handleTest10pmSummary = async () => {
    setEmailStatus('Generating actual study data and dispatching 10 PM Daily Summary...');

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

  // Full JSON Backup Export
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
        <h2 className="text-xl font-bold text-white tracking-tight">Settings & Notifications</h2>
        <p className="text-xs text-slate-400">Manage account, automated Asia/Kathmandu email summaries, streaks, and backups.</p>
      </div>

      {resetMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{resetMessage}</span>
        </div>
      )}

      {/* 1. Active Profile Switcher Box */}
      <Card className="p-6 border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
          <span>Active User Profile</span>
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-12 h-12 rounded-full border-2 border-brand-500 bg-slate-800"
            />
            <div>
              <p className="text-base font-bold text-white">{currentUser.name}</p>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
              <Badge variant="brand" className="mt-1">Active Study Partner</Badge>
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

      {/* 2. Reset Progress & Streak (2-Step Verification Modal) */}
      <Card className="p-6 border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>Reset Study Dashboard & Streak (Day 0 Start)</span>
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed">
          Start fresh from Day 1. You can choose to reset both Siddhartha and Shilpa together, or reset only one profile. Includes a 2-step double verification to prevent accidental clicks.
        </p>

        <div className="pt-2">
          <Button
            variant="danger"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => setIsResetModalOpen(true)}
          >
            Reset Dashboard & Streak (2-Step Verification)
          </Button>
        </div>
      </Card>

      {/* 3. Automated Email Reminders & 10 PM Summary Settings */}
      <Card className="p-6 border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              <span>Automated Email Reminders & Daily Summary</span>
            </h3>
            <p className="text-xs text-slate-400">Scheduled in timezone: <strong>Asia/Kathmandu (UTC+5:45)</strong></p>
          </div>
        </div>

        {emailStatus && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            {emailStatus}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient Email Address</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isReminder15m}
                onChange={e => setIsReminder15m(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Send 15-minute advance reminder before scheduled study sessions</span>
            </label>

            <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isDaily10pm}
                onChange={e => setIsDaily10pm(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Send 10:00 PM Asia/Kathmandu Daily Summary Email</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
            <Button variant="primary" size="sm" onClick={handleSaveSettings}>
              Save Email Preferences
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Mail className="w-3.5 h-3.5" />} onClick={handleTest10pmSummary}>
              Send Test 10 PM Daily Summary Now
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Local Backup & Export */}
      <Card className="p-6 border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span>Local Backup & Export</span>
        </h3>

        {backupStatus && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
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
