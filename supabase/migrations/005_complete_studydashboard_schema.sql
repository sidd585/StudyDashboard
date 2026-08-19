-- ==============================================================================
-- STUDYDASHBOARD — COMPLETE SUPABASE CLOUD SCHEMA & RLS MIGRATION
-- Migration: 005_complete_studydashboard_schema.sql
-- Idempotent script: Safe to run multiple times in Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Application Enums (idempotent creation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_role') THEN
        CREATE TYPE application_role AS ENUM ('MAIN_ADMIN', 'SUB_ADMIN', 'USER', 'FRIEND');
    ELSE
        -- Ensure 'FRIEND' is a valid label if enum exists
        BEGIN
            ALTER TYPE application_role ADD VALUE IF NOT EXISTS 'FRIEND';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
        CREATE TYPE account_status AS ENUM ('ACTIVE', 'DEACTIVATED', 'PENDING', 'PENDING_APPROVAL');
    ELSE
        BEGIN
            ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
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
    status account_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    visible_to_sub_admin BOOLEAN NOT NULL DEFAULT TRUE,
    daily_goal_minutes INTEGER DEFAULT 150,
    timezone TEXT DEFAULT 'Asia/Kathmandu',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add visible_to_sub_admin column if missing
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS visible_to_sub_admin BOOLEAN NOT NULL DEFAULT TRUE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    year INTEGER DEFAULT 2027,
    daily_goal_minutes INTEGER DEFAULT 60,
    color TEXT DEFAULT '#5b5bd6',
    is_sample BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add year column if missing
DO $$ BEGIN
    ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 2027;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Subjects / Papers Table (Course -> Subject / Paper)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Topics & Lessons Table (Recursive / Parent-Child: Top-level units e.g. 1..6 and lessons e.g. 1.1..1.4)
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    parent_topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    code TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add subject_id column to topics if missing
DO $$ BEGIN
    ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Syllabus Documents Table
CREATE TABLE IF NOT EXISTS public.syllabus_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    parsed_sections JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Questions Bank (MCQs)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
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
    year INTEGER DEFAULT 2027,
    source_file_id TEXT,
    source_page INTEGER,
    original_question_number INTEGER,
    is_sample BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add subject_id & year to questions if missing
DO $$ BEGIN
    ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
    ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 2027;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Subjective / Long Questions & Papers Archive
CREATE TABLE IF NOT EXISTS public.subjective_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    paper_title TEXT NOT NULL,
    year INTEGER DEFAULT 2027,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    solution_path TEXT,
    is_shared_friend BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Focus Study Sessions
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    paused_milliseconds BIGINT DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'ACTIVE', 'PAUSED', 'COMPLETED'
    focus_rating INTEGER,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$ BEGIN
    ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
    ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- MCQ Practice Sessions
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
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

-- Planner Sessions (Weekly & Daily study timetable)
CREATE TABLE IF NOT EXISTS public.planner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 45,
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_minutes_before INTEGER DEFAULT 15,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$ BEGIN
    ALTER TABLE public.planner_sessions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
    ALTER TABLE public.planner_sessions ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;
    ALTER TABLE public.planner_sessions ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE public.planner_sessions ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER DEFAULT 15;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Friend Relationships (Super Admin ↔ Selected Admin Friend)
CREATE TABLE IF NOT EXISTS public.study_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_compare BOOLEAN DEFAULT TRUE,
    can_view_summary BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_study_relationship UNIQUE(owner_user_id, friend_user_id)
);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjective_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_relationships ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_main_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'MAIN_ADMIN' AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
DROP POLICY IF EXISTS "Profiles visibility policy" ON public.profiles;
CREATE POLICY "Profiles visibility policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR public.is_main_admin()
        OR (public.is_sub_admin() AND managed_by = auth.uid() AND visible_to_sub_admin = TRUE)
        OR EXISTS (
            SELECT 1 FROM public.study_relationships
            WHERE active = TRUE AND (
                (owner_user_id = auth.uid() AND friend_user_id = public.profiles.id)
                OR (friend_user_id = auth.uid() AND owner_user_id = public.profiles.id)
            )
        )
    );

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id
        OR public.is_main_admin()
        OR (public.is_sub_admin() AND managed_by = auth.uid() AND visible_to_sub_admin = TRUE)
    );

DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id OR public.is_main_admin());

-- Standard User-Owned Table Isolation Policies
-- Courses
DROP POLICY IF EXISTS "Courses isolation" ON public.courses;
CREATE POLICY "Courses isolation" ON public.courses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Subjects
DROP POLICY IF EXISTS "Subjects isolation" ON public.subjects;
CREATE POLICY "Subjects isolation" ON public.subjects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Topics
DROP POLICY IF EXISTS "Topics isolation" ON public.topics;
CREATE POLICY "Topics isolation" ON public.topics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Syllabus Documents
DROP POLICY IF EXISTS "Syllabus documents isolation" ON public.syllabus_documents;
CREATE POLICY "Syllabus documents isolation" ON public.syllabus_documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Questions
DROP POLICY IF EXISTS "Questions isolation" ON public.questions;
CREATE POLICY "Questions isolation" ON public.questions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Subjective Papers
DROP POLICY IF EXISTS "Subjective papers isolation" ON public.subjective_papers;
CREATE POLICY "Subjective papers isolation" ON public.subjective_papers FOR ALL USING (
    auth.uid() = user_id
    OR (is_shared_friend = TRUE AND EXISTS (
        SELECT 1 FROM public.study_relationships
        WHERE active = TRUE AND (
            (owner_user_id = auth.uid() AND friend_user_id = public.subjective_papers.user_id)
            OR (friend_user_id = auth.uid() AND owner_user_id = public.subjective_papers.user_id)
        )
    ))
) WITH CHECK (auth.uid() = user_id);

-- Study Sessions
DROP POLICY IF EXISTS "Study sessions isolation" ON public.study_sessions;
CREATE POLICY "Study sessions isolation" ON public.study_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Practice Sessions
DROP POLICY IF EXISTS "Practice sessions isolation" ON public.practice_sessions;
CREATE POLICY "Practice sessions isolation" ON public.practice_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Practice Answers
DROP POLICY IF EXISTS "Practice answers isolation" ON public.practice_answers;
CREATE POLICY "Practice answers isolation" ON public.practice_answers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Planner Sessions
DROP POLICY IF EXISTS "Planner sessions isolation" ON public.planner_sessions;
CREATE POLICY "Planner sessions isolation" ON public.planner_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email Preferences
DROP POLICY IF EXISTS "Email preferences isolation" ON public.email_preferences;
CREATE POLICY "Email preferences isolation" ON public.email_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Study Relationships
DROP POLICY IF EXISTS "Study relationships isolation" ON public.study_relationships;
CREATE POLICY "Study relationships isolation" ON public.study_relationships FOR ALL USING (
    auth.uid() = owner_user_id
    OR auth.uid() = friend_user_id
    OR public.is_main_admin()
) WITH CHECK (
    auth.uid() = owner_user_id
    OR public.is_main_admin()
);

-- ==============================================================================
-- 5. SECURE RPC FUNCTIONS
-- ==============================================================================

-- RPC: Get permitted Friend Progress Summary for Together Room
CREATE OR REPLACE FUNCTION public.get_friend_progress_summary(p_friend_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_has_access BOOLEAN;
    v_today_start TIMESTAMPTZ;
    v_week_start TIMESTAMPTZ;
    v_month_start TIMESTAMPTZ;
    v_today_focus_mins INT := 0;
    v_today_mcqs INT := 0;
    v_today_correct INT := 0;
    v_week_focus_mins INT := 0;
    v_week_mcqs INT := 0;
    v_week_correct INT := 0;
    v_month_focus_mins INT := 0;
    v_month_mcqs INT := 0;
    v_month_correct INT := 0;
    v_streak_days INT := 0;
    v_active_days_week INT := 0;
    v_planner_completed INT := 0;
    v_planner_total INT := 0;
    v_course_count INT := 0;
    v_topic_count INT := 0;
    v_friend_name TEXT;
    v_friend_avatar TEXT;
    v_friend_daily_goal INT := 120;
BEGIN
    -- Check relationship authorization
    SELECT EXISTS (
        SELECT 1 FROM public.study_relationships
        WHERE active = TRUE
          AND ((owner_user_id = auth.uid() AND friend_user_id = p_friend_user_id)
               OR (friend_user_id = auth.uid() AND owner_user_id = p_friend_user_id))
    ) INTO v_has_access;

    IF NOT v_has_access AND NOT public.is_main_admin() THEN
        RAISE EXCEPTION 'Access Denied: No active relationship with user %', p_friend_user_id;
    END IF;

    -- Fetch user profile
    SELECT display_name, avatar_url, COALESCE(daily_goal_minutes, 120)
    INTO v_friend_name, v_friend_avatar, v_friend_daily_goal
    FROM public.profiles
    WHERE id = p_friend_user_id;

    -- Day boundaries (Asia/Kathmandu timezone)
    v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kathmandu') AT TIME ZONE 'Asia/Kathmandu';
    v_week_start := v_today_start - INTERVAL '6 days';
    v_month_start := v_today_start - INTERVAL '29 days';

    -- Today's focus minutes
    SELECT COALESCE(SUM(duration_seconds) / 60, 0) INTO v_today_focus_mins
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_today_start;

    -- Today's MCQs
    SELECT COALESCE(SUM(correct_count + wrong_count + unanswered_count), 0),
           COALESCE(SUM(correct_count), 0)
    INTO v_today_mcqs, v_today_correct
    FROM public.practice_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_today_start;

    -- 7-day focus minutes
    SELECT COALESCE(SUM(duration_seconds) / 60, 0) INTO v_week_focus_mins
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_week_start;

    -- 7-day MCQs
    SELECT COALESCE(SUM(correct_count + wrong_count + unanswered_count), 0),
           COALESCE(SUM(correct_count), 0)
    INTO v_week_mcqs, v_week_correct
    FROM public.practice_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_week_start;

    -- 30-day focus minutes
    SELECT COALESCE(SUM(duration_seconds) / 60, 0) INTO v_month_focus_mins
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_month_start;

    -- 30-day MCQs
    SELECT COALESCE(SUM(correct_count + wrong_count + unanswered_count), 0),
           COALESCE(SUM(correct_count), 0)
    INTO v_month_mcqs, v_month_correct
    FROM public.practice_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_month_start;

    -- Active study days in last 7 days
    SELECT COUNT(DISTINCT date_trunc('day', started_at AT TIME ZONE 'Asia/Kathmandu'))
    INTO v_active_days_week
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_week_start;

    -- Active study days in last 30 days
    SELECT COUNT(DISTINCT date_trunc('day', started_at AT TIME ZONE 'Asia/Kathmandu'))
    INTO v_streak_days
    FROM public.study_sessions
    WHERE user_id = p_friend_user_id AND started_at >= v_month_start;

    -- Planner completion rate
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = TRUE)
    INTO v_planner_total, v_planner_completed
    FROM public.planner_sessions
    WHERE user_id = p_friend_user_id AND start_time >= v_week_start;

    -- Course & Topic counts
    SELECT COUNT(*) INTO v_course_count FROM public.courses WHERE user_id = p_friend_user_id AND is_archived = FALSE;
    SELECT COUNT(*) INTO v_topic_count FROM public.topics WHERE user_id = p_friend_user_id;

    RETURN jsonb_build_object(
        'userId', p_friend_user_id,
        'displayName', v_friend_name,
        'avatarUrl', v_friend_avatar,
        'dailyGoalMinutes', v_friend_daily_goal,
        'todayFocusMinutes', v_today_focus_mins,
        'todayGoalPct', CASE WHEN v_friend_daily_goal > 0 THEN LEAST(100, ROUND((v_today_focus_mins::numeric / v_friend_daily_goal::numeric) * 100)) ELSE 0 END,
        'todayMcqs', v_today_mcqs,
        'todayAccuracy', CASE WHEN v_today_mcqs > 0 THEN ROUND((v_today_correct::numeric / v_today_mcqs::numeric) * 100) ELSE 0 END,
        'weekFocusMinutes', v_week_focus_mins,
        'weekGoalPct', CASE WHEN (v_friend_daily_goal * 7) > 0 THEN LEAST(100, ROUND((v_week_focus_mins::numeric / (v_friend_daily_goal * 7)::numeric) * 100)) ELSE 0 END,
        'weekMcqs', v_week_mcqs,
        'weekAccuracy', CASE WHEN v_week_mcqs > 0 THEN ROUND((v_week_correct::numeric / v_week_mcqs::numeric) * 100) ELSE 0 END,
        'monthFocusMinutes', v_month_focus_mins,
        'monthMcqs', v_month_mcqs,
        'monthAccuracy', CASE WHEN v_month_mcqs > 0 THEN ROUND((v_month_correct::numeric / v_month_mcqs::numeric) * 100) ELSE 0 END,
        'activeDaysWeek', v_active_days_week,
        'streakDays', v_streak_days,
        'plannerTotal', v_planner_total,
        'plannerCompleted', v_planner_completed,
        'plannerCompletionPct', CASE WHEN v_planner_total > 0 THEN ROUND((v_planner_completed::numeric / v_planner_total::numeric) * 100) ELSE 100 END,
        'courseCount', v_course_count,
        'topicCount', v_topic_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Admin Reset User Data
CREATE OR REPLACE FUNCTION public.admin_reset_user_data(p_target_user_id UUID, p_reset_type TEXT)
RETURNS JSONB AS $$
DECLARE
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- Check permissions
    IF public.is_main_admin() THEN
        v_is_authorized := TRUE;
    ELSIF public.is_sub_admin() THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = p_target_user_id AND managed_by = auth.uid() AND visible_to_sub_admin = TRUE
        ) INTO v_is_authorized;
    ELSIF auth.uid() = p_target_user_id THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized to reset data for user %', p_target_user_id;
    END IF;

    IF p_reset_type = 'PROGRESS_ONLY' THEN
        -- Delete study sessions, practice sessions, attempts
        DELETE FROM public.study_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_answers WHERE user_id = p_target_user_id;
        RETURN jsonb_build_object('success', true, 'message', 'User study progress and attempt history reset successfully.');
    ELSIF p_reset_type = 'FULL_STUDY_DATA' THEN
        -- Delete all user study entities
        DELETE FROM public.study_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_answers WHERE user_id = p_target_user_id;
        DELETE FROM public.planner_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.questions WHERE user_id = p_target_user_id;
        DELETE FROM public.subjective_papers WHERE user_id = p_target_user_id;
        DELETE FROM public.syllabus_documents WHERE user_id = p_target_user_id;
        DELETE FROM public.topics WHERE user_id = p_target_user_id;
        DELETE FROM public.subjects WHERE user_id = p_target_user_id;
        DELETE FROM public.courses WHERE user_id = p_target_user_id;
        RETURN jsonb_build_object('success', true, 'message', 'All user study data (courses, syllabus, questions, planner) reset successfully.');
    ELSE
        RAISE EXCEPTION 'Invalid reset type: %', p_reset_type;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 6. AUTH TRIGGER: AUTO-PROFILE CREATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, extensions
LANGUAGE plpgsql
AS $$
DECLARE
    v_role public.application_role := 'USER';
    v_status public.account_status := 'PENDING_APPROVAL';
    v_has_admin BOOLEAN := FALSE;
    v_display_name TEXT;
    v_avatar TEXT := '/avatars/panda.png';
    v_clean_email TEXT;
BEGIN
    v_clean_email := LOWER(COALESCE(new.email, ''));

    -- Check if any MAIN_ADMIN exists or if this email is the configured main admin
    IF v_clean_email = 'sid.paudel585@gmail.com' OR v_clean_email = 'siddharthapaudel585@gmail.com' THEN
        v_role := 'MAIN_ADMIN';
        v_status := 'ACTIVE';
    ELSE
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM public.profiles WHERE role = 'MAIN_ADMIN'
            ) INTO v_has_admin;
            
            IF NOT v_has_admin THEN
                v_role := 'MAIN_ADMIN';
                v_status := 'ACTIVE';
            ELSE
                v_role := 'USER';
                v_status := 'PENDING_APPROVAL';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_role := 'USER';
            v_status := 'PENDING_APPROVAL';
        END;
    END IF;

    -- Extract display name
    v_display_name := COALESCE(
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1),
        'Student'
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
            visible_to_sub_admin,
            daily_goal_minutes,
            timezone,
            avatar_url
        ) VALUES (
            new.id,
            v_clean_email,
            v_display_name,
            v_role,
            v_status,
            TRUE,
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 7. STORAGE BUCKET CREATION & ACCESS POLICIES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-files', 'study-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users own storage files select" ON storage.objects;
CREATE POLICY "Users own storage files select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'study-files' 
        AND (
            (auth.uid())::text = (storage.foldername(name))[1]
            OR public.is_main_admin()
        )
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
        AND (
            (auth.uid())::text = (storage.foldername(name))[1]
            OR public.is_main_admin()
        )
    );
