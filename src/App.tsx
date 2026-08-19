import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
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
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { migrationService } from './services/migrationService';
import { applyDailyTheme } from './utils/dailyTheme';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Sparkles, ArrowRight } from 'lucide-react';

type AuthView = 'login' | 'signup' | 'forgot_password';

export const App: React.FC = () => {
  const { session, user, isLoading } = useAuth();
  const { currentUser, canAccessAdmin } = useUser();

  const [authView, setAuthView] = useState<AuthView>('login');
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [activePracticeSessionId, setActivePracticeSessionId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(undefined);
  const [migrationAvailable, setMigrationAvailable] = useState(false);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    applyDailyTheme();
  }, []);

  // Check if there is existing local data to migrate to Supabase Cloud
  useEffect(() => {
    if (session && user) {
      migrationService.checkLocalDataCounts().then(counts => {
        if (counts.targets > 0 || counts.questions > 0) {
          const hasMigrated = localStorage.getItem(`studydashboard_migrated_${user.id}`);
          if (!hasMigrated) {
            setMigrationAvailable(true);
          }
        }
      });
    }
  }, [session, user]);

  const handleRunMigration = async () => {
    if (!user) return;
    setMigrating(true);
    const res = await migrationService.migrateLocalToCloud();
    if (res.success) {
      localStorage.setItem(`studydashboard_migrated_${user.id}`, 'true');
      setMigrationAvailable(false);
    }
    setMigrating(false);
  };

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

  // 1. Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f6fa] dark:bg-[#0d0f18] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5b5bd6] to-[#4a4ac9] text-white flex items-center justify-center shadow-md animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-[#64748b] dark:text-[#9496a8]">Loading StudyDashboard...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Auth Screens
  if (!session) {
    if (authView === 'signup') {
      return <SignUp onNavigateLogin={() => setAuthView('login')} />;
    }
    if (authView === 'forgot_password') {
      return <ForgotPassword onNavigateLogin={() => setAuthView('login')} />;
    }
    return (
      <Login
        onNavigateSignUp={() => setAuthView('signup')}
        onNavigateForgotPassword={() => setAuthView('forgot_password')}
      />
    );
  }

  // 3. Authenticated App Pages
  const renderScreen = () => {
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
        return <Questions onNavigate={handleNavigate} />;
      case 'planner':
        return <Planner />;
      case 'together':
        return <Together />;
      case 'materials':
        return <Materials />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <Admin />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      studyStreak={1}
    >
      {/* Optional One-Time Local to Cloud Data Migration Banner */}
      {migrationAvailable && (
        <div className="mb-6 p-4 rounded-2xl bg-[#f4ebff] dark:bg-[#2c1c5f] border border-[#e9d7fe] dark:border-[#53389e] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-xs font-bold text-[#6941c6] dark:text-[#d6bbfb]">
              Local Study Data Found on Device
            </p>
            <p className="text-[11px] text-[#475467] dark:text-[#9496a8]">
              Would you like to sync your existing questions and courses into your new permanent Supabase Cloud account?
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMigrationAvailable(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#64748b] hover:text-[#101828]"
            >
              Dismiss
            </button>
            <button
              onClick={handleRunMigration}
              disabled={migrating}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#7f56d9] hover:bg-[#6941c6] text-white shadow-xs inline-flex items-center gap-1"
            >
              <span>{migrating ? 'Syncing...' : 'Sync to Cloud'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <ErrorBoundary fallbackTitle="Unable to load page">
        {renderScreen()}
      </ErrorBoundary>
    </AppLayout>
  );
};
