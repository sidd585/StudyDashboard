import React, { createContext, useContext, useState, useEffect } from 'react';
import { USER_PROFILES, type ActiveUserProfile, type UserProfile } from '../lib/supabase';
import { seedNepalInitialData, resetAllProgressToZero } from '../db/seed';

interface UserContextType {
  activeProfileKey: ActiveUserProfile;
  currentUser: UserProfile;
  switchUser: (profile: ActiveUserProfile) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProfileKey, setActiveProfileKey] = useState<ActiveUserProfile>(() => {
    const raw = localStorage.getItem('studydashboard_active_user') || localStorage.getItem('studyos_active_user');
    if (raw === 'shilpa' || raw === 'user2') return 'shilpa';
    return 'siddhartha';
  });

  const currentUser = USER_PROFILES[activeProfileKey] || USER_PROFILES.siddhartha;

  const switchUser = (profile: ActiveUserProfile) => {
    setActiveProfileKey(profile);
    localStorage.setItem('studydashboard_active_user', profile);
  };

  useEffect(() => {
    // Reset to clean Day 0 state (targets & questions preserved, sessions & streaks reset to 0)
    const SEED_VERSION = 'studydashboard_clean_day0_v5';
    const lastSeed = localStorage.getItem('studydashboard_seed_version');
    if (lastSeed !== SEED_VERSION) {
      seedNepalInitialData(true).then(async () => {
        await resetAllProgressToZero('all');
        localStorage.setItem('studydashboard_seed_version', SEED_VERSION);
      });
    } else {
      seedNepalInitialData(false);
    }
  }, []);

  return (
    <UserContext.Provider value={{ activeProfileKey, currentUser, switchUser }}>
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
