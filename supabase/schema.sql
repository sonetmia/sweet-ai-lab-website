-- RA Graphic Studio: Supabase schema, access policy, and credit/payment RPCs.
-- Apply with: node scripts/apply-supabase-schema.mjs

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_name as enum ('free', 'pro', 'max');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role public.app_role not null default 'user',
  plan public.plan_name not null default 'free',
  credits integer not null default 10 check (credits >= 0),
  credit_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  source text not null default 'app',
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_plan public.plan_name not null check (requested_plan in ('pro', 'max')),
  amount_bdt integer not null check (amount_bdt in (400, 500)),
  bkash_number text not null,
  transaction_id text not null,
  status public.payment_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id)
);

create index if not exists payment_requests_status_created_idx on public.payment_requests (status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists payment_requests_set_updated_at on public.payment_requests;
create trigger payment_requests_set_updated_at
before update on public.payment_requests
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, plan, credits)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    case when lower(coalesce(new.email, '')) = lower(coalesce(current_setting('app.admin_email', true), '')) then 'admin'::public.app_role else 'user'::public.app_role end,
    'free'::public.plan_name,
    10
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(excluded.display_name, public.profiles.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.payment_requests enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "profiles: users can view self" on public.profiles;
create policy "profiles: users can view self" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: users can update own basic fields" on public.profiles;
create policy "profiles: users can update own basic fields" on public.profiles
for update to authenticated using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()) and plan = (select plan from public.profiles where id = auth.uid()) and credits = (select credits from public.profiles where id = auth.uid()));

drop policy if exists "ledger: users can view own records" on public.credit_ledger;
create policy "ledger: users can view own records" on public.credit_ledger
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payments: users can view own requests" on public.payment_requests;
create policy "payments: users can view own requests" on public.payment_requests
for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.get_my_credits()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  is_expired boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select * into current_profile from public.profiles where id = auth.uid();
  if not found then
    return jsonb_build_object('success', false, 'error', 'profile_not_found');
  end if;

  is_expired := current_profile.credit_expires_at is not null and current_profile.credit_expires_at <= now();
  return jsonb_build_object(
    'success', true,
    'credits', case when is_expired then 0 else current_profile.credits end,
    'plan', current_profile.plan,
    'expires_at', current_profile.credit_expires_at,
    'expired', is_expired
  );
end;
$$;

create or replace function public.deduct_credit(action_type text, amount integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  remaining integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if amount is null or amount < 1 or amount > 100 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;

  select * into current_profile from public.profiles where id = auth.uid() for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'profile_not_found');
  end if;
  if current_profile.credit_expires_at is not null and current_profile.credit_expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'credits_expired');
  end if;
  if current_profile.credits < amount then
    return jsonb_build_object('success', false, 'error', 'insufficient_credits');
  end if;

  remaining := current_profile.credits - amount;
  update public.profiles set credits = remaining where id = current_profile.id;
  insert into public.credit_ledger (user_id, action_type, delta, balance_after, source)
  values (current_profile.id, action_type, -amount, remaining, 'app');
  return jsonb_build_object('success', true, 'credits', remaining);
end;
$$;

create or replace function public.submit_payment_request(p_plan public.plan_name, p_bkash_number text, p_transaction_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_number text := trim(coalesce(p_bkash_number, ''));
  normalized_transaction text := upper(trim(coalesce(p_transaction_id, '')));
  request_id uuid;
  current_email text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if p_plan not in ('pro', 'max') then
    return jsonb_build_object('success', false, 'error', 'invalid_plan');
  end if;
  if normalized_number !~ '^01[0-9]{9}$' or length(normalized_transaction) < 6 then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    return jsonb_build_object('success', false, 'error', 'profile_not_found');
  end if;
  if exists (select 1 from public.payment_requests where user_id = auth.uid() and status = 'pending') then
    return jsonb_build_object('success', false, 'error', 'pending_request_exists');
  end if;

  insert into public.payment_requests (user_id, requested_plan, amount_bdt, bkash_number, transaction_id)
  values (auth.uid(), p_plan, case when p_plan = 'pro' then 400 else 500 end, normalized_number, normalized_transaction)
  returning id into request_id;

  select email into current_email from public.profiles where id = auth.uid();
  return jsonb_build_object('success', true, 'request_id', request_id, 'email', current_email);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'transaction_id_exists');
end;
$$;

create or replace function public.admin_review_payment(p_request_id uuid, p_decision public.payment_status, p_note text default null, p_expiry_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.payment_requests%rowtype;
  plan_credits integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('success', false, 'error', 'invalid_decision');
  end if;
  select * into request_row from public.payment_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if request_row.status <> 'pending' then
    return jsonb_build_object('success', false, 'error', 'already_reviewed');
  end if;

  update public.payment_requests
  set status = p_decision, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = request_row.id;

  if p_decision = 'approved' then
    plan_credits := case when request_row.requested_plan = 'pro' then 6000 else 8000 end;
    update public.profiles
    set plan = request_row.requested_plan,
        credits = plan_credits,
        credit_expires_at = now() + make_interval(days => greatest(1, least(coalesce(p_expiry_days, 30), 365)))
    where id = request_row.user_id;
    insert into public.credit_ledger (user_id, action_type, delta, balance_after, source)
    values (request_row.user_id, 'plan_activation', plan_credits, plan_credits, 'admin');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_top_up_credits(p_user_id uuid, p_amount integer, p_note text default 'manual_top_up')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;
  update public.profiles
  set credits = greatest(0, credits + p_amount)
  where id = p_user_id
  returning credits into new_balance;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  insert into public.credit_ledger (user_id, action_type, delta, balance_after, source)
  values (p_user_id, coalesce(nullif(trim(p_note), ''), 'manual_top_up'), p_amount, new_balance, 'admin');
  return jsonb_build_object('success', true, 'credits', new_balance);
end;
$$;

create or replace function public.admin_activate_plan(p_user_id uuid, p_plan public.plan_name, p_expiry_days integer default 30, p_note text default 'manual_plan_activation')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_credits integer;
  new_expiry timestamptz;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;
  if p_plan not in ('pro', 'max') then
    return jsonb_build_object('success', false, 'error', 'invalid_plan');
  end if;

  plan_credits := case when p_plan = 'pro' then 6000 else 8000 end;
  new_expiry := now() + make_interval(days => greatest(1, least(coalesce(p_expiry_days, 30), 365)));
  update public.profiles
  set plan = p_plan,
      credits = plan_credits,
      credit_expires_at = new_expiry
  where id = p_user_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  insert into public.credit_ledger (user_id, action_type, delta, balance_after, source)
  values (p_user_id, coalesce(nullif(trim(p_note), ''), 'manual_plan_activation'), plan_credits, plan_credits, 'admin');
  return jsonb_build_object('success', true, 'plan', p_plan, 'credits', plan_credits, 'expires_at', new_expiry);
end;
$$;

grant usage on schema public to authenticated;
grant select on public.profiles, public.credit_ledger, public.payment_requests to authenticated;
grant execute on function public.get_my_credits() to authenticated;
grant execute on function public.deduct_credit(text, integer) to authenticated;
grant execute on function public.submit_payment_request(public.plan_name, text, text) to authenticated;
grant execute on function public.admin_review_payment(uuid, public.payment_status, text, integer) to authenticated;
grant execute on function public.admin_top_up_credits(uuid, integer, text) to authenticated;
grant execute on function public.admin_activate_plan(uuid, public.plan_name, integer, text) to authenticated;
