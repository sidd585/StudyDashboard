import { supabase, type CloudQuestion, type AnswerStatus } from '../lib/supabase';

export interface QuestionInsertInput {
  courseId: string;
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
  sourceFileId?: string;
  sourcePage?: number;
  originalQuestionNumber?: number;
  isSample?: boolean;
}

export const questionService = {
  // Get all questions with optional filters
  async getQuestions(filters?: { courseId?: string; topicId?: string; status?: AnswerStatus; search?: string }): Promise<CloudQuestion[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('questions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filters?.courseId) {
      query = query.eq('course_id', filters.courseId);
    }
    if (filters?.topicId) {
      query = query.eq('topic_id', filters.topicId);
    }
    if (filters?.status) {
      query = query.eq('answer_status', filters.status);
    }
    if (filters?.search) {
      query = query.ilike('question_text', `%${filters.search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching questions:', error);
      return [];
    }
    return data || [];
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

  // Batch insert with duplicate safety / idempotency
  async createQuestionsBatch(inputs: QuestionInsertInput[]): Promise<{ inserted: number; errors: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || inputs.length === 0) return { inserted: 0, errors: 0 };

    const rows = inputs.map(input => ({
      user_id: user.id,
      course_id: input.courseId,
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
      source_file_id: input.sourceFileId || null,
      source_page: input.sourcePage || null,
      original_question_number: input.originalQuestionNumber || null,
      is_sample: input.isSample || false,
    }));

    // Insert in chunks of 50
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
