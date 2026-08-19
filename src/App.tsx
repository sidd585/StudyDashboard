import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useUser } from './context/UserContext';
import { AppLayout } from './components/layout/AppLayout';
import type { PageId } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Courses } from './pages/Courses';
import { Practice } from './pages/Practice';
import { PracticeSession } from './pages/PracticeSession';
import { Questions } from './pages/Questions';
import { Planner } from './pages/Planner';
import { Together } from './pages/Together';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { migrationService } from './services/migrationService';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Sparkles, ArrowRight, Clock, ShieldAlert, LogOut, RotateCcw } from 'lucide-react';
import type { CloudQuestion } from './lib/supabase';
import type { QuizConfig } from './types';

type AuthView = 'login' | 'signup' | 'forgot_password';

export const App: React.FC = () => {
  const { session, user, isLoading, isApproved, status, refreshProfile, signOut } = useAuth();
  const { currentUser, isMainAdmin } = useUser();

  const [authView, setAuthView] = useState<AuthView>('login');
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [activePracticePayload, setActivePracticePayload] = useState<{
    config: QuizConfig;
    questions: CloudQuestion[];
  } | null>(null);

  const [practiceInitialCourseId, setPracticeInitialCourseId] = useState<string | undefined>(undefined);
  const [migrationAvailable, setMigrationAvailable] = useState(false);
  const [migrating, setMigrating] = useState(false);

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
    setActivePracticePayload(null);
    if (params?.courseId) {
      setPracticeInitialCourseId(params.courseId);
    } else {
      setPracticeInitialCourseId(undefined);
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

  // 3. User Registered but PENDING APPROVAL (Requirement 64)
  if (!isApproved && status === 'PENDING_APPROVAL') {
    return (
      <div className="min-h-screen bg-[#f4f6fa] dark:bg-[#0d0f18] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] shadow-sm text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc]">
              Approval Required
            </h2>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8] leading-relaxed">
              Account created successfully. Your account is waiting for administrator approval. Please contact the administrator.
            </p>
          </div>

          <div className="p-3 bg-[#f8fafc] dark:bg-[#181d2f] rounded-2xl border border-[#e2e8f0] dark:border-[#2b334d] text-xs space-y-1">
            <p className="text-[#64748b]">Registered Account:</p>
            <p className="font-bold text-[#172033] dark:text-white">{user?.email}</p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => refreshProfile()}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-xs flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Check Approval Status</span>
            </button>

            <button
              onClick={() => signOut()}
              className="w-full py-2 px-4 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. User Deactivated
  if (status === 'DEACTIVATED') {
    return (
      <div className="min-h-screen bg-[#f4f6fa] dark:bg-[#0d0f18] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-[#141824] border border-rose-200 dark:border-rose-950 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-[#172033] dark:text-white">Account Deactivated</h2>
          <p className="text-xs text-[#64748b]">
            Your access has been deactivated by an administrator. Please contact your admin for assistance.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-2 px-4 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // 5. Authenticated App Pages
  const renderScreen = () => {
    if (activePracticePayload) {
      return (
        <PracticeSession
          sessionPayload={activePracticePayload}
          onFinish={() => {
            setActivePracticePayload(null);
            setCurrentPage('dashboard');
          }}
          onExit={() => {
            setActivePracticePayload(null);
            setCurrentPage('practice');
          }}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'courses':
        return <Courses />;
      case 'practice':
        return (
          <Practice
            onStartSession={payload => setActivePracticePayload(payload)}
            onNavigate={handleNavigate}
            initialCourseId={practiceInitialCourseId}
          />
        );
      case 'questions':
        return <Questions onNavigate={handleNavigate} />;
      case 'planner':
        return <Planner />;
      case 'together':
        return <Together />;
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
      {/* Migration Sync Banner */}
      {migrationAvailable && (
        <div className="mb-6 p-4 rounded-2xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#cbd5e1] dark:border-[#2b334d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea]">
              Local Study Data Found on Device
            </p>
            <p className="text-[11px] text-[#64748b] dark:text-[#9496a8]">
              Would you like to sync your existing questions and courses into your new permanent Supabase Cloud account?
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMigrationAvailable(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#64748b] hover:text-[#172033]"
            >
              Dismiss
            </button>
            <button
              onClick={handleRunMigration}
              disabled={migrating}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-xs inline-flex items-center gap-1"
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
