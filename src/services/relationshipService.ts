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

  // Check if current user has an active partner (either as Super Admin or as Admin Friend)
  async getActivePartner(): Promise<{ partnerUserId: string; isSuperAdmin: boolean } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('study_relationships')
      .select('*')
      .or(`owner_user_id.eq.${user.id},friend_user_id.eq.${user.id}`)
      .eq('active', true)
      .limit(1)
      .single();

    if (error || !data) return null;

    const isSuperAdmin = data.owner_user_id === user.id;
    const partnerUserId = isSuperAdmin ? data.friend_user_id : data.owner_user_id;

    return { partnerUserId, isSuperAdmin };
  },

  // Get secure aggregate friend summary (via PostgreSQL RPC without exposing private questions/notes)
  async getFriendSummary(friendUserId: string): Promise<FriendSummaryStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_friend_progress_summary', {
        p_friend_user_id: friendUserId,
      });

      if (error) {
        console.error('Error calling get_friend_progress_summary RPC:', error);
        return null;
      }
      return data as FriendSummaryStats;
    } catch (err) {
      console.error('Error in getFriendSummary:', err);
      return null;
    }
  }
};
