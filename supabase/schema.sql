-- ============================================================================
-- Stock & Options P&L Tracker — Supabase schema
-- Run this in the Supabase dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- One JSON snapshot per user (stockRows, optionRows, realizedRows, dailyRows).
create table if not exists public.portfolios (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user can only see and modify their own row.
alter table public.portfolios enable row level security;

drop policy if exists "portfolios_select_own" on public.portfolios;
create policy "portfolios_select_own"
  on public.portfolios for select
  using (auth.uid() = user_id);

drop policy if exists "portfolios_insert_own" on public.portfolios;
create policy "portfolios_insert_own"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

drop policy if exists "portfolios_update_own" on public.portfolios;
create policy "portfolios_update_own"
  on public.portfolios for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "portfolios_delete_own" on public.portfolios;
create policy "portfolios_delete_own"
  on public.portfolios for delete
  using (auth.uid() = user_id);
