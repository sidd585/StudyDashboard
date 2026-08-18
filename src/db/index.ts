import Dexie, { type Table } from 'dexie';
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

export class StudyOSDatabase extends Dexie {
  targets!: Table<Target, string>;
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  questions!: Table<Question, string>;
  attempts!: Table<Attempt, string>;
  quizSessions!: Table<QuizSession, string>;
  studySessions!: Table<StudySession, string>;
  dailyAllocations!: Table<DailyAllocation, string>;
  studySchedules!: Table<StudySchedule, string>;
  materials!: Table<Material, string>;
  userSettings!: Table<UserSettings, string>;

  constructor() {
    super('StudyOSDatabaseV2');

    this.version(1).stores({
      targets: 'id, userId, name, type, isArchived, createdAt',
      subjects: 'id, userId, targetId, name, createdAt',
      topics: 'id, userId, targetId, subjectId, name, createdAt',
      questions: 'id, userId, targetId, subjectId, topicId, source, difficulty, isShared, isBookmarked, isDifficult, createdAt',
      attempts: 'id, userId, questionId, targetId, subjectId, isCorrect, timestamp',
      quizSessions: 'id, userId, targetId, mode, status, startedAt, completedAt',
      studySessions: 'id, userId, targetId, subjectId, startTime, endTime, createdAt',
      dailyAllocations: 'id, userId, targetId, date, [userId+targetId+date]',
      studySchedules: 'id, userId, targetId, date, isCompleted, emailReminderSent',
      materials: 'id, userId, targetId, type, isShared, createdAt',
      userSettings: 'userId'
    });
  }
}

export const db = new StudyOSDatabase();

export const DEFAULT_USER_SETTINGS: UserSettings = {
  userId: '11111111-1111-1111-1111-111111111111',
  theme: 'dark',
  emailNotificationsEnabled: true,
  reminder15minEnabled: true,
  dailySummary10pmEnabled: true,
  timezone: 'Asia/Kathmandu',
  defaultMarks: 1,
  defaultNegative: 0.25,
  recipientEmail: 'user@studydashboard.local',
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const current = await db.userSettings.get(userId);
  if (!current) {
    const initial = { ...DEFAULT_USER_SETTINGS, userId };
    await db.userSettings.put(initial);
    return initial;
  }
  return current;
}

export async function updateUserSettings(userId: string, partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const updated = { ...current, ...partial };
  await db.userSettings.put(updated);
  return updated;
}
