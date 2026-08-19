import { supabase, type CloudQuestion, type AnswerStatus } from '../lib/supabase';

export interface QuestionInsertInput {
  courseId: string;
  subjectId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer?: string | null;
  answerStatus?: AnswerStatus;
  explanation?: string | null;
  year?: number;
  sourceFileId?: string;
  sourcePage?: number;
  originalQuestionNumber?: number;
  isSample?: boolean;
}

export const questionService = {
  // Get all questions with optional filters and pagination
  async getQuestions(filters?: {
    courseId?: string;
    subjectId?: string;
    topicId?: string;
    year?: number;
    status?: AnswerStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ questions: CloudQuestion[]; total: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { questions: [], total: 0 };

    let query = supabase
      .from('questions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filters?.courseId) query = query.eq('course_id', filters.courseId);
    if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
    if (filters?.topicId) query = query.eq('topic_id', filters.topicId);
    if (filters?.year) query = query.eq('year', filters.year);
    if (filters?.status) query = query.eq('answer_status', filters.status);
    if (filters?.search) query = query.ilike('question_text', `%${filters.search.trim()}%`);

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) {
      console.error('Error fetching questions:', error);
      return { questions: [], total: 0 };
    }
    return { questions: data || [], total: count || 0 };
  },

  // Get total question counts grouped by course
  async getQuestionCountsByCourse(): Promise<Record<string, number>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('questions')
      .select('course_id')
      .eq('user_id', user.id);

    if (error || !data) return {};

    const counts: Record<string, number> = {};
    data.forEach(q => {
      counts[q.course_id] = (counts[q.course_id] || 0) + 1;
    });
    return counts;
  },

  // Insert a single question
  async createQuestion(input: QuestionInsertInput): Promise<CloudQuestion | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('questions')
      .insert({
        user_id: user.id,
        course_id: input.courseId,
        subject_id: input.subjectId || null,
        topic_id: input.topicId || null,
        subtopic_id: input.subtopicId || null,
        question_text: input.questionText.trim(),
        option_a: input.optionA.trim(),
        option_b: input.optionB.trim(),
        option_c: input.optionC.trim(),
        option_d: input.optionD.trim(),
        correct_answer: input.correctAnswer || null,
        answer_status: input.answerStatus || 'VALID',
        explanation: input.explanation?.trim() || null,
        year: input.year || 2027,
        source_file_id: input.sourceFileId || null,
        source_page: input.sourcePage || null,
        original_question_number: input.originalQuestionNumber || null,
        is_sample: input.isSample || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating question:', error);
      return null;
    }
    return data;
  },

  // Batch insert with duplicate safety
  async createQuestionsBatch(inputs: QuestionInsertInput[]): Promise<{ inserted: number; errors: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || inputs.length === 0) return { inserted: 0, errors: 0 };

    const rows = inputs.map(input => ({
      user_id: user.id,
      course_id: input.courseId,
      subject_id: input.subjectId || null,
      topic_id: input.topicId || null,
      subtopic_id: input.subtopicId || null,
      question_text: input.questionText.trim(),
      option_a: input.optionA.trim(),
      option_b: input.optionB.trim(),
      option_c: input.optionC.trim(),
      option_d: input.optionD.trim(),
      correct_answer: input.correctAnswer || null,
      answer_status: input.answerStatus || 'VALID',
      explanation: input.explanation?.trim() || null,
      year: input.year || 2027,
      source_file_id: input.sourceFileId || null,
      source_page: input.sourcePage || null,
      original_question_number: input.originalQuestionNumber || null,
      is_sample: input.isSample || false,
    }));

    let totalInserted = 0;
    let totalErrors = 0;
    const chunkSize = 50;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('questions')
        .insert(chunk)
        .select('id');

      if (error) {
        console.error('Batch insert error:', error);
        totalErrors += chunk.length;
      } else {
        totalInserted += (data?.length || 0);
      }
    }

    return { inserted: totalInserted, errors: totalErrors };
  },

  // Delete a question
  async deleteQuestion(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    return !error;
  }
};
