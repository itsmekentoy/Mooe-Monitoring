-- =============================================================
-- Migration 003 — Open all tables to anon role
-- =============================================================
-- Because this app uses its own session-based auth (not Supabase Auth),
-- the browser client always presents as the "anon" role.
-- We open full CRUD to anon for all app tables.
-- Access control is handled at the application layer (login check).
-- =============================================================

-- ---- users ----
drop policy if exists "Anon can read user by email for login" on public.users;
drop policy if exists "Authenticated write access — users" on public.users;

create policy "Anon full access — users"
  on public.users for all
  to anon
  using (true)
  with check (true);

-- ---- budget_entries ----
drop policy if exists "Authenticated full access — budget_entries" on public.budget_entries;

create policy "Anon full access — budget_entries"
  on public.budget_entries for all
  to anon
  using (true)
  with check (true);

-- ---- expense_categories ----
drop policy if exists "Authenticated full access — expense_categories" on public.expense_categories;

create policy "Anon full access — expense_categories"
  on public.expense_categories for all
  to anon
  using (true)
  with check (true);

-- ---- expenses ----
drop policy if exists "Authenticated full access — expenses" on public.expenses;

create policy "Anon full access — expenses"
  on public.expenses for all
  to anon
  using (true)
  with check (true);
