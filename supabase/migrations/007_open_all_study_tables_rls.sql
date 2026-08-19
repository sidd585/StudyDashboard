-- ==============================================================================
-- 007: ENABLE AND OPEN RLS FOR ALL STUDY TABLES (Courses, Subjects, Topics, Study Sessions, Files)
-- ==============================================================================

-- 1. Ensure all columns exist on study_sessions
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS focus_rating INTEGER DEFAULT 4;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure all columns exist on subjects & topics
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS parent_topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE;

-- 3. Enable RLS on all tables and grant full access
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjective_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_answers ENABLE ROW LEVEL SECURITY;

-- Courses
DROP POLICY IF EXISTS "Courses full access" ON public.courses;
CREATE POLICY "Courses full access" ON public.courses FOR ALL USING (true) WITH CHECK (true);

-- Subjects
DROP POLICY IF EXISTS "Subjects full access" ON public.subjects;
CREATE POLICY "Subjects full access" ON public.subjects FOR ALL USING (true) WITH CHECK (true);

-- Topics
DROP POLICY IF EXISTS "Topics full access" ON public.topics;
CREATE POLICY "Topics full access" ON public.topics FOR ALL USING (true) WITH CHECK (true);

-- Study Sessions
DROP POLICY IF EXISTS "Study sessions full access" ON public.study_sessions;
CREATE POLICY "Study sessions full access" ON public.study_sessions FOR ALL USING (true) WITH CHECK (true);

-- Syllabus Documents
DROP POLICY IF EXISTS "Syllabus documents full access" ON public.syllabus_documents;
CREATE POLICY "Syllabus documents full access" ON public.syllabus_documents FOR ALL USING (true) WITH CHECK (true);

-- Subjective Papers
DROP POLICY IF EXISTS "Subjective papers full access" ON public.subjective_papers;
CREATE POLICY "Subjective papers full access" ON public.subjective_papers FOR ALL USING (true) WITH CHECK (true);

-- Questions
DROP POLICY IF EXISTS "Questions full access" ON public.questions;
CREATE POLICY "Questions full access" ON public.questions FOR ALL USING (true) WITH CHECK (true);

-- Planner Sessions
DROP POLICY IF EXISTS "Planner sessions full access" ON public.planner_sessions;
CREATE POLICY "Planner sessions full access" ON public.planner_sessions FOR ALL USING (true) WITH CHECK (true);

-- Practice Sessions
DROP POLICY IF EXISTS "Practice sessions full access" ON public.practice_sessions;
CREATE POLICY "Practice sessions full access" ON public.practice_sessions FOR ALL USING (true) WITH CHECK (true);

-- Practice Answers
DROP POLICY IF EXISTS "Practice answers full access" ON public.practice_answers;
CREATE POLICY "Practice answers full access" ON public.practice_answers FOR ALL USING (true) WITH CHECK (true);
