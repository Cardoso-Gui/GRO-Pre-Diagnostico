-- Global uniqueness includes archived clients and concurrent requests.
alter table public.clients drop constraint clients_team_cnpj_key;
alter table public.clients add constraint clients_cnpj_key unique(cnpj);
create or replace function private.guard_client_team() returns trigger language plpgsql set search_path='' as $$ begin
 if new.team_id is distinct from old.team_id then
  if not private.is_global_admin() then raise exception 'Somente administradores gerais podem transferir clientes.' using errcode='42501'; end if;
  if not exists(select 1 from public.teams where id=new.team_id and active) then raise exception 'Escolha uma equipe ativa.' using errcode='23514';end if;
 end if;
 return new;
end $$;
