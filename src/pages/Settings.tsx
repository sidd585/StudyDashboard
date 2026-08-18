import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getUserSettings, updateUserSettings } from '../db';
import { useUser } from '../context/UserContext';
import { isSupabaseConfigured, USER_PROFILES } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Settings as SettingsIcon,
  Mail,
  Bell,
  Database,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  Globe,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { sendDailySummaryEmail } from '../services/emailService';
import { exportBackupData } from '../services/backupService';
import { resetAllProgressToZero } from '../db/seed';
import { format, startOfDay, endOfDay } from 'date-fns';

export const Settings: React.FC = () => {
  const { activeProfileKey, currentUser, switchUser } = useUser();
  const settings = useLiveQuery(() => getUserSettings(currentUser.id), [currentUser.id]);

  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(currentUser.email);
  const [isReminder15m, setIsReminder15m] = useState(true);
  const [isDaily10pm, setIsDaily10pm] = useState(true);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Mutual Reset Proposal State (stored in localStorage for instantaneous sync)
  const [pendingResetProposal, setPendingResetProposal] = useState<{
    requestedBy: string;
    requestedTime: string;
  } | null>(null);

  useEffect(() => {
    const checkReset = () => {
      const raw = localStorage.getItem('studydashboard_pending_reset');
      if (raw) {
        try {
          setPendingResetProposal(JSON.parse(raw));
        } catch {
          setPendingResetProposal(null);
        }
      } else {
        setPendingResetProposal(null);
      }
    };
    checkReset();
    window.addEventListener('storage', checkReset);
    return () => window.removeEventListener('storage', checkReset);
  }, []);

  // Sync settings when loaded
  React.useEffect(() => {
    if (settings) {
      setRecipientEmail(settings.recipientEmail || currentUser.email);
      setIsReminder15m(settings.reminder15minEnabled);
      setIsDaily10pm(settings.dailySummary10pmEnabled);
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

  // Reset Progress Handlers
  const handleRequestSharedReset = () => {
    const proposal = {
      requestedBy: currentUser.name,
      requestedTime: format(new Date(), 'hh:mm a, MMM d'),
    };
    localStorage.setItem('studydashboard_pending_reset', JSON.stringify(proposal));
    setPendingResetProposal(proposal);
    setResetMessage(`Reset proposal sent by ${currentUser.name}. Waiting for study partner to accept.`);
  };

  const handleAcceptSharedReset = async () => {
    await resetAllProgressToZero('all');
    localStorage.removeItem('studydashboard_pending_reset');
    setPendingResetProposal(null);
    setResetMessage('All study progress & streaks have been successfully reset to Day 0 (Fresh Start)!');
    setTimeout(() => setResetMessage(null), 5000);
  };

  const handleDeclineSharedReset = () => {
    localStorage.removeItem('studydashboard_pending_reset');
    setPendingResetProposal(null);
    setResetMessage('Reset request was declined.');
    setTimeout(() => setResetMessage(null), 4000);
  };

  const handleResetPersonalStats = async () => {
    if (window.confirm(`Are you sure you want to reset all study time, streaks, and quiz attempts for ${currentUser.name} to 0?`)) {
      await resetAllProgressToZero('user', currentUser.id);
      setResetMessage(`Personal streak and statistics for ${currentUser.name} have been reset to 0.`);
      setTimeout(() => setResetMessage(null), 4000);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 pb-12 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Settings & Notifications</h2>
        <p className="text-xs text-slate-400">Manage account, automated Asia/Kathmandu email summaries, streaks, and backups.</p>
      </div>

      {/* Pending Reset Proposal Alert Banner */}
      {pendingResetProposal && (
        <Card className="p-5 border-amber-500/40 bg-amber-500/10 space-y-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-300">
                Shared Progress Reset Request Pending
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                <strong>{pendingResetProposal.requestedBy}</strong> has requested to reset all study sessions, question attempts, and streaks back to <strong>Day 0 (Fresh Start)</strong> for both Siddhartha and Shilpa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button variant="primary" size="sm" onClick={handleAcceptSharedReset}>
              Accept & Reset All to Day 0
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeclineSharedReset}>
              Decline Request
            </Button>
          </div>
        </Card>
      )}

      {resetMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          {resetMessage}
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
              <Badge variant="brand" className="mt-1">Study Together Partner</Badge>
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

      {/* 2. Reset Progress & Streak (Mutual Confirmation) */}
      <Card className="p-6 border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>Reset Streak & Study Progress (Day 0 Start)</span>
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed">
          Start fresh from Day 1. You can reset your personal stats immediately, or send a shared reset proposal that requires acceptance by both Siddhartha and Shilpa.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Flame className="w-3.5 h-3.5 text-amber-400" />}
            onClick={handleResetPersonalStats}
          >
            Reset My Personal Streak to 0
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-rose-400" />}
            onClick={handleRequestSharedReset}
          >
            Request Shared Room Reset (Day 0)
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
    </div>
  );
};
