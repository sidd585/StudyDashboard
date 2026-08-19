import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import type { Profile } from '../lib/supabase';

export interface UserProfileDisplay {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'MAIN_ADMIN' | 'SUB_ADMIN' | 'USER';
  dailyGoalMinutes: number;
}

interface UserContextType {
  currentUser: UserProfileDisplay;
  profile: Profile | null;
  isAdmin: boolean;
  isSubAdmin: boolean;
  canAccessAdmin: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, role } = useAuth();

  const currentUser: UserProfileDisplay = {
    id: user?.id || 'anonymous-user',
    name: profile?.display_name || user?.email?.split('@')[0] || 'Student',
    email: user?.email || '',
    avatarUrl: profile?.avatar_url || (profile?.display_name?.toLowerCase().includes('shilpa') ? '/avatars/whale.png' : '/avatars/panda.png'),
    role: role,
    dailyGoalMinutes: profile?.daily_goal_minutes || 120,
  };

  const isAdmin = role === 'MAIN_ADMIN';
  const isSubAdmin = role === 'SUB_ADMIN';
  const canAccessAdmin = isAdmin || isSubAdmin;

  return (
    <UserContext.Provider value={{ currentUser, profile, isAdmin, isSubAdmin, canAccessAdmin }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
