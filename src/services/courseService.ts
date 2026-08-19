import { supabase, type CloudCourse, type CloudSubject, type CloudTopic, type CloudSyllabusDocument } from '../lib/supabase';
import type { ExtractedTopicSection } from '../types';

export interface CourseInput {
  name: string;
  description?: string;
  year?: number;
  dailyGoalMinutes: number;
  color?: string;
}

export interface SubjectInput {
  courseId: string;
  name: string;
  description?: string;
  code?: string;
  sortOrder?: number;
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
    if (!user) {
      console.error('No authenticated user found for createCourse');
      return null;
    }

    const payload: any = {
      user_id: user.id,
      name: input.name.trim(),
      daily_goal_minutes: input.dailyGoalMinutes || 60,
      color: input.color || '#5b5bd6',
      is_archived: false,
    };

    if (input.description) payload.description = input.description.trim();
    if (input.year) payload.year = input.year;

    const { data, error } = await supabase
      .from('courses')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating course:', error);
      // Fallback without optional columns if schema differs
      const minimalPayload = {
        user_id: user.id,
        name: input.name.trim(),
        daily_goal_minutes: input.dailyGoalMinutes || 60,
      };
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('courses')
        .insert(minimalPayload)
        .select()
        .single();

      if (fallbackError) {
        console.error('Fallback course insert failed:', fallbackError);
        return null;
      }
      return fallbackData;
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
        ...(updates.year !== undefined && { year: updates.year }),
        ...(updates.dailyGoalMinutes && { daily_goal_minutes: updates.dailyGoalMinutes }),
        ...(updates.color && { color: updates.color }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  // Archive / Delete course
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

  // ================= SUBJECTS / PAPERS =================
  async getSubjects(courseId: string): Promise<CloudSubject[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching subjects:', error);
      return [];
    }
    return data || [];
  },

  async createSubject(input: SubjectInput): Promise<CloudSubject | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('subjects')
      .insert({
        user_id: user.id,
        course_id: input.courseId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        code: input.code?.trim() || null,
        sort_order: input.sortOrder || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subject:', error);
      return null;
    }
    return data;
  },

  async updateSubject(id: string, updates: Partial<SubjectInput>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('subjects')
      .update({
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.description !== undefined && { description: updates.description.trim() }),
        ...(updates.code !== undefined && { code: updates.code.trim() }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  async deleteSubject(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  // ================= TOPICS & LESSONS =================
  async getTopics(courseId: string, subjectId?: string | null): Promise<CloudTopic[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true });

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching topics:', error);
      return [];
    }
    return data || [];
  },

  async createTopic(
    courseId: string,
    name: string,
    subjectId?: string | null,
    parentTopicId?: string | null,
    code?: string,
    sortOrder: number = 0
  ): Promise<CloudTopic | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('topics')
      .insert({
        user_id: user.id,
        course_id: courseId,
        subject_id: subjectId || null,
        parent_topic_id: parentTopicId || null,
        name: name.trim(),
        code: code || null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating topic:', error);
      return null;
    }
    return data;
  },

  async updateTopic(id: string, updates: { name?: string; code?: string; sortOrder?: number }): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('topics')
      .update({
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.code !== undefined && { code: updates.code.trim() }),
        ...(updates.sortOrder !== undefined && { sort_order: updates.sortOrder }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  async deleteTopic(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  },

  // Save full extracted syllabus hierarchy into Supabase (Topics & Lessons)
  async saveSyllabusHierarchy(
    courseId: string,
    subjectId: string | null,
    sections: ExtractedTopicSection[],
    syllabusFileName?: string
  ): Promise<{ topicsCreated: number; lessonsCreated: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { topicsCreated: 0, lessonsCreated: 0 };

    let topicsCreated = 0;
    let lessonsCreated = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      // 1. Create Top-Level Topic
      const parentTopic = await this.createTopic(
        courseId,
        section.name,
        subjectId,
        null,
        section.code || `${i + 1}`,
        i + 1
      );

      if (parentTopic) {
        topicsCreated++;
        // 2. Create sub-lessons under this parent topic
        for (let j = 0; j < section.lessons.length; j++) {
          const lesson = section.lessons[j];
          await this.createTopic(
            courseId,
            lesson.name,
            subjectId,
            parentTopic.id,
            lesson.code || `${section.code || i + 1}.${j + 1}`,
            j + 1
          );
          lessonsCreated++;
        }
      }
    }

    if (syllabusFileName) {
      try {
        await supabase.from('syllabus_documents').insert({
          user_id: user.id,
          course_id: courseId,
          subject_id: subjectId || null,
          document_name: syllabusFileName,
          raw_text: sections.map(s => `${s.name}: ${s.lessons.map(l => l.name).join(', ')}`).join('\n'),
        });
      } catch (docErr) {
        console.warn('Syllabus document metadata note:', docErr);
      }
    }

    return { topicsCreated, lessonsCreated };
  }
};
