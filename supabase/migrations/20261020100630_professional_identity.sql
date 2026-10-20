-- Professional identity is independent from authorization. No real-user backfill.
-- Requires user-contact-phone.sql, transferred-draft-responsible.sql and report rectification.
begin;

alter table public.team_members
 add column professional_role text,
 add column professional_registration text,
 add column professional_registration_uf text,
 add constraint team_members_professional_role_check check (
  professional_role is null or professional_role in ('safety_technician','safety_engineer','safety_assistant')),
 add constraint team_members_professional_registration_check check (
  professional_registration is null or (professional_registration=btrim(professional_registration)
   and length(professional_registration) between 1 and 80 and professional_registration !~ '[[:cntrl:]]')),
 add constraint team_members_professional_registration_uf_check check (
  professional_registration_uf is null or professional_registration_uf in
   ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));

alter table public.assessments add column visit_responsible_id uuid
 references public.team_members(user_id) on delete restrict;
create index assessments_visit_responsible_idx on public.assessments(visit_responsible_id)
 where visit_responsible_id is not null;
comment on column public.assessments.responsible_id is 'Existing operator/owner; unchanged authorization and RLS.';
comment on column public.assessments.visit_responsible_id is 'Technical professional selected for the visit; not an authorization role.';

-- A narrowly scoped private validator is needed to lock membership/team rows without
-- granting authenticated users UPDATE on the directory. It does not mutate data or
-- widen its visibility: actor access and candidate scope are independently enforced.
-- All rows governing eligibility are held FOR SHARE until the assessment commits.
create function private.assessment_professional_snapshot(
 p_client_id uuid,p_operator_id uuid,p_old_operator_id uuid,p_professional_id uuid,p_validate boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.team_members; actor_team public.teams; client public.clients;
 professional public.team_members; professional_team public.teams; actor_global boolean; actor_admin boolean;
begin
 if auth.uid() is null then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
 perform 1 from public.team_members m
 where m.user_id in (auth.uid(),p_operator_id,p_old_operator_id,p_professional_id)
 order by m.user_id for share;
 select * into actor from public.team_members where user_id=auth.uid();
 if actor.user_id is null or not actor.active then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
 select * into client from public.clients where id=p_client_id for share;
 if client.id is null then raise exception 'Cliente indisponível.' using errcode='42501'; end if;
 select * into professional from public.team_members where user_id=p_professional_id;
 perform 1 from public.teams t where t.id in (actor.team_id,client.team_id,professional.team_id)
 order by t.id for share;
 select * into actor_team from public.teams where id=actor.team_id;
 if actor_team.id is null or not (actor_team.active or actor.is_super_admin) then
  raise exception 'Acesso não autorizado.' using errcode='42501';
 end if;
 -- Exactly the existing current_team_role/is_global_admin rules, not professional_role.
 actor_global:=(actor.is_super_admin and actor.role='admin') or (actor_team.active and actor_team.grants_global_access);
 actor_admin:=actor.role='admin' or actor.is_super_admin or actor_team.grants_global_access;
 if not (actor_global or client.team_id=actor.team_id) or
  not coalesce(actor_admin or (p_operator_id=actor.user_id and (p_old_operator_id is null or p_old_operator_id=actor.user_id)),false) then
  raise exception 'Levantamento não autorizado.' using errcode='42501';
 end if;
 if not coalesce(p_validate,false) then return null; end if;
 select * into professional_team from public.teams where id=professional.team_id;
 if professional.user_id is null or not professional.active or professional_team.id is null or not professional_team.active
  or not (professional.team_id=client.team_id or (actor_global and professional_team.grants_global_access))
  or not (actor_global or professional.team_id=actor.team_id)
  or professional.professional_role is null or professional.professional_role not in ('safety_technician','safety_engineer')
  or nullif(btrim(professional.professional_registration),'') is null
  or (professional.professional_role='safety_engineer' and (professional.professional_registration_uf is null
   or professional.professional_registration_uf not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))) then
  raise exception 'Selecione um técnico ou engenheiro de segurança ativo, com registro informado e UF do CREA quando aplicável, como responsável pela visita.' using errcode='23514';
 end if;
 return jsonb_build_object('user_id',professional.user_id,'display_name',professional.display_name,
  'professional_role',professional.professional_role,
  'registration_type',case professional.professional_role when 'safety_technician' then 'MTE' else 'CREA' end,
  'registration_number',professional.professional_registration,
  'registration_uf',case when professional.professional_role='safety_engineer' then professional.professional_registration_uf else null end);
end; $$;
revoke all on function private.assessment_professional_snapshot(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function private.assessment_professional_snapshot(uuid,uuid,uuid,uuid,boolean) to authenticated;

CREATE OR REPLACE FUNCTION private.guard_assessment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare client_snapshot jsonb; professional_snapshot jsonb; old_operator uuid; validate_professional boolean;
begin
 if TG_OP='UPDATE' then
  if OLD.status='completed' then
   raise exception 'Levantamento concluído não pode ser alterado.' using errcode='23514';
  end if;
  if NEW.client_id <> OLD.client_id then
   raise exception 'O cliente do levantamento não pode ser alterado.' using errcode='23514';
  end if;
  NEW.revision := OLD.revision + 1;
  old_operator:=OLD.responsible_id;
  validate_professional:=NEW.visit_responsible_id is distinct from OLD.visit_responsible_id and NEW.visit_responsible_id is not null;
 else
  if NEW.status <> 'draft' then
   raise exception 'O levantamento deve começar como rascunho.' using errcode='23514';
  end if;
  NEW.revision := 1;
  validate_professional:=NEW.visit_responsible_id is not null;
 end if;
 -- Recheck actor permissions even on drafts. An unchanged stale choice may remain in
 -- a draft, but a new choice and every conclusion must pass current eligibility.
 professional_snapshot:=private.assessment_professional_snapshot(NEW.client_id,NEW.responsible_id,old_operator,
  NEW.visit_responsible_id,validate_professional or NEW.status='completed');
 if not exists(select 1 from public.team_members where user_id=NEW.responsible_id and active) and not (TG_OP='UPDATE' and NEW.responsible_id=OLD.responsible_id and private.existing_responsible_active(OLD.id)) then
  raise exception 'Responsável deve ser membro ativo.' using errcode='23514';
 end if;
 if NEW.status='completed' then
  if NEW.answers='{}'::jsonb then
   raise exception 'Preencha o levantamento antes de concluir.' using errcode='23514';
  end if;
  select to_jsonb(c) into client_snapshot from public.clients c where c.id=NEW.client_id;
  if client_snapshot is null then raise exception 'Cliente indisponível.'; end if;
  NEW.completed_at := now();
  NEW.completed_by := auth.uid();
  NEW.final_snapshot := jsonb_build_object(
   'client',client_snapshot,'answers',NEW.answers,'schema_version',NEW.schema_version,
   'title',NEW.title,'responsible_id',NEW.responsible_id,'completed_at',NEW.completed_at,
   'responsible_professional',professional_snapshot);
 else
  NEW.completed_at := null; NEW.completed_by := null; NEW.final_snapshot := null;
 end if;
 return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.manage_gro_admin(p_actor uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor public.team_members; target public.team_members; team public.teams; result jsonb; tid uuid;
begin
 select * into actor from public.team_members where user_id=p_actor for update;
 select * into team from public.teams where id=actor.team_id for share;
 if team.active and team.grants_global_access then actor.is_super_admin=true; actor.role='admin'; end if;
 if actor.user_id is null or not actor.active or actor.role<>'admin' then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform 1 from public.teams where id=actor.team_id and (active or actor.is_super_admin) for share;
 if not found then raise exception 'Equipe inativa' using errcode='42501'; end if;
 if p_action in ('create_team','update_team') then
  if not actor.is_super_admin then raise exception 'Somente o administrador geral pode alterar equipes' using errcode='42501'; end if;
  if p_action='create_team' then
   insert into public.teams(name) values(btrim(p_data->>'name')) returning to_jsonb(teams.*) into result;
  else
   tid=(p_data->>'id')::uuid;
   if not (p_data->>'active')::boolean and exists(select 1 from public.team_members where team_id=tid and is_super_admin) then raise exception 'A equipe do administrador geral deve permanecer ativa'; end if;
   update public.teams set name=btrim(p_data->>'name'),active=(p_data->>'active')::boolean where id=tid returning to_jsonb(teams.*) into result;
   if result is null then raise exception 'Equipe não encontrada'; end if;
  end if;
 elsif p_action in ('create_user','update_user') then
  -- Validate supplied types independently from the Edge Function. Omitted keys
  -- preserve existing values; null or a blank string explicitly clears that field.
  if exists(select 1 from jsonb_each(p_data) e where e.key in
   ('professional_role','professional_registration','professional_registration_uf')
   and jsonb_typeof(e.value) not in ('string','null')) then
   raise exception 'Dados profissionais inválidos.' using errcode='22023';
  end if;
  tid=(p_data->>'team_id')::uuid;
  select * into team from public.teams where id=tid for share;
  if team.id is null or not team.active then raise exception 'Escolha uma equipe ativa'; end if;
  if not actor.is_super_admin and tid<>actor.team_id then raise exception 'Equipe não autorizada' using errcode='42501'; end if;
  if p_action='create_user' then
   insert into public.team_members(user_id,display_name,username,contact_phone,role,active,team_id,professional_role,professional_registration,professional_registration_uf)
   values((p_data->>'user_id')::uuid,btrim(p_data->>'display_name'),p_data->>'username',nullif(btrim(p_data->>'contact_phone'),''),p_data->>'role',true,tid,nullif(btrim(p_data->>'professional_role'),''),nullif(btrim(p_data->>'professional_registration'),''),upper(nullif(btrim(p_data->>'professional_registration_uf'),'')))
   returning to_jsonb(team_members.*) into result;
  else
   select * into target from public.team_members where user_id=(p_data->>'user_id')::uuid for update;
   if target.user_id is null or (not actor.is_super_admin and (target.team_id<>actor.team_id or target.is_super_admin)) then raise exception 'Usuário não autorizado' using errcode='42501'; end if;
   if target.is_super_admin and (tid<>target.team_id or p_data->>'role'<>'admin' or not (p_data->>'active')::boolean) then raise exception 'O acesso do administrador geral está protegido'; end if;
   if target.user_id=actor.user_id and (tid<>actor.team_id or p_data->>'role'<>target.role or not (p_data->>'active')::boolean) then raise exception 'Você não pode remover seu próprio acesso'; end if;
   if target.team_id<>tid and exists(select 1 from public.assessments where responsible_id=target.user_id and status='draft') then raise exception 'Conclua os rascunhos deste usuário antes de transferi-lo de equipe'; end if;
   update public.team_members set display_name=btrim(p_data->>'display_name'),username=p_data->>'username',contact_phone=case when p_data ? 'contact_phone' then nullif(btrim(p_data->>'contact_phone'),'') else target.contact_phone end,role=p_data->>'role',active=(p_data->>'active')::boolean,team_id=tid,
    professional_role=case when p_data ? 'professional_role' then nullif(btrim(p_data->>'professional_role'),'') else target.professional_role end,
    professional_registration=case when p_data ? 'professional_registration' then nullif(btrim(p_data->>'professional_registration'),'') else target.professional_registration end,
    professional_registration_uf=case when p_data ? 'professional_registration_uf' then upper(nullif(btrim(p_data->>'professional_registration_uf'),'')) else target.professional_registration_uf end
   where user_id=target.user_id returning to_jsonb(team_members.*) into result;
  end if;
 else raise exception 'Operação inválida';
 end if;
 return result;
end $function$
;

create or replace function public.read_assessment_report(p_assessment_id uuid,p_original boolean default false) returns jsonb
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
 -- Freeze the professional identity, including its display name. Only legacy
 -- snapshots without the identity object retain the previous directory fallback.
 if jsonb_typeof(effective->'responsible_professional')='object' then
  responsible_name:=effective#>>'{responsible_professional,display_name}';
 else
  select display_name into responsible_name from public.team_members where user_id=original.responsible_id;
 end if;
 return jsonb_build_object('assessment',jsonb_build_object('id',original.id,'client_id',original.client_id,
  'title',coalesce(effective->>'title',original.title),'report_revision',original.report_revision,'revision',original.revision,
  'completed_at',original.completed_at,'final_snapshot',effective,'team_members',jsonb_build_object('display_name',responsible_name)),
  'original_report_document',original.final_snapshot#>'{answers,report_document}',
  'sequence',coalesce(latest,0),'can_rectify',public.can_rectify_assessment(p_assessment_id),'history',history);
end; $$;

-- CREATE OR REPLACE preserves each existing function ACL/security mode. No policy,
-- table grant, authorization role, historical snapshot or rectification allowlist changes.
commit;
