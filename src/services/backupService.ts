import { db } from '../db';
import type {
  Target,
  Subject,
  Topic,
  Question,
  Attempt,
  QuizSession,
  StudySession,
  DailyAllocation,
  StudySchedule,
  Material,
  UserSettings,
} from '../types';

export interface BackupData {
  version: number;
  app: string;
  exportedAt: string;
  data: {
    targets: Target[];
    subjects: Subject[];
    topics: Topic[];
    questions: Question[];
    attempts: Attempt[];
    quizSessions: QuizSession[];
    studySessions: StudySession[];
    dailyAllocations: DailyAllocation[];
    studySchedules: StudySchedule[];
    materials: Partial<Material>[];
    userSettings?: UserSettings[];
  };
}

export async function exportBackupData(): Promise<string> {
  const [
    targets,
    subjects,
    topics,
    questions,
    attempts,
    quizSessions,
    studySessions,
    dailyAllocations,
    studySchedules,
    materials,
    userSettings,
  ] = await Promise.all([
    db.targets.toArray(),
    db.subjects.toArray(),
    db.topics.toArray(),
    db.questions.toArray(),
    db.attempts.toArray(),
    db.quizSessions.toArray(),
    db.studySessions.toArray(),
    db.dailyAllocations.toArray(),
    db.studySchedules.toArray(),
    db.materials.toArray(),
    db.userSettings.toArray(),
  ]);

  const sanitizedMaterials = materials.map(m => ({
    ...m,
    fileBlob: undefined,
  }));

  const backup: BackupData = {
    version: 2,
    app: 'StudyOS-Nepal',
    exportedAt: new Date().toISOString(),
    data: {
      targets,
      subjects,
      topics,
      questions,
      attempts,
      quizSessions,
      studySessions,
      dailyAllocations,
      studySchedules,
      materials: sanitizedMaterials,
      userSettings,
    },
  };

  return JSON.stringify(backup, null, 2);
}

export function validateBackupData(jsonString: string): { isValid: boolean; error?: string; preview?: any } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Invalid JSON file format' };
    }
    if (!parsed.data || !Array.isArray(parsed.data.targets) || !Array.isArray(parsed.data.questions)) {
      return { isValid: false, error: 'Invalid StudyOS backup: Missing targets or questions tables' };
    }
    return {
      isValid: true,
      preview: {
        exportedAt: parsed.exportedAt,
        targetCount: parsed.data.targets.length,
        questionCount: parsed.data.questions.length,
        attemptsCount: parsed.data.attempts?.length || 0,
        sessionsCount: parsed.data.studySessions?.length || 0,
      },
    };
  } catch (err: any) {
    return { isValid: false, error: err.message || 'Failed to parse JSON file' };
  }
}

export async function restoreBackupData(jsonString: string, mode: 'overwrite' | 'merge' = 'overwrite'): Promise<void> {
  const validation = validateBackupData(jsonString);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const backup: BackupData = JSON.parse(jsonString);
  const data = backup.data;

  if (mode === 'overwrite') {
    await Promise.all([
      db.targets.clear(),
      db.subjects.clear(),
      db.topics.clear(),
      db.questions.clear(),
      db.attempts.clear(),
      db.quizSessions.clear(),
      db.studySessions.clear(),
      db.dailyAllocations.clear(),
      db.studySchedules.clear(),
      db.materials.clear(),
    ]);
  }

  if (data.targets?.length) await db.targets.bulkPut(data.targets);
  if (data.subjects?.length) await db.subjects.bulkPut(data.subjects);
  if (data.topics?.length) await db.topics.bulkPut(data.topics);
  if (data.questions?.length) await db.questions.bulkPut(data.questions);
  if (data.attempts?.length) await db.attempts.bulkPut(data.attempts);
  if (data.quizSessions?.length) await db.quizSessions.bulkPut(data.quizSessions);
  if (data.studySessions?.length) await db.studySessions.bulkPut(data.studySessions);
  if (data.dailyAllocations?.length) await db.dailyAllocations.bulkPut(data.dailyAllocations);
  if (data.studySchedules?.length) await db.studySchedules.bulkPut(data.studySchedules);
  if (data.materials?.length) await db.materials.bulkPut(data.materials as any);
  if (data.userSettings?.length) await db.userSettings.bulkPut(data.userSettings);
}

export function exportQuestionsToCSV(questions: Question[]): string {
  const headers = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Difficulty', 'Explanation', 'Source', 'Year'];
  const rows = questions.map((q: any) => {
    const optA = q.options?.find((o: any) => o.id === 'A')?.text || q.option_a || '';
    const optB = q.options?.find((o: any) => o.id === 'B')?.text || q.option_b || '';
    const optC = q.options?.find((o: any) => o.id === 'C')?.text || q.option_c || '';
    const optD = q.options?.find((o: any) => o.id === 'D')?.text || q.option_d || '';
    const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

    return [
      escape(q.questionText || q.question_text),
      escape(optA),
      escape(optB),
      escape(optC),
      escape(optD),
      escape(q.correctOptionId || q.correct_answer || ''),
      escape(q.difficulty || 'medium'),
      escape(q.explanation || ''),
      escape(q.source || ''),
      q.year ? String(q.year) : '',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
