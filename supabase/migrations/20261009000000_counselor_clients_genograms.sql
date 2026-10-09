-- Counselors sign in with email and password. Every client and genogram belongs
-- to exactly one counselor, and row level security keeps each counselor inside
-- their own rows. The browser talks to the database directly (static export),
-- so these policies are the only access control.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  age smallint check (age between 0 and 150),
  birth_year smallint check (birth_year between 1850 and 2200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, counselor_id)
);

create index clients_counselor_id_idx on public.clients (counselor_id, created_at desc);

-- One genogram per client. `graph` is the working copy that autosaves;
-- `final_graph` and `final_svg` are the snapshot taken by "최종 저장".
-- `revision` lets the browser refuse to overwrite a newer save from another tab.
create table public.genograms (
  client_id uuid primary key,
  counselor_id uuid not null,
  graph jsonb not null default '{"nodes":[],"edges":[],"households":[]}'::jsonb,
  final_graph jsonb,
  final_svg text,
  finalized_at timestamptz,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  foreign key (client_id, counselor_id) references public.clients (id, counselor_id) on delete cascade,
  constraint genograms_graph_shape check (
    jsonb_typeof(graph) = 'object'
    and jsonb_typeof(graph -> 'nodes') = 'array'
    and jsonb_typeof(graph -> 'edges') = 'array'
    and jsonb_typeof(graph -> 'households') = 'array'
  ),
  constraint genograms_final_graph_shape check (
    final_graph is null
    or (
      jsonb_typeof(final_graph) = 'object'
      and jsonb_typeof(final_graph -> 'nodes') = 'array'
      and jsonb_typeof(final_graph -> 'edges') = 'array'
      and jsonb_typeof(final_graph -> 'households') = 'array'
    )
  ),
  constraint genograms_final_complete check (
    (final_graph is null and final_svg is null and finalized_at is null)
    or (final_graph is not null and final_svg is not null and finalized_at is not null)
  ),
  constraint genograms_graph_size check (pg_column_size(graph) < 1048576),
  constraint genograms_final_svg_size check (final_svg is null or octet_length(final_svg) < 2097152)
);

create index genograms_counselor_id_idx on public.genograms (counselor_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The genogram row is created with the client so the one-to-one rule can never
-- be broken by a half-finished save from the browser.
create function public.create_client_genogram()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.genograms (client_id, counselor_id) values (new.id, new.counselor_id);
  return new;
end;
$$;

create trigger on_client_created
  after insert on public.clients
  for each row execute function public.create_client_genogram();

create function public.touch_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.counselor_id := old.counselor_id;
  return new;
end;
$$;

create trigger clients_touch
  before update on public.clients
  for each row execute function public.touch_client();

create function public.touch_genogram()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  new.client_id := old.client_id;
  new.counselor_id := old.counselor_id;
  return new;
end;
$$;

create trigger genograms_touch
  before update on public.genograms
  for each row execute function public.touch_genogram();

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.genograms enable row level security;

revoke all on public.profiles, public.clients, public.genograms from anon;
revoke all on public.profiles, public.clients, public.genograms from authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, update on public.genograms to authenticated;

create policy "Counselors read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Counselors read their own clients"
  on public.clients for select to authenticated
  using ((select auth.uid()) = counselor_id);

create policy "Counselors add their own clients"
  on public.clients for insert to authenticated
  with check ((select auth.uid()) = counselor_id);

create policy "Counselors edit their own clients"
  on public.clients for update to authenticated
  using ((select auth.uid()) = counselor_id)
  with check ((select auth.uid()) = counselor_id);

create policy "Counselors delete their own clients"
  on public.clients for delete to authenticated
  using ((select auth.uid()) = counselor_id);

create policy "Counselors read their own genograms"
  on public.genograms for select to authenticated
  using ((select auth.uid()) = counselor_id);

create policy "Counselors save their own genograms"
  on public.genograms for update to authenticated
  using ((select auth.uid()) = counselor_id)
  with check ((select auth.uid()) = counselor_id);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_client_genogram() from public, anon, authenticated;
revoke execute on function public.touch_client() from public, anon, authenticated;
revoke execute on function public.touch_genogram() from public, anon, authenticated;
