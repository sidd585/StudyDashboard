-- ==============================================================================
-- FIX AUTH TRIGGER FOR SUPABASE SIGNUP
-- Migration: 002_fix_trigger.sql
-- ==============================================================================

-- 1. Grant full schema permissions to Supabase roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Bulletproof handle_new_user function with explicit search_path
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

-- 3. Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
