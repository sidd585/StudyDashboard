import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  BookOpenCheck,
  HelpCircle,
  Calendar,
  Users2,
  Settings,
  ShieldAlert,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';

export type PageId =
  | 'dashboard'
  | 'courses'
  | 'practice'
  | 'questions'
  | 'planner'
  | 'together'
  | 'settings'
  | 'admin';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const { currentUser, isMainAdmin, isSubAdmin, canAccessAdmin, canAccessTogether } = useUser();
  const { signOut } = useAuth();

  const navItems: {
    id: PageId;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string;
    show: boolean;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { id: 'courses', label: 'My Courses', icon: BookOpen, show: true },
    { id: 'practice', label: 'Practice', icon: BookOpenCheck, show: true },
    { id: 'questions', label: 'Question Bank', icon: HelpCircle, show: true },
    { id: 'planner', label: 'Planner', icon: Calendar, show: true },
    { id: 'together', label: 'Together', icon: Users2, badge: 'Shared', show: canAccessTogether },
    { id: 'settings', label: 'Settings', icon: Settings, show: true },
    { id: 'admin', label: 'Admin', icon: ShieldAlert, badge: isMainAdmin ? 'Main' : 'Sub', show: canAccessAdmin },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shrink-0 h-screen sticky top-0 transition-colors">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#23293d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5b5bd6] to-[#4a4ac9] flex items-center justify-center shadow-xs text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#172033] dark:text-[#f8f9fc]">StudyDashboard</span>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8]">Personal Study Cloud</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.filter(item => item.show).map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-[#eef2f6] dark:bg-[#1f2538] text-[#5b5bd6] dark:text-[#8282ea] font-bold'
                  : 'text-[#64748b] dark:text-[#9496a8] hover:text-[#172033] dark:hover:text-white hover:bg-[#f8fafc] dark:hover:bg-[#181d2f]/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#5b5bd6] dark:text-[#8282ea]' : 'text-[#64748b] dark:text-[#9496a8]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-[#5b5bd6]/10 text-[#5b5bd6] dark:text-[#8282ea]' : 'bg-[#eef2f6] dark:bg-[#1f2538] text-[#64748b]'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Authenticated User Profile & Logout */}
      <div className="p-4 border-t border-[#e2e8f0] dark:border-[#23293d] bg-[#f8fafc] dark:bg-[#0d0f18]/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-9 h-9 rounded-full border border-[#e2e8f0] dark:border-[#2b334d] bg-white dark:bg-[#141824] object-cover shadow-xs"
            />
            <div className="max-w-[130px] truncate">
              <p className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc] leading-none truncate">{currentUser.name}</p>
              <p className="text-[11px] text-[#64748b] dark:text-[#9496a8] mt-1 truncate">{currentUser.email || currentUser.role}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-[#141824] hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-[#e2e8f0] dark:border-[#23293d] shadow-xs transition-colors"
          title="Sign out of StudyDashboard"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
