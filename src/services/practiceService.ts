import { supabase, type CloudPracticeSession } from '../lib/supabase';
import { getNepalTodayRange } from '../utils/dateUtils';

export interface PracticeSessionInput {
  courseId: string;
  mode: 'PRACTICE' | 'TIMED';
  questionIds: string[];
  durationSeconds: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  answers: {
    questionId: string;
    selectedOption: string | null;
    isCorrect: boolean;
    markedForReview?: boolean;
  }[];
}

export const practiceService = {
  // Record a completed practice test in Supabase
  async recordPracticeSession(input: PracticeSessionInput): Promise<CloudPracticeSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const now = new Date();
    const startTime = new Date(now.getTime() - input.durationSeconds * 1000);

    // 1. Insert session record
    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: user.id,
        course_id: input.courseId,
        mode: input.mode,
        question_ids: input.questionIds,
        started_at: startTime.toISOString(),
        submitted_at: now.toISOString(),
        duration_seconds: input.durationSeconds,
        score: input.score,
        correct_count: input.correctCount,
        wrong_count: input.wrongCount,
        unanswered_count: input.unansweredCount,
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error recording practice session:', sessionError);
      return null;
    }

    // 2. Insert answer details
    if (input.answers.length > 0) {
      const answerRows = input.answers.map(a => ({
        practice_session_id: session.id,
        user_id: user.id,
        question_id: a.questionId,
        selected_option: a.selectedOption,
        is_correct: a.isCorrect,
        marked_for_review: a.markedForReview || false,
      }));

      await supabase.from('practice_answers').insert(answerRows);
    }

    return session;
  },

  // Get today's practice attempts
  async getTodayPracticeSessions(): Promise<CloudPracticeSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { start } = getNepalTodayRange();

    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', start.toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching today practice sessions:', error);
      return [];
    }
    return data || [];
  }
};
