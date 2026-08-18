import React from 'react';
import {
  Timer,
  Sun,
  Moon,
  ArrowLeftRight,
  Flame,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useStudyTimer } from '../../context/StudyTimerContext';
import type { PageId } from './Sidebar';

interface HeaderProps {
  currentPage: PageId;
  studyStreak?: number;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, studyStreak = 1 }) => {
  const { theme, toggleTheme } = useTheme();
  const { activeProfileKey, currentUser, switchUser } = useUser();
  const { openModal, isRunning, activeTargetName, formattedTime } = useStudyTimer();

  const pageTitles: Record<PageId, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: `Welcome back, ${currentUser.name}. Track your daily targets.` },
    targets: { title: 'My Targets', subtitle: 'Manage your competitive exams, college courses, subjects & topics.' },
    practice: { title: 'MCQ Practice', subtitle: 'Solve targeted questions with instant feedback and explanations.' },
    questions: { title: 'Question Bank', subtitle: 'Upload PDFs, images, or enter MCQs with mandatory review.' },
    planner: { title: 'Study Planner', subtitle: 'Schedule focused study sessions and automated email reminders.' },
    together: { title: 'Study Together', subtitle: 'Side-by-side progress comparison for Siddhartha & Shilpa.' },
    materials: { title: 'Syllabus & Materials', subtitle: 'Upload and view syllabus PDFs, notes, and study resources.' },
    settings: { title: 'Settings', subtitle: 'Manage email reminders (15m before & 10 PM summary) and preferences.' },
  };

  const currentInfo = pageTitles[currentPage] || { title: 'StudyDashboard', subtitle: 'Study & Exam Tracker' };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          {currentInfo.title}
          {currentPage === 'together' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Siddhartha & Shilpa
            </span>
          )}
        </h1>
        <p className="text-xs text-slate-400 hidden sm:block">{currentInfo.subtitle}</p>
      </div>

      {/* Header Controls */}
      <div className="flex items-center gap-3">
        {/* Streak Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>{studyStreak} Day Streak</span>
        </div>

        {/* Global Study Timer Trigger */}
        <button
          onClick={openModal}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isRunning
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse shadow-md shadow-emerald-500/20'
              : 'bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20'
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>{isRunning ? `${activeTargetName || 'Studying'}: ${formattedTime}` : 'Start Study'}</span>
        </button>

        {/* User Switch Pill */}
        <button
          onClick={() => switchUser(activeProfileKey === 'siddhartha' ? 'shilpa' : 'siddhartha')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
          title="Switch view between Siddhartha and Shilpa"
        >
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.name}
            className="w-4 h-4 rounded-full"
          />
          <span className="hidden md:inline">{currentUser.name}</span>
          <ArrowLeftRight className="w-3 h-3 text-slate-400" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>
      </div>
    </header>
  );
};
