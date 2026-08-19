import React from 'react';
import { Sidebar, type PageId } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import { StudyTimerModal } from './StudyTimerModal';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: PageId;
  onNavigate: (page: PageId, params?: any) => void;
  studyStreak?: number;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentPage,
  onNavigate,
  studyStreak = 1,
}) => {
  return (
    <div className="min-h-screen bg-[#f4f6fa] dark:bg-[#0d0f18] text-[#172033] dark:text-[#f8f9fc] flex flex-col lg:flex-row antialiased selection:bg-[#5b5bd6] selection:text-white transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Header currentPage={currentPage} onNavigate={onNavigate} studyStreak={studyStreak} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav currentPage={currentPage} onNavigate={onNavigate} />

      {/* Global Study Timer Modal */}
      <StudyTimerModal
        onNavigatePractice={(courseId) => onNavigate('practice', { courseId })}
      />
    </div>
  );
};
