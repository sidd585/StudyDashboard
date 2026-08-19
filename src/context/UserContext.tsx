import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { relationshipService } from '../services/relationshipService';
import type { Profile } from '../lib/supabase';
import type { UserProfileDisplay } from '../types';

interface UserContextType {
  currentUser: UserProfileDisplay;
  profile: Profile | null;
  isAdmin: boolean;
  isMainAdmin: boolean;
  isSubAdmin: boolean;
  isAdminFriend: boolean;
  isApproved: boolean;
  canAccessAdmin: boolean;
  canAccessTogether: boolean;
  refreshFriendStatus: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, role, status, isApproved } = useAuth();
  const [hasActiveFriendRelationship, setHasActiveFriendRelationship] = useState(false);

  const checkFriendStatus = async () => {
    if (!user) {
      setHasActiveFriendRelationship(false);
      return;
    }
    const partner = await relationshipService.getActivePartner();
    setHasActiveFriendRelationship(Boolean(partner));
  };

  useEffect(() => {
    checkFriendStatus();
  }, [user?.id, role]);

  const currentUser: UserProfileDisplay = {
    id: user?.id || 'anonymous-user',
    name: profile?.display_name || user?.email?.split('@')[0] || 'Student',
    email: user?.email || '',
    avatarUrl: profile?.avatar_url || (profile?.display_name?.toLowerCase().includes('shilpa') ? '/avatars/whale.png' : '/avatars/panda.png'),
    role: role,
    status: status,
    dailyGoalMinutes: profile?.daily_goal_minutes || 120,
    managedBy: profile?.managed_by,
    visibleToSubAdmin: profile?.visible_to_sub_admin !== false,
  };

  const isMainAdmin = role === 'MAIN_ADMIN';
  const isSubAdmin = role === 'SUB_ADMIN';
  const isAdminFriend = role === 'FRIEND' || (hasActiveFriendRelationship && !isMainAdmin);
  const canAccessAdmin = isMainAdmin || isSubAdmin;
  const canAccessTogether = isMainAdmin || isSubAdmin || role === 'FRIEND' || isAdminFriend || hasActiveFriendRelationship;

  return (
    <UserContext.Provider
      value={{
        currentUser,
        profile,
        isAdmin: isMainAdmin,
        isMainAdmin,
        isSubAdmin,
        isAdminFriend,
        isApproved,
        canAccessAdmin,
        canAccessTogether,
        refreshFriendStatus: checkFriendStatus,
      }}
    >
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
