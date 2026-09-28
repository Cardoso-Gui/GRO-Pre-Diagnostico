create function private.existing_responsible_active(p_assessment uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.assessments a join public.clients c on c.id=a.client_id join public.team_members m on m.user_id=a.responsible_id
where a.id=p_assessment and m.active and (select auth.uid()) is not null and ((select private.is_global_admin()) or c.team_id=(select private.current_team_id())));
$$;
revoke all on function private.existing_responsible_active(uuid) from public,anon;
grant execute on function private.existing_responsible_active(uuid) to authenticated;
CREATE OR REPLACE FUNCTION private.guard_assessment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare client_snapshot jsonb;
begin
 if TG_OP='UPDATE' then
  if OLD.status='completed' then
   raise exception 'Levantamento concluído não pode ser alterado.' using errcode='23514';
  end if;
  if NEW.client_id <> OLD.client_id then
   raise exception 'O cliente do levantamento não pode ser alterado.' using errcode='23514';
  end if;
  NEW.revision := OLD.revision + 1;
 else
  if NEW.status <> 'draft' then
   raise exception 'O levantamento deve começar como rascunho.' using errcode='23514';
  end if;
  NEW.revision := 1;
 end if;
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
   'title',NEW.title,'responsible_id',NEW.responsible_id,'completed_at',NEW.completed_at);
 else
  NEW.completed_at := null; NEW.completed_by := null; NEW.final_snapshot := null;
 end if;
 return NEW;
end;
$function$
