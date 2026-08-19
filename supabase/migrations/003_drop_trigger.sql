-- Disable trigger on auth.users so Supabase user signups are 100% direct and error-free
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Ensure public.profiles allows insert and update by the authenticated user
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_main_admin())
    WITH CHECK (auth.uid() = id OR public.is_main_admin());
