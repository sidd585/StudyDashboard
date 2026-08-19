import { supabase, type CloudPlannerSession } from '../lib/supabase';

export interface PlannerSessionInput {
  courseId: string;
  subjectId?: string | null;
  topicId?: string | null;
  title: string;
  date?: string; // YYYY-MM-DD
  startTime: string; // ISO string
  durationMinutes: number;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
}

export const plannerService = {
  // Get upcoming and all planner sessions for authenticated user
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

  // Create single planner session
  async createPlannerSession(input: PlannerSessionInput): Promise<CloudPlannerSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const start = new Date(input.startTime);
    const end = new Date(start.getTime() + input.durationMinutes * 60000);
    const dateStr = input.date || start.toISOString().split('T')[0];

    const payload: any = {
      user_id: user.id,
      course_id: input.courseId,
      subject_id: input.subjectId || null,
      topic_id: input.topicId || null,
      title: input.title.trim(),
      date: dateStr,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: input.durationMinutes,
      reminder_enabled: input.reminderEnabled !== undefined ? input.reminderEnabled : true,
      reminder_minutes_before: input.reminderMinutesBefore || 15,
      is_completed: false,
    };

    const { data, error } = await supabase
      .from('planner_sessions')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating planner session:', error);
      return null;
    }
    return data;
  },

  // Create multiple sessions (for repeating daily/weekly study plans)
  async createPlannerSessionsBatch(inputs: PlannerSessionInput[]): Promise<CloudPlannerSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || inputs.length === 0) return [];

    const rows = inputs.map(input => {
      const start = new Date(input.startTime);
      const end = new Date(start.getTime() + input.durationMinutes * 60000);
      const dateStr = input.date || start.toISOString().split('T')[0];

      return {
        user_id: user.id,
        course_id: input.courseId,
        subject_id: input.subjectId || null,
        topic_id: input.topicId || null,
        title: input.title.trim(),
        date: dateStr,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_minutes: input.durationMinutes,
        reminder_enabled: input.reminderEnabled !== undefined ? input.reminderEnabled : true,
        reminder_minutes_before: input.reminderMinutesBefore || 15,
        is_completed: false,
      };
    });

    const { data, error } = await supabase
      .from('planner_sessions')
      .insert(rows)
      .select();

    if (error) {
      console.error('Error batch creating planner sessions:', error);
      return [];
    }
    return data || [];
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
