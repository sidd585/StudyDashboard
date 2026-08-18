import React from 'react';
import {
  LayoutDashboard,
  Target as TargetIcon,
  BookOpenCheck,
  Calendar,
  Users2,
} from 'lucide-react';
import type { PageId } from './Sidebar';

interface MobileNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentPage, onNavigate }) => {
  const items: { id: PageId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'targets', label: 'Targets', icon: TargetIcon },
    { id: 'practice', label: 'Practice', icon: BookOpenCheck },
    { id: 'together', label: 'Together', icon: Users2 },
    { id: 'planner', label: 'Planner', icon: Calendar },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex items-center justify-around">
      {items.map(item => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
              isActive ? 'text-brand-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
