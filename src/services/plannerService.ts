import { supabase, type CloudPlannerSession } from '../lib/supabase';

export interface PlannerSessionInput {
  courseId: string;
  topicId?: string | null;
  title: string;
  startTime: string;
  durationMinutes: number;
  reminderEnabled?: boolean;
}

export const plannerService = {
  // Get upcoming and today's planner sessions
  async getPlannerSessions(): Promise<CloudPlannerSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('planner_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching planner sessions:', error);
      return [];
    }
    return data || [];
  },

  // Create planner session
  async createPlannerSession(input: PlannerSessionInput): Promise<CloudPlannerSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const start = new Date(input.startTime);
    const end = new Date(start.getTime() + input.durationMinutes * 60000);

    const { data, error } = await supabase
      .from('planner_sessions')
      .insert({
        user_id: user.id,
        course_id: input.courseId,
        topic_id: input.topicId || null,
        title: input.title.trim(),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_minutes: input.durationMinutes,
        reminder_enabled: input.reminderEnabled !== undefined ? input.reminderEnabled : true,
        is_completed: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating planner session:', error);
      return null;
    }
    return data;
  },

  // Toggle completion
  async toggleComplete(id: string, isCompleted: boolean): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('planner_sessions')
      .update({ is_completed: isCompleted })
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  // Delete session
  async deleteSession(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('planner_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  }
};
