-- Supabase: foreign keys to auth, Row Level Security, policies, and per-user
-- seeding. Everything Prisma can't express.
--
-- WHEN TO RUN: AFTER `prisma migrate deploy` / `prisma db push` has created the
-- public.expenses / public.categories / public.profiles tables. Run it in the
-- Supabase SQL editor (or psql). Idempotent — every object is dropped-if-exists
-- first, so re-run it after any schema push or reset.
--
-- IMPORTANT: RLS is enabled but NOT forced. Prisma connects as the table owner
-- and must keep bypassing RLS (its server-side queries scope by user_id in
-- code). `FORCE ROW LEVEL SECURITY` would make auth.uid() — null under Prisma's
-- connection — block every Prisma query. RLS here guards only the Supabase
-- client / PostgREST paths. Do not force it.

begin;

-- 1. Foreign keys to Supabase Auth (Prisma can't model the `auth` schema).
alter table public.expenses              drop constraint if exists expenses_user_id_fkey;
alter table public.categories            drop constraint if exists categories_user_id_fkey;
alter table public.profiles              drop constraint if exists profiles_user_id_fkey;
alter table public.savings_goals         drop constraint if exists savings_goals_user_id_fkey;
alter table public.savings_contributions drop constraint if exists savings_contributions_user_id_fkey;

alter table public.expenses
  add constraint expenses_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.categories
  add constraint categories_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.profiles
  add constraint profiles_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.savings_goals
  add constraint savings_goals_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
-- goal_id -> savings_goals FK (with its ON DELETE CASCADE) is owned by Prisma.
alter table public.savings_contributions
  add constraint savings_contributions_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- 2. Defense-in-depth CHECKs mirroring the Zod schemas (validation.ts). These
--    hold even if a row ever arrives via the Supabase client instead of the
--    validated server route.
alter table public.expenses drop constraint if exists expenses_amount_positive;
alter table public.expenses drop constraint if exists expenses_description_len;
alter table public.expenses
  add constraint expenses_amount_positive
    check (amount > 0 and amount <= 99999999.99),
  add constraint expenses_description_len
    check (char_length(description) between 1 and 200);

alter table public.profiles drop constraint if exists profiles_budget_positive;
alter table public.profiles drop constraint if exists profiles_currency_valid;
alter table public.profiles
  add constraint profiles_budget_positive
    check (monthly_budget is null or (monthly_budget > 0 and monthly_budget <= 99999999.99)),
  add constraint profiles_currency_valid
    check (currency in ('USD', 'PHP', 'EUR', 'GBP'));

-- savings_goals no longer has a `saved` column (moved to the contributions
-- ledger) — drop that old check if a prior run added it, and don't re-add it.
-- `target`/`target_date` are now NULLABLE (an open-ended fund has neither), so
-- the positive check only applies when a target is set, and a new check
-- enforces the invariant that a deadline can't exist without a target.
-- The DROP NOT NULLs live here (not a Prisma migration) because the
-- auth.users FKs below make this DB un-introspectable by `prisma db push`
-- (P4002); both statements are idempotent like everything else in this file.
alter table public.savings_goals alter column target      drop not null;
alter table public.savings_goals alter column target_date drop not null;
alter table public.savings_goals drop constraint if exists savings_goals_target_positive;
alter table public.savings_goals drop constraint if exists savings_goals_saved_nonneg;
alter table public.savings_goals drop constraint if exists savings_goals_name_len;
alter table public.savings_goals drop constraint if exists savings_goals_deadline_requires_target;
alter table public.savings_goals
  add constraint savings_goals_target_positive
    check (target is null or (target > 0 and target <= 99999999.99)),
  add constraint savings_goals_deadline_requires_target
    check (target_date is null or target is not null),
  add constraint savings_goals_name_len
    check (char_length(name) between 1 and 60);

alter table public.savings_contributions drop constraint if exists savings_contributions_amount_positive;
alter table public.savings_contributions
  add constraint savings_contributions_amount_positive
    check (amount > 0 and amount <= 99999999.99);

-- 3. Enable RLS (see the "not forced" note above).
alter table public.expenses              enable row level security;
alter table public.categories            enable row level security;
alter table public.profiles              enable row level security;
alter table public.savings_goals         enable row level security;
alter table public.savings_contributions enable row level security;

-- 4. Policies: a user may touch only their own rows. `(select auth.uid())`
--    lets the planner evaluate it once per statement rather than per row.
drop policy if exists own_select on public.expenses;
drop policy if exists own_insert on public.expenses;
drop policy if exists own_update on public.expenses;
drop policy if exists own_delete on public.expenses;

create policy own_select on public.expenses for select
  using ((select auth.uid()) = user_id);
create policy own_insert on public.expenses for insert
  with check ((select auth.uid()) = user_id);
create policy own_update on public.expenses for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy own_delete on public.expenses for delete
  using ((select auth.uid()) = user_id);

drop policy if exists own_select on public.categories;
drop policy if exists own_insert on public.categories;
drop policy if exists own_update on public.categories;
drop policy if exists own_delete on public.categories;

create policy own_select on public.categories for select
  using ((select auth.uid()) = user_id);
create policy own_insert on public.categories for insert
  with check ((select auth.uid()) = user_id);
create policy own_update on public.categories for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy own_delete on public.categories for delete
  using ((select auth.uid()) = user_id);

drop policy if exists own_select on public.profiles;
drop policy if exists own_insert on public.profiles;
drop policy if exists own_update on public.profiles;
drop policy if exists own_delete on public.profiles;

create policy own_select on public.profiles for select
  using ((select auth.uid()) = user_id);
create policy own_insert on public.profiles for insert
  with check ((select auth.uid()) = user_id);
create policy own_update on public.profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy own_delete on public.profiles for delete
  using ((select auth.uid()) = user_id);

drop policy if exists own_select on public.savings_goals;
drop policy if exists own_insert on public.savings_goals;
drop policy if exists own_update on public.savings_goals;
drop policy if exists own_delete on public.savings_goals;

create policy own_select on public.savings_goals for select
  using ((select auth.uid()) = user_id);
create policy own_insert on public.savings_goals for insert
  with check ((select auth.uid()) = user_id);
create policy own_update on public.savings_goals for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy own_delete on public.savings_goals for delete
  using ((select auth.uid()) = user_id);

drop policy if exists own_select on public.savings_contributions;
drop policy if exists own_insert on public.savings_contributions;
drop policy if exists own_update on public.savings_contributions;
drop policy if exists own_delete on public.savings_contributions;

create policy own_select on public.savings_contributions for select
  using ((select auth.uid()) = user_id);
create policy own_insert on public.savings_contributions for insert
  with check ((select auth.uid()) = user_id);
create policy own_update on public.savings_contributions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy own_delete on public.savings_contributions for delete
  using ((select auth.uid()) = user_id);

-- 5. Seed each new user: default categories + an (empty) profile row. Colors +
--    icons match the old global seed so the UI looks identical. security
--    definer + a fixed search_path so it runs with rights to insert and can't
--    be hijacked by a mutable search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (id, user_id, name, color, icon, "createdAt")
  values
    (gen_random_uuid()::text, new.id, 'Groceries',     '#0F766E', 'shopping-cart', now()),
    (gen_random_uuid()::text, new.id, 'Dining',        '#A16207', 'utensils',      now()),
    (gen_random_uuid()::text, new.id, 'Transport',     '#33608D', 'bus',           now()),
    (gen_random_uuid()::text, new.id, 'Utilities',     '#475569', 'lightbulb',     now()),
    (gen_random_uuid()::text, new.id, 'Entertainment', '#6D5A8E', 'clapperboard',  now()),
    (gen_random_uuid()::text, new.id, 'Shopping',      '#9F1239', 'shopping-bag',  now());

  -- Empty profile: monthly_budget stays NULL so the dashboard shows onboarding.
  insert into public.profiles (user_id, created_at, updated_at)
  values (new.id, now(), now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Backfill: give every EXISTING user a profile row (monthly_budget NULL, so
--    they get the onboarding modal on next load). New users get one from the
--    trigger above. Idempotent via ON CONFLICT.
insert into public.profiles (user_id, created_at, updated_at)
select id, now(), now() from auth.users
on conflict (user_id) do nothing;

commit;
