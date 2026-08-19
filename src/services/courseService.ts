import { supabase, type CloudCourse, type CloudTopic } from '../lib/supabase';

export interface CourseInput {
  name: string;
  description?: string;
  dailyGoalMinutes: number;
  color?: string;
}

export const courseService = {
  // Get all courses for current authenticated user
  async getCourses(): Promise<CloudCourse[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching courses:', error);
      return [];
    }
    return data || [];
  },

  // Create a new course
  async createCourse(input: CourseInput): Promise<CloudCourse | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('courses')
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        description: input.description?.trim(),
        daily_goal_minutes: input.dailyGoalMinutes,
        color: input.color || '#5b5bd6',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating course:', error);
      return null;
    }
    return data;
  },

  // Update a course
  async updateCourse(id: string, updates: Partial<CourseInput>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('courses')
      .update({
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.description !== undefined && { description: updates.description.trim() }),
        ...(updates.dailyGoalMinutes && { daily_goal_minutes: updates.dailyGoalMinutes }),
        ...(updates.color && { color: updates.color }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  // Archive a course
  async archiveCourse(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('courses')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  // Delete a course permanently
  async deleteCourse(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  // Topics CRUD
  async getTopics(courseId: string): Promise<CloudTopic[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching topics:', error);
      return [];
    }
    return data || [];
  },

  async createTopic(courseId: string, name: string, parentTopicId?: string | null, code?: string): Promise<CloudTopic | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('topics')
      .insert({
        user_id: user.id,
        course_id: courseId,
        parent_topic_id: parentTopicId || null,
        name: name.trim(),
        code: code || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating topic:', error);
      return null;
    }
    return data;
  }
};
