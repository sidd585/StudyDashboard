import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useUser } from './context/UserContext';
import { AppLayout } from './components/layout/AppLayout';
import type { PageId } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Targets } from './pages/Targets';
import { Practice } from './pages/Practice';
import { PracticeSession } from './pages/PracticeSession';
import { Questions } from './pages/Questions';
import { Planner } from './pages/Planner';
import { Together } from './pages/Together';
import { Materials } from './pages/Materials';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  const { currentUser } = useUser();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [activePracticeSessionId, setActivePracticeSessionId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(undefined);

  // User's study sessions for streak calculation
  const userSessions = useLiveQuery(
    () => db.studySessions.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const studyStreak = Math.max(1, Math.min(7, Math.floor(userSessions.length / 2) + 1));

  const handleNavigate = (page: PageId, params?: any) => {
    setActivePracticeSessionId(null);
    if (params?.targetId) {
      setSelectedTargetId(params.targetId);
    } else {
      setSelectedTargetId(undefined);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderScreen = () => {
    // 1. Active Focus Practice Session
    if (activePracticeSessionId) {
      return (
        <PracticeSession
          sessionId={activePracticeSessionId}
          onFinish={() => {
            setActivePracticeSessionId(null);
            setCurrentPage('dashboard');
          }}
          onExit={() => {
            setActivePracticeSessionId(null);
            setCurrentPage('practice');
          }}
        />
      );
    }

    // 2. Simplified 8 Core Pages
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'targets':
        return <Targets />;
      case 'practice':
        return (
          <Practice
            onStartSession={sessionId => setActivePracticeSessionId(sessionId)}
            onNavigate={handleNavigate}
            initialTargetId={selectedTargetId}
          />
        );
      case 'questions':
        return <Questions />;
      case 'planner':
        return <Planner />;
      case 'together':
        return <Together />;
      case 'materials':
        return <Materials />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      studyStreak={studyStreak}
    >
      {renderScreen()}
    </AppLayout>
  );
};
