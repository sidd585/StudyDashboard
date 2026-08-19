import { supabase, type CloudStudyRelationship } from '../lib/supabase';
import type { FriendSummaryStats } from '../types';

export const relationshipService = {
  // Get all active study relationships for the current user
  async getRelationships(): Promise<CloudStudyRelationship[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('study_relationships')
      .select('*')
      .or(`owner_user_id.eq.${user.id},friend_user_id.eq.${user.id}`)
      .eq('active', true);

    if (error) {
      console.error('Error fetching relationships:', error);
      return [];
    }
    return data || [];
  },

  // Get all active study partners (supports 1, 2, 3, 4, 5+ friends)
  async getAllActivePartners(): Promise<{
    partnerUserId: string;
    partnerName: string;
    avatarUrl: string;
    role: string;
    isSuperAdmin: boolean;
  }[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isMainAdmin = myProfile?.role === 'MAIN_ADMIN';

    // 1. Fetch from study_relationships table
    const { data: rels } = await supabase
      .from('study_relationships')
      .select('*')
      .or(`owner_user_id.eq.${user.id},friend_user_id.eq.${user.id}`)
      .eq('active', true);

    const partnerUserIds = new Set<string>();
    (rels || []).forEach(r => {
      const id = r.owner_user_id === user.id ? r.friend_user_id : r.owner_user_id;
      if (id && id !== user.id) partnerUserIds.add(id);
    });

    // 2. Also fetch all users with role 'FRIEND' or 'SUB_ADMIN' if main admin, or main admins & friends if friend
    if (isMainAdmin) {
      const { data: friends } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, role')
        .in('role', ['FRIEND', 'SUB_ADMIN'])
        .neq('id', user.id);

      (friends || []).forEach(f => partnerUserIds.add(f.id));
    } else {
      const { data: adminsAndFriends } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, role')
        .in('role', ['MAIN_ADMIN', 'FRIEND'])
        .neq('id', user.id);

      (adminsAndFriends || []).forEach(f => partnerUserIds.add(f.id));
    }

    if (partnerUserIds.size === 0) return [];

    // Fetch details for all partners
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role')
      .in('id', Array.from(partnerUserIds));

    return (profiles || []).map(p => ({
      partnerUserId: p.id,
      partnerName: p.display_name,
      avatarUrl: p.avatar_url || (p.display_name?.toLowerCase().includes('shilpa') ? '/avatars/whale.png' : '/avatars/panda.png'),
      role: p.role,
      isSuperAdmin: p.role === 'MAIN_ADMIN',
    }));
  },

  // Check if current user has an active partner (either as Super Admin or as Admin Friend)
  async getActivePartner(): Promise<{ partnerUserId: string; isSuperAdmin: boolean; partnerName?: string } | null> {
    const all = await this.getAllActivePartners();
    if (all.length > 0) {
      return {
        partnerUserId: all[0].partnerUserId,
        isSuperAdmin: all[0].isSuperAdmin,
        partnerName: all[0].partnerName,
      };
    }
    return null;
  },

  // Get aggregate friend summary (via RPC or direct table query fallback)
  async getFriendSummary(friendUserId: string): Promise<FriendSummaryStats | null> {
    try {
      // 1. Attempt PostgreSQL RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_friend_progress_summary', {
        p_friend_user_id: friendUserId,
      });

      if (!rpcError && rpcData) {
        return rpcData as FriendSummaryStats;
      }
    } catch {
      // Continue to fallback
    }

    // 2. Direct Table Query Fallback
    try {
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', friendUserId)
        .maybeSingle();

      const partnerName = partnerProfile?.display_name || 'Study Partner';
      const partnerAvatar = partnerProfile?.avatar_url || '/avatars/whale.png';
      const dailyGoal = partnerProfile?.daily_goal_minutes || 120;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Study sessions
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('duration_seconds, started_at')
        .eq('user_id', friendUserId)
        .gte('started_at', monthStart);

      let todaySecs = 0;
      let weekSecs = 0;
      let monthSecs = 0;
      const activeDaysSet = new Set<string>();

      (sessions || []).forEach(s => {
        const dur = s.duration_seconds || 0;
        monthSecs += dur;
        if (s.started_at >= weekStart) {
          weekSecs += dur;
          activeDaysSet.add(s.started_at.split('T')[0]);
        }
        if (s.started_at >= todayStart) {
          todaySecs += dur;
        }
      });

      // Practice sessions
      const { data: practice } = await supabase
        .from('practice_sessions')
        .select('correct_count, wrong_count, unanswered_count, started_at')
        .eq('user_id', friendUserId)
        .gte('started_at', weekStart);

      let totalQs = 0;
      let correctQs = 0;
      (practice || []).forEach(p => {
        totalQs += (p.correct_count + p.wrong_count + p.unanswered_count);
        correctQs += p.correct_count;
      });

      const todayFocusMins = Math.round(todaySecs / 60);
      const weekFocusMins = Math.round(weekSecs / 60);
      const monthFocusMins = Math.round(monthSecs / 60);
      const todayGoalPct = Math.min(100, Math.round((todayFocusMins / dailyGoal) * 100));
      const accuracy = totalQs > 0 ? Math.round((correctQs / totalQs) * 100) : 0;

      return {
        userId: friendUserId,
        displayName: partnerName,
        avatarUrl: partnerAvatar,
        todayFocusMinutes: todayFocusMins,
        weekFocusMinutes: weekFocusMins,
        monthFocusMinutes: monthFocusMins,
        dailyGoalMinutes: dailyGoal,
        todayGoalPct,
        streakDays: Math.max(1, activeDaysSet.size),
        activeDaysWeek: activeDaysSet.size || 1,
        todayAccuracy: accuracy,
        monthAccuracy: accuracy,
        plannerCompletionPct: 80,
      };
    } catch (fallbackErr) {
      console.error('Direct friend summary calculation error:', fallbackErr);
      return null;
    }
  }
};
