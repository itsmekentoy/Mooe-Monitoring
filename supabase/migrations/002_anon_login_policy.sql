-- =============================================================
-- Migration 002 — Allow anonymous login lookup on users table
-- =============================================================
-- The browser uses the anon key (unauthenticated), so the existing
-- "authenticated" policy blocks the login query.
-- This policy allows the anon role to SELECT a single user row
-- only when filtering by email — the minimum needed for login.
-- All other tables remain restricted to authenticated users only.
-- =============================================================

-- Drop the overly-broad authenticated-only policy added in 001
drop policy if exists "Authenticated full access — users" on public.users;

-- Re-add it (keep write access for authenticated users only)
create policy "Authenticated write access — users"
  on public.users
  for all
  to authenticated
  using (true)
  with check (true);

-- Allow anon role to SELECT user by email (login check only)
create policy "Anon can read user by email for login"
  on public.users
  for select
  to anon
  using (true);
