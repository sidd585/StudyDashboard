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

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }

    return (data || []).map(p => ({
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

  // Reset User Progress / Study Data
  async resetUserData(targetUserId: string, resetType: 'PROGRESS_ONLY' | 'FULL_STUDY_DATA'): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('admin_reset_user_data', {
        p_target_user_id: targetUserId,
        p_reset_type: resetType,
      });

      if (error) {
        console.error('Error in admin_reset_user_data RPC:', error);
        return false;
      }
      return Boolean(data?.success);
    } catch (err) {
      console.error('Failed to reset user data:', err);
      return false;
    }
  }
};
