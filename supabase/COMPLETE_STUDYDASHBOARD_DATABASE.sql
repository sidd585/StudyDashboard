-- ==============================================================================
-- STUDYDASHBOARD COMPLETE CONSOLIDATED POSTGRESQL DATABASE SCHEMA
-- For Supabase SQL Editor
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. PUBLIC TABLES
-- ==============================================================================

-- PROFILES (Users, Roles, Status)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('MAIN_ADMIN', 'SUB_ADMIN', 'FRIEND', 'USER')),
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('ACTIVE', 'PENDING_APPROVAL', 'DEACTIVATED')),
    managed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    visible_to_sub_admin BOOLEAN NOT NULL DEFAULT TRUE,
    daily_goal_minutes INTEGER NOT NULL DEFAULT 120,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
    avatar_url TEXT DEFAULT '/avatars/panda.png',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COURSES (e.g. RBB Preparation, NRB Assistant)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    year INTEGER DEFAULT 2027,
    daily_goal_minutes INTEGER NOT NULL DEFAULT 60,
    color TEXT DEFAULT '#5b5bd6',
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUBJECTS (e.g. Mathematics, Banking, General Knowledge)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TOPICS & LESSONS (e.g. Simple Interest, Compound Interest)
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    parent_topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SYLLABUS DOCUMENTS
CREATE TABLE IF NOT EXISTS public.syllabus_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    document_name TEXT NOT NULL,
    file_path TEXT,
    raw_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTIONS (Multiple Choice Question Bank)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    answer_status TEXT DEFAULT 'VERIFIED' CHECK (answer_status IN ('VERIFIED', 'UNKNOWN', 'NEEDS_REVIEW')),
    explanation TEXT,
    year INTEGER DEFAULT 2027,
    source_file_id TEXT,
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUBJECTIVE PAPERS (PDFs / Long Question Papers)
CREATE TABLE IF NOT EXISTS public.subjective_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    paper_title TEXT NOT NULL,
    year INTEGER DEFAULT 2027,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    solution_path TEXT,
    is_shared_friend BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLANNER SESSIONS (Day/Week/Month/Year Timetable)
CREATE TABLE IF NOT EXISTS public.planner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_minutes_before INTEGER NOT NULL DEFAULT 15,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STUDY SESSIONS (Focused Stopwatch / Pomodoro Logs)
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL DEFAULT 'Reading',
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER NOT NULL,
    focus_rating INTEGER CHECK (focus_rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRACTICE SESSIONS (Quiz / Test Attempts)
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'PRACTICE' CHECK (mode IN ('PRACTICE', 'TIMED', 'EXAM')),
    question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    score NUMERIC(6, 2) NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRACTICE ANSWERS (Individual Question Responses)
CREATE TABLE IF NOT EXISTS public.practice_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option TEXT CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EMAIL PREFERENCES
CREATE TABLE IF NOT EXISTS public.email_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    daily_report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    study_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_reminder_minutes INTEGER NOT NULL DEFAULT 15,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STUDY RELATIONSHIPS (Admin Friend Link)
CREATE TABLE IF NOT EXISTS public.study_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'FRIEND',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_owner_friend UNIQUE (owner_user_id, friend_user_id)
);

-- ==============================================================================
-- 3. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_courses_user ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_course ON public.subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON public.topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_course ON public.topics(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_course ON public.questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_planner_sessions_user_date ON public.planner_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON public.study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON public.practice_sessions(user_id);

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
ALTER TABLE public.planner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_relationships ENABLE ROW LEVEL SECURITY;

-- Helper admin functions
CREATE OR REPLACE FUNCTION public.is_main_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'MAIN_ADMIN' AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles visibility policy" ON public.profiles;
CREATE POLICY "Profiles visibility policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR public.is_main_admin()
        OR TRUE
    );

DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id
        OR auth.uid() IS NULL
        OR public.is_main_admin()
    );

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id
        OR public.is_main_admin()
    );

-- User Isolation Policies
DROP POLICY IF EXISTS "Courses isolation" ON public.courses;
CREATE POLICY "Courses isolation" ON public.courses FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Subjects isolation" ON public.subjects;
CREATE POLICY "Subjects isolation" ON public.subjects FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Topics isolation" ON public.topics;
CREATE POLICY "Topics isolation" ON public.topics FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Questions isolation" ON public.questions;
CREATE POLICY "Questions isolation" ON public.questions FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Subjective papers isolation" ON public.subjective_papers;
CREATE POLICY "Subjective papers isolation" ON public.subjective_papers FOR ALL USING (
    auth.uid() = user_id
    OR public.is_main_admin()
    OR (is_shared_friend = TRUE)
) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Planner sessions isolation" ON public.planner_sessions;
CREATE POLICY "Planner sessions isolation" ON public.planner_sessions FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Study sessions isolation" ON public.study_sessions;
CREATE POLICY "Study sessions isolation" ON public.study_sessions FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Practice sessions isolation" ON public.practice_sessions;
CREATE POLICY "Practice sessions isolation" ON public.practice_sessions FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

DROP POLICY IF EXISTS "Practice answers isolation" ON public.practice_answers;
CREATE POLICY "Practice answers isolation" ON public.practice_answers FOR ALL USING (auth.uid() = user_id OR public.is_main_admin()) WITH CHECK (auth.uid() = user_id OR public.is_main_admin());

-- ==============================================================================
-- 5. AUTO-PROFILE REGISTRATION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_clean_email TEXT;
    v_is_super_admin BOOLEAN := FALSE;
    v_display_name TEXT;
    v_avatar TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(COALESCE(NEW.email, '')));
    
    IF v_clean_email IN (
        'sid.paudel585@gmail.com',
        'siddharthapaudel585@gmail.com',
        'siddhartha@studydashboard.local'
    ) THEN
        v_is_super_admin := TRUE;
    END IF;

    v_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        SPLIT_PART(v_clean_email, '@', 1)
    );

    IF v_clean_email LIKE '%shilpa%' THEN
        v_avatar := '/avatars/whale.png';
    ELSE
        v_avatar := '/avatars/panda.png';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        role,
        status,
        visible_to_sub_admin,
        daily_goal_minutes,
        timezone,
        avatar_url,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_clean_email,
        INITCAP(v_display_name),
        CASE WHEN v_is_super_admin THEN 'MAIN_ADMIN' ELSE 'USER' END,
        CASE WHEN v_is_super_admin THEN 'ACTIVE' ELSE 'PENDING_APPROVAL' END,
        TRUE,
        120,
        'Asia/Kathmandu',
        v_avatar,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_sync();

-- ==============================================================================
-- 6. ADMIN RESET RPC FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_user_data(p_target_user_id UUID, p_reset_type TEXT)
RETURNS JSONB AS $$
BEGIN
    IF p_reset_type = 'PROGRESS_ONLY' THEN
        DELETE FROM public.study_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_answers WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_sessions WHERE user_id = p_target_user_id;
        RETURN jsonb_build_object('success', true, 'message', 'Progress reset successfully.');
    ELSIF p_reset_type = 'FULL_STUDY_DATA' THEN
        DELETE FROM public.study_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_answers WHERE user_id = p_target_user_id;
        DELETE FROM public.practice_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.planner_sessions WHERE user_id = p_target_user_id;
        DELETE FROM public.questions WHERE user_id = p_target_user_id;
        DELETE FROM public.subjective_papers WHERE user_id = p_target_user_id;
        DELETE FROM public.syllabus_documents WHERE user_id = p_target_user_id;
        DELETE FROM public.topics WHERE user_id = p_target_user_id;
        DELETE FROM public.subjects WHERE user_id = p_target_user_id;
        DELETE FROM public.courses WHERE user_id = p_target_user_id;
        RETURN jsonb_build_object('success', true, 'message', 'All study data reset successfully.');
    ELSE
        RAISE EXCEPTION 'Invalid reset type: %', p_reset_type;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. INITIAL AUTH USER SYNC
-- ==============================================================================
INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    status,
    visible_to_sub_admin,
    daily_goal_minutes,
    timezone,
    avatar_url,
    created_at,
    updated_at
)
SELECT
    u.id,
    LOWER(TRIM(COALESCE(u.email, ''))),
    INITCAP(COALESCE(u.raw_user_meta_data->>'display_name', SPLIT_PART(COALESCE(u.email, ''), '@', 1))),
    CASE
        WHEN LOWER(TRIM(COALESCE(u.email, ''))) IN (
            'sid.paudel585@gmail.com',
            'siddharthapaudel585@gmail.com',
            'siddhartha@studydashboard.local'
        ) THEN 'MAIN_ADMIN'
        ELSE 'USER'
    END,
    CASE
        WHEN LOWER(TRIM(COALESCE(u.email, ''))) IN (
            'sid.paudel585@gmail.com',
            'siddharthapaudel585@gmail.com',
            'siddhartha@studydashboard.local'
        ) THEN 'ACTIVE'
        ELSE 'PENDING_APPROVAL'
    END,
    TRUE,
    120,
    'Asia/Kathmandu',
    '/avatars/panda.png',
    NOW(),
    NOW()
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
