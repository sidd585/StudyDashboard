import type {
  CloudCourse,
  CloudSubject,
  CloudTopic,
  CloudQuestion,
  CloudSubjectivePaper,
  CloudStudySession,
  CloudPracticeSession,
  CloudPlannerSession,
  CloudStudyRelationship,
  Profile,
  ApplicationRole,
  AccountStatus,
} from '../lib/supabase';

// Re-export cloud types
export type {
  CloudCourse,
  CloudSubject,
  CloudTopic,
  CloudQuestion,
  CloudSubjectivePaper,
  CloudStudySession,
  CloudPracticeSession,
  CloudPlannerSession,
  CloudStudyRelationship,
  Profile,
  ApplicationRole,
  AccountStatus,
};

// Option representation
export interface QuestionOption {
  id: string;
  text: string;
}

// Aliases for backward compatibility
export type Target = any;
export type Subject = any;
export type Topic = any;
export type Question = any;
export type Attempt = any;
export type QuizSession = any;
export type StudySession = any;
export type DailyAllocation = any;
export type StudySchedule = any;
export type Material = any;
export type MaterialType = 'note' | 'syllabus' | 'summary' | 'pdf' | 'link';
export type TargetType = 'Competitive Exam' | 'College' | 'Certification' | 'Skill';
export type UserSettings = any;
export type ExtractedQuestion = any;
export type AIResearchSummary = any;
export type AIPracticeBlueprint = any;
export type AIGeneratedQuestionCandidate = any;
export type QuestionOrigin = any;

export type StudyActivityType = 'Reading' | 'MCQ Practice' | 'Revision' | 'Problem Solving';
export type Difficulty = 'easy' | 'medium' | 'hard';

// User display profile
export interface UserProfileDisplay {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: ApplicationRole;
  status: AccountStatus;
  dailyGoalMinutes: number;
  managedBy?: string | null;
  visibleToSubAdmin?: boolean;
}

// Syllabus Extractor Hierarchy types
export interface ExtractedLessonItem {
  name: string;
  code?: string;
  description?: string;
  sortOrder: number;
}

export interface ExtractedTopicSection {
  name: string;
  code?: string;
  description?: string;
  sortOrder: number;
  lessons: ExtractedLessonItem[];
}

export interface SyllabusExtractionResult {
  fileName: string;
  totalTopics: number;
  totalLessons: number;
  sections: ExtractedTopicSection[];
}

// Practice Quiz Configuration
export interface QuizConfig {
  mode: 'practice' | 'exam';
  title: string;
  courseId: string;
  subjectId?: string;
  topicIds: string[];
  questionCount: number;
  durationMinutes?: number;
  marksPerCorrect: number;
  negativeMarks: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  immediateFeedback?: boolean;
}

// Friend Summary Stats for Together Room
export interface FriendSummaryStats {
  userId: string;
  displayName: string;
  avatarUrl: string;
  todayFocusMinutes: number;
  weekFocusMinutes: number;
  monthFocusMinutes: number;
  dailyGoalMinutes: number;
  todayGoalPct: number;
  streakDays: number;
  activeDaysWeek: number;
  todayAccuracy: number;
  monthAccuracy: number;
  plannerCompletionPct: number;
}
