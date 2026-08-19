import { db } from '../db';
import { supabase } from '../lib/supabase';
import { questionService, type QuestionInsertInput } from './questionService';

export const migrationService = {
  // Check if there is local Dexie data to migrate
  async checkLocalDataCounts(): Promise<{ targets: number; questions: number; studySessions: number; planner: number }> {
    try {
      const targets = await db.targets.count();
      const questions = await db.questions.count();
      const studySessions = await db.studySessions.count();
      const planner = await db.studySchedules.count();
      return { targets, questions, studySessions, planner };
    } catch (e) {
      console.warn('Dexie check error:', e);
      return { targets: 0, questions: 0, studySessions: 0, planner: 0 };
    }
  },

  // Perform one-time migration of local Dexie targets and questions to Supabase Cloud
  async migrateLocalToCloud(): Promise<{ success: boolean; migratedTargets: number; migratedQuestions: number; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, migratedTargets: 0, migratedQuestions: 0, error: 'User not authenticated' };

    try {
      const localTargets = await db.targets.toArray();
      const localQuestions = await db.questions.toArray();

      let migratedTargets = 0;
      let migratedQuestions = 0;

      // 1. Migrate Targets to Courses
      const targetIdToCourseIdMap = new Map<string, string>();

      for (const t of localTargets) {
        const { data: course, error } = await supabase
          .from('courses')
          .insert({
            user_id: user.id,
            name: t.name,
            daily_goal_minutes: t.dailyGoalMinutes,
            color: t.color || '#5b5bd6',
            is_sample: false,
          })
          .select('id')
          .single();

        if (!error && course) {
          targetIdToCourseIdMap.set(t.id, course.id);
          migratedTargets++;
        }
      }

      // 2. Migrate Questions to Cloud Questions Bank
      const cloudQuestions: QuestionInsertInput[] = localQuestions.map(q => {
        const mappedCourseId = targetIdToCourseIdMap.get(q.targetId) || null;
        const optA = q.options?.[0]?.text || 'Option A';
        const optB = q.options?.[1]?.text || 'Option B';
        const optC = q.options?.[2]?.text || 'Option C';
        const optD = q.options?.[3]?.text || 'Option D';
        
        let correctLetter: string = 'UNKNOWN';
        if (q.correctOptionId) {
          const idx = q.options?.findIndex(o => o.id === q.correctOptionId);
          if (idx !== -1 && idx < 4) {
            correctLetter = ['A', 'B', 'C', 'D'][idx];
          }
        }

        return {
          courseId: mappedCourseId || '00000000-0000-0000-0000-000000000000',
          questionText: q.questionText,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctAnswer: correctLetter,
          explanation: q.explanation || null,
          answerStatus: 'VALID' as const,
        };
      }).filter(q => q.courseId !== '00000000-0000-0000-0000-000000000000');

      if (cloudQuestions.length > 0) {
        const res = await questionService.createQuestionsBatch(cloudQuestions);
        migratedQuestions = res.inserted;
      }

      return { success: true, migratedTargets, migratedQuestions };
    } catch (err: any) {
      console.error('Migration error:', err);
      return { success: false, migratedTargets: 0, migratedQuestions: 0, error: err?.message || 'Migration failed' };
    }
  }
};
