import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  BookOpenCheck,
  Calendar,
  HelpCircle,
  Users2,
} from 'lucide-react';
import type { PageId } from './Sidebar';
import { useUser } from '../../context/UserContext';

interface MobileNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentPage, onNavigate }) => {
  const { canAccessTogether } = useUser();

  const items: { id: PageId; label: string; icon: React.FC<{ className?: string }>; show: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { id: 'courses', label: 'Courses', icon: BookOpen, show: true },
    { id: 'practice', label: 'Practice', icon: BookOpenCheck, show: true },
    { id: 'questions', label: 'Bank', icon: HelpCircle, show: true },
    { id: 'planner', label: 'Planner', icon: Calendar, show: true },
    { id: 'together', label: 'Together', icon: Users2, show: canAccessTogether },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#141824]/95 backdrop-blur-md border-t border-[#e2e8f0] dark:border-[#23293d] px-2 py-2 flex items-center justify-around">
      {items.filter(i => i.show).map(item => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${
              isActive
                ? 'text-[#5b5bd6] dark:text-[#8282ea]'
                : 'text-[#64748b] dark:text-[#9496a8] hover:text-[#172033] dark:hover:text-white'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-[#5b5bd6] dark:text-[#8282ea]' : 'text-[#64748b] dark:text-[#9496a8]'}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
