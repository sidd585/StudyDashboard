-- ==============================================================================
-- StudyDashboard: Two-Person Study + MCQ Tracker
-- PostgreSQL Schema with Row Level Security (RLS) & Nepal Starter Seeds
-- Timezone: Asia/Kathmandu
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'student',
    current_streak INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STUDY GROUPS & MEMBERSHIP (Shared Study Together Group)
CREATE TABLE IF NOT EXISTS public.study_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- 3. TARGETS (Primary Study Goals: e.g. RBB IT, NRB Assistant, AI Course, College)
CREATE TABLE IF NOT EXISTS public.targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Competitive Exam', -- 'Competitive Exam' | 'College' | 'Course' | 'Certification' | 'Custom'
    color TEXT NOT NULL DEFAULT '#6366f1',
    icon TEXT NOT NULL DEFAULT 'Target',
    deadline_date DATE,
    daily_goal_minutes INT NOT NULL DEFAULT 90,
    weekly_goal_minutes INT NOT NULL DEFAULT 600,
    target_question_goal INT NOT NULL DEFAULT 25,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBJECTS (Target -> Subject)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TOPICS (Subject -> Topic)
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. QUESTIONS (MCQs)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of { id: 'A', text: 'Option text' }
    correct_option_id TEXT, -- 'A' | 'B' | 'C' | 'D' | NULL (Unknown)
    explanation TEXT,
    source TEXT,
    year INT,
    difficulty TEXT DEFAULT 'medium', -- 'easy' | 'medium' | 'hard'
    is_shared BOOLEAN DEFAULT FALSE, -- Shared with Study Together group
    is_bookmarked BOOLEAN DEFAULT FALSE,
    is_difficult BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. QUIZ / EXAM SESSIONS
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.targets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'practice', -- 'practice' | 'exam' | 'mistake_review'
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
    config JSONB NOT NULL,
    question_ids JSONB NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    score NUMERIC DEFAULT 0,
    accuracy NUMERIC DEFAULT 0,
    net_score NUMERIC DEFAULT 0,
    total_time_ms INT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 8. INDIVIDUAL MCQ ATTEMPTS
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.targets(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    session_id UUID,
    selected_option_id TEXT,
    correct_option_id TEXT,
    is_correct BOOLEAN NOT NULL,
    is_skipped BOOLEAN DEFAULT FALSE,
    response_time_ms INT DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9. STUDY SESSIONS (Logged by Study Timer)
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL DEFAULT 'MCQ Practice', -- 'Reading' | 'MCQ Practice' | 'Mock Test' | 'Revision' | 'Notes'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    focused_minutes INT NOT NULL,
    break_minutes INT DEFAULT 0,
    focus_rating INT CHECK (focus_rating >= 1 AND focus_rating <= 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. DAILY TIME ALLOCATIONS ("How much time do I want to give each target today?")
CREATE TABLE IF NOT EXISTS public.daily_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    planned_minutes INT NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, target_id, date)
);

-- 11. STUDY SCHEDULES / PLANNER
CREATE TABLE IF NOT EXISTS public.study_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 45,
    notes TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    email_reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. MATERIALS & SYLLABUS FILES
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'pdf', -- 'pdf' | 'note' | 'image'
    storage_path TEXT,
    content TEXT,
    file_size INT,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. USER SETTINGS & EMAIL PREFERENCES
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    reminder_15min_enabled BOOLEAN DEFAULT TRUE,
    daily_summary_10pm_enabled BOOLEAN DEFAULT TRUE,
    timezone TEXT DEFAULT 'Asia/Kathmandu',
    default_marks NUMERIC DEFAULT 1,
    default_negative NUMERIC DEFAULT 0.25,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. EMAIL LOGS (Audit trail for Resend dispatches)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'reminder_15min' | 'daily_summary_10pm'
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Is member of the same study group
CREATE OR REPLACE FUNCTION public.is_study_partner(partner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.study_group_members m1
        JOIN public.study_group_members m2 ON m1.group_id = m2.group_id
        WHERE m1.user_id = auth.uid() AND m2.user_id = partner_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users see own profile + group members' profile
CREATE POLICY "Profiles are viewable by owner or group partner" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_study_partner(id));
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Study Groups & Members
CREATE POLICY "Study groups viewable by members" ON public.study_groups
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.study_group_members WHERE group_id = id AND user_id = auth.uid()));
CREATE POLICY "Group members viewable by members" ON public.study_group_members
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.study_group_members WHERE group_id = study_group_members.group_id AND user_id = auth.uid()));

-- Targets: Private to owner (Together dashboard uses aggregated session queries)
CREATE POLICY "Targets private to owner" ON public.targets
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Subjects private to owner" ON public.subjects
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Topics private to owner" ON public.topics
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Questions accessible by owner or shared with group" ON public.questions
    FOR ALL USING (auth.uid() = user_id OR (is_shared = TRUE AND public.is_study_partner(user_id)));

CREATE POLICY "Quiz sessions private to owner" ON public.quiz_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Attempts private to owner" ON public.attempts
    FOR ALL USING (auth.uid() = user_id);

-- Study Sessions: Viewable by owner OR summarized by group partner for Together Dashboard
CREATE POLICY "Study sessions viewable by owner or partner" ON public.study_sessions
    FOR SELECT USING (auth.uid() = user_id OR public.is_study_partner(user_id));
CREATE POLICY "Study sessions editable by owner" ON public.study_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Study sessions updatable by owner" ON public.study_sessions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Study sessions deletable by owner" ON public.study_sessions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Daily allocations private to owner" ON public.daily_allocations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Study schedules private to owner" ON public.study_schedules
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Materials accessible by owner or shared" ON public.materials
    FOR ALL USING (auth.uid() = user_id OR (is_shared = TRUE AND public.is_study_partner(user_id)));

CREATE POLICY "User settings private to owner" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Email logs private to owner" ON public.email_logs
    FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- DEFAULT SEED DATA: STUDY TOGETHER GROUP
-- ==============================================================================

INSERT INTO public.study_groups (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Study Together', 'Shared study accountability room')
ON CONFLICT (id) DO NOTHING;
