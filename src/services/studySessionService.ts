import { supabase, type CloudStudySession } from '../lib/supabase';
import { getNepalTodayRange } from '../utils/dateUtils';

export const studySessionService = {
  // Start or resume an active session in Supabase
  async startSession(courseId: string, topicId?: string | null): Promise<CloudStudySession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: user.id,
        course_id: courseId,
        topic_id: topicId || null,
        started_at: new Date().toISOString(),
        status: 'ACTIVE',
        duration_seconds: 0,
        paused_milliseconds: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting study session in cloud:', error);
      return null;
    }
    return data;
  },

  // Finish a study session
  async finishSession(sessionId: string, durationSeconds: number, focusRating?: number, note?: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('study_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        status: 'COMPLETED',
        focus_rating: focusRating || null,
        note: note?.trim() || null,
      })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    return !error;
  },

  // Record a complete direct study session
  async recordCompletedSession(courseId: string, durationSeconds: number, topicId?: string | null, note?: string): Promise<CloudStudySession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const now = new Date();
    const startTime = new Date(now.getTime() - durationSeconds * 1000);

    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: user.id,
        course_id: courseId,
        topic_id: topicId || null,
        started_at: startTime.toISOString(),
        ended_at: now.toISOString(),
        duration_seconds: durationSeconds,
        status: 'COMPLETED',
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording study session:', error);
      return null;
    }
    return data;
  },

  // Get today's study sessions using Asia/Kathmandu day boundaries
  async getTodaySessions(): Promise<CloudStudySession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { start } = getNepalTodayRange();

    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', start.toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching today study sessions:', error);
      return [];
    }
    return data || [];
  },

  // Get last 7 days sessions
  async getLast7DaysSessions(): Promise<CloudStudySession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', sevenDaysAgo.toISOString())
      .order('started_at', { ascending: true });

    if (error) {
      console.error('Error fetching 7-day study sessions:', error);
      return [];
    }
    return data || [];
  }
};
