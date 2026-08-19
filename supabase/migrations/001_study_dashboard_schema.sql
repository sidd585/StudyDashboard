-- ==============================================================================
-- STUDYDASHBOARD — PRODUCTION SUPABASE CLOUD SCHEMA & RLS MIGRATION
-- Migration: 001_study_dashboard_schema.sql
-- Idempotent script: Safe to run multiple times in Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Application Enums (idempotent creation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_role') THEN
        CREATE TYPE application_role AS ENUM ('MAIN_ADMIN', 'SUB_ADMIN', 'USER');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
        CREATE TYPE account_status AS ENUM ('ACTIVE', 'DEACTIVATED', 'PENDING');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'answer_status') THEN
        CREATE TYPE answer_status AS ENUM ('VALID', 'UNCERTAIN', 'SAMPLE');
    END IF;
END $$;

-- ==============================================================================
-- 3. CORE APPLICATION TABLES
-- ==============================================================================

-- Profiles Table (Linked 1:1 with Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role application_role NOT NULL DEFAULT 'USER',
    managed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status account_status NOT NULL DEFAULT 'ACTIVE',
    daily_goal_minutes INTEGER DEFAULT 120,
    timezone TEXT DEFAULT 'Asia/Kathmandu',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Courses / Targets Table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    daily_goal_minutes INTEGER DEFAULT 60,
    color TEXT DEFAULT '#5b5bd6',
    is_sample BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Syllabus Documents Table
CREATE TABLE IF NOT EXISTS public.syllabus_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    parsed_sections JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Topics & Subtopics (Recursive hierarchy)
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    parent_topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    code TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Questions Bank (MCQs)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    subtopic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT, -- 'A', 'B', 'C', 'D', or 'UNKNOWN'
    answer_status answer_status NOT NULL DEFAULT 'VALID',
    explanation TEXT,
    source_file_id TEXT,
    source_page INTEGER,
    original_question_number INTEGER,
    is_sample BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Focus Study Sessions
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    paused_milliseconds BIGINT DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'ACTIVE', 'PAUSED', 'COMPLETED'
    focus_rating INTEGER,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MCQ Practice Sessions
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'PRACTICE', -- 'PRACTICE', 'TIMED'
    question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    score NUMERIC(5,2) DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    unanswered_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Practice Answer Details
CREATE TABLE IF NOT EXISTS public.practice_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    answered_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    marked_for_review BOOLEAN DEFAULT FALSE
);

-- Planner Sessions
CREATE TABLE IF NOT EXISTS public.planner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 45,
    reminder_enabled BOOLEAN DEFAULT TRUE,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Study Materials / Notes Metadata
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Email & Reminder Preferences
CREATE TABLE IF NOT EXISTS public.email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_report_enabled BOOLEAN DEFAULT TRUE,
    daily_report_time TEXT DEFAULT '22:00',
    study_reminders_enabled BOOLEAN DEFAULT TRUE,
    reminder_minutes_before INTEGER DEFAULT 15,
    timezone TEXT DEFAULT 'Asia/Kathmandu',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Friend Relationships (Siddhartha ↔ Shilpa and other study partners)
CREATE TABLE IF NOT EXISTS public.study_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_compare BOOLEAN DEFAULT TRUE,
    can_view_summary BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_study_relationship UNIQUE(owner_user_id, friend_user_id)
);

-- User Invitations (Admin and Sub-Admin invites)
CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role application_role NOT NULL DEFAULT 'USER',
    managed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REVOKED'
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 4. PERFORMANCE & LOOKUP INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_managed_by ON public.profiles(managed_by);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

CREATE INDEX IF NOT EXISTS idx_courses_user_id ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_archived ON public.courses(user_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_topics_user_course ON public.topics(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent ON public.topics(parent_topic_id);

CREATE INDEX IF NOT EXISTS idx_questions_user_course ON public.questions(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic ON public.questions(subtopic_id);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_time ON public.study_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON public.study_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON public.practice_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_answers_session ON public.practice_answers(practice_session_id);

CREATE INDEX IF NOT EXISTS idx_planner_user_start ON public.planner_sessions(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_materials_user ON public.materials(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_users ON public.study_relationships(owner_user_id, friend_user_id);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if requesting user is MAIN_ADMIN
CREATE OR REPLACE FUNCTION public.is_main_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'MAIN_ADMIN' AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if requesting user is SUB_ADMIN
CREATE OR REPLACE FUNCTION public.is_sub_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('MAIN_ADMIN', 'SUB_ADMIN') AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR public.is_main_admin()
        OR (public.is_sub_admin() AND managed_by = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.study_relationships
            WHERE active = TRUE AND (
                (owner_user_id = auth.uid() AND friend_user_id = public.profiles.id)
                OR (friend_user_id = auth.uid() AND owner_user_id = public.profiles.id)
            )
        )
    );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_main_admin())
    WITH CHECK (auth.uid() = id OR public.is_main_admin());

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles
    FOR ALL USING (public.is_main_admin());

-- Standard User-Owned Table Policies (Courses, Topics, Questions, Study, Practice, Planner, Materials)
-- Courses
DROP POLICY IF EXISTS "User courses isolation" ON public.courses;
CREATE POLICY "User courses isolation" ON public.courses
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Syllabus Documents
DROP POLICY IF EXISTS "User syllabus isolation" ON public.syllabus_documents;
CREATE POLICY "User syllabus isolation" ON public.syllabus_documents
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Topics
DROP POLICY IF EXISTS "User topics isolation" ON public.topics;
CREATE POLICY "User topics isolation" ON public.topics
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Questions
DROP POLICY IF EXISTS "User questions isolation" ON public.questions;
CREATE POLICY "User questions isolation" ON public.questions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Study Sessions
DROP POLICY IF EXISTS "User study sessions isolation" ON public.study_sessions;
CREATE POLICY "User study sessions isolation" ON public.study_sessions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Practice Sessions
DROP POLICY IF EXISTS "User practice sessions isolation" ON public.practice_sessions;
CREATE POLICY "User practice sessions isolation" ON public.practice_sessions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Practice Answers
DROP POLICY IF EXISTS "User practice answers isolation" ON public.practice_answers;
CREATE POLICY "User practice answers isolation" ON public.practice_answers
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Planner Sessions
DROP POLICY IF EXISTS "User planner isolation" ON public.planner_sessions;
CREATE POLICY "User planner isolation" ON public.planner_sessions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Materials
DROP POLICY IF EXISTS "User materials isolation" ON public.materials;
CREATE POLICY "User materials isolation" ON public.materials
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Email Preferences
DROP POLICY IF EXISTS "User email preferences isolation" ON public.email_preferences;
CREATE POLICY "User email preferences isolation" ON public.email_preferences
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Study Relationships
DROP POLICY IF EXISTS "User study relationships access" ON public.study_relationships;
CREATE POLICY "User study relationships access" ON public.study_relationships
    FOR ALL USING (
        auth.uid() = owner_user_id 
        OR auth.uid() = friend_user_id
        OR public.is_main_admin()
    )
    WITH CHECK (
        auth.uid() = owner_user_id 
        OR public.is_main_admin()
    );

-- Invitations Policies
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.user_invitations;
CREATE POLICY "Admins can manage invitations" ON public.user_invitations
    FOR ALL USING (
        public.is_main_admin() 
        OR (public.is_sub_admin() AND invited_by = auth.uid())
    )
    WITH CHECK (
        public.is_main_admin() 
        OR (public.is_sub_admin() AND invited_by = auth.uid())
    );

-- ==============================================================================
-- 6. SECURE RPC FUNCTIONS FOR AGGREGATES & TOGETHER ROOM
-- ==============================================================================

-- RPC: Get permitted Friend Progress Summary (Never exposes private questions/notes)
CREATE OR REPLACE FUNCTION public.get_friend_progress_summary(p_friend_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_has_access BOOLEAN;
    v_can_view_summary BOOLEAN;
    v_today_start TIMESTAMPTZ;
    v_week_start TIMESTAMPTZ;
    v_today_focus_mins INT := 0;
    v_today_mcqs INT := 0;
    v_today_correct INT := 0;
    v_week_focus_mins INT := 0;
    v_week_mcqs INT := 0;
    v_week_correct INT := 0;
    v_streak_days INT := 0;
    v_friend_name TEXT;
    v_friend_avatar TEXT;
BEGIN
    -- Check relationship authorization
    SELECT can_view_summary INTO v_can_view_summary
    FROM public.study_relationships
    WHERE active = TRUE
      AND ((owner_user_id = auth.uid() AND friend_user_id = p_friend_user_id)
           OR (friend_user_id = auth.uid() AND owner_user_id = p_friend_user_id))
    LIMIT 1;

    IF v_can_view_summary IS NULL AND NOT public.is_main_admin() THEN
        RAISE EXCEPTION 'Access Denied: No active relationship with user %', p_friend_user_id;
    END IF;

    -- Fetch user profile header
    SELECT display_name, avatar_url INTO v_friend_name, v_friend_avatar
    FROM public.profiles
    WHERE id = p_friend_user_id;

    -- Day boundaries (Asia/Kathmandu offset approx UTC+5:45)
    v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kathmandu') AT TIME ZONE 'Asia/Kathmandu';
    v_week_start := v_today_start - INTERVAL '6 days';

    -- Aggregate today's focus minutes
    SELECT COALESCE(SUM(duration_seconds) / 60, 0) INTO v_today_focus_mins
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_today_start;

    -- Aggregate today's MCQs
    SELECT COALESCE(SUM(correct_count + wrong_count + unanswered_count), 0),
           COALESCE(SUM(correct_count), 0)
    INTO v_today_mcqs, v_today_correct
    FROM public.practice_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_today_start;

    -- Aggregate 7-day focus minutes
    SELECT COALESCE(SUM(duration_seconds) / 60, 0) INTO v_week_focus_mins
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_week_start;

    -- Aggregate 7-day MCQs
    SELECT COALESCE(SUM(correct_count + wrong_count + unanswered_count), 0),
           COALESCE(SUM(correct_count), 0)
    INTO v_week_mcqs, v_week_correct
    FROM public.practice_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_week_start;

    -- Calculate streak
    SELECT COUNT(DISTINCT date_trunc('day', started_at AT TIME ZONE 'Asia/Kathmandu'))
    INTO v_streak_days
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= (now() - INTERVAL '30 days');

    RETURN jsonb_build_object(
        'userId', p_friend_user_id,
        'displayName', v_friend_name,
        'avatarUrl', v_friend_avatar,
        'todayFocusMinutes', v_today_focus_mins,
        'todayMcqs', v_today_mcqs,
        'todayAccuracy', CASE WHEN v_today_mcqs > 0 THEN ROUND((v_today_correct::numeric / v_today_mcqs::numeric) * 100) ELSE 0 END,
        'weekFocusMinutes', v_week_focus_mins,
        'weekMcqs', v_week_mcqs,
        'weekAccuracy', CASE WHEN v_week_mcqs > 0 THEN ROUND((v_week_correct::numeric / v_week_mcqs::numeric) * 100) ELSE 0 END,
        'streakDays', v_streak_days
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. AUTH TRIGGER: AUTO-PROFILE CREATION & BOOTSTRAP MAIN_ADMIN
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, extensions
LANGUAGE plpgsql
AS $$
DECLARE
    v_role public.application_role := 'MAIN_ADMIN';
    v_has_admin BOOLEAN := FALSE;
    v_display_name TEXT;
    v_avatar TEXT := '/avatars/panda.png';
BEGIN
    -- Check if any MAIN_ADMIN exists
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles WHERE role = 'MAIN_ADMIN'
        ) INTO v_has_admin;
        
        IF v_has_admin THEN
            v_role := 'USER';
        ELSE
            v_role := 'MAIN_ADMIN';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_role := 'MAIN_ADMIN';
    END;

    -- Extract display name
    v_display_name := COALESCE(
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1),
        'Siddhartha'
    );

    IF v_display_name ILIKE '%shilpa%' THEN
        v_avatar := '/avatars/whale.png';
    ELSE
        v_avatar := '/avatars/panda.png';
    END IF;

    -- Insert Profile
    BEGIN
        INSERT INTO public.profiles (
            id,
            email,
            display_name,
            role,
            status,
            daily_goal_minutes,
            timezone,
            avatar_url
        ) VALUES (
            new.id,
            COALESCE(new.email, ''),
            v_display_name,
            v_role,
            'ACTIVE',
            120,
            'Asia/Kathmandu',
            v_avatar
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = now();
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating profile in trigger: %', SQLERRM;
    END;

    -- Insert default email preferences
    BEGIN
        INSERT INTO public.email_preferences (
            user_id,
            daily_report_enabled,
            daily_report_time,
            study_reminders_enabled,
            reminder_minutes_before,
            timezone
        ) VALUES (
            new.id,
            TRUE,
            '22:00',
            TRUE,
            15,
            'Asia/Kathmandu'
        ) ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating email preferences in trigger: %', SQLERRM;
    END;

    RETURN new;
END;
$$;

-- Trigger definition on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 8. STORAGE BUCKET CREATION & ACCESS POLICIES
-- ==============================================================================
-- Create private bucket 'study-files' if not present
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-files', 'study-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS: Users can only upload and read files inside their own folder: /{user_id}/*
DROP POLICY IF EXISTS "Users own storage files select" ON storage.objects;
CREATE POLICY "Users own storage files select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'study-files' 
        AND (auth.uid())::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users own storage files insert" ON storage.objects;
CREATE POLICY "Users own storage files insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'study-files' 
        AND (auth.uid())::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users own storage files delete" ON storage.objects;
CREATE POLICY "Users own storage files delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'study-files' 
        AND (auth.uid())::text = (storage.foldername(name))[1]
    );

-- Done!
