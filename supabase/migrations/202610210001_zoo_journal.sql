create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_couple(display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_couple public.couples;
  clean_name text := left(trim(display_name), 40);
  new_code text;
begin
  if auth.uid() is null then raise exception 'Log eerst in.'; end if;
  if clean_name = '' then raise exception 'Vul je naam in.'; end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Dit account is al gekoppeld.';
  end if;

  loop
    new_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.couples where invite_code = new_code);
  end loop;

  insert into public.couples (invite_code, created_by)
  values (new_code, auth.uid()) returning * into new_couple;

  insert into public.couple_members (couple_id, user_id, email, display_name, role)
  values (new_couple.id, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), clean_name, 'owner');

  return jsonb_build_object('couple_id', new_couple.id, 'invite_code', new_code);
end;
$$;

create or replace function public.join_couple(invite_code_input text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_couple_id uuid;
  clean_name text := left(trim(display_name), 40);
begin
  if auth.uid() is null then raise exception 'Log eerst in.'; end if;
  if clean_name = '' then raise exception 'Vul je naam in.'; end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'Dit account is al gekoppeld.';
  end if;

  select id into target_couple_id
  from public.couples
  where invite_code = upper(trim(invite_code_input));

  if target_couple_id is null then raise exception 'Deze koppelcode klopt niet.'; end if;
  if (select count(*) from public.couple_members where couple_id = target_couple_id) >= 2 then
    raise exception 'Dit dagboek heeft al twee accounts.';
  end if;

  insert into public.couple_members (couple_id, user_id, email, display_name, role)
  values (target_couple_id, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), clean_name, 'partner');
  return target_couple_id;
end;
$$;

create or replace function public.rename_current_member(display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare clean_name text := left(trim(display_name), 40);
begin
  if auth.uid() is null then raise exception 'Log eerst in.'; end if;
  if clean_name = '' then raise exception 'Vul je naam in.'; end if;
  update public.couple_members set display_name = clean_name where user_id = auth.uid();
end;
$$;

create table if not exists public.shared_trips (
  id text primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  zoo_id text not null,
  date text not null,
  leave_time text not null,
  start_point text not null,
  budget numeric not null default 0,
  tickets text not null default 'nee' check (tickets in ('nee', 'ja')),
  note text not null default '',
  packing_json jsonb not null default '[]'::jsonb,
  created_by_user_id uuid not null references auth.users(id),
  requested_from_user_id uuid references auth.users(id),
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_place_states (
  couple_id uuid not null references public.couples(id) on delete cascade,
  zoo_id text not null,
  wished boolean not null default false,
  visited boolean not null default false,
  updated_by_user_id uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (couple_id, zoo_id)
);

create table if not exists public.shared_visits (
  couple_id uuid not null references public.couples(id) on delete cascade,
  zoo_id text not null,
  visit_date text not null,
  start_point text not null,
  distance_km numeric not null default 0,
  updated_by_user_id uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (couple_id, zoo_id)
);

create table if not exists public.shared_reviews (
  couple_id uuid not null references public.couples(id) on delete cascade,
  zoo_id text not null,
  visit_date text not null default '',
  note text not null default '',
  scores_json jsonb not null default '{}'::jsonb,
  updated_by_user_id uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (couple_id, zoo_id, updated_by_user_id)
);

create table if not exists public.shared_memories (
  id text primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  zoo_id text not null,
  visit_date text not null default '',
  caption text not null,
  note text not null default '',
  image_key text,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_custom_places (
  id text primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  place_json jsonb not null,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.shared_trips enable row level security;
alter table public.shared_place_states enable row level security;
alter table public.shared_visits enable row level security;
alter table public.shared_reviews enable row level security;
alter table public.shared_memories enable row level security;
alter table public.shared_custom_places enable row level security;

create policy "members read their couple" on public.couples
for select to authenticated using (public.is_couple_member(id));
create policy "members read profiles" on public.couple_members
for select to authenticated using (public.is_couple_member(couple_id));

create policy "members manage trips" on public.shared_trips for all to authenticated
using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "members manage place states" on public.shared_place_states for all to authenticated
using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "members manage visits" on public.shared_visits for all to authenticated
using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "members manage reviews" on public.shared_reviews for all to authenticated
using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "members manage memories" on public.shared_memories for all to authenticated
using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "members manage custom places" on public.shared_custom_places for all to authenticated
using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));

grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.rename_current_member(text) to authenticated;
grant execute on function public.is_couple_member(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('memories', 'memories', false)
on conflict (id) do update set public = false;

create policy "couple members read memory photos" on storage.objects
for select to authenticated
using (bucket_id = 'memories' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "couple members upload memory photos" on storage.objects
for insert to authenticated
with check (bucket_id = 'memories' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "couple members update memory photos" on storage.objects
for update to authenticated
using (bucket_id = 'memories' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "couple members delete memory photos" on storage.objects
for delete to authenticated
using (bucket_id = 'memories' and public.is_couple_member((storage.foldername(name))[1]::uuid));
