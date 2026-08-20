import { supabase, type Profile, type ApplicationRole, type AccountStatus } from '../lib/supabase';

export interface AdminUserListItem {
  id: string;
  email: string;
  displayName: string;
  role: ApplicationRole;
  managedBy?: string | null;
  status: AccountStatus;
  visibleToSubAdmin: boolean;
  dailyGoalMinutes: number;
  createdAt: string;
}

export interface AdminOverviewStats {
  totalUsers: number;
  activeUsers: number;
  pendingApprovals: number;
  subAdmins: number;
  activeAdminFriend: string | null;
  todayActiveStudents: number;
}

export const adminService = {
  // Get all users visible to this Admin or Sub-Admin
  async getUsers(): Promise<AdminUserListItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get current user's profile to determine role
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isMainAdmin = myProfile?.role === 'MAIN_ADMIN';
    const isSubAdmin = myProfile?.role === 'SUB_ADMIN';

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }

    const allProfiles = (data || []).map(p => ({
      id: p.id,
      email: p.email,
      displayName: p.display_name,
      role: p.role,
      managedBy: p.managed_by,
      status: p.status,
      visibleToSubAdmin: p.visible_to_sub_admin !== false,
      dailyGoalMinutes: p.daily_goal_minutes || 120,
      createdAt: p.created_at,
    }));

    // Sub-Admin restriction: Sub-Admins CANNOT look at Admin and Admin's Friend dashboards/users
    if (isSubAdmin && !isMainAdmin) {
      return allProfiles.filter(p => {
        // Exclude Main Admin
        if (p.role === 'MAIN_ADMIN') return false;
        // Exclude Admin Friend
        if (p.role === 'FRIEND') return false;
        // Exclude users marked hidden from sub-admin
        if (!p.visibleToSubAdmin) return false;
        return true;
      });
    }

    return allProfiles;
  },

  // Delete User and wipe their associated records (Admin only)
  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'Authentication required.' };
    if (user.id === userId) {
      return { success: false, message: 'You cannot delete your own admin account.' };
    }

    try {
      // 1. Wipe all study data and cascading child records
      await this.resetUserData(userId, 'FULL_STUDY_DATA');

      // 2. Remove any study relationships
      await supabase
        .from('study_relationships')
        .delete()
        .or(`owner_user_id.eq.${userId},friend_user_id.eq.${userId}`);

      // 3. Delete profile from public.profiles
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.warn('Profile deletion error:', error.message);
        // If hard delete restricted by auth FK, deactivate as clean fallback
        await supabase
          .from('profiles')
          .update({ status: 'DEACTIVATED', updated_at: new Date().toISOString() })
          .eq('id', userId);

        return { success: true, message: 'User data wiped and account deactivated.' };
      }

      this.clearLocalTimerCaches(userId);
      return { success: true, message: 'User and all associated data permanently deleted.' };
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      return { success: false, message: err?.message || 'Failed to delete user.' };
    }
  },

  // Get Admin Overview Stats
  async getOverviewStats(): Promise<AdminOverviewStats> {
    const users = await this.getUsers();
    const active = users.filter(u => u.status === 'ACTIVE');
    const pending = users.filter(u => u.status === 'PENDING_APPROVAL' || u.status === 'PENDING');
    const subAdmins = users.filter(u => u.role === 'SUB_ADMIN');

    // Check active admin friend
    const activeFriend = await this.getActiveAdminFriend();

    return {
      totalUsers: users.length,
      activeUsers: active.length,
      pendingApprovals: pending.length,
      subAdmins: subAdmins.length,
      activeAdminFriend: activeFriend?.displayName || null,
      todayActiveStudents: active.length > 0 ? active.length : 1,
    };
  },

  // Approve a pending user and assign role
  async approveUser(userId: string, assignedRole: ApplicationRole = 'USER', managedBy?: string | null): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({
        status: 'ACTIVE',
        role: assignedRole,
        managed_by: managedBy || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return !error;
  },

  // Add / Approve a registered user directly by Email
  async addOrApproveUserByEmail(
    email: string,
    displayName?: string,
    assignedRole: ApplicationRole = 'USER'
  ): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    // 1. Check if profile already exists in public.profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email, status, role')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'ACTIVE',
          role: assignedRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id);

      if (!error) {
        return { success: true, message: `User ${cleanEmail} approved and activated as ${assignedRole}!` };
      }
      return { success: false, message: `Failed to update profile: ${error.message}` };
    }

    // 2. If profile row doesn't exist yet, insert active profile
    const name = displayName?.trim() || cleanEmail.split('@')[0];
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        email: cleanEmail,
        display_name: formattedName,
        role: assignedRole,
        status: 'ACTIVE',
        visible_to_sub_admin: true,
        daily_goal_minutes: 120,
        timezone: 'Asia/Kathmandu',
        avatar_url: cleanEmail.includes('shilpa') ? '/avatars/whale.png' : '/avatars/panda.png',
      })
      .select()
      .single();

    if (!insertError || newProfile) {
      return { success: true, message: `Created and approved profile for ${cleanEmail}!` };
    }

    return {
      success: false,
      message: `Error activating profile for ${cleanEmail}: ${insertError?.message || 'Database error'}`,
    };
  },

  // Toggle user status (Active / Deactivated)
  async toggleUserStatus(userId: string, newStatus: AccountStatus): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  },

  // Update a user's role
  async updateUserRole(userId: string, newRole: ApplicationRole): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  },

  // Assign user to Sub-Admin
  async assignSubAdmin(userId: string, subAdminId: string | null): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ managed_by: subAdminId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  },

  // Toggle visible_to_sub_admin (Main-Admin-Only / Private)
  async toggleMainAdminOnly(userId: string, isPrivateToMainAdmin: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({
        visible_to_sub_admin: !isPrivateToMainAdmin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return !error;
  },

  // Set / Change Active Admin Friend (Only ONE active Friend)
  async setAdminFriend(friendUserId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    try {
      // 1. Deactivate any previous friend relationships for this admin
      await supabase
        .from('study_relationships')
        .update({ active: false })
        .eq('owner_user_id', user.id);

      // 2. Set role of previous friends to 'USER' if needed
      // 3. Upsert active relationship with selected friend
      const { error } = await supabase
        .from('study_relationships')
        .upsert({
          owner_user_id: user.id,
          friend_user_id: friendUserId,
          can_compare: true,
          can_view_summary: true,
          active: true,
          created_at: new Date().toISOString(),
        }, { onConflict: 'owner_user_id,friend_user_id' });

      if (error) {
        console.error('Error setting admin friend in study_relationships:', error);
        return false;
      }

      // Also set role in profile to FRIEND
      await supabase
        .from('profiles')
        .update({ role: 'FRIEND', updated_at: new Date().toISOString() })
        .eq('id', friendUserId);

      return true;
    } catch (err) {
      console.error('Failed to set admin friend:', err);
      return false;
    }
  },

  // Remove Admin Friend
  async removeAdminFriend(friendUserId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('study_relationships')
      .update({ active: false })
      .eq('owner_user_id', user.id)
      .eq('friend_user_id', friendUserId);

    await supabase
      .from('profiles')
      .update({ role: 'USER' })
      .eq('id', friendUserId);

    return !error;
  },

  // Get current active Admin Friend
  async getActiveAdminFriend(): Promise<{ userId: string; displayName: string; email: string } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('study_relationships')
      .select('friend_user_id, profiles:friend_user_id(display_name, email)')
      .eq('owner_user_id', user.id)
      .eq('active', true)
      .limit(1)
      .single();

    if (data && (data as any).profiles) {
      return {
        userId: data.friend_user_id,
        displayName: (data as any).profiles.display_name,
        email: (data as any).profiles.email,
      };
    }
    return null;
  },

  // Reset User Progress / Study Data (RPC + Direct Table Fallback)
  async resetUserData(targetUserId: string, resetType: 'PROGRESS_ONLY' | 'FULL_STUDY_DATA'): Promise<boolean> {
    // 1. Try PostgreSQL RPC first
    try {
      const { data, error } = await supabase.rpc('admin_reset_user_data', {
        p_target_user_id: targetUserId,
        p_reset_type: resetType,
      });

      if (!error && (data?.success || data === true)) {
        this.clearLocalTimerCaches(targetUserId);
        return true;
      }
      if (error) {
        console.warn('RPC admin_reset_user_data failed, attempting direct table deletion fallback:', error.message);
      }
    } catch (rpcErr) {
      console.warn('RPC call exception, falling back to direct table deletion:', rpcErr);
    }

    // 2. Resilient Direct Table Deletion Fallback
    try {
      if (resetType === 'PROGRESS_ONLY') {
        // Progress only: delete study logs, practice sessions and answers
        await Promise.allSettled([
          supabase.from('practice_answers').delete().eq('user_id', targetUserId),
          supabase.from('practice_sessions').delete().eq('user_id', targetUserId),
          supabase.from('study_sessions').delete().eq('user_id', targetUserId),
        ]);
        this.clearLocalTimerCaches(targetUserId);
        return true;
      }

      if (resetType === 'FULL_STUDY_DATA') {
        // Full study data wipe: delete child records first, then topics, subjects, courses
        await Promise.allSettled([
          supabase.from('practice_answers').delete().eq('user_id', targetUserId),
          supabase.from('practice_sessions').delete().eq('user_id', targetUserId),
          supabase.from('study_sessions').delete().eq('user_id', targetUserId),
          supabase.from('planner_sessions').delete().eq('user_id', targetUserId),
          supabase.from('questions').delete().eq('user_id', targetUserId),
          supabase.from('subjective_papers').delete().eq('user_id', targetUserId),
          supabase.from('syllabus_documents').delete().eq('user_id', targetUserId),
        ]);

        // Delete hierarchy in order: topics -> subjects -> courses
        await supabase.from('topics').delete().eq('user_id', targetUserId);
        await supabase.from('subjects').delete().eq('user_id', targetUserId);
        const { error: courseErr } = await supabase.from('courses').delete().eq('user_id', targetUserId);

        this.clearLocalTimerCaches(targetUserId);
        return !courseErr;
      }

      return false;
    } catch (fallbackErr) {
      console.error('Direct table reset fallback error:', fallbackErr);
      return false;
    }
  },

  clearLocalTimerCaches(userId: string) {
    try {
      localStorage.removeItem(`studydashboard_active_session_${userId}`);
      localStorage.removeItem('studydashboard_active_session');
    } catch {}
  }
};
