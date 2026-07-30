-- =============================================================
-- MOOE Expenses Monitoring System — Initial Schema
-- Run this migration once against your Supabase project via:
--   Dashboard → SQL Editor → paste & run
--   OR: supabase db push (if using the Supabase CLI)
-- =============================================================

-- ----------------------------------------------------------------
-- 1. users
--    Stores system users managed through User Management.
--    Passwords are stored as bcrypt hashes (never plain text).
-- ----------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  email       text        not null unique,
  password    text        not null,           -- bcrypt hash
  role        text        not null default 'user'
                          check (role in ('super_admin', 'admin', 'user')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 2. budget_entries
--    Monthly/range budget allocations per fiscal year.
-- ----------------------------------------------------------------
create table if not exists public.budget_entries (
  id           uuid primary key default gen_random_uuid(),
  from_month   text        not null,
  to_month     text        not null,
  year         integer     not null check (year between 2000 and 2100),
  budget       numeric(15, 2) not null check (budget > 0),
  created_by   uuid        references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 3. expense_categories
--    User-defined categories for classifying expenses.
-- ----------------------------------------------------------------
create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null unique,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 4. expenses
--    Individual expense rows linked to a budget entry.
-- ----------------------------------------------------------------
create table if not exists public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  budget_entry_id    uuid        not null references public.budget_entries (id) on delete cascade,
  category_id        uuid        references public.expense_categories (id) on delete set null,
  expense_date       date        not null,
  amount             numeric(15, 2) not null check (amount > 0),
  liquidated         boolean     not null default false,
  liquidated_amount  numeric(15, 2) check (liquidated_amount > 0),
  created_by         uuid        references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Indexes for common query patterns
-- ----------------------------------------------------------------
create index if not exists idx_budget_entries_year
  on public.budget_entries (year);

create index if not exists idx_expenses_budget_entry
  on public.expenses (budget_entry_id);

create index if not exists idx_expenses_category
  on public.expenses (category_id);

create index if not exists idx_expenses_date
  on public.expenses (expense_date);

-- ----------------------------------------------------------------
-- updated_at auto-update trigger
-- ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace trigger trg_budget_entries_updated_at
  before update on public.budget_entries
  for each row execute function public.set_updated_at();

create or replace trigger trg_expense_categories_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();

create or replace trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------
-- Row Level Security (RLS) — enable but leave open for now;
-- tighten policies once auth is wired up.
-- ----------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.budget_entries      enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.expenses            enable row level security;

-- Allow full access for authenticated users (adjust per role later)
create policy "Authenticated full access — users"
  on public.users for all
  to authenticated using (true) with check (true);

create policy "Authenticated full access — budget_entries"
  on public.budget_entries for all
  to authenticated using (true) with check (true);

create policy "Authenticated full access — expense_categories"
  on public.expense_categories for all
  to authenticated using (true) with check (true);

create policy "Authenticated full access — expenses"
  on public.expenses for all
  to authenticated using (true) with check (true);
