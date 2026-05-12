# Admin Setup (Supabase)

## 1) Create Supabase project
- Create a new Supabase project.
- Keep your project URL and anon key.

## 2) Create tables/policies
- Open SQL editor in Supabase.
- Run the SQL in:
  - `supabase-schema.sql`

## 3) Create admin user
- In Supabase Auth, create an email/password user.
- Use that account to sign in from Navlog admin login.

## 4) Connect in Navlog
- On Navlog setup page, click UTC clock 5 times quickly.
- Enter:
  - Supabase URL
  - Supabase anon key
- Click `Connect`.
- Sign in with admin email/password.

## 5) What can be edited
- Route presets
- Airport records
- User manual HTML
- Privacy policy HTML

## Notes
- Public app reads presets/airports/manual/privacy from Supabase when URL/key are configured.
- If Supabase is not configured, app falls back to local built-in defaults.
- Current SQL allows any authenticated Supabase user to write admin data.
  - For production, limit writes to trusted admin users only.
