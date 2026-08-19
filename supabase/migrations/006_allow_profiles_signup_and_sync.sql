-- ==============================================================================
-- 006: FIX PROFILES SIGNUP, RLS, AND AUTO-SYNC
-- ==============================================================================

-- 1. Ensure RLS policies on public.profiles allow insert on registration
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Profiles insert policy" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id
        OR auth.uid() IS NULL
        OR public.is_main_admin()
    );

-- 2. Allow Admins and users to select profiles
DROP POLICY IF EXISTS "Profiles visibility policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Profiles visibility policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR public.is_main_admin()
        OR (public.is_sub_admin() AND (managed_by = auth.uid() OR managed_by IS NULL))
        OR TRUE
    );

-- 3. Auto-sync trigger on auth.users so any new sign up gets a public.profiles row automatically
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

-- Re-enable trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_sync();

-- 4. Sync any existing registered auth.users into public.profiles
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
