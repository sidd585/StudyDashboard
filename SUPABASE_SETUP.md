# StudyDashboard — One-Time Supabase Cloud Setup

Follow these simple steps to initialize your Supabase cloud backend:

---

### Step 1: Run the Database Migration
1. Open your Supabase project: [https://supabase.com/dashboard/project/oiorstuenjiztoqzbyvt](https://supabase.com/dashboard/project/oiorstuenjiztoqzbyvt)
2. Go to **SQL Editor** (left menu).
3. Click **New Query**, paste the entire contents of [`supabase/migrations/001_study_dashboard_schema.sql`](file:///c:/Users/3395/.gemini/antigravity-ide/scratch/studyos/supabase/migrations/001_study_dashboard_schema.sql), and click **Run**.
4. This will create all required tables (`profiles`, `courses`, `topics`, `questions`, `study_sessions`, `practice_sessions`, `planner_sessions`, `materials`, `study_relationships`), triggers, functions, and Row-Level Security (RLS) policies.

---

### Step 2: Configure Authentication URLs
1. In Supabase Dashboard, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your production URL (e.g. `https://study-dashboard-qaqx.vercel.app` or `http://localhost:5173`).
3. Add Redirect URLs:
   - `http://localhost:5173/**`
   - `https://*.vercel.app/**`

---

### Step 3: Configure Environment Variables
In your deployment environment (e.g. Vercel) and local `.env`:

```bash
# Frontend (Browser)
VITE_SUPABASE_URL=https://oiorstuenjiztoqzbyvt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable__sjEkh85BxZnm9V_FAydLg_58mtppgc

# Server-Only (FastAPI / Backend)
SUPABASE_SECRET_KEY=your_supabase_service_role_secret_key_here
BOOTSTRAP_ADMIN_EMAIL=your_siddhartha_email@gmail.com
```

---

### Step 4: Login as Siddhartha (Main Admin)
1. Sign up / Sign in with Siddhartha's email.
2. The trigger will automatically assign the **`MAIN_ADMIN`** role to Siddhartha.
3. From the **Admin** dashboard (`/admin`), you can invite Shilpa, Rabin (Sub-Admin), or other study partners.
