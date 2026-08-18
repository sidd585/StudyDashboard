import { createClient } from '@supabase/supabase-js';

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
const procEnv = typeof process !== 'undefined' ? process.env || {} : {};

const supabaseUrl = metaEnv.VITE_SUPABASE_URL || procEnv.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type ActiveUserProfile = 'user1' | 'user2';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export const USER_PROFILES: Record<ActiveUserProfile, UserProfile> = {
  user1: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Primary Account',
    email: 'user1@studydashboard.local',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=User1',
  },
  user2: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Study Partner',
    email: 'user2@studydashboard.local',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=User2',
  }
};
