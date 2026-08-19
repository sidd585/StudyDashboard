import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile, type ApplicationRole, type AccountStatus } from '../lib/supabase';

export const MAIN_ADMIN_EMAILS = [
  'sid.paudel585@gmail.com',
  'siddharthapaudel585@gmail.com',
  'siddhartha@studydashboard.local',
];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: ApplicationRole;
  status: AccountStatus;
  isApproved: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string, dailyGoalMinutes?: number) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch cloud profile from public.profiles
  const fetchProfile = useCallback(async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Profile fetch note:', error.message);
      }

      if (data) {
        setProfile(data as Profile);
      } else {
        const cleanEmail = userEmail.toLowerCase().trim();
        const isSuperAdminEmail = MAIN_ADMIN_EMAILS.includes(cleanEmail);
        const role: ApplicationRole = isSuperAdminEmail ? 'MAIN_ADMIN' : 'USER';
        const status: AccountStatus = isSuperAdminEmail ? 'ACTIVE' : 'PENDING_APPROVAL';
        const avatar = cleanEmail.includes('shilpa') ? '/avatars/whale.png' : '/avatars/panda.png';
        const displayName = cleanEmail.split('@')[0];

        const initialProfile: Profile = {
          id: userId,
          email: cleanEmail,
          display_name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
          role,
          status,
          visible_to_sub_admin: true,
          daily_goal_minutes: 120,
          timezone: 'Asia/Kathmandu',
          avatar_url: avatar,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          const { data: savedProfile } = await supabase
            .from('profiles')
            .upsert(initialProfile, { onConflict: 'id' })
            .select('*')
            .single();

          if (savedProfile) {
            setProfile(savedProfile as Profile);
          } else {
            setProfile(initialProfile);
          }
        } catch {
          setProfile(initialProfile);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  }, []);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email ?? '');
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfile(newSession.user.id, newSession.user.email ?? '');
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user.email ?? '');
    }
  }, [user, fetchProfile]);

  const signIn = async (email: string, password: string, rememberMe = true) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Login failed. Please check your credentials.' };
    }
  };

  const signUp = async (email: string, password: string, displayName: string, dailyGoalMinutes = 120) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: displayName.trim() || cleanEmail.split('@')[0],
            daily_goal_minutes: dailyGoalMinutes,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const isSuperAdminEmail = MAIN_ADMIN_EMAILS.includes(cleanEmail);
        const role: ApplicationRole = isSuperAdminEmail ? 'MAIN_ADMIN' : 'USER';
        const status: AccountStatus = isSuperAdminEmail ? 'ACTIVE' : 'PENDING_APPROVAL';
        const avatar = cleanEmail.includes('shilpa') ? '/avatars/whale.png' : '/avatars/panda.png';

        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: cleanEmail,
            display_name: displayName.trim() || cleanEmail.split('@')[0],
            role,
            status,
            visible_to_sub_admin: true,
            daily_goal_minutes: dailyGoalMinutes,
            timezone: 'Asia/Kathmandu',
            avatar_url: avatar,
          }, { onConflict: 'id' });
        } catch (profileErr) {
          console.warn('Profile creation note:', profileErr);
        }

        await fetchProfile(data.user.id, data.user.email ?? '');
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Sign up failed.' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/reset-password` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to send password reset email.' };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update password.' };
    }
  };

  const role: ApplicationRole = profile?.role || 'USER';
  const status: AccountStatus = profile?.status || 'PENDING_APPROVAL';
  const isApproved: boolean = status === 'ACTIVE' || role === 'MAIN_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        status,
        isApproved,
        isLoading,
        signIn,
        signUp,
        signOut,
        sendPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
