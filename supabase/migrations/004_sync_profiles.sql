-- ==============================================================================
-- SYNC EXISTING AUTH USERS TO PROFILES TABLE
-- Run this query once in Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure RLS policies on profiles table allow insert & update
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_main_admin())
    WITH CHECK (auth.uid() = id OR public.is_main_admin());

-- 2. Populate profiles from any existing auth.users
INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    status,
    daily_goal_minutes,
    timezone,
    avatar_url
)
SELECT 
    u.id,
    COALESCE(u.email, ''),
    COALESCE(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1),
        'Siddhartha'
    ) AS display_name,
    'MAIN_ADMIN'::public.application_role AS role,
    'ACTIVE'::public.account_status AS status,
    120 AS daily_goal_minutes,
    'Asia/Kathmandu' AS timezone,
    CASE 
        WHEN u.email ILIKE '%shilpa%' THEN '/avatars/whale.png'
        ELSE '/avatars/panda.png'
    END AS avatar_url
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'MAIN_ADMIN',
    updated_at = now();

-- 3. Populate default sample courses for existing users
INSERT INTO public.courses (user_id, name, description, daily_goal_minutes, color, is_sample)
SELECT 
    u.id,
    'General Banking (Sample)',
    'Banking Laws, NRB Directives & Operations',
    45,
    '#5b5bd6',
    TRUE
FROM auth.users u
ON CONFLICT DO NOTHING;

INSERT INTO public.courses (user_id, name, description, daily_goal_minutes, color, is_sample)
SELECT 
    u.id,
    'IT & Core Banking (Sample)',
    'Database, Networking, Finacle & Security',
    45,
    '#12b76a',
    TRUE
FROM auth.users u
ON CONFLICT DO NOTHING;
