import { supabase, type CloudStudyRelationship } from '../lib/supabase';

export interface FriendSummary {
  userId: string;
  displayName: string;
  avatarUrl: string;
  todayFocusMinutes: number;
  todayMcqs: number;
  todayAccuracy: number;
  weekFocusMinutes: number;
  weekMcqs: number;
  weekAccuracy: number;
  streakDays: number;
}

export const relationshipService = {
  // Get all active study relationships for the user
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

  // Get secure aggregate friend summary (via PostgreSQL RPC without exposing private questions/notes)
  async getFriendSummary(friendUserId: string): Promise<FriendSummary | null> {
    try {
      const { data, error } = await supabase.rpc('get_friend_progress_summary', {
        p_friend_user_id: friendUserId,
      });

      if (error) {
        console.error('Error calling get_friend_progress_summary RPC:', error);
        return null;
      }
      return data as FriendSummary;
    } catch (err) {
      console.error('Error in getFriendSummary:', err);
      return null;
    }
  }
};
