import { supabase, type CloudCourse, type CloudSubject, type CloudTopic, type CloudSyllabusDocument } from '../lib/supabase';
import type { ExtractedTopicSection } from '../types';

export interface CourseInput {
  name: string;
  description?: string;
  year?: number;
  examDate?: string | null;
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

// Local cache for exam dates to ensure 100% resilience across all databases
const EXAM_DATE_CACHE_KEY = 'studydashboard_course_exam_dates';

function getCachedExamDates(): Record<string, string> {
  try {
    const raw = localStorage.getItem(EXAM_DATE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCachedExamDate(courseId: string, examDate?: string | null) {
  try {
    const cache = getCachedExamDates();
    if (examDate) {
      cache[courseId] = examDate;
    } else {
      delete cache[courseId];
    }
    localStorage.setItem(EXAM_DATE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export const courseService = {
  // Get all courses for current authenticated user or shared workspace
  async getCourses(): Promise<CloudCourse[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching courses:', error);
      return [];
    }

    const examDates = getCachedExamDates();
    const courses = (data || []).map(c => ({
      ...c,
      exam_date: c.exam_date || examDates[c.id] || null,
    }));

    // Filter for current user's courses, or shared/sample courses
    const userCourses = courses.filter(c => c.user_id === user.id || c.is_sample);
    return userCourses.length > 0 ? userCourses : courses;
  },

  // Create a new course with Deduplication
  async createCourse(input: CourseInput): Promise<CloudCourse | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found for createCourse');
      return null;
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Course name cannot be empty.');
    }

    // 1. DEDUPLICATION CHECK: Check if course with this name already exists
    const existing = await this.getCourses();
    const isDuplicate = existing.some(
      c => c.user_id === user.id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A course with the name "${trimmedName}" already exists. Duplicate courses are not allowed.`);
    }

    const payload: any = {
      user_id: user.id,
      name: trimmedName,
      daily_goal_minutes: input.dailyGoalMinutes || 60,
      color: input.color || '#5b5bd6',
      is_archived: false,
    };

    if (input.description) payload.description = input.description.trim();
    if (input.year) payload.year = input.year;
    if (input.examDate) payload.exam_date = input.examDate;

    const { data, error } = await supabase
      .from('courses')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('Initial course insert note, trying minimal payload:', error.message);
      // Fallback without optional columns if schema differs
      const minimalPayload = {
        user_id: user.id,
        name: trimmedName,
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
      if (input.examDate && fallbackData) {
        setCachedExamDate(fallbackData.id, input.examDate);
        fallbackData.exam_date = input.examDate;
      }
      return fallbackData;
    }

    if (input.examDate && data) {
      setCachedExamDate(data.id, input.examDate);
    }
    return data;
  },

  // Update a course with Deduplication check
  async updateCourse(id: string, updates: Partial<CourseInput>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    if (updates.name) {
      const trimmedName = updates.name.trim();
      const existing = await this.getCourses();
      const isDuplicate = existing.some(
        c => c.id !== id && c.user_id === user.id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Another course is already named "${trimmedName}". Please choose a different name.`);
      }
    }

    const payload: any = {
      ...(updates.name && { name: updates.name.trim() }),
      ...(updates.description !== undefined && { description: updates.description.trim() }),
      ...(updates.year !== undefined && { year: updates.year }),
      ...(updates.dailyGoalMinutes && { daily_goal_minutes: updates.dailyGoalMinutes }),
      ...(updates.color && { color: updates.color }),
      ...(updates.examDate !== undefined && { exam_date: updates.examDate }),
      updated_at: new Date().toISOString(),
    };

    if (updates.examDate !== undefined) {
      setCachedExamDate(id, updates.examDate);
    }

    const { error } = await supabase
      .from('courses')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      // Fallback without exam_date column if schema lacks it
      delete payload.exam_date;
      const { error: fbErr } = await supabase
        .from('courses')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id);
      return !fbErr;
    }

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

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Subject name cannot be empty.');
    }

    // 2. DEDUPLICATION CHECK: Check if subject with same name exists in course
    const existing = await this.getSubjects(input.courseId);
    const isDuplicate = existing.some(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase() ||
           (input.code && s.code && s.code.trim().toLowerCase() === input.code.trim().toLowerCase())
    );
    if (isDuplicate) {
      throw new Error(`A subject with the name "${trimmedName}" or code "${input.code}" already exists in this course.`);
    }

    const { data, error } = await supabase
      .from('subjects')
      .insert({
        user_id: user.id,
        course_id: input.courseId,
        name: trimmedName,
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

    if (updates.name && updates.courseId) {
      const trimmedName = updates.name.trim();
      const existing = await this.getSubjects(updates.courseId);
      const isDuplicate = existing.some(
        s => s.id !== id && s.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Another subject in this course is already named "${trimmedName}".`);
      }
    }

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

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Topic name cannot be empty.');
    }

    // 3. DEDUPLICATION CHECK: Check if topic with same name exists under this subject/course
    const existing = await this.getTopics(courseId, subjectId);
    const isDuplicate = existing.some(
      t => t.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
           t.parent_topic_id === (parentTopicId || null)
    );
    if (isDuplicate) {
      throw new Error(`A topic with the name "${trimmedName}" already exists in this section.`);
    }

    const { data, error } = await supabase
      .from('topics')
      .insert({
        user_id: user.id,
        course_id: courseId,
        subject_id: subjectId || null,
        parent_topic_id: parentTopicId || null,
        name: trimmedName,
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
