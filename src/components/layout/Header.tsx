import React, { useState } from 'react';
import {
  Timer,
  Sun,
  Moon,
  Flame,
  Settings,
  ShieldAlert,
  LogOut,
  ChevronDown,
  Users2,
  BookOpen,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { useStudyTimer } from '../../context/StudyTimerContext';
import type { PageId } from './Sidebar';

interface HeaderProps {
  currentPage: PageId;
  onNavigate?: (page: PageId) => void;
  studyStreak?: number;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, studyStreak = 1 }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, isMainAdmin, canAccessAdmin, canAccessTogether } = useUser();
  const { signOut } = useAuth();
  const { openModal, isRunning, isPaused, activeCourseName, formattedTime } = useStudyTimer();
  const [profileOpen, setProfileOpen] = useState(false);

  const pageTitles: Record<PageId, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: `Welcome back, ${currentUser.name}.` },
    courses: { title: 'My Courses', subtitle: 'Manage your courses, papers, syllabus, topics & lessons.' },
    practice: { title: 'MCQ Practice', subtitle: 'Solve targeted questions with instant scoring and explanations.' },
    questions: { title: 'Question Bank', subtitle: 'MCQs and subjective question paper archives.' },
    planner: { title: 'Study Planner', subtitle: 'Schedule weekly study sessions with automated reminders.' },
    together: { title: 'Study Together', subtitle: 'Compare study statistics with your study partner.' },
    settings: { title: 'Settings', subtitle: 'Manage appearance, study preferences, and account data.' },
    admin: { title: 'Admin Console', subtitle: isMainAdmin ? 'Manage users, approvals, sub-admins, and friends.' : 'Manage assigned study users.' },
  };

  const currentInfo = pageTitles[currentPage] || { title: 'StudyDashboard', subtitle: 'Personal Study Cloud' };

  return (
    <header className="h-16 border-b border-[#e2e8f0] dark:border-[#23293d] bg-white/95 dark:bg-[#141824]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-lg font-bold text-[#172033] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
          {currentInfo.title}
          {currentPage === 'together' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#5b5bd6]/10 text-[#5b5bd6] border border-[#5b5bd6]/20">
              Private Room
            </span>
          )}
        </h1>
        <p className="text-xs text-[#64748b] dark:text-[#9496a8] hidden sm:block">{currentInfo.subtitle}</p>
      </div>

      {/* Header Controls */}
      <div className="flex items-center gap-2.5">
        {/* Streak Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-bold">
          <Flame className="w-4 h-4 text-amber-500" />
          <span>{studyStreak} Day Streak</span>
        </div>

        {/* Global Study Timer Trigger with Light/Dark theme support */}
        <button
          onClick={openModal}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
            isRunning
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 animate-pulse'
              : isPaused
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
              : 'bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-indigo-500/20'
          }`}
          title={isRunning || isPaused ? 'Open focus timer' : 'Start a focused study session'}
        >
          <Timer className="w-4 h-4" />
          <span>
            {isRunning
              ? `● ${activeCourseName || 'Focus'}: ${formattedTime}`
              : isPaused
              ? `❚❚ ${activeCourseName || 'Paused'}: ${formattedTime}`
              : 'Focus Now'}
          </span>
        </button>

        {/* User Profile Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#f8fafc] hover:bg-[#eef2f6] dark:bg-[#181d2f] dark:hover:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] transition-colors"
          >
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-5 h-5 rounded-full object-cover border border-[#e2e8f0] dark:border-slate-600 shadow-xs"
            />
            <span className="font-bold text-[#172033] dark:text-white max-w-[90px] truncate">{currentUser.name}</span>
            <ChevronDown className="w-3 h-3 text-[#64748b]" />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] shadow-lg py-1.5 z-50 animate-fade-in"
              onMouseLeave={() => setProfileOpen(false)}
            >
              <div className="px-3.5 py-2 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <p className="text-xs font-bold text-[#172033] dark:text-[#f8f9fc] truncate">{currentUser.name}</p>
                <p className="text-[10px] text-[#64748b] dark:text-[#9496a8] truncate">{currentUser.email || currentUser.role}</p>
              </div>

              {onNavigate && (
                <>
                  <button
                    onClick={() => { onNavigate('settings'); setProfileOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#334155] dark:text-[#cbd5e1] hover:bg-[#f8fafc] dark:hover:bg-[#181d2f] flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#64748b]" />
                    <span>Settings</span>
                  </button>

                  {canAccessTogether && (
                    <button
                      onClick={() => { onNavigate('together'); setProfileOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#334155] dark:text-[#cbd5e1] hover:bg-[#f8fafc] dark:hover:bg-[#181d2f] flex items-center gap-2"
                    >
                      <Users2 className="w-3.5 h-3.5 text-[#64748b]" />
                      <span>Study Together</span>
                    </button>
                  )}

                  {canAccessAdmin && (
                    <button
                      onClick={() => { onNavigate('admin'); setProfileOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#5b5bd6] dark:text-[#8282ea] font-bold hover:bg-[#f8fafc] dark:hover:bg-[#181d2f] flex items-center gap-2"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Admin Console</span>
                    </button>
                  )}
                </>
              )}

              <div className="border-t border-[#e2e8f0] dark:border-[#23293d] mt-1 pt-1">
                <button
                  onClick={() => { signOut(); setProfileOpen(false); }}
                  className="w-full text-left px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-[#64748b] dark:text-[#9496a8] hover:bg-[#f8fafc] dark:hover:bg-[#181d2f] transition-colors border border-[#e2e8f0] dark:border-[#23293d]"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#5b5bd6]" />}
        </button>
      </div>
    </header>
  );
};
