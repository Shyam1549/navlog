# Admin Setup (Supabase)

## 1) Create Supabase project
- Create a new Supabase project.
- Keep your project URL and anon key.

## 2) Create tables/policies
- Open SQL editor in Supabase.
- Run the SQL in this order:
  - `supabase-schema.sql`
  - `supabase-seed.sql`
  - `supabase-seed.sql` is safe to run again (airports/content are upserted; presets are inserted only when a DEP/ARR pair is missing).

## 3) Create admin user
- In Supabase Auth, create an email/password user.
- Use that account to sign in from Navlog admin login.

## 4) Connect in Navlog
- In `index.html`, set:
  - `window.NAVLOG_CONFIG.supabaseUrl`
  - `window.NAVLOG_CONFIG.supabaseAnonKey`
- On Navlog setup page, click UTC clock 5 times quickly.
- Sign in with admin email/password.

## 5) What can be edited
- Route presets
- Airport records
- User manual HTML
- Privacy policy HTML

## Notes
- Public app reads presets/airports/manual/privacy from Supabase when URL/key are configured.
- Preset, airport, manual, and privacy content are DB-only now (no JS hardcoded fallback data).
- `supabase-seed.sql` loads the previous default airports, route presets, manual, and privacy content into Supabase.
- Current SQL allows any authenticated Supabase user to write admin data.
  - For production, limit writes to trusted admin users only.
