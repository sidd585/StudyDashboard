import React, { createContext, useContext, useState, useEffect } from 'react';
import { USER_PROFILES, type ActiveUserProfile, type UserProfile } from '../lib/supabase';
import { seedNepalInitialData } from '../db/seed';

interface UserContextType {
  activeProfileKey: ActiveUserProfile;
  currentUser: UserProfile;
  switchUser: (profile: ActiveUserProfile) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProfileKey, setActiveProfileKey] = useState<ActiveUserProfile>(() => {
    const saved = localStorage.getItem('studydashboard_active_user') as ActiveUserProfile;
    return saved && USER_PROFILES[saved] ? saved : 'siddhartha';
  });

  const currentUser = USER_PROFILES[activeProfileKey] || USER_PROFILES.siddhartha;

  const switchUser = (profile: ActiveUserProfile) => {
    setActiveProfileKey(profile);
    localStorage.setItem('studydashboard_active_user', profile);
  };

  useEffect(() => {
    seedNepalInitialData(false);
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
