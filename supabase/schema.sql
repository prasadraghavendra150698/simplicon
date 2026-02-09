-- Supabase schema for Client Portal (auth + documents + admin review)
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Profiles table to store user metadata (Name, Role, etc.)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'client' check (role in ('client', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update, delete on table public.profiles to authenticated;

-- Admin allowlist (managed in SQL editor only)
create table if not exists public.admins (
  email text primary key,
  is_lead boolean not null default false,
  created_at timestamptz not null default now()
);

revoke all on table public.admins from anon, authenticated;

-- Ensure super admin exists and is marked lead (safe to re-run)
insert into public.admins (email, is_lead)
values ('info@simplicontax.com', true)
on conflict (email) do update set is_lead = true;

-- Backfill profiles for existing users
insert into public.profiles (id, email, full_name, role)
select 
  id, 
  lower(email), 
  coalesce(raw_user_meta_data->>'full_name', ''),
  case 
    when lower(email) = 'info@simplicontax.com' then 'super_admin'
    when exists (select 1 from public.admins a where lower(a.email) = lower(u.email)) then 'admin'
    else 'client'
  end
from auth.users u
on conflict (id) do nothing;

create or replace function public.normalize_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(new.email);
  return new;
end;
$$;

drop trigger if exists admins_normalize_email on public.admins;
create trigger admins_normalize_email
before insert or update on public.admins
for each row execute function public.normalize_email();

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_adm boolean;
  is_lead boolean;
begin
  select exists(select 1 from public.admins where email = lower(new.email)) into is_adm;
  select coalesce((select a.is_lead from public.admins a where email = lower(new.email)), false) into is_lead;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, 
    lower(new.email), 
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when is_lead then 'super_admin' when is_adm then 'admin' else 'client' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

revoke all on function public.current_email() from public;
grant execute on function public.current_email() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where lower(a.email) = public.current_email()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_lead_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_email() = 'info@simplicontax.com'
    or exists (
      select 1
      from public.admins a
      where lower(a.email) = public.current_email()
        and a.is_lead = true
    );
$$;

revoke all on function public.is_lead_admin() from public;
grant execute on function public.is_lead_admin() to authenticated;

-- Profile RLS
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
for all to authenticated using (public.is_admin());

-- Internal access approval queue
create table if not exists public.admin_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.admin_access_requests enable row level security;
revoke all on table public.admin_access_requests from anon;
grant select, insert, update, delete on table public.admin_access_requests to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_access_requests_updated_at on public.admin_access_requests;
create trigger admin_access_requests_updated_at
before update on public.admin_access_requests
for each row execute function public.set_updated_at();

drop policy if exists admin_access_requests_client_select_own on public.admin_access_requests;
create policy admin_access_requests_client_select_own
on public.admin_access_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists admin_access_requests_client_insert_own on public.admin_access_requests;
create policy admin_access_requests_client_insert_own
on public.admin_access_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and lower(email) = public.current_email()
);

drop policy if exists admin_access_requests_admin_all on public.admin_access_requests;
create policy admin_access_requests_admin_all
on public.admin_access_requests
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.approve_admin_access_request(request_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.admin_access_requests%rowtype;
  caller_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into req
  from public.admin_access_requests
  where id = request_id
  for update;

  if not found then
    raise exception 'request not found';
  end if;

  update public.admin_access_requests
  set status = 'approved',
      review_note = note,
      reviewed_by = caller_email,
      reviewed_at = now()
  where id = request_id;

  insert into public.admins (email)
  values (req.email)
  on conflict (email) do nothing;
  
  update public.profiles
  set role = 'admin'
  where email = lower(req.email);
end;
$$;

create or replace function public.deny_admin_access_request(request_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.admin_access_requests
  set status = 'denied',
      review_note = note,
      reviewed_by = caller_email,
      reviewed_at = now()
  where id = request_id;

  if not found then
    raise exception 'request not found';
  end if;
end;
$$;

revoke all on function public.approve_admin_access_request(uuid, text) from public;
revoke all on function public.deny_admin_access_request(uuid, text) from public;
grant execute on function public.approve_admin_access_request(uuid, text) to authenticated;
grant execute on function public.deny_admin_access_request(uuid, text) to authenticated;

-- Helper to list all admins for Super Admin
drop function if exists public.list_admins();
create or replace function public.list_admins()
returns table (email text, is_lead boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select email, is_lead, created_at
  from public.admins
  order by created_at desc;
$$;

revoke all on function public.list_admins() from public;
grant execute on function public.list_admins() to authenticated;

-- Helper to revoke admin access
drop function if exists public.revoke_admin_access(text);
create or replace function public.revoke_admin_access(admin_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_lead_admin() then
    raise exception 'not authorized';
  end if;

  if lower(admin_email) = 'info@simplicontax.com' then
    raise exception 'Cannot revoke super admin access';
  end if;

  delete from public.admins where lower(email) = lower(admin_email);
  
  update public.profiles
  set role = 'client'
  where lower(email) = lower(admin_email);
end;
$$;

revoke all on function public.revoke_admin_access(text) from public;
grant execute on function public.revoke_admin_access(text) to authenticated;

-- Main submission (one request per service choice)
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  request_no text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_email text,
  client_full_name text,
  client_phone text,
  tax_year text,
  notes text,
  service_key text not null,
  service_name text not null,
  required_docs text[] not null default '{}'::text[],
  missing_docs text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'Open', 'Pending', 'Work in Progress', 'Completed', 'Closed')),
  assigned_to text,
  assigned_by text,
  assigned_at timestamptz,
  deadline_date date,
  updated_at timestamptz not null default now(),
  updated_by text,
  created_at timestamptz not null default now()
);

alter table public.submissions add column if not exists request_no text;
alter table public.submissions add column if not exists assigned_to text;
alter table public.submissions add column if not exists assigned_by text;
alter table public.submissions add column if not exists assigned_at timestamptz;
alter table public.submissions add column if not exists deadline_date date;
alter table public.submissions add column if not exists updated_at timestamptz;
alter table public.submissions add column if not exists updated_by text;
alter table public.submissions add column if not exists tax_year text;
alter table public.submissions add column if not exists client_full_name text;
alter table public.submissions add column if not exists client_phone text;
alter table public.submissions add column if not exists notes text;

-- Ensure data is valid before applying constraint
update public.submissions 
set status = 'Open' 
where status not in ('draft', 'Open', 'Pending', 'Work in Progress', 'Completed', 'Closed');

-- Ensure constraints are updated if table already exists
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check check (status in ('draft', 'Open', 'Pending', 'Work in Progress', 'Completed', 'Closed'));

alter table public.submissions enable row level security;
grant select, insert, update, delete on table public.submissions to authenticated;

create policy "submissions_read_access" on public.submissions
for select to authenticated using (public.can_access_submission(id));

create policy "submissions_insert_access" on public.submissions
for insert to authenticated with check (user_id = auth.uid()); -- Basic check, triggers handle details

create policy "submissions_update_access" on public.submissions
for update to authenticated using (public.can_access_submission(id));

create or replace function public.can_access_submission(submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    and (
      public.is_lead_admin()
      or exists (
        select 1
        from public.submissions s
        where s.id = submission_id
          and lower(coalesce(s.assigned_to, '')) = public.current_email()
      )
    );
$$;

revoke all on function public.can_access_submission(uuid) from public;
grant execute on function public.can_access_submission(uuid) to authenticated;

create sequence if not exists public.request_no_seq;

create or replace function public.set_submission_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_email text;
begin
  if new.request_no is null then
    new.request_no := 'REQ' || lpad(nextval('public.request_no_seq')::text, 7, '0');
  end if;

  if new.assigned_to is null then
    select a.email into lead_email
    from public.admins a
    where a.is_lead = true
    order by a.created_at asc
    limit 1;

    if lead_email is null then
      lead_email := 'info@simplicontax.com';
    end if;

    if lead_email is not null then
      new.assigned_to := lower(lead_email);
      new.assigned_by := lower(lead_email);
      new.assigned_at := now();
    end if;
  end if;

  if new.deadline_date is null then
    new.deadline_date := (now() at time zone 'utc')::date + 7;
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(nullif(public.current_email(), ''), lower(new.client_email), 'info@simplicontax.com');
  return new;
end;
$$;

drop trigger if exists submissions_set_defaults on public.submissions;
create trigger submissions_set_defaults
before insert on public.submissions
for each row execute function public.set_submission_defaults();

create or replace function public.prevent_limited_reassign_or_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent modification of REQ#
  if coalesce(new.request_no, '') <> coalesce(old.request_no, '') then
    raise exception 'request number cannot be changed';
  end if;

  -- Reopening check: only lead admin can reopen a closed ticket
  if old.status = 'Closed' and new.status <> 'Closed' then
    if not public.is_lead_admin() then
      raise exception 'Only Super Admin can reopen a closed ticket';
    end if;
  end if;

  -- Assignment check
  if coalesce(new.assigned_to, '') <> coalesce(old.assigned_to, '') then
    if not public.is_lead_admin() then
      raise exception 'not authorized to reassign submissions';
    end if;
    new.assigned_by := public.current_email();
    new.assigned_at := now();
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(nullif(public.current_email(), ''), old.updated_by, lower(new.client_email), 'info@simplicontax.com');
  return new;
end;
$$;

drop trigger if exists submissions_prevent_reassign on public.submissions;
create trigger submissions_prevent_reassign
before update on public.submissions
for each row execute function public.prevent_limited_reassign_or_close();

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  doc_key text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

alter table public.submission_files enable row level security;
grant select, insert, update, delete on table public.submission_files to authenticated;

-- Policies for submission_files are handled via storage bucket policies mostly, 
-- but consistent row access is good too.
create policy "submission_files_access" on public.submission_files
for all to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_files.submission_id and public.can_access_submission(s.id))
);

create table if not exists public.submission_messages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  sender text not null check (sender in ('client', 'admin')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.submission_messages enable row level security;
grant select, insert, update, delete on table public.submission_messages to authenticated;

create policy "submission_messages_access" on public.submission_messages
for all to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_messages.submission_id and public.can_access_submission(s.id))
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  title text not null,
  content text,
  type text not null, -- 'message', 'status', 'new_request'
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
grant select, insert, update, delete on table public.notifications to authenticated;
create policy "notifications_own" on public.notifications
for all to authenticated using (user_id = auth.uid());

-- Notifications logic
create or replace function public.create_notification_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
begin
  -- For status changes, notify the client
  if (old.status is distinct from new.status) and (new.status not in ('draft')) then
    insert into public.notifications (user_id, submission_id, title, content, type)
    values (new.user_id, new.id, 'Status Updated', 'Your request status is now: ' || new.status, 'status');
  end if;
  return new;
end;
$$;

create trigger on_submission_update_notify
after update on public.submissions
for each row execute function public.create_notification_on_update();

create or replace function public.create_notification_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_user uuid;
  sub_assigned_to text;
  assigned_uid uuid;
begin
  select user_id, assigned_to into sub_user, sub_assigned_to from public.submissions where id = new.submission_id;
  
  if new.sender = 'admin' then
    -- Notify client
    insert into public.notifications (user_id, submission_id, title, content, type)
    values (sub_user, new.submission_id, 'New Message from Admin', left(new.message, 100), 'message');
  else
    -- Notify assigned admin
    select id into assigned_uid from auth.users where email = sub_assigned_to;
    if assigned_uid is not null then
      insert into public.notifications (user_id, submission_id, title, content, type)
      values (assigned_uid, new.submission_id, 'New Message from Client', left(new.message, 100), 'message');
    end if;
  end if;
  return new;
end;
$$;

create trigger on_message_insert_notify
after insert on public.submission_messages
for each row execute function public.create_notification_on_message();

-- Storage bucket + policies (documents)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_client_read_own on storage.objects;
create policy documents_client_read_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists documents_client_upload_own on storage.objects;
create policy documents_client_upload_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists documents_admin_all on storage.objects;
create policy documents_admin_all
on storage.objects
for all
to authenticated
using (
  bucket_id = 'documents'
  and public.is_admin()
  and (
    public.is_lead_admin()
    or exists (
      select 1
      from public.submissions s
      where s.id = ((storage.foldername(name))[2])::uuid
        and lower(coalesce(s.assigned_to, '')) = public.current_email()
    )
  )
)
with check (bucket_id = 'documents' and public.is_admin());

-- Cleanup function to delete user (Super Admin only)
drop function if exists public.delete_user_account(uuid);
create or replace function public.delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_lead_admin() then
    raise exception 'Not authorized';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.delete_user_account(uuid) to authenticated;

-- Danger: Reset all system data (Super Admin Only)
create or replace function public.danger_reset_all_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_lead_admin() then
    raise exception 'Not authorized';
  end if;

  -- Delete all request data
  truncate public.submissions, 
           public.submission_files, 
           public.submission_messages, 
           public.notifications 
  cascade;

  -- Reset sequence
  alter sequence public.request_no_seq restart with 1;
end;
$$;

grant execute on function public.danger_reset_all_data() to authenticated;
