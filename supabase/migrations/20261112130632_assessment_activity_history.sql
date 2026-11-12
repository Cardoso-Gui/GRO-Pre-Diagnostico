begin;
-- Additive audit metadata. No answer values or document snapshots are copied.
-- No FK: deleting an authorized draft must not erase or be blocked by its audit.
-- A deleted assessment has no readable history because SELECT requires its
-- current parent row under the caller's existing assessment RLS policy.
create table private.assessment_activity (
 id bigint generated always as identity primary key,
 assessment_id uuid not null,
 actor_id uuid,
 actor_name text not null,
 occurred_at timestamptz not null default clock_timestamp(),
 action text not null check(action in ('created','updated','completed','rectified')),
 revision bigint,
 changed_fields text[] not null default '{}'
);
create index assessment_activity_assessment_page on private.assessment_activity(assessment_id,id desc);
alter table private.assessment_activity enable row level security;
revoke all on private.assessment_activity from public,anon,authenticated,service_role;
revoke all on sequence private.assessment_activity_id_seq from public,anon,authenticated,service_role;
grant select on private.assessment_activity to authenticated;
create policy assessment_activity_read on private.assessment_activity for select to authenticated
 using((select private.rectification_identity_active()) and exists(
  select 1 from public.assessments a where a.id=assessment_id
 ));

create function private.reject_assessment_activity_mutation() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'O histórico de alterações é somente leitura.' using errcode='23514'; end;
$$;
create trigger assessment_activity_no_rewrite before update or delete on private.assessment_activity
 for each row execute function private.reject_assessment_activity_mutation();
create trigger assessment_activity_no_truncate before truncate on private.assessment_activity
 for each statement execute function private.reject_assessment_activity_mutation();
revoke all on function private.reject_assessment_activity_mutation() from public,anon,authenticated,service_role;

-- Only a database trigger inserts events. Actor and time are derived on the
-- server, never accepted from a browser payload. Existing write guards/RLS stay.
create function private.record_assessment_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare fields text[]:='{}'; actor uuid:=auth.uid(); actor_label text; event_action text; key text;
begin
 select m.display_name into actor_label from public.team_members m where m.user_id=actor;
 if TG_TABLE_NAME='assessment_rectifications' then
  select coalesce(array_agg(distinct field_name order by field_name),'{}'::text[]) into fields
  from (select case when jsonb_typeof(change->'path')='string' then
     case when split_part(change->>'path','/',2)='answers' then 'answers.'||replace(replace(split_part(change->>'path','/',3),'~1','/'),'~0','~')
       else replace(replace(split_part(change->>'path','/',2),'~1','/'),'~0','~') end
    when change->'path'->>0='answers' then 'answers.'||coalesce(change->'path'->>1,'') else coalesce(change->'path'->>0,'other') end as field_name
    from jsonb_array_elements(NEW.changes) change limit 100) changed;
  insert into private.assessment_activity(assessment_id,actor_id,actor_name,action,revision,changed_fields)
   select NEW.assessment_id,actor,coalesce(actor_label,case when actor is null then 'Sistema' else 'Integrante' end),'rectified',a.revision,fields
   from public.assessments a where a.id=NEW.assessment_id;
  return NEW;
 end if;
 if TG_OP='INSERT' then event_action:='created';
 else
  if NEW.title is distinct from OLD.title then fields:=array_append(fields,'title');end if;
  if NEW.status is distinct from OLD.status then fields:=array_append(fields,'status');end if;
  if NEW.responsible_id is distinct from OLD.responsible_id then fields:=array_append(fields,'responsible_id');end if;
  if NEW.visit_responsible_id is distinct from OLD.visit_responsible_id then fields:=array_append(fields,'visit_responsible_id');end if;
  for key in select k from jsonb_object_keys(coalesce(NEW.answers,'{}'::jsonb)||coalesce(OLD.answers,'{}'::jsonb)) k
    where NEW.answers->k is distinct from OLD.answers->k order by k limit 100
  loop fields:=array_append(fields,'answers.'||left(key,120));end loop;
  if cardinality(fields)=0 then return NEW;end if;
  event_action:=case when NEW.status='completed' and OLD.status is distinct from NEW.status then 'completed' else 'updated' end;
 end if;
 insert into private.assessment_activity(assessment_id,actor_id,actor_name,action,revision,changed_fields)
  values(NEW.id,actor,coalesce(actor_label,case when actor is null then 'Sistema' else 'Integrante' end),event_action,NEW.revision,fields);
 return NEW;
end;
$$;
revoke all on function private.record_assessment_activity() from public,anon,authenticated,service_role;
create trigger assessments_z_activity after insert or update on public.assessments
 for each row execute function private.record_assessment_activity();
create trigger rectifications_z_activity after insert on private.assessment_rectifications
 for each row execute function private.record_assessment_activity();

-- Invoker security and the table's RLS preserve current assessment visibility,
-- including client transfers and fresh session/member revocation checks.
create function public.read_assessment_activity(p_assessment_id uuid,p_before_id bigint default null,p_limit integer default 21)
returns table(event_id text,action text,actor_name text,occurred_at timestamptz,revision bigint,changed_fields text[])
language sql stable security invoker set search_path='' as $$
 select e.id::text,e.action,e.actor_name,e.occurred_at,e.revision,e.changed_fields
 from private.assessment_activity e
 where e.assessment_id=p_assessment_id and (p_before_id is null or e.id<p_before_id)
 order by e.id desc limit least(greatest(coalesce(p_limit,21),1),50);
$$;
revoke all on function public.read_assessment_activity(uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function public.read_assessment_activity(uuid,bigint,integer) to authenticated;
commit;
