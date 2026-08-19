-- ==============================================================================
-- 008: FINAL FULL DATABASE, STORAGE & RLS SYNC
-- Run this once in Supabase SQL Editor to guarantee 100% functionality
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CREATE ALL TABLES IF THEY DO NOT EXIST YET

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER',
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    managed_by UUID,
    visible_to_sub_admin BOOLEAN NOT NULL DEFAULT TRUE,
    daily_goal_minutes INTEGER NOT NULL DEFAULT 120,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
    avatar_url TEXT DEFAULT '/avatars/panda.png',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COURSES
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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

-- SUBJECTS
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TOPICS
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID,
    parent_topic_id UUID,
    name TEXT NOT NULL,
    code TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SYLLABUS DOCUMENTS
CREATE TABLE IF NOT EXISTS public.syllabus_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID,
    document_name TEXT NOT NULL,
    file_path TEXT,
    raw_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTIONS
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID,
    topic_id UUID,
    lesson_id UUID,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL DEFAULT 'A',
    answer_status TEXT DEFAULT 'VALID',
    explanation TEXT,
    year INTEGER DEFAULT 2027,
    source_file_id TEXT,
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUBJECTIVE PAPERS
CREATE TABLE IF NOT EXISTS public.subjective_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID,
    topic_id UUID,
    paper_title TEXT NOT NULL,
    year INTEGER DEFAULT 2027,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    solution_path TEXT,
    is_shared_friend BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLANNER SESSIONS
CREATE TABLE IF NOT EXISTS public.planner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID,
    topic_id UUID,
    lesson_id UUID,
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

-- STUDY SESSIONS
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    subject_id UUID,
    topic_id UUID,
    lesson_id UUID,
    activity_type TEXT NOT NULL DEFAULT 'Reading',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NOW(),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    focus_rating INTEGER DEFAULT 4,
    note TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRACTICE SESSIONS
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'PRACTICE',
    question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    score NUMERIC(6, 2) NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRACTICE ANSWERS
CREATE TABLE IF NOT EXISTS public.practice_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option TEXT,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EMAIL PREFERENCES
CREATE TABLE IF NOT EXISTS public.email_preferences (
    user_id UUID PRIMARY KEY,
    daily_report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    study_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_reminder_minutes INTEGER NOT NULL DEFAULT 15,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ENSURE ALL COLUMN TYPES & MISSING FIELDS
ALTER TABLE public.profiles ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT;

ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS subject_id UUID;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS parent_topic_id UUID;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS focus_rating INTEGER DEFAULT 4;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS topic_id UUID;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS subject_id UUID;

-- 4. STORAGE BUCKET FOR SUBJECTIVE & SYLLABUS FILES
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-files', 'study-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DROP POLICY IF EXISTS "Study files public access" ON storage.objects;
CREATE POLICY "Study files public access" ON storage.objects FOR ALL USING (bucket_id = 'study-files') WITH CHECK (bucket_id = 'study-files');

-- 5. OPEN RLS ON ALL PUBLIC TABLES
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

DROP POLICY IF EXISTS "Profiles full access" ON public.profiles;
CREATE POLICY "Profiles full access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Courses full access" ON public.courses;
CREATE POLICY "Courses full access" ON public.courses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Subjects full access" ON public.subjects;
CREATE POLICY "Subjects full access" ON public.subjects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Topics full access" ON public.topics;
CREATE POLICY "Topics full access" ON public.topics FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Syllabus documents full access" ON public.syllabus_documents;
CREATE POLICY "Syllabus documents full access" ON public.syllabus_documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Questions full access" ON public.questions;
CREATE POLICY "Questions full access" ON public.questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Subjective papers full access" ON public.subjective_papers;
CREATE POLICY "Subjective papers full access" ON public.subjective_papers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Planner sessions full access" ON public.planner_sessions;
CREATE POLICY "Planner sessions full access" ON public.planner_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Study sessions full access" ON public.study_sessions;
CREATE POLICY "Study sessions full access" ON public.study_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Practice sessions full access" ON public.practice_sessions;
CREATE POLICY "Practice sessions full access" ON public.practice_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Practice answers full access" ON public.practice_answers;
CREATE POLICY "Practice answers full access" ON public.practice_answers FOR ALL USING (true) WITH CHECK (true);

-- 6. TRIGGER FOR AUTOMATIC USER PROFILE CREATION
CREATE OR REPLACE FUNCTION public.handle_new_user_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_clean_email TEXT;
    v_is_super_admin BOOLEAN := FALSE;
    v_display_name TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(COALESCE(NEW.email, '')));
    
    IF v_clean_email IN (
        'sid.paudel585@gmail.com',
        'siddharthapaudel585@gmail.com',
        'sid.paudel1234@gmail.com'
    ) THEN
        v_is_super_admin := TRUE;
    END IF;

    v_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        SPLIT_PART(v_clean_email, '@', 1)
    );

    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        role,
        status
    )
    VALUES (
        NEW.id,
        v_clean_email,
        INITCAP(v_display_name),
        CASE WHEN v_is_super_admin THEN 'MAIN_ADMIN' ELSE 'USER' END,
        CASE WHEN v_is_super_admin THEN 'ACTIVE' ELSE 'PENDING_APPROVAL' END
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
