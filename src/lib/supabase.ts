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

export type ActiveUserProfile = 'siddhartha' | 'shilpa';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export const USER_PROFILES: Record<ActiveUserProfile, UserProfile> = {
  siddhartha: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Siddhartha',
    email: 'siddhartha@studydashboard.local',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Siddhartha',
  },
  shilpa: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Shilpa',
    email: 'shilpa@studydashboard.local',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Shilpa',
  }
};
