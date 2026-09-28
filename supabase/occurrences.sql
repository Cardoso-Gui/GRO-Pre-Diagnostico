create table public.occurrences (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id),
 kind text not null check(kind in ('Acidente','Incidente','Observação')),
 occurred_on date not null,
 description text not null check(length(trim(description)) between 1 and 5000),
 photo_path text,
 created_by uuid not null default auth.uid() references public.team_members(user_id),
 created_at timestamptz not null default now(),
 check(photo_path is null or (split_part(photo_path,'/',1)=client_id::text and split_part(photo_path,'/',2)=created_by::text and photo_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$'))
);
create index occurrences_client_date_idx on public.occurrences(client_id,occurred_on desc,id);
create index occurrences_created_by_idx on public.occurrences(created_by);
alter table public.occurrences enable row level security;
revoke all on public.occurrences from public,anon,authenticated;
grant select on public.occurrences to authenticated;
grant insert(id,client_id,kind,occurred_on,description,photo_path) on public.occurrences to authenticated;
create policy occurrences_read on public.occurrences for select to authenticated using (
 exists(select 1 from public.clients c where c.id=client_id and ((select private.is_global_admin()) or c.team_id=(select private.current_team_id())))
);
create policy occurrences_insert on public.occurrences for insert to authenticated with check (
 created_by=(select auth.uid()) and exists(select 1 from public.clients c where c.id=client_id and not c.archived and ((select private.is_global_admin()) or c.team_id=(select private.current_team_id())))
);
