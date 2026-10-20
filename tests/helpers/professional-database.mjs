import {readFile} from 'node:fs/promises';
export const root=new URL('../../',import.meta.url);
export const ids={
 team:'20000000-0000-4000-8000-000000000001',other:'20000000-0000-4000-8000-000000000002',globalTeam:'10888888-c3e9-4bf7-ac23-76e7b1e8fe6d',inactiveTeam:'20000000-0000-4000-8000-000000000004',
 admin:'30000000-0000-4000-8000-000000000001',assistant:'30000000-0000-4000-8000-000000000002',tech:'30000000-0000-4000-8000-000000000003',engineer:'30000000-0000-4000-8000-000000000004',outsider:'30000000-0000-4000-8000-000000000005',global:'30000000-0000-4000-8000-000000000006',globalTech:'30000000-0000-4000-8000-000000000007',unknown:'30000000-0000-4000-8000-000000000008',inactive:'30000000-0000-4000-8000-000000000009',inactiveTeamTech:'30000000-0000-4000-8000-000000000010',missingRegistration:'30000000-0000-4000-8000-000000000011',missingUf:'30000000-0000-4000-8000-000000000012',superAdmin:'30000000-0000-4000-8000-000000000013',
 client:'40000000-0000-4000-8000-000000000001',otherClient:'40000000-0000-4000-8000-000000000002',legacy:'50000000-0000-4000-8000-000000000001',draft:'50000000-0000-4000-8000-000000000002'
};
export const sessionFor=id=>id?.replace(/^30000000/,'70000000');
export const migrationPath='supabase/migrations/20261020100630_professional_identity.sql';
export const source=path=>readFile(new URL(path,root),'utf8');
export async function baseline(exec,query){
 await exec(await source('supabase/tests/rectification-fixture.sql'));
 await exec(await source('supabase/tests/professional-identity-fixture.sql'));
 await exec(await source('supabase/user-contact-phone.sql'));
 await exec('revoke all on function public.manage_gro_admin(uuid,text,jsonb) from public,anon,authenticated;grant execute on function public.manage_gro_admin(uuid,text,jsonb) to service_role;');
 await exec(await source('supabase/transferred-draft-responsible.sql'));
 await exec(await source('supabase/migrations/20261020001758_report_rectification.sql'));
 for(const [id,name,active,global] of [[ids.team,'Synthetic team',true,false],[ids.other,'Synthetic other team',true,false],[ids.globalTeam,'Synthetic administrators',true,true],[ids.inactiveTeam,'Synthetic inactive team',false,false]]){
  await query('insert into public.teams(id,name,active,grants_global_access) values($1,$2,$3,$4)',[id,name,active,global]);
 }
 for(const key of ['admin','assistant','tech','engineer','outsider','global','globalTech','unknown','inactive','inactiveTeamTech','missingRegistration','missingUf','superAdmin']){
  const id=ids[key],team=['global','globalTech'].includes(key)?ids.globalTeam:key==='outsider'?ids.other:key==='inactiveTeamTech'?ids.inactiveTeam:ids.team;
  await query('insert into auth.users(id) values($1)',[id]);await query('insert into auth.sessions(id,user_id) values($1,$2)',[sessionFor(id),id]);
  await query('insert into public.team_members(user_id,team_id,username,display_name,role,active,is_super_admin) values($1,$2,$3,$4,$5,$6,$7)',[id,team,key,'Synthetic '+key,['admin','superAdmin'].includes(key)?'admin':'editor',key!=='inactive',key==='superAdmin']);
 }
 await query('insert into public.clients(id,team_id,legal_name) values($1,$2,\'Synthetic company\'),($3,$4,\'Synthetic other company\')',[ids.client,ids.team,ids.otherClient,ids.other]);
 const legacy={client:{id:ids.client,team_id:ids.team,legal_name:'Synthetic company'},title:'Legacy report',answers:{visitDate:'2026-01-15',report_document:{version:1,children:[{text:'Original legacy document'}]}},responsible_id:ids.assistant,schema_version:1};
 await query("insert into public.assessments(id,client_id,title,responsible_id,status,revision,report_revision,created_by,answers,final_snapshot) values($1,$2,'Legacy report',$3,'completed',10,2,$3,$4::jsonb,$5::jsonb)",[ids.legacy,ids.client,ids.assistant,JSON.stringify(legacy.answers),JSON.stringify(legacy)]);
 await query("insert into public.assessments(id,client_id,title,responsible_id,status,revision,created_by,answers) values($1,$2,'Existing draft',$3,'draft',1,$3,'{\"visitDate\":\"2026-01-15\"}'::jsonb)",[ids.draft,ids.client,ids.assistant]);
 await exec('drop trigger assessments_b_guard on public.assessments;create trigger assessments_b_guard before insert or update on public.assessments for each row execute function private.guard_assessment();');
}
export async function seedProfessionals(query){
 for(const [key,role,registration,uf] of [
  ['admin','safety_assistant','NOT-QUALIFIED',null],['assistant','safety_assistant',null,null],['tech','safety_technician','MTE-123',null],['engineer','safety_engineer','CREA-456','SP'],['outsider','safety_engineer','CREA-789','RJ'],['global','safety_assistant',null,null],['globalTech','safety_technician','MTE-999',null],['inactive','safety_technician','MTE-888',null],['inactiveTeamTech','safety_technician','MTE-777',null],['missingRegistration','safety_technician',null,null],['missingUf','safety_engineer','CREA-000',null]
 ]) await query('update public.team_members set professional_role=$2,professional_registration=$3,professional_registration_uf=$4 where user_id=$1',[ids[key],role,registration,uf]);
}
