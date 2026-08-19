import { supabase, type Profile, type ApplicationRole } from '../lib/supabase';

export interface AdminUserListItem {
  id: string;
  email: string;
  displayName: string;
  role: ApplicationRole;
  managedBy?: string | null;
  status: 'ACTIVE' | 'DEACTIVATED' | 'PENDING';
  dailyGoalMinutes: number;
  lastActive?: string;
  createdAt: string;
}

export interface AdminOverviewStats {
  totalUsers: number;
  activeUsers: number;
  subAdmins: number;
  pendingInvitations: number;
  todayActiveStudents: number;
  totalFocusTimeMinutesToday: number;
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
      dailyGoalMinutes: p.daily_goal_minutes,
      createdAt: p.created_at,
    }));
  },

  // Get Admin Overview Stats
  async getOverviewStats(): Promise<AdminOverviewStats> {
    const users = await this.getUsers();
    const active = users.filter(u => u.status === 'ACTIVE');
    const subAdmins = users.filter(u => u.role === 'SUB_ADMIN');

    return {
      totalUsers: users.length,
      activeUsers: active.length,
      subAdmins: subAdmins.length,
      pendingInvitations: 0,
      todayActiveStudents: active.length > 0 ? active.length : 1,
      totalFocusTimeMinutesToday: 0,
    };
  },

  // Toggle user status (Activate / Deactivate)
  async toggleUserStatus(userId: string, newStatus: 'ACTIVE' | 'DEACTIVATED'): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  },

  // Send an invitation
  async inviteUser(email: string, role: ApplicationRole = 'USER', managedBy?: string | null): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated.' };

    try {
      // 1. Check if backend invitation endpoint is available
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, managedBy: managedBy || null }),
      });

      if (response.ok) {
        return { success: true };
      }
    } catch {
      // Fallback: direct Supabase invitation table insertion
    }

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('user_invitations')
      .insert({
        email: email.trim().toLowerCase(),
        invited_by: user.id,
        role,
        managed_by: managedBy || null,
        status: 'PENDING',
        token,
        expires_at: expiresAt,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }
};
