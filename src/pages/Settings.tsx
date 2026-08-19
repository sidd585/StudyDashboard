import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { adminService } from '../services/adminService';
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
  const [defaultExamTimer, setDefaultExamTimer] = useState<number>(30);
  const [weekStartsOnMonday, setWeekStartsOnMonday] = useState<boolean>(true);

  // Email & Reminders
  const [dailyReportEnabled, setDailyReportEnabled] = useState(true);
  const [dailyReportTime, setDailyReportTime] = useState('22:00');
  const [studyRemindersEnabled, setStudyRemindersEnabled] = useState(true);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);

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
      } else {
        alert('Failed to reset study data.');
      }
    } finally {
      setIsResetting(false);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'preferences', label: 'Study Preferences', icon: Sliders },
    { id: 'email', label: 'Email & Reminders', icon: Mail },
    { id: 'data', label: 'Data & Progress', icon: Database },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight">
          Settings & Configuration
        </h1>
        <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
          Customize your study preferences, themes, reminders, and manage account security.
        </p>
      </div>

      {saveStatus && (
        <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Main Settings Card with Sidebar Navigation */}
      <Card className="border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs overflow-hidden">
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
                      : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white hover:bg-white dark:hover:bg-[#181d2f]'
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
                <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Profile Settings</h3>

                <div className="flex items-center gap-4 pb-2">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-14 h-14 rounded-full border-2 border-[#5b5bd6] object-cover shadow-xs"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-[#172033] dark:text-white">{currentUser.name}</h4>
                    <p className="text-xs text-[#64748b]">{currentUser.email}</p>
                    <Badge variant="neutral" size="sm" className="mt-1">{currentUser.role}</Badge>
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
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none focus:border-[#5b5bd6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                    Email Address (Read-Only)
                  </label>
                  <input
                    type="text"
                    value={currentUser.email}
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

            {/* TAB 2: APPEARANCE (Requirement 51) */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Appearance & Themes</h3>
                  <p className="text-xs text-[#64748b]">
                    Theme is applied consistently to Dashboard, sidebar, Practice, Question Bank, Planner, Together, and all modals.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                      themeMode === 'light'
                        ? 'bg-[#eef2f6] border-[#5b5bd6] text-[#5b5bd6] font-bold shadow-xs'
                        : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                    }`}
                  >
                    <Sun className="w-6 h-6 mx-auto text-amber-500" />
                    <div className="text-xs font-bold">Comfort Light</div>
                    <p className="text-[10px] text-[#64748b]">Soft gray background & readable contrast</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                      themeMode === 'dark'
                        ? 'bg-[#1f2538] border-[#5b5bd6] text-[#8282ea] font-bold shadow-xs'
                        : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                    }`}
                  >
                    <Moon className="w-6 h-6 mx-auto text-[#5b5bd6]" />
                    <div className="text-xs font-bold">Dark Theme</div>
                    <p className="text-[10px] text-[#64748b]">Sleek dark slate for low-light studying</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('system')}
                    className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                      themeMode === 'system'
                        ? 'bg-[#eef2f6] dark:bg-[#1f2538] border-[#5b5bd6] text-[#5b5bd6] font-bold shadow-xs'
                        : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                    }`}
                  >
                    <Laptop className="w-6 h-6 mx-auto text-[#64748b]" />
                    <div className="text-xs font-bold">System Default</div>
                    <p className="text-[10px] text-[#64748b]">Match your OS light/dark setting</p>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: STUDY PREFERENCES (Requirement 52) */}
            {activeTab === 'preferences' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Study Preferences</h3>

                <div className="space-y-1">
                  <label className="block text-xs font-bold">Daily Study Goal (Minutes)</label>
                  <input
                    type="number"
                    value={dailyGoalMinutes}
                    onChange={e => setDailyGoalMinutes(parseInt(e.target.value) || 120)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold">Default Focus Duration</label>
                    <input
                      type="number"
                      value={defaultFocusDuration}
                      onChange={e => setDefaultFocusDuration(parseInt(e.target.value) || 45)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold">Default Practice Qty</label>
                    <input
                      type="number"
                      value={defaultQuestionCount}
                      onChange={e => setDefaultQuestionCount(parseInt(e.target.value) || 15)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
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

            {/* TAB 4: EMAIL & REMINDERS (Requirement 53, 54) */}
            {activeTab === 'email' && (
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Email & Reminders</h3>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#23293d] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs">15-Minute Study Reminder</h4>
                      <p className="text-[11px] text-[#64748b]">Sent 15 minutes before your scheduled planner session starts</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={studyRemindersEnabled}
                      onChange={e => setStudyRemindersEnabled(e.target.checked)}
                      className="w-4 h-4 text-[#5b5bd6] rounded"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#23293d] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs">Daily Study Summary Email</h4>
                      <p className="text-[11px] text-[#64748b]">Daily evening progress report with study graph and accuracy stats</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={dailyReportEnabled}
                      onChange={e => setDailyReportEnabled(e.target.checked)}
                      className="w-4 h-4 text-[#5b5bd6] rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: DATA & PROGRESS (Requirement 55) */}
            {activeTab === 'data' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Data & Progress Reset</h3>
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
                      Permanently wipes all your courses, subjects, topics, lessons, questions, and planner sessions.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                    onClick={() => setIsResetDataModalOpen(true)}
                  >
                    Reset Study Data
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 6: SECURITY (Requirement 57) */}
            {activeTab === 'security' && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Security & Password</h3>

                {passwordStatus && (
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs font-bold text-amber-700 dark:text-amber-300">
                    {passwordStatus}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <Button type="submit" variant="primary" size="sm" className="bg-[#5b5bd6] text-white font-bold">
                    Change Password
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-rose-600 border-rose-200 font-bold"
                    onClick={() => signOut()}
                  >
                    Sign Out All Devices
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>

      {/* ================= MODAL: RESET PROGRESS CONFIRM ================= */}
      {isResetProgressModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResetProgressModalOpen(false)}
          title="Confirm Reset Progress"
          size="sm"
        >
          <div className="space-y-4 text-[#172033] dark:text-[#f8f9fc] text-center">
            <p className="text-xs text-[#64748b]">
              Are you sure you want to reset your study session history and quiz attempts? Your courses and questions will NOT be deleted.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsResetProgressModalOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" className="bg-amber-600 text-white font-bold" onClick={handleResetProgress} disabled={isResetting}>
                {isResetting ? 'Resetting...' : 'Yes, Reset Progress'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: RESET STUDY DATA CONFIRM (Type RESET) ================= */}
      {isResetDataModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResetDataModalOpen(false)}
          title="Wipe All Study Data"
          size="sm"
        >
          <div className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
            <p className="text-xs text-rose-600 font-semibold">
              Warning: This will permanently delete all your courses, subjects, syllabus topics, questions, and planner sessions.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold">
                Type <code>RESET</code> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={e => setResetConfirmInput(e.target.value)}
                placeholder="RESET"
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-rose-400 font-bold outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsResetDataModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
                onClick={handleResetStudyData}
                disabled={resetConfirmInput !== 'RESET' || isResetting}
              >
                {isResetting ? 'Wiping...' : 'Confirm Wipe'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
