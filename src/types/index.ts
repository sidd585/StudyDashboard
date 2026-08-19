export type TargetType = 'Competitive Exam' | 'College' | 'Course' | 'Certification' | 'Custom';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type StudyActivityType = 'Reading' | 'MCQ Practice' | 'Mock Test' | 'Revision' | 'Notes';
export type QuizMode = 'practice' | 'exam' | 'mistake_review';

export interface QuestionOption {
  id: string; // 'A' | 'B' | 'C' | 'D'
  text: string;
}

export interface QuestionStats {
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  lastAttemptedAt?: number;
  lastResult?: 'correct' | 'wrong';
  consecutiveCorrect: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewDate?: number;
}

export interface Target {
  id: string;
  userId: string;
  name: string;
  type: TargetType;
  color: string;
  icon: string;
  deadlineDate?: string; // YYYY-MM-DD
  dailyGoalMinutes: number;
  weeklyGoalMinutes: number;
  targetQuestionGoal: number;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  userId: string;
  targetId: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Topic {
  id: string;
  userId: string;
  targetId: string;
  subjectId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DailyAllocation {
  id: string;
  userId: string;
  targetId: string;
  date: string; // YYYY-MM-DD
  plannedMinutes: number;
  createdAt: number;
}

export type QuestionOrigin =
  | 'IMPORTED_OLD_QUESTION'
  | 'USER_CREATED'
  | 'AI_GENERATED'
  | 'AI_PAST_PATTERN'
  | 'SHARED';

export interface Question {
  id: string;
  userId: string;
  targetId: string;
  subjectId?: string;
  topicId?: string;
  questionText: string;
  options: QuestionOption[];
  correctOptionId: string | null;
  explanation: string;
  source?: string;
  year?: number | null;
  difficulty: Difficulty;
  origin?: QuestionOrigin;
  isShared: boolean; // Shared with Study Together partner
  isBookmarked: boolean;
  isDifficult: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  stats: QuestionStats;
}

export interface AIResearchTopic {
  topic: string;
  weight: 'High' | 'Medium' | 'Low';
  subtopics?: string[];
  observedFrequency?: string;
}

export interface AIResearchSourceItem {
  tier: 'Tier 1 - Official' | 'Tier 2 - User Verified' | 'Tier 3 - Secondary';
  domain: string;
  description: string;
}

export interface AIResearchSummary {
  officialSyllabusFound: boolean;
  documentsAnalyzed: number;
  officialSourcesCount: number;
  secondarySourcesCount: number;
  hasHistoricalEvidence?: boolean;
  evidenceMessage?: string | null;
  sources: string[];
  tierSources?: AIResearchSourceItem[];
  observedTopics: AIResearchTopic[];
  notes?: string;
}

export interface AIPracticeBlueprint {
  title: string;
  targetId: string;
  targetName: string;
  topic: string;
  totalQuestions: number;
  topicDistribution: Record<string, number>;
  difficultyDistribution: {
    easy: number;
    moderate: number;
    hard: number;
  };
  styleDistribution: {
    directConcept: number;
    comparison: number;
    scenario: number;
    problemSolving: number;
    pastPattern: number;
  };
}

export interface AIGeneratedQuestionCandidate {
  tempId: string;
  number: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  origin: QuestionOrigin;
  status: 'VALIDATED' | 'NEEDS_REVIEW' | 'REJECTED';
  issues: string[];
  approved: boolean;
}

export interface QuizConfig {
  mode: QuizMode;
  title: string;
  targetId?: string;
  subjectIds: string[];
  topicIds: string[];
  questionCount: number;
  durationMinutes?: number;
  marksPerCorrect: number;
  negativeMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  immediateFeedback: boolean;
  specificQuestionIds?: string[];
}

export interface QuizSession {
  id: string;
  userId: string;
  targetId?: string;
  title: string;
  mode: QuizMode;
  status: 'in_progress' | 'completed' | 'abandoned';
  config: QuizConfig;
  questionIds: string[];
  answers: Record<string, {
    selectedOptionId: string | null;
    isMarkedForReview: boolean;
    responseTimeMs: number;
    answeredAt?: number;
  }>;
  currentQuestionIndex: number;
  startedAt: number;
  completedAt: number | null;
  timeRemainingSeconds?: number;
  totalTimeSpentMs: number;
  score?: number;
  accuracy?: number;
  netScore?: number;
}

export interface Attempt {
  id: string;
  userId: string;
  questionId: string;
  sessionId?: string;
  targetId: string;
  subjectId?: string;
  topicId?: string;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  isCorrect: boolean;
  isSkipped: boolean;
  responseTimeMs: number;
  mode: QuizMode;
  timestamp: number;
}

export interface StudySession {
  id: string;
  userId: string;
  targetId: string;
  subjectId?: string;
  topicId?: string;
  activityType: StudyActivityType;
  startTime: number;
  endTime: number;
  focusedMinutes: number;
  breakMinutes: number;
  focusRating?: number; // 1 to 5
  notes?: string;
  isAutoTracked?: boolean;
  createdAt: number;
}

export interface StudySchedule {
  id: string;
  userId: string;
  targetId: string;
  subjectId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  notes?: string;
  isCompleted: boolean;
  emailReminderSent: boolean;
  createdAt: number;
}

export type MaterialType = 'pdf' | 'note' | 'image';

export interface Material {
  id: string;
  userId: string;
  targetId: string;
  subjectId?: string;
  title: string;
  type: MaterialType;
  storagePath?: string;
  content?: string;
  fileBlob?: Blob;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isShared: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  emailNotificationsEnabled: boolean;
  reminder15minEnabled: boolean;
  dailySummary10pmEnabled: boolean;
  timezone: string; // 'Asia/Kathmandu'
  defaultMarks: number;
  defaultNegative: number;
  recipientEmail?: string;
}

export interface ExtractedQuestion {
  tempId: string;
  rawQuestionNumber?: string;
  questionText: string;
  options: { id: string; text: string }[];
  detectedAnswer: string | null;
  explanation: string;
  sourcePage?: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceReason?: string;
  isDuplicate?: boolean;
  duplicateMatchId?: string;
  duplicateMatchText?: string;
  targetId?: string;
  subjectId?: string;
  topicId?: string;
  tags?: string[];
  approved: boolean;
  hasParsingIssues?: boolean;
  parsingIssues?: string[];
  status?: 'valid' | 'needs_review' | 'answer_unknown';
  rawSourceText?: string;
  difficulty?: Difficulty;
  source?: string;
}
