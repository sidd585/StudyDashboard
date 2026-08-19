import { createClient } from '@supabase/supabase-js';

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
const procEnv = typeof process !== 'undefined' ? process.env || {} : {};

function sanitizeConfigVal(val: any): string {
  if (typeof val !== 'string') return '';
  let clean = val.replace(/[\r\n\t]/g, '').replace(/^['"]+|['"]+$/g, '').trim();
  // Strip accidental key prefixes if the entire line was copied
  if (clean.includes('=')) {
    clean = clean.split('=').pop()?.trim() || clean;
  }
  return clean;
}

const rawUrl = metaEnv.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || 'https://oiorstuenjiztoqzbyvt.supabase.co';
const rawKey = 
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || 
  metaEnv.VITE_SUPABASE_ANON_KEY || 
  procEnv.VITE_SUPABASE_PUBLISHABLE_KEY || 
  procEnv.VITE_SUPABASE_ANON_KEY || 
  'sb_publishable__sjEkh85BxZnm9V_FAydLg_58mtppgc';

export const supabaseUrl = sanitizeConfigVal(rawUrl);
export const supabasePublishableKey = sanitizeConfigVal(rawKey);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabasePublishableKey && 
  !supabaseUrl.includes('placeholder')
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'studydashboard_auth_session',
  }
});

// Types for Cloud Entities
export type ApplicationRole = 'MAIN_ADMIN' | 'SUB_ADMIN' | 'USER';
export type AccountStatus = 'ACTIVE' | 'DEACTIVATED' | 'PENDING';
export type AnswerStatus = 'VALID' | 'UNCERTAIN' | 'SAMPLE';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: ApplicationRole;
  managed_by?: string | null;
  status: AccountStatus;
  daily_goal_minutes: number;
  timezone: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CloudCourse {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  daily_goal_minutes: number;
  color: string;
  is_sample: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudTopic {
  id: string;
  user_id: string;
  course_id: string;
  parent_topic_id?: string | null;
  code?: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface CloudQuestion {
  id: string;
  user_id: string;
  course_id: string;
  topic_id?: string | null;
  subtopic_id?: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer?: string | null;
  answer_status: AnswerStatus;
  explanation?: string | null;
  source_file_id?: string;
  source_page?: number;
  original_question_number?: number;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudStudySession {
  id: string;
  user_id: string;
  course_id: string;
  topic_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  paused_milliseconds: number;
  duration_seconds: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  focus_rating?: number;
  note?: string;
  created_at: string;
}

export interface CloudPracticeSession {
  id: string;
  user_id: string;
  course_id: string;
  mode: 'PRACTICE' | 'TIMED';
  question_ids: string[];
  started_at: string;
  submitted_at?: string | null;
  duration_seconds: number;
  score: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  created_at: string;
}

export interface CloudPlannerSession {
  id: string;
  user_id: string;
  course_id: string;
  topic_id?: string | null;
  title: string;
  start_time: string;
  end_time?: string | null;
  duration_minutes: number;
  reminder_enabled: boolean;
  is_completed: boolean;
  created_at: string;
}

export interface CloudStudyRelationship {
  id: string;
  owner_user_id: string;
  friend_user_id: string;
  can_compare: boolean;
  can_view_summary: boolean;
  active: boolean;
  created_at: string;
}

export const USER_PROFILES = {
  siddhartha: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Siddhartha',
    email: 'siddhartha@studydashboard.local',
    avatarUrl: '/avatars/panda.png',
  },
  shilpa: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Shilpa',
    email: 'shilpa@studydashboard.local',
    avatarUrl: '/avatars/whale.png',
  }
};

