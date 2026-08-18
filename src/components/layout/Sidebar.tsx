import React from 'react';
import {
  LayoutDashboard,
  Target as TargetIcon,
  BookOpenCheck,
  HelpCircle,
  Calendar,
  Users2,
  FolderArchive,
  Settings,
  Sparkles,
  ArrowLeftRight,
} from 'lucide-react';
import { useUser } from '../../context/UserContext';

export type PageId =
  | 'dashboard'
  | 'targets'
  | 'practice'
  | 'questions'
  | 'planner'
  | 'together'
  | 'materials'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const { activeProfileKey, currentUser, switchUser } = useUser();

  const navItems: { id: PageId; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'targets', label: 'My Targets', icon: TargetIcon },
    { id: 'practice', label: 'Practice', icon: BookOpenCheck },
    { id: 'questions', label: 'Question Bank', icon: HelpCircle },
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'together', label: 'Together', icon: Users2, badge: 'Shared' },
    { id: 'materials', label: 'Materials', icon: FolderArchive },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">StudyDashboard</span>
            </div>
            <p className="text-xs text-slate-400">Two-Person Study Tracker</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-brand-500/20 text-brand-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active User Switcher / Profile Box */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800"
            />
            <div>
              <p className="text-sm font-semibold text-white leading-none">{currentUser.name}</p>
              <p className="text-[11px] text-slate-400 mt-1">Active Profile</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => switchUser(activeProfileKey === 'siddhartha' ? 'shilpa' : 'siddhartha')}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          title="Switch view between Siddhartha and Shilpa"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-brand-400" />
          <span>Switch to {activeProfileKey === 'siddhartha' ? 'Shilpa' : 'Siddhartha'}</span>
        </button>
      </div>
    </aside>
  );
};
