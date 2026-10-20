-- PREPARED ONLY. Applying this migration activates a NEW narrowly scoped write permission.
-- Apply only after explicit activation approval and review of REPORT_RECTIFICATION.md.
-- No existing assessment, membership, policy, grant, guard or revision trigger is changed.
begin;

create table private.assessment_rectification_control (
 singleton boolean primary key default true check (singleton),
 enabled boolean not null
);
insert into private.assessment_rectification_control(singleton,enabled) values (true,true);
alter table private.assessment_rectification_control enable row level security;
revoke all on private.assessment_rectification_control from public,anon,authenticated,service_role;

create table private.assessment_rectifications (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.assessments(id) on delete restrict,
 sequence integer not null check (sequence > 0),
 request_id uuid not null,
 expected_sequence integer not null check (expected_sequence >= 0),
 actor_id uuid not null,
 actor_name text not null,
 actor_team_id uuid not null check (actor_team_id='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d'::uuid),
 created_at timestamptz not null,
 reason text not null check (length(btrim(reason)) between 3 and 2000),
 requested_changes jsonb not null check (jsonb_typeof(requested_changes)='object'),
 changes jsonb not null check (jsonb_typeof(changes)='array' and jsonb_array_length(changes)>0),
 effective_snapshot jsonb not null check (jsonb_typeof(effective_snapshot)='object'),
 unique(assessment_id,sequence),
 unique(assessment_id,request_id),
 check(sequence=expected_sequence+1)
);
alter table private.assessment_rectifications enable row level security;
revoke all on private.assessment_rectifications from public,anon,authenticated,service_role;

-- SQL statements or privileged API routes must not rewrite or erase audit history.
-- A database owner can always deliberately change DDL; that is outside application authorization.
create function private.reject_rectification_history_mutation() returns trigger
language plpgsql set search_path='' as $$
begin
 raise exception 'O histórico de retificações é imutável.' using errcode='23514';
end; $$;
create trigger assessment_rectifications_no_rewrite before update or delete
 on private.assessment_rectifications for each row execute function private.reject_rectification_history_mutation();
create trigger assessment_rectifications_no_truncate before truncate
 on private.assessment_rectifications for each statement execute function private.reject_rectification_history_mutation();
revoke all on function private.reject_rectification_history_mutation() from public,anon,authenticated,service_role;

-- Fresh server-side identities only. No email, editable name, browser role or team claim is authority.
create function private.rectification_identity_active() returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists (
  select 1 from auth.users u
  join public.team_members m on m.user_id=u.id
  join public.teams t on t.id=m.team_id
  where u.id=(select auth.uid()) and not coalesce(u.is_anonymous,false)
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
   and m.active and t.active
   and exists(select 1 from auth.sessions session
    where session.user_id=u.id and session.id=case when auth.jwt()->>'session_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     then (auth.jwt()->>'session_id')::uuid end
    and (session.not_after is null or session.not_after>now()))
 );
$$;
create function private.rectification_actor_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select private.rectification_identity_active()
  and exists(select 1 from private.assessment_rectification_control where singleton and enabled)
  and exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id
   where m.user_id=(select auth.uid()) and m.active and m.role='admin' and t.active
    and m.team_id='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d'::uuid);
$$;
revoke all on function private.rectification_identity_active(),private.rectification_actor_allowed() from public,anon,authenticated,service_role;
grant execute on function private.rectification_identity_active(),private.rectification_actor_allowed() to authenticated;

-- SECURITY INVOKER reads and this policy inherit the ORIGINAL assessment SELECT policy,
-- including current client/team visibility after a transfer. No history exists without visibility.
create policy assessment_rectifications_read on private.assessment_rectifications
 for select to authenticated using (
  (select private.rectification_identity_active())
  and exists(select 1 from public.assessments a where a.id=assessment_id and a.status='completed')
 );
grant select on private.assessment_rectifications to authenticated;

create function public.can_rectify_assessment(p_assessment_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select private.rectification_actor_allowed() and exists(
  select 1 from public.assessments where id=p_assessment_id and status='completed'
 );
$$;

-- Stable identities preserve legacy fields when arrays are reordered or siblings removed.
create function private.rectification_item_identity(p_item jsonb,p_identity jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]'::jsonb; field text;
begin
 if jsonb_typeof(p_identity)='number' then return p_item->((p_identity#>>'{}')::integer); end if;
 if jsonb_typeof(p_identity)='string' then return p_item->(p_identity#>>'{}'); end if;
 for field in select * from jsonb_array_elements_text(p_identity) loop result:=result||jsonb_build_array(p_item->field); end loop;
 return result;
end; $$;
revoke all on function private.rectification_item_identity(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Recursive JSON validator. Unknown legacy object fields may only be round-tripped unchanged;
-- patch boundaries marked strict never accept unknown fields, even when the value is unchanged.
create function private.validate_rectification_value(p_value jsonb,p_old jsonb,p_schema jsonb,p_path text default '') returns void
language plpgsql immutable set search_path='' as $$
declare actual text:=jsonb_typeof(p_value); field record; item jsonb; old_item jsonb; item_schema jsonb; identity jsonb; i integer:=0; wanted jsonb:=p_schema->'type';
begin
 if p_value='null'::jsonb and coalesce((p_schema->>'nullable')::boolean,false) then return; end if;
 if actual is null or not (wanted=to_jsonb(actual) or (jsonb_typeof(wanted)='array' and wanted ? actual)) then
  raise exception 'Tipo inválido em %.',p_path using errcode='22023';
 end if;
 if p_value is distinct from p_old and p_schema ? 'enum' and not (p_schema->'enum' @> jsonb_build_array(p_value)) then
  raise exception 'Valor inválido em %.',p_path using errcode='22023';
 end if;
 if p_value is distinct from p_old and coalesce((p_schema->>'nonblank')::boolean,false) and (p_value#>>'{}') ~ '^[[:space:]]*$' then
  raise exception 'Preencha o campo %.',p_path using errcode='22023';
 end if;
 if p_value is distinct from p_old and coalesce((p_schema->>'positiveInteger')::boolean,false) then
  if p_value#>>'{}' !~ '^[0-9]+$' then
   raise exception 'Informe um número inteiro positivo em %.',p_path using errcode='22023';
  end if;
  if (p_value#>>'{}')::numeric not between 1 and 10000000 then
   raise exception 'Informe um número inteiro positivo em %.',p_path using errcode='22023';
  end if;
 end if;
 if actual='string' and length(p_value#>>'{}')>20000 then raise exception 'Texto muito longo em %.',p_path using errcode='22023'; end if;
 if actual='object' then
  if p_schema ? 'required' and exists(select 1 from jsonb_array_elements_text(p_schema->'required') r where not p_value ? r and (jsonb_typeof(p_old) is distinct from 'object' or p_old ? r or coalesce(p_schema->'hardRequired' ? r,false))) then
   raise exception 'Campos obrigatórios ausentes em %.',p_path using errcode='22023';
  end if;
  if coalesce((p_schema->>'complete')::boolean,false) and jsonb_typeof(p_old)='object' and exists(select 1 from jsonb_object_keys(p_old) k where not (p_schema->'properties' ? k) and not (p_value ? k)) then
   raise exception 'Preserve os dados históricos adicionais em %.',p_path using errcode='22023';
  end if;
  for field in select * from jsonb_each(p_value) loop
   if not (p_schema->'properties' ? field.key) then
    if coalesce((p_schema->>'strict')::boolean,false) or not coalesce(p_old ? field.key,false) or field.value is distinct from p_old->field.key then
     raise exception 'Campo não permitido: %.',p_path||'/'||field.key using errcode='22023';
    end if;
   else perform private.validate_rectification_value(field.value,p_old->field.key,p_schema->'properties'->field.key,p_path||'/'||field.key);
   end if;
  end loop;
 elsif actual='array' then
  if p_schema ? 'maxItems' and p_value is distinct from p_old and jsonb_array_length(p_value)>(p_schema->>'maxItems')::integer then raise exception 'Lista inválida em %.',p_path using errcode='22023'; end if;
  if jsonb_array_length(p_value)>2000 then raise exception 'Lista muito longa em %.',p_path using errcode='22023'; end if;
  if p_schema ? 'tuple' and jsonb_array_length(p_value)<>jsonb_array_length(p_schema->'tuple') then
   raise exception 'Par inválido em %.',p_path using errcode='22023';
  end if;
  for item in select * from jsonb_array_elements(p_value) loop
   old_item:=p_old->i;
   if p_schema ? 'identity' and jsonb_typeof(p_old)='array' then
    identity:=private.rectification_item_identity(item,p_schema->'identity');
    select old_value into old_item from jsonb_array_elements(p_old) old_value
     where private.rectification_item_identity(old_value,p_schema->'identity')=identity limit 1;
    -- A renamed entity may keep the old positional record only if that old identity
    -- is absent from the new array. Insertion must not borrow a sibling's legacy data.
    if not found and not exists(select 1 from jsonb_array_elements(p_value) new_value
     where private.rectification_item_identity(new_value,p_schema->'identity')=private.rectification_item_identity(p_old->i,p_schema->'identity')) then old_item:=p_old->i; end if;
   end if;
   item_schema:=case when p_schema ? 'tuple' then p_schema->'tuple'->i else p_schema->'items' end;
   perform private.validate_rectification_value(item,old_item,item_schema,p_path||'/'||i::text);
   i:=i+1;
  end loop;
 end if;
end; $$;
revoke all on function private.validate_rectification_value(jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;

-- Object patches are recursive; arrays are deliberate whole-field replacements.
create function private.merge_rectification_object(p_old jsonb,p_patch jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=coalesce(p_old,'{}'::jsonb); entry record;
begin
 for entry in select * from jsonb_each(p_patch) loop
  if jsonb_typeof(entry.value)='object' and jsonb_typeof(result->entry.key)='object' then
   result:=jsonb_set(result,array[entry.key],private.merge_rectification_object(result->entry.key,entry.value));
  else result:=jsonb_set(result,array[entry.key],entry.value); end if;
 end loop;
 return result;
end; $$;
revoke all on function private.merge_rectification_object(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Diff calculated from the effective before/after snapshots, never supplied by the browser.
-- Arrays are listed as a changed business field in full (rather than positional pseudo-identities).
create function private.rectification_diff(p_before jsonb,p_after jsonb,p_path text default '') returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]'::jsonb; key text;
begin
 if p_before is not distinct from p_after then return result; end if;
 if jsonb_typeof(p_before)='object' and jsonb_typeof(p_after)='object' then
  for key in select jsonb_object_keys(p_before) union select jsonb_object_keys(p_after) order by 1 loop
   result:=result||private.rectification_diff(p_before->key,p_after->key,p_path||'/'||replace(replace(key,'~','~0'),'/','~1'));
  end loop;
 else
  result:=jsonb_build_array(jsonb_build_object('path',p_path,'before',p_before,'after',p_after,'before_present',p_before is not null,'after_present',p_after is not null));
 end if;
 return result;
end; $$;
revoke all on function private.rectification_diff(jsonb,jsonb,text) from public,anon,authenticated,service_role;

create function private.rectification_key(p_text text) returns text
language sql immutable set search_path='' as $$
 select regexp_replace(normalize(lower(btrim(p_text)),NFD),U&'[\0300-\036f]','','g');
$$;
revoke all on function private.rectification_key(text) from public,anon,authenticated,service_role;

-- The renderer indexes risks by normalized target IDs. Reject edits that would make a
-- selected risk silently disappear. Unchanged historical orphan detail caches remain inert.
create function private.validate_rectification_references(p_answers jsonb,p_old jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare targets text[]:='{}'; job_links jsonb:='[]'; sources text[]:='{}'; epis text[]:='{}';
 entry jsonb; job jsonb; ghe jsonb; link jsonb; risk jsonb; target text; key text; name text; seen text[]:='{}'; codes text[];
 catalogue jsonb:='["01.01.001", "01.02.001", "01.03.001", "01.03.002", "01.04.001", "01.05.001", "01.06.001", "01.07.001", "01.08.001", "01.09.001", "01.09.002", "01.09.003", "01.09.004", "01.09.005", "01.09.006", "01.10.001", "01.11.001", "01.12.001", "01.13.001", "01.14.001", "01.15.001", "01.16.001", "01.17.001", "01.18.001", "01.19.001", "01.19.002", "01.19.003", "01.19.004", "01.19.005", "01.19.006", "01.19.007", "01.19.008", "01.19.009", "01.19.010", "01.19.011", "01.19.012", "01.19.013", "01.19.014", "01.19.015", "01.19.016", "01.19.017", "01.19.018", "01.19.019", "01.19.021", "01.19.022", "01.19.023", "01.19.024", "01.19.025", "01.19.026", "01.19.027", "01.19.028", "01.19.029", "01.19.030", "01.19.031", "01.19.032", "01.19.033", "01.19.034", "01.19.035", "01.19.036", "01.19.038", "01.19.039", "01.19.040", "01.19.041", "02.01.001", "02.01.002", "02.01.003", "02.01.004", "02.01.005", "02.01.006", "02.01.007", "02.01.008", "02.01.009", "02.01.010", "02.01.011", "02.01.012", "02.01.013", "02.01.014", "02.01.015", "02.01.016", "02.01.017", "02.01.018", "03.01.001", "03.01.002", "03.01.003", "03.01.004", "03.01.005", "03.01.006", "03.01.007", "04.01.001", "04.01.002", "05.01.001", "09.01.001", "ACI.001", "ACI.002", "ACI.003", "ACI.004", "ACI.005", "ACI.006", "ACI.007", "ACI.008", "ACI.009", "ACI.010", "ACI.011", "ACI.012", "ACI.013", "ACI.014", "ACI.015", "ACI.016", "ACI.017", "BIO.001", "ERG.001", "ERG.002", "ERG.003", "ERG.004", "ERG.005", "ERG.006", "ERG.007", "ERG.008", "ERG.009", "ERG.010", "ERG.011", "ERG.012", "FIS.001", "FIS.002", "FIS.003", "PSI.001", "PSI.002", "PSI.003", "PSI.004", "PSI.005", "PSI.006", "SAN.001"]'::jsonb;
begin
 if p_answers->>'selectedRiskMode' not in ('job','ghe') then raise exception 'Escolha GHE ou cargo para retificar riscos.' using errcode='22023'; end if;
 for entry in select * from jsonb_array_elements(coalesce(p_answers->'jobsBySector','[]')) loop
  if (p_answers->'selectedSectors') @> jsonb_build_array(entry->0) then
   for job in select * from jsonb_array_elements(entry->1) loop
    if nullif(btrim(job->>'name'),'') is null then raise exception 'Cargo sem nome.' using errcode='22023'; end if;
    target:=private.rectification_key('job__'||(entry->>0)||'__'||(job->>'name'));
    if target=any(seen) then raise exception 'Cargos duplicados tornam os riscos ambíguos.' using errcode='22023'; end if;
    seen:=array_append(seen,target);
    job_links:=job_links||jsonb_build_array(jsonb_build_object('sectorName',entry->>0,'jobName',job->>'name'));
    if p_answers->>'selectedRiskMode'='job' then targets:=array_append(targets,target); end if;
   end loop;
  end if;
 end loop;
 if p_answers->>'selectedRiskMode'='ghe' then
  for ghe in select * from jsonb_array_elements(coalesce(p_answers->'gheList','[]')) loop
   target:=ghe->>'id';
   if nullif(btrim(target),'') is null or target=any(targets) or nullif(btrim(ghe->>'name'),'') is null then
    raise exception 'GHE inválido ou duplicado.' using errcode='22023';
   end if;
   targets:=array_append(targets,target);
   for link in select * from jsonb_array_elements(coalesce(ghe->'linkedJobs','[]')) loop
    if not (job_links @> jsonb_build_array(jsonb_build_object('sectorName',link->>'sectorName','jobName',link->>'jobName'))) then
     raise exception 'GHE vinculado a setor ou cargo inexistente.' using errcode='22023';
    end if;
   end loop;
  end loop;
 end if;
 seen:='{}';
 for entry in select * from jsonb_array_elements(coalesce(p_answers->'selectedRisksByTarget','[]')) loop
  target:=entry->>0;
  if target=any(seen) then raise exception 'Seleção de riscos duplicada.' using errcode='22023'; end if;
  seen:=array_append(seen,target);
  if jsonb_array_length(entry->1)>0 and not target=any(targets) then
   raise exception 'Risco vinculado a cargo ou GHE inexistente. Revise os vínculos.' using errcode='22023';
  end if;
  codes:='{}';
  for risk in select * from jsonb_array_elements(entry->1) loop
   key:=risk#>>'{}';
   if not (catalogue ? key) or key=any(codes) then raise exception 'Código de risco inválido ou duplicado.' using errcode='22023'; end if;
   codes:=array_append(codes,key);
   sources:=array_append(sources,private.rectification_key('source__'||target||'__'||key));
   epis:=array_append(epis,private.rectification_key('epi-data__'||target||'__'||key));
  end loop;
  if '09.01.001'=any(codes) and exists(select 1 from unnest(codes) c where c<>'09.01.001' and c ~ '^[0-9]') then
   raise exception 'A ausência de agentes nocivos não pode coexistir com um agente selecionado.' using errcode='22023';
  end if;
 end loop;
 foreach name in array array['riskSourcesBySelection','epiBySelection'] loop
  seen:='{}';
  for entry in select * from jsonb_array_elements(coalesce(p_answers->name,'[]')) loop
   key:=entry->>0;
   if key=any(seen) then raise exception 'Detalhamento de risco duplicado.' using errcode='22023'; end if;
   seen:=array_append(seen,key);
   if name='epiBySelection' and entry#>>'{1,applicable}'='Sim' and jsonb_array_length(coalesce(entry#>'{1,items}','[]'))=0 and not coalesce((p_old->name) @> jsonb_build_array(entry),false) then
    raise exception 'Informe quais EPIs são utilizados.' using errcode='22023';
   end if;
   if not key=any(case when name='riskSourcesBySelection' then sources else epis end)
    and not coalesce((p_old->name) @> jsonb_build_array(entry),false) then
    raise exception 'Detalhamento novo ou alterado sem risco selecionado.' using errcode='22023';
   end if;
  end loop;
 end loop;
end; $$;
revoke all on function private.validate_rectification_references(jsonb,jsonb) from public,anon,authenticated,service_role;

create function private.validate_rectification_photos(p_answers jsonb,p_old jsonb,p_client_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
declare entry jsonb; job jsonb; post jsonb; photo jsonb; path text; old_paths jsonb;
begin
 select coalesce(jsonb_agg(p),'[]'::jsonb) into old_paths from (
  select jsonb_path_query(p_old,'$.jobsBySector[*][1][*].workstations[*].photoPaths[*]') as p
  union select jsonb_path_query(p_old,'$.jobsBySector[*][1][*].workstations[*].photoPath') as p
 ) previous;
 for entry in select * from jsonb_array_elements(coalesce(p_answers->'jobsBySector','[]')) loop
  for job in select * from jsonb_array_elements(entry->1) loop
   for post in select * from jsonb_array_elements(coalesce(job->'workstations','[]')) loop
    if jsonb_array_length(coalesce(post->'photoPaths','[]'))>3 then raise exception 'Cada posto permite até três fotos.' using errcode='22023'; end if;
    for photo in select * from jsonb_array_elements(coalesce(post->'photoPaths','[]')||case when nullif(post->>'photoPath','') is null then '[]'::jsonb else jsonb_build_array(post->'photoPath') end) loop
     if old_paths @> jsonb_build_array(photo) then continue; end if;
     path:=photo#>>'{}';
     if path is null or split_part(path,'/',1)<>p_client_id::text or path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$' then
      raise exception 'Foto inválida para este cliente.' using errcode='22023';
     end if;
     if not exists(select 1 from storage.objects where bucket_id='workstation-photos' and name=path) then
      raise exception 'A foto informada não está disponível. Envie a foto antes de retificar.' using errcode='22023';
     end if;
    end loop;
   end loop;
  end loop;
 end loop;
end; $$;
revoke all on function private.validate_rectification_photos(jsonb,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.read_assessment_report(p_assessment_id uuid,p_original boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare original public.assessments; effective jsonb; latest integer; history jsonb; responsible_name text;
begin
 if not private.rectification_identity_active() then raise exception 'Relatório indisponível.' using errcode='42501'; end if;
 select * into original from public.assessments where id=p_assessment_id and status='completed';
 if not found then raise exception 'Relatório indisponível.' using errcode='42501'; end if;
 select r.effective_snapshot,r.sequence into effective,latest from private.assessment_rectifications r
  where r.assessment_id=p_assessment_id order by r.sequence desc limit 1;
 if coalesce(p_original,false) or effective is null then effective:=original.final_snapshot; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'sequence',r.sequence,'actor_id',r.actor_id,
  'actor_name',r.actor_name,'created_at',r.created_at,'reason',r.reason,'changes',r.changes) order by r.sequence),'[]'::jsonb)
 into history from private.assessment_rectifications r where r.assessment_id=p_assessment_id;
 select display_name into responsible_name from public.team_members where user_id=original.responsible_id;
 return jsonb_build_object('assessment',jsonb_build_object('id',original.id,'client_id',original.client_id,
  'title',coalesce(effective->>'title',original.title),'report_revision',original.report_revision,'revision',original.revision,
  'completed_at',original.completed_at,'final_snapshot',effective,'team_members',jsonb_build_object('display_name',responsible_name)),
  'original_report_document',original.final_snapshot#>'{answers,report_document}',
  'sequence',coalesce(latest,0),'can_rectify',public.can_rectify_assessment(p_assessment_id),'history',history);
end; $$;

-- Bounded list metadata only; every row still passes the original assessment SELECT RLS.
create function public.read_assessment_report_summaries(p_assessment_ids uuid[]) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.rectification_identity_active() then raise exception 'Relatórios indisponíveis.' using errcode='42501'; end if;
 if p_assessment_ids is null or cardinality(p_assessment_ids)>1000 then raise exception 'Informe até 1000 relatórios.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',coalesce(latest.effective_snapshot->>'title',a.title),
  'sequence',coalesce(latest.sequence,0),'can_rectify',public.can_rectify_assessment(a.id)) order by array_position(p_assessment_ids,a.id)),'[]'::jsonb)
 into result from public.assessments a left join lateral (
  select r.effective_snapshot,r.sequence from private.assessment_rectifications r
  where r.assessment_id=a.id order by r.sequence desc limit 1
 ) latest on true where a.id=any(p_assessment_ids) and a.status='completed';
 return result;
end; $$;
revoke all on function public.read_assessment_report_summaries(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.read_assessment_report_summaries(uuid[]) to authenticated;

create function private.append_assessment_rectification(p_assessment_id uuid,p_expected_sequence integer,p_request_id uuid,p_reason text,p_changes jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare original public.assessments; actor public.team_members; existing private.assessment_rectifications;
 before_snapshot jsonb; after_snapshot jsonb; latest integer; delta jsonb; client jsonb; company jsonb; entry record;
 patch_schema jsonb:='{"type":"object","properties":{"title":{"type":"string","nonblank":true},"client":{"type":"object","properties":{"legal_name":{"type":"string","nonblank":true},"trade_name":{"type":"string","nullable":true},"cnpj":{"type":"string","nullable":true},"cnae":{"type":"string","nullable":true},"contact_name":{"type":"string","nullable":true},"contact_phone":{"type":"string","nullable":true},"contact_email":{"type":"string","nullable":true},"address":{"type":"object","properties":{"street":{"type":"string"},"number":{"type":"string"},"complement":{"type":"string"},"district":{"type":"string"},"city":{"type":"string"},"state":{"type":"string"},"postal_code":{"type":"string"}},"strict":true}},"strict":true},"answers":{"type":"object","properties":{"visitDate":{"type":"string"},"employees":{"type":["string","number"],"positiveInteger":true},"dimensionOptions":{"type":"object","properties":{"preponderantRisk":{"type":"string"},"health":{"type":"boolean"}},"strict":false},"selectedSectors":{"type":"array","items":{"type":"string","nonblank":true}},"jobsBySector":{"type":"array","items":{"type":"array","tuple":[{"type":"string","nonblank":true},{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","nonblank":true},"quantity":{"type":["number","string"],"positiveInteger":true},"activities":{"type":"string","nonblank":true},"foodHandling":{"type":"boolean"},"workstations":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","nonblank":true},"note":{"type":"string"},"photoPath":{"type":"string","nullable":true},"photoPaths":{"type":"array","items":{"type":"string"}}},"strict":false,"required":["name"],"complete":true},"identity":"name"}},"strict":false,"required":["name","quantity","activities"],"complete":true},"identity":"name"}]},"identity":0},"selectedRiskMode":{"type":"string","enum":["ghe","job"]},"gheList":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","nonblank":true},"name":{"type":"string","nonblank":true},"linkedJobs":{"type":"array","items":{"type":"object","properties":{"sectorName":{"type":"string"},"jobName":{"type":"string"}},"strict":false,"required":["sectorName","jobName"],"complete":true},"identity":["sectorName","jobName"]}},"strict":false,"required":["id","name","linkedJobs"],"complete":true,"hardRequired":["id","name","linkedJobs"]},"identity":"id"},"selectedRisksByTarget":{"type":"array","items":{"type":"array","tuple":[{"type":"string"},{"type":"array","items":{"type":"string"}}]},"identity":0},"riskSourcesBySelection":{"type":"array","items":{"type":"array","tuple":[{"type":"string"},{"type":"object","properties":{"source":{"type":"string","nonblank":true},"note":{"type":"string"},"frequency":{"type":"string","nonblank":true},"duration":{"type":"string","nonblank":true},"damage":{"type":"string","nonblank":true},"measures":{"type":"string","nonblank":true},"improve":{"type":"string"},"measure":{"type":"string","enum":["Sim","Não"]},"controls":{"type":"array","items":{"type":"boolean"},"maxItems":3},"damageSelections":{"type":"array","items":{"type":"string"}},"damageOther":{"type":"string"},"damageOtherEnabled":{"type":"boolean"}},"strict":false,"complete":true}]},"identity":0},"epiBySelection":{"type":"array","items":{"type":"array","tuple":[{"type":"string"},{"type":"object","properties":{"applicable":{"type":"string","enum":["Sim","Não"]},"items":{"type":"array","items":{"type":"string","nonblank":true}}},"strict":false,"required":["applicable","items"],"complete":true}]},"identity":0}},"strict":true}},"strict":true}'::jsonb;
begin
 -- Hold the authoritative account, session, membership, team, and feature gate against concurrent revocation.
 perform 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)
  and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then raise exception 'Retificação não autorizada.' using errcode='42501'; end if;
 perform 1 from auth.sessions session
  where session.user_id=auth.uid() and session.id=case when auth.jwt()->>'session_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   then (auth.jwt()->>'session_id')::uuid end
  and (session.not_after is null or session.not_after>clock_timestamp()) for share;
 if not found then raise exception 'Sessão encerrada. Entre novamente.' using errcode='42501'; end if;
 select * into actor from public.team_members where user_id=auth.uid() and active and role='admin'
  and team_id='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d'::uuid for share;
 if not found then raise exception 'Retificação não autorizada.' using errcode='42501'; end if;
 perform 1 from public.teams where id=actor.team_id and active for share;
 if not found then raise exception 'Retificação não autorizada.' using errcode='42501'; end if;
 perform 1 from private.assessment_rectification_control where singleton and enabled for share;
 if not found then raise exception 'Retificação desativada.' using errcode='42501'; end if;
 -- Same client-team predicate as the verified original assessment read policy. The public
 -- SECURITY INVOKER wrapper additionally enforces the live original RLS before this helper.
 -- Recheck this dependency if the existing read policy changes; never use global-admin alone.
 select a.* into original from public.assessments a join public.clients c on c.id=a.client_id
  where a.id=p_assessment_id and a.status='completed'
   and (private.is_global_admin() or c.team_id=private.current_team_id()) for update of a;
 if not found then raise exception 'Relatório indisponível.' using errcode='42501'; end if;
 if p_expected_sequence is null or p_expected_sequence<0 or p_request_id is null then
  raise exception 'Informe a sequência e o identificador da solicitação.' using errcode='22023';
 end if;
 p_reason:=regexp_replace(p_reason,'^[[:space:]]+|[[:space:]]+$','','g');
 if p_reason is null or length(p_reason) not between 3 and 2000 then
  raise exception 'Informe um motivo entre 3 e 2000 caracteres.' using errcode='22023';
 end if;
 if p_changes is null or jsonb_typeof(p_changes)<>'object' or octet_length(p_changes::text)>1048576 then
  raise exception 'Alterações inválidas ou muito extensas.' using errcode='22023';
 end if;
 select * into existing from private.assessment_rectifications where assessment_id=p_assessment_id and request_id=p_request_id;
 if found then
  if existing.actor_id<>actor.user_id or existing.expected_sequence<>p_expected_sequence
   or existing.reason<>btrim(p_reason) or existing.requested_changes<>p_changes then
   raise exception 'Identificador da solicitação já utilizado com outro conteúdo.' using errcode='22023';
  end if;
  return; -- Lost-response retries are successful even after a later rectification.
 end if;
 select effective_snapshot,sequence into before_snapshot,latest from private.assessment_rectifications
  where assessment_id=p_assessment_id order by sequence desc limit 1;
 latest:=coalesce(latest,0);
 if latest<>p_expected_sequence then
  raise exception 'O relatório foi retificado em outra sessão. Reabra para comparar antes de salvar.' using errcode='40001';
 end if;
 before_snapshot:=coalesce(before_snapshot,original.final_snapshot);
 if jsonb_typeof(before_snapshot) is distinct from 'object' or jsonb_typeof(before_snapshot->'answers') is distinct from 'object'
  or jsonb_typeof(before_snapshot->'client') is distinct from 'object' then
  raise exception 'O relatório não possui um retrato de dados compatível.' using errcode='22023';
 end if;
 perform private.validate_rectification_value(p_changes,before_snapshot,patch_schema);
 if p_changes ? 'title' and length(btrim(p_changes->>'title')) not between 1 and 240 then
  raise exception 'Informe um título entre 1 e 240 caracteres.' using errcode='22023';
 end if;
 if p_changes->'answers' ? 'visitDate' and p_changes#>>'{answers,visitDate}'<>'' then
  if p_changes#>>'{answers,visitDate}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Data da visita inválida.' using errcode='22023'; end if;
  begin perform (p_changes#>>'{answers,visitDate}')::date;
  exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Data da visita inválida.' using errcode='22023'; end;
 end if;
 after_snapshot:=private.merge_rectification_object(before_snapshot,p_changes);
 if p_changes ? 'client' then
  client:=after_snapshot->'client'; company:=coalesce(after_snapshot#>'{answers,currentCompany}','{}'::jsonb);
  -- Synchronize only explicitly changed identity fields. Never recopy the live client record.
  for entry in select * from (values ('cnpj','cnpj'),('legal_name','razao_social'),('trade_name','nome_fantasia'),
   ('cnae','cnae_fiscal'),('contact_name','contact_name'),('contact_phone','ddd_telefone_1'),('contact_email','email')) as mapping(source,target) loop
   if p_changes->'client' ? entry.source and client->entry.source is distinct from before_snapshot->'client'->entry.source then
    company:=jsonb_set(company,array[entry.target],to_jsonb(coalesce(client->>entry.source,'')));
   end if;
  end loop;
  for entry in select * from (values ('street','logradouro'),('number','numero'),('complement','complemento'),
   ('district','bairro'),('city','municipio'),('state','uf'),('postal_code','cep')) as mapping(source,target) loop
   if p_changes#>'{client,address}' ? entry.source and client->'address'->entry.source is distinct from before_snapshot#>array['client','address',entry.source] then
    company:=jsonb_set(company,array[entry.target],to_jsonb(coalesce(client->'address'->>entry.source,'')));
   end if;
  end loop;
  if p_changes->'client' ? 'cnae' and client->'cnae' is distinct from before_snapshot#>'{client,cnae}' then company:=jsonb_set(company,'{cnae_fiscal_descricao}','""'); end if;
  if p_changes#>'{client,address}' ? 'street' and client#>'{address,street}' is distinct from before_snapshot#>'{client,address,street}' then company:=jsonb_set(company,'{descricao_tipo_de_logradouro}','""'); end if;
  after_snapshot:=jsonb_set(after_snapshot,'{answers,currentCompany}',company);
  if p_changes->'client' ? 'cnpj' and client->'cnpj' is distinct from before_snapshot#>'{client,cnpj}' then after_snapshot:=jsonb_set(after_snapshot,'{answers,cnpj}',to_jsonb(coalesce(client->>'cnpj',''))); end if;
 end if;
 if p_changes->'answers' ?| array['selectedSectors','jobsBySector','selectedRiskMode','gheList','selectedRisksByTarget','riskSourcesBySelection','epiBySelection'] then
  perform private.validate_rectification_references(after_snapshot->'answers',before_snapshot->'answers');
 end if;
 if p_changes->'answers' ? 'jobsBySector' then
  perform private.validate_rectification_photos(after_snapshot->'answers',before_snapshot->'answers',original.client_id);
 end if;
 delta:=private.rectification_diff(before_snapshot,after_snapshot);
 if delta='[]'::jsonb then raise exception 'Nenhuma alteração foi informada.' using errcode='22023'; end if;
 -- The old report document remains permanently in the original assessment. Effective documents
 -- must be regenerated from business data, never accepted from an editable client payload.
 after_snapshot:=after_snapshot#-'{answers,report_document}';
 insert into private.assessment_rectifications(assessment_id,sequence,request_id,expected_sequence,
  actor_id,actor_name,actor_team_id,created_at,reason,requested_changes,changes,effective_snapshot)
 values(p_assessment_id,latest+1,p_request_id,p_expected_sequence,actor.user_id,actor.display_name,
  actor.team_id,clock_timestamp(),btrim(p_reason),p_changes,delta,after_snapshot);
end; $$;
revoke all on function private.append_assessment_rectification(uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.append_assessment_rectification(uuid,integer,uuid,text,jsonb) to authenticated;

create function public.rectify_assessment(p_assessment_id uuid,p_expected_sequence integer,p_request_id uuid,p_reason text,p_changes jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if not public.can_rectify_assessment(p_assessment_id) then raise exception 'Retificação não autorizada.' using errcode='42501'; end if;
 perform private.append_assessment_rectification(p_assessment_id,p_expected_sequence,p_request_id,p_reason,p_changes);
 return public.read_assessment_report(p_assessment_id,false);
end; $$;
revoke all on function public.can_rectify_assessment(uuid),public.read_assessment_report(uuid,boolean),public.rectify_assessment(uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.can_rectify_assessment(uuid),public.read_assessment_report(uuid,boolean),public.rectify_assessment(uuid,integer,uuid,text,jsonb) to authenticated;
-- The existing private schema is already usable by authenticated in the verified baseline;
-- intentionally no schema, role, membership or existing object grants are broadened here.
commit;
