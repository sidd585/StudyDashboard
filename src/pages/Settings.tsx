import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { adminService } from '../services/adminService';
import { sendDailySummaryEmail } from '../services/emailService';
import { supabase } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  User,
  Sun,
  Moon,
  Laptop,
  Clock,
  Mail,
  Database,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Sliders,
  Sparkles,
  Send,
} from 'lucide-react';

type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'preferences'
  | 'email'
  | 'data'
  | 'security';

export const Settings: React.FC = () => {
  const { user, profile, refreshProfile, updatePassword, signOut } = useAuth();
  const { currentUser } = useUser();
  const { themeMode, setThemeMode } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Form states
  const [displayName, setDisplayName] = useState(currentUser.name || '');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(currentUser.dailyGoalMinutes || 150);
  const [defaultFocusDuration, setDefaultFocusDuration] = useState<number>(45);
  const [defaultQuestionCount, setDefaultQuestionCount] = useState<number>(15);

  // Email & Reminders
  const [dailyReportEnabled, setDailyReportEnabled] = useState(true);
  const [studyRemindersEnabled, setStudyRemindersEnabled] = useState(true);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Security
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  // Save Banner
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Reset Modals
  const [isResetProgressModalOpen, setIsResetProgressModalOpen] = useState(false);
  const [isResetDataModalOpen, setIsResetDataModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setDailyGoalMinutes(profile.daily_goal_minutes || 150);
    }
  }, [profile]);

  // Handle Save Profile & Preferences
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          daily_goal_minutes: dailyGoalMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      await refreshProfile();
      setSaveStatus('Profile and preferences updated successfully.');
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  // Handle Send Test Summary Email
  const handleSendTestSummaryEmail = async () => {
    if (!user?.email) return;
    setIsSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await sendDailySummaryEmail({
        userId: user.id,
        userName: currentUser.name,
        recipientEmail: user.email,
        totalStudyMinutes: 75,
        todayFocusMinutes: 75,
        dailyGoalMinutes: dailyGoalMinutes || 120,
        goalCompletionPct: 63,
        mcqsAttempted: 30,
        mcqsCorrect: 26,
        mcqsWrong: 4,
        accuracyPct: 87,
        status: 'On Track',
        targetBreakdowns: [
          { targetName: 'RBB Preparation', studiedMinutes: 60, plannedMinutes: 60, isCompleted: true },
          { targetName: 'NRB Assistant', studiedMinutes: 15, plannedMinutes: 30, isCompleted: false },
        ],
      });
      setTestEmailStatus(`✓ Daily summary email sent to ${user.email}`);
      setTimeout(() => setTestEmailStatus(null), 5000);
    } catch (err) {
      setTestEmailStatus('Failed to send email test.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Handle Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordStatus('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus('Passwords do not match.');
      return;
    }

    const { error } = await updatePassword(newPassword);
    if (error) {
      setPasswordStatus(error);
    } else {
      setPasswordStatus('Password successfully changed.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus(null), 4000);
    }
  };

  // Handle Reset User Progress
  const handleResetProgress = async () => {
    if (!user) return;
    setIsResetting(true);
    try {
      const success = await adminService.resetUserData(user.id, 'PROGRESS_ONLY');
      if (success) {
        alert('Your study progress and attempt history have been reset.');
        setIsResetProgressModalOpen(false);
        setTimeout(() => window.location.reload(), 300);
      } else {
        alert('Failed to reset progress.');
      }
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Reset User Full Study Data
  const handleResetStudyData = async () => {
    if (!user || resetConfirmInput !== 'RESET') return;
    setIsResetting(true);
    try {
      const success = await adminService.resetUserData(user.id, 'FULL_STUDY_DATA');
      if (success) {
        alert('All your study data (courses, questions, planner) have been reset.');
        setIsResetDataModalOpen(false);
        setResetConfirmInput('');
        setTimeout(() => window.location.reload(), 300);
      } else {
        alert('Failed to reset study data.');
      }
    } finally {
      setIsResetting(false);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance & Themes', icon: Sun },
    { id: 'preferences', label: 'Study Preferences', icon: Sliders },
    { id: 'email', label: 'Email & Reminders', icon: Mail },
    { id: 'data', label: 'Data & Progress', icon: Database },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in text-[#101828] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight">
          Settings & Configuration
        </h1>
        <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
          Customize your study preferences, themes, reminders, and account security.
        </p>
      </div>

      {saveStatus && (
        <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Main Settings Card with Sidebar Navigation */}
      <Card className="border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#e2e8f0] dark:divide-[#23293d]">
          {/* Settings Nav (4 cols) */}
          <div className="md:col-span-4 p-3 sm:p-4 space-y-1 bg-[#f8fafc]/50 dark:bg-[#141824]/50">
            {tabs.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-[#5b5bd6] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#101828] dark:hover:text-white hover:bg-white dark:hover:bg-[#181d2f]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Content Area (8 cols) */}
          <div className="md:col-span-8 p-6 sm:p-8">
            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Profile Settings</h3>

                <div className="flex items-center gap-4 pb-2">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-14 h-14 rounded-full border-2 border-[#5b5bd6] object-cover shadow-xs"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">{currentUser.name}</h4>
                    <p className="text-xs text-[#64748b] dark:text-[#9496a8]">{user?.email || currentUser.email}</p>
                    <Badge variant="brand" className="mt-1">{currentUser.role}</Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                    Authenticated Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || currentUser.email}
                    disabled
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#f8fafc] dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] text-[#94a3b8] cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                    Timezone
                  </label>
                  <input
                    type="text"
                    value="Asia/Kathmandu (UTC +05:45)"
                    disabled
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#f8fafc] dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] text-[#94a3b8] cursor-not-allowed"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="primary" size="sm" className="bg-[#5b5bd6] text-white font-bold">
                    Save Profile
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: APPEARANCE (3 MODES: BRIGHT, DIM, NIGHT) */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Appearance & Themes</h3>
                  <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                    Choose from 3 comfortable viewing themes. The theme applies consistently across all cards, modals, inputs, and pages.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {/* Mode 1: Bright */}
                  <button
                    type="button"
                    onClick={() => setThemeMode('bright')}
                    className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                      themeMode === 'bright' || themeMode === 'light'
                        ? 'bg-[#5b5bd6]/10 border-[#5b5bd6] text-[#5b5bd6] font-bold shadow-xs'
                        : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                    }`}
                  >
                    <Sun className="w-6 h-6 mx-auto text-amber-500" />
                    <div className="text-xs font-bold">Bright</div>
                    <p className="text-[10px] text-[#64748b]">Clean off-white & light gray with crisp contrast</p>
                  </button>

                  {/* Mode 2: Dim */}
                  <button
                    type="button"
                    onClick={() => setThemeMode('dim')}
                    className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                      themeMode === 'dim'
                        ? 'bg-[#5b5bd6]/10 border-[#5b5bd6] text-[#5b5bd6] dark:text-[#8282ea] font-bold shadow-xs'
                        : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                    }`}
                  >
                    <Clock className="w-6 h-6 mx-auto text-indigo-400" />
                    <div className="text-xs font-bold">Dim</div>
                    <p className="text-[10px] text-[#64748b]">Softer slate tones for comfortable low-light study</p>
                  </button>

                  {/* Mode 3: Night */}
                  <button
                    type="button"
                    onClick={() => setThemeMode('night')}
                    className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                      themeMode === 'night' || themeMode === 'dark'
                        ? 'bg-[#5b5bd6]/10 border-[#5b5bd6] text-[#5b5bd6] dark:text-[#8282ea] font-bold shadow-xs'
                        : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                    }`}
                  >
                    <Moon className="w-6 h-6 mx-auto text-[#5b5bd6]" />
                    <div className="text-xs font-bold">Night</div>
                    <p className="text-[10px] text-[#64748b]">Deep dark theme for night-time focus</p>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: STUDY PREFERENCES */}
            {activeTab === 'preferences' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Study Preferences</h3>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Default Daily Study Goal (Minutes)</label>
                  <input
                    type="number"
                    value={dailyGoalMinutes}
                    onChange={e => setDailyGoalMinutes(parseInt(e.target.value) || 120)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Default Focus Duration (Minutes)</label>
                    <input
                      type="number"
                      value={defaultFocusDuration}
                      onChange={e => setDefaultFocusDuration(parseInt(e.target.value) || 45)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Default Practice Qty</label>
                    <input
                      type="number"
                      value={defaultQuestionCount}
                      onChange={e => setDefaultQuestionCount(parseInt(e.target.value) || 15)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="primary" size="sm" className="bg-[#5b5bd6] text-white font-bold">
                    Save Preferences
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 4: EMAIL & REMINDERS */}
            {activeTab === 'email' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Email Reminders & Summary</h3>
                  <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                    Reminders and summaries are automatically sent to your authenticated Supabase email: <strong>{user?.email || currentUser.email}</strong>.
                  </p>
                </div>

                {testEmailStatus && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold">
                    {testEmailStatus}
                  </div>
                )}

                {/* Option 1: Daily Study Summary Email */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#23293d] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs">Daily Study Summary Email</h4>
                      <p className="text-[11px] text-[#64748b]">
                        Receive an evening email containing today's study goal, actual study minutes, study time by course, MCQs attempted, correct answers, accuracy, and planned vs completed sessions.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={dailyReportEnabled}
                      onChange={e => setDailyReportEnabled(e.target.checked)}
                      className="w-4 h-4 text-[#5b5bd6] rounded cursor-pointer"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold bg-white dark:bg-[#141824] text-[#5b5bd6] border-[#e2e8f0] dark:border-[#2b334d]"
                      leftIcon={<Send className="w-3 h-3" />}
                      onClick={handleSendTestSummaryEmail}
                      disabled={isSendingTestEmail}
                    >
                      {isSendingTestEmail ? 'Sending...' : 'Send Test Summary Email'}
                    </Button>
                  </div>
                </div>

                {/* Option 2: Pre-Study Timetable Reminders */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#23293d] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs">Pre-Study Timetable Reminders</h4>
                      <p className="text-[11px] text-[#64748b]">
                        Receive an email reminder before your scheduled planner session starts (e.g. 15 minutes before).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={studyRemindersEnabled}
                      onChange={e => setStudyRemindersEnabled(e.target.checked)}
                      className="w-4 h-4 text-[#5b5bd6] rounded cursor-pointer"
                    />
                  </div>

                  {studyRemindersEnabled && (
                    <div className="pt-2 flex items-center gap-3 text-xs">
                      <span className="font-bold text-[#64748b]">Default Reminder Time:</span>
                      <select
                        value={reminderMinutesBefore}
                        onChange={e => setReminderMinutesBefore(parseInt(e.target.value))}
                        className="px-2.5 py-1 rounded-lg bg-[#f8fafc] dark:bg-[#141824] border border-[#d0d5dd] dark:border-[#2b334d] font-bold text-xs"
                      >
                        <option value={15}>15 minutes before (Recommended)</option>
                        <option value={30}>30 minutes before</option>
                        <option value={60}>1 hour before</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: DATA & PROGRESS */}
            {activeTab === 'data' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Data & Progress Reset</h3>
                  <p className="text-xs text-[#64748b]">
                    Manage your stored cloud study data and progress records.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#23293d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-xs">Reset My Progress</h4>
                    <p className="text-[11px] text-[#64748b]">
                      Clears study sessions, attempts, and streak history. Keeps your courses, syllabus, and questions.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold text-amber-600 border-amber-300 dark:border-amber-800"
                    onClick={() => setIsResetProgressModalOpen(true)}
                  >
                    Reset Progress
                  </Button>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181d2f] border border-rose-200 dark:border-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-xs text-rose-600">Reset My Study Data (Complete Wipe)</h4>
                    <p className="text-[11px] text-[#64748b]">
                      Permanently wipes all your courses, subjects, topics, questions, and planner sessions.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                    onClick={() => setIsResetDataModalOpen(true)}
                  >
                    Reset Full Study Data
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 6: SECURITY */}
            {activeTab === 'security' && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Security & Password</h3>

                {passwordStatus && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    passwordStatus.includes('successfully') ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {passwordStatus}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="primary" size="sm" className="bg-[#5b5bd6] text-white font-bold">
                    Change Password
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>

      {/* Modal: Reset Progress Confirmation */}
      <Modal
        isOpen={isResetProgressModalOpen}
        onClose={() => setIsResetProgressModalOpen(false)}
        title="Reset Study Progress"
        size="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#64748b]">
            Are you sure you want to clear your study sessions, timer history, and practice scorecards? Your courses and questions will remain untouched.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsResetProgressModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleResetProgress} disabled={isResetting} className="bg-amber-600 text-white font-bold">
              {isResetting ? 'Resetting...' : 'Confirm Reset Progress'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Complete Wipe Confirmation */}
      <Modal
        isOpen={isResetDataModalOpen}
        onClose={() => setIsResetDataModalOpen(false)}
        title="Confirm Complete Study Data Wipe"
        size="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>WARNING: This will permanently erase all your courses, subjects, topics, questions, and timetables.</span>
          </div>

          <p className="text-[#64748b]">
            To confirm this destructive action, please type <strong>RESET</strong> below:
          </p>

          <input
            type="text"
            value={resetConfirmInput}
            onChange={e => setResetConfirmInput(e.target.value)}
            placeholder="Type RESET"
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#181d2f] border border-rose-300 dark:border-rose-900 outline-none text-center font-bold tracking-widest text-rose-600"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsResetDataModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResetStudyData}
              disabled={resetConfirmInput !== 'RESET' || isResetting}
              className="bg-rose-600 text-white font-bold"
            >
              {isResetting ? 'Wiping...' : 'Permanently Wipe Data'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
