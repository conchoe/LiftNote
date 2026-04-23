-- Run this in the Supabase SQL editor (or via migrations) to match the app.
-- Adjust RLS policies for your security model.

create extension if not exists "pgcrypto";

-- One row per auth user; created automatically on sign-up (see trigger below).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a new user registers (Auth → public.profiles).
-- Uses security definer so the insert succeeds under RLS; search_path is pinned for safety.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'user'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Allow users to create their own row if the signup trigger did not (fixes missing profile / username save).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

grant select, insert, update on table public.profiles to authenticated;

-- Anon needs public profiles for split catalog RLS (exists … profiles.is_private).
drop policy if exists "profiles_select_public_anon" on public.profiles;
create policy "profiles_select_public_anon"
  on public.profiles for select
  to anon
  using (is_private = false);

grant select on table public.profiles to anon;

-- SPEC2: optional profile fields + privacy
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists current_streak integer not null default 0;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists is_private boolean not null default false;

-- Friends (SPEC2): follow / pending / accepted
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friends enable row level security;

drop policy if exists "friends_select_participant" on public.friends;
create policy "friends_select_participant"
  on public.friends for select
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friends_insert_outgoing" on public.friends;
create policy "friends_insert_outgoing"
  on public.friends for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "friends_update_participant" on public.friends;
create policy "friends_update_participant"
  on public.friends for update
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid())
  with check (user_id = auth.uid() or friend_id = auth.uid());

grant select, insert, update on table public.friends to authenticated;

drop policy if exists "friends_delete_participant" on public.friends;
create policy "friends_delete_participant"
  on public.friends for delete
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

grant delete on table public.friends to authenticated;

-- Discover public profiles + accepted friends (friend search / feed)
drop policy if exists "profiles_select_discoverable" on public.profiles;
create policy "profiles_select_discoverable"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or is_private = false
    or exists (
      select 1
      from public.friends f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = profiles.id)
          or (f.friend_id = auth.uid() and f.user_id = profiles.id)
        )
    )
  );

-- Marketplace splits (public catalog)
create table if not exists public.splits (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users (id) on delete set null,
  name text not null,
  description text,
  structure_json jsonb,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Likes: target_id references a split id when type = 'split'
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null,
  type text not null check (type in ('workout', 'split')),
  unique (user_id, target_id, type)
);

-- Legacy `likes`: if the table already existed from an older script, `CREATE TABLE IF NOT EXISTS` does
-- nothing and PostgREST reports "could not find the 'target_id' column of likes in the schema cache".
alter table public.likes add column if not exists target_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'likes'
      and column_name = 'split_id'
  ) then
    update public.likes
    set target_id = split_id
    where target_id is null and split_id is not null;
  end if;
end $$;

-- Rows that cannot be migrated (no target) would break NOT NULL / inserts; drop only those orphans.
delete from public.likes where target_id is null;

alter table public.likes alter column target_id set not null;

-- Older DBs may already have `likes` without `type`; IF NOT EXISTS does not add new columns.
alter table public.likes add column if not exists type text;
update public.likes set type = 'split' where type is null;
alter table public.likes alter column type set not null;

do $$
begin
  alter table public.likes add constraint likes_type_check check (type in ('workout', 'split'));
exception
  when duplicate_object then null;
end $$;

-- Nudge PostgREST to pick up new columns (restart app alone is not enough).
notify pgrst, 'reload schema';

-- row_security: liker updates another user's `splits` / `workout_logs` row for `likes_count` only.
-- Definer + SET row_security=off is the standard pattern; body SET is not allowed in plpgsql in many versions.
create or replace function public.bump_split_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_op = 'INSERT' and new.type = 'split' then
    update public.splits
    set likes_count = likes_count + 1
    where id = new.target_id;
    return new;
  elsif tg_op = 'DELETE' and old.type = 'split' then
    update public.splits
    set likes_count = greatest(0, likes_count - 1)
    where id = old.target_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_bump_split_on_insert on public.likes;
create trigger likes_bump_split_on_insert
  after insert on public.likes
  for each row
  when (new.type = 'split')
  execute procedure public.bump_split_like_count();

drop trigger if exists likes_bump_split_on_delete on public.likes;
create trigger likes_bump_split_on_delete
  after delete on public.likes
  for each row
  when (old.type = 'split')
  execute procedure public.bump_split_like_count();

alter table public.splits enable row level security;
alter table public.likes enable row level security;

-- Marketplace catalog: only splits from public creators (or legacy rows with no creator), plus own rows always.
drop policy if exists "splits_select_authenticated" on public.splits;
create policy "splits_select_authenticated"
  on public.splits for select
  to authenticated
  using (
    creator_id is null
    or auth.uid() = creator_id
    or exists (
      select 1
      from public.profiles p
      where p.id = splits.creator_id
        and p.is_private = false
    )
  );

drop policy if exists "splits_select_anon" on public.splits;
create policy "splits_select_anon"
  on public.splits for select
  to anon
  using (
    creator_id is null
    or exists (
      select 1
      from public.profiles p
      where p.id = splits.creator_id
        and p.is_private = false
    )
  );

drop policy if exists "splits_insert_own" on public.splits;
create policy "splits_insert_own"
  on public.splits for insert
  to authenticated
  with check (auth.uid() = creator_id);

drop policy if exists "splits_update_own" on public.splits;
create policy "splits_update_own"
  on public.splits for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "splits_delete_own" on public.splits;
create policy "splits_delete_own"
  on public.splits for delete
  to authenticated
  using (auth.uid() = creator_id);

grant select, insert, update, delete on table public.splits to authenticated;
grant select on table public.splits to anon;

drop policy if exists "likes_select_own" on public.likes;
create policy "likes_select_own"
  on public.likes for select
  to authenticated
  using (auth.uid() = user_id);

-- Trending / weekly velocity needs all split likes visible (workout likes stay private via policy above only matching own rows for type workout when combined — split rows are readable by everyone).
drop policy if exists "likes_select_split_public" on public.likes;
create policy "likes_select_split_public"
  on public.likes for select
  to authenticated, anon
  using (type = 'split');

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own"
  on public.likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own"
  on public.likes for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on table public.likes to authenticated;
grant select on table public.likes to anon;

-- Like timestamps for "velocity" / recent-like queries (SPEC2)
alter table public.likes add column if not exists created_at timestamptz not null default now();

-- Cloud workout sessions + community feed (SPEC2)
create table if not exists public.workout_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  volume_total integer not null default 0,
  workout_name text,
  split_name text,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.bump_workout_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_op = 'INSERT' and new.type = 'workout' then
    update public.workout_logs
    set likes_count = likes_count + 1
    where id = new.target_id;
    return new;
  elsif tg_op = 'DELETE' and old.type = 'workout' then
    update public.workout_logs
    set likes_count = greatest(0, likes_count - 1)
    where id = old.target_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_bump_workout_on_insert on public.likes;
create trigger likes_bump_workout_on_insert
  after insert on public.likes
  for each row
  when (new.type = 'workout')
  execute procedure public.bump_workout_like_count();

drop trigger if exists likes_bump_workout_on_delete on public.likes;
create trigger likes_bump_workout_on_delete
  after delete on public.likes
  for each row
  when (old.type = 'workout')
  execute procedure public.bump_workout_like_count();

alter table public.workout_logs enable row level security;

drop policy if exists "workout_logs_select_visible" on public.workout_logs;
create policy "workout_logs_select_visible"
  on public.workout_logs for select
  to authenticated
  using (
    user_id = auth.uid()
    or not coalesce(
      (select pr.is_private from public.profiles pr where pr.id = workout_logs.user_id limit 1),
      false
    )
    or exists (
      select 1
      from public.friends f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = workout_logs.user_id)
          or (f.friend_id = auth.uid() and f.user_id = workout_logs.user_id)
        )
    )
  );

drop policy if exists "workout_logs_insert_own" on public.workout_logs;
create policy "workout_logs_insert_own"
  on public.workout_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Required for supabase-js upsert (INSERT ... ON CONFLICT DO UPDATE); without UPDATE grant/policy, pushes fail silently (queued then stuck).
drop policy if exists "workout_logs_update_own" on public.workout_logs;
create policy "workout_logs_update_own"
  on public.workout_logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workout_logs_delete_own" on public.workout_logs;
create policy "workout_logs_delete_own"
  on public.workout_logs for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.workout_logs to authenticated;

-- Realtime: like counts on splits (enable in Dashboard → Database → Replication if needed)
do $$
begin
  alter publication supabase_realtime add table public.splits;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.workout_logs;
exception
  when duplicate_object then null;
end $$;
