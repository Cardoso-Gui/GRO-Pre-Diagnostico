import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {baseline,seedProfessionals,ids,sessionFor,source,migrationPath} from './helpers/professional-database.mjs';

const permissionSql="select c.oid::regclass::text as name,c.relacl::text as acl,c.relrowsecurity as rls from pg_class c where c.relnamespace in ('public'::regnamespace,'auth'::regnamespace) and c.relkind='r' order by 1";
const policiesSql="select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname";
const functionsSql="select p.oid::regprocedure::text as name,p.proacl::text as acl,p.prosecdef as definer from pg_proc p where p.oid in ('public.manage_gro_admin(uuid,text,jsonb)'::regprocedure,'private.guard_assessment()'::regprocedure,'private.current_team_role()'::regprocedure,'private.current_team_id()'::regprocedure,'private.is_global_admin()'::regprocedure,'public.read_assessment_report(uuid,boolean)'::regprocedure) order by 1";

test('professional SQL eligibility, independent permissions and immutable report identity',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const q=async(sql,values=[]) => (await db.query(sql,values)).rows;
 const owner=async(sql,values=[])=>{await db.exec('reset role');return q(sql,values);};
 const as=async(id=ids.assistant,role='authenticated')=>{await db.exec(`reset role;set role ${role}`);await q("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id||'',JSON.stringify({sub:id,session_id:sessionFor(id),role})]);};
 const denies=async(fn,code)=>assert.rejects(fn,e=>{assert.equal(e.code,code,e.message);return true;});
 const draft=async(professional=null,operator=ids.assistant,client=ids.client)=> (await q("insert into public.assessments(client_id,title,responsible_id,created_by,visit_responsible_id,answers) values($1,'Synthetic draft',$2,auth.uid(),$3,'{\"visitDate\":\"2026-01-15\"}') returning *",[client,operator,professional]))[0];
 const complete=async(id)=> (await q("update public.assessments set status='completed' where id=$1 returning *",[id]))[0];
 const getReport=async(id,original=false)=>(await q('select public.read_assessment_report($1,$2) as report',[id,original]))[0].report;
 const rectify=async(id,changes,sequence=0,request=1)=>(await q('select public.rectify_assessment($1,$2,$3,$4,$5::jsonb) as report',[id,sequence,`60000000-0000-4000-8000-${String(request).padStart(12,'0')}`,'Synthetic authorized correction',JSON.stringify(changes)]))[0].report;
 await baseline(sql=>db.exec(sql),q);
 const permissions=await q(permissionSql),policies=await q(policiesSql),functions=await q(functionsSql);
 const oldOriginal=(await q('select to_jsonb(a) as value from public.assessments a where id=$1',[ids.legacy]))[0].value;
 const authHelpers=await q("select pg_get_functiondef(p.oid) as definition from pg_proc p where p.oid in ('private.current_team_role()'::regprocedure,'private.current_team_id()'::regprocedure,'private.is_global_admin()'::regprocedure) order by p.oid");
 await db.exec(await source(migrationPath));
 await t.test('migration changes no existing grants, policies, auth helpers, roles or legacy snapshot',async()=>{
  assert.deepEqual(await q(permissionSql),permissions);assert.deepEqual(await q(policiesSql),policies);assert.deepEqual(await q(functionsSql),functions);
  assert.deepEqual(await q("select pg_get_functiondef(p.oid) as definition from pg_proc p where p.oid in ('private.current_team_role()'::regprocedure,'private.current_team_id()'::regprocedure,'private.is_global_admin()'::regprocedure) order by p.oid"),authHelpers);
  const after=(await q('select to_jsonb(a) as value from public.assessments a where id=$1',[ids.legacy]))[0].value;
  assert.deepEqual(after,{...oldOriginal,visit_responsible_id:null});
  assert.equal((await q('select count(*)::int count from public.team_members where professional_role is not null or professional_registration is not null or professional_registration_uf is not null'))[0].count,0);
  assert.equal((await q("select has_function_privilege('anon','private.assessment_professional_snapshot(uuid,uuid,uuid,uuid,boolean)','execute') as allowed"))[0].allowed,false);
 });
 await seedProfessionals(q);
 await t.test('assistants and unknown users may draft, but cannot self-qualify or conclude without a selected professional',async()=>{
  await as();const a=await draft();assert.equal(a.status,'draft');assert.equal(a.visit_responsible_id,null);
  const saved=await q("update public.assessments set title='Saved by auxiliary' where id=$1 returning revision",[a.id]);assert.equal(saved[0].revision,2);
  await denies(()=>complete(a.id),'23514');await denies(()=>draft(ids.assistant),'23514');
  await denies(()=>q('update public.team_members set professional_role=\'safety_engineer\' where user_id=auth.uid()'),'42501');
  await as(ids.unknown);assert.equal((await draft(null,ids.unknown)).status,'draft');await denies(()=>draft(ids.unknown,ids.unknown),'23514');
 });
 await t.test('invalid selected professionals are rejected on direct database draft assignment, including administrator auxiliaries',async()=>{
  await as(ids.global);
  for(const key of ['admin','assistant','unknown','inactive','inactiveTeamTech','missingRegistration','missingUf','outsider']) await denies(()=>draft(ids[key],ids.global),'23514');
  await denies(()=>draft('30000000-0000-4000-8000-000000000099',ids.global),'23514');
  await as(ids.admin);await denies(()=>draft(ids.admin,ids.admin),'23514');
  await as(ids.assistant);const a=await draft();await denies(()=>q('update public.assessments set visit_responsible_id=$2 where id=$1',[a.id,ids.admin]),'23514');
 });
 let technicianReport,engineerReport;
 await t.test('auxiliary operator concludes with qualified technician; server ignores identity spoofing',async()=>{
  await as();const a=await draft(ids.tech);assert.equal(a.responsible_id,ids.assistant);
  const spoof={user_id:ids.admin,display_name:'Forged name',professional_role:'safety_engineer',registration_type:'CREA',registration_number:'FAKE',registration_uf:'RJ'};
  technicianReport=(await q("update public.assessments set status='completed',completed_by=$2,final_snapshot=$3::jsonb,answers=answers || $4::jsonb where id=$1 returning *",[a.id,ids.admin,JSON.stringify({responsible_professional:spoof}),JSON.stringify({responsible_professional:spoof})]))[0];
  assert.equal(technicianReport.completed_by,ids.assistant);assert.equal(technicianReport.responsible_id,ids.assistant);
  assert.deepEqual(technicianReport.final_snapshot.responsible_professional,{user_id:ids.tech,display_name:'Synthetic tech',professional_role:'safety_technician',registration_type:'MTE',registration_number:'MTE-123',registration_uf:null});
  assert.equal((await getReport(a.id)).assessment.team_members.display_name,'Synthetic tech');
  await denies(()=>q('update public.assessments set visit_responsible_id=$2 where id=$1',[a.id,ids.engineer]),'23514');
  await denies(()=>q("update public.assessments set final_snapshot='{}'::jsonb where id=$1",[a.id]),'23514');
 });
 await t.test('engineer snapshot contains immutable CREA number and UF without changing operator permissions',async()=>{
  await as();const a=await draft(ids.engineer);engineerReport=await complete(a.id);
  assert.deepEqual(engineerReport.final_snapshot.responsible_professional,{user_id:ids.engineer,display_name:'Synthetic engineer',professional_role:'safety_engineer',registration_type:'CREA',registration_number:'CREA-456',registration_uf:'SP'});
  await as(ids.engineer);const cannotOwn=await q("update public.assessments set title='Not the operator' where id=$1 returning id",[ids.draft]);assert.deepEqual(cannotOwn,[]);
 });
 await t.test('candidate scope matches existing directory RLS; global authorization is not professional qualification',async()=>{
  await as();assert.deepEqual(await q('select user_id from public.team_members where user_id=$1',[ids.globalTech]),[]);
  await denies(()=>draft(ids.globalTech),'23514');await denies(()=>draft(ids.outsider),'23514');
  await as(ids.global);assert.equal((await draft(ids.globalTech,ids.global)).visit_responsible_id,ids.globalTech);assert.equal((await draft(ids.tech,ids.global)).visit_responsible_id,ids.tech);
  await denies(()=>draft(ids.outsider,ids.global),'23514');await denies(()=>draft(ids.global,ids.global),'23514');
  await as(ids.superAdmin);assert.equal((await draft(ids.globalTech,ids.superAdmin)).visit_responsible_id,ids.globalTech);
 });
 await t.test('unchanged stale choice permits draft saving but blocks conclusion; a replacement must qualify',async()=>{
  for(const mutation of ["active=false","professional_registration=null","professional_role='safety_assistant'","team_id='20000000-0000-4000-8000-000000000002'"]){
   await as();const a=await draft(ids.tech);
   await owner(`update public.team_members set ${mutation} where user_id=$1`,[ids.tech]);
   await as();assert.equal((await q("update public.assessments set title='Still draft' where id=$1 returning status",[a.id]))[0].status,'draft');await denies(()=>complete(a.id),'23514');
   await denies(()=>draft(ids.tech),'23514');
   await q('update public.assessments set visit_responsible_id=$2 where id=$1',[a.id,ids.engineer]);assert.equal((await complete(a.id)).visit_responsible_id,ids.engineer);
   await owner("update public.team_members set active=true,professional_role='safety_technician',professional_registration='MTE-123',team_id=$2 where user_id=$1",[ids.tech,ids.team]);
  }
  await as(ids.global);const a=await draft(ids.globalTech,ids.global);
  // Use a different operator team so professional-team deactivation does not also revoke the actor.
  await as(ids.superAdmin);await q('update public.assessments set responsible_id=$2 where id=$1',[a.id,ids.superAdmin]);
  await owner('update public.teams set active=false where id=$1',[ids.globalTeam]);
  await as(ids.superAdmin);assert.equal((await q("update public.assessments set title='Inactive professional team' where id=$1 returning status",[a.id]))[0].status,'draft');await denies(()=>complete(a.id),'23514');
  await owner('update public.teams set active=true where id=$1',[ids.globalTeam]);
 });
 await t.test('frozen identity survives directory renaming, credential changes, deactivation, transfer and rectification',async()=>{
  const before=technicianReport.final_snapshot;
  await owner("update public.team_members set display_name='Changed live name',professional_registration='NEW-REG',active=false,team_id=$2 where user_id=$1",[ids.tech,ids.other]);
  await as();const report=await getReport(technicianReport.id);assert.deepEqual(report.assessment.final_snapshot,before);assert.equal(report.assessment.team_members.display_name,'Synthetic tech');
  await owner("update public.team_members set role='admin' where user_id=$1",[ids.global]);await as(ids.global);
  for(const changes of [{responsible_professional:{display_name:'Forged'}},{responsible_id:ids.global},{visit_responsible_id:ids.global},{answers:{responsible_professional:{registration_number:'Forged'}}}]) await denies(()=>rectify(technicianReport.id,changes),'22023');
  const corrected=await rectify(technicianReport.id,{title:'Corrected title'});assert.deepEqual(corrected.assessment.final_snapshot.responsible_professional,before.responsible_professional);
  assert.equal(corrected.assessment.team_members.display_name,'Synthetic tech');assert.deepEqual((await getReport(technicianReport.id,true)).assessment.final_snapshot,before);
  await owner("update public.team_members set role='editor' where user_id=$1",[ids.global]);
  const persisted=(await owner('select final_snapshot from public.assessments where id=$1',[technicianReport.id]))[0].final_snapshot;assert.deepEqual(persisted,before);
  await owner("update public.team_members set display_name='Synthetic tech',professional_registration='MTE-123',active=true,team_id=$2 where user_id=$1",[ids.tech,ids.team]);
 });
 await t.test('legacy reports retain name fallback but never invent registration from current directory',async()=>{
  await as();const legacy=await getReport(ids.legacy);assert.equal(legacy.assessment.team_members.display_name,'Synthetic assistant');assert.equal('responsible_professional' in legacy.assessment.final_snapshot,false);
  await owner("update public.team_members set professional_role='safety_engineer',professional_registration='LATER-REG',professional_registration_uf='SP' where user_id=$1",[ids.assistant]);
  await as();assert.equal('responsible_professional' in (await getReport(ids.legacy)).assessment.final_snapshot,false);
  await owner("update public.team_members set professional_role='safety_assistant',professional_registration=null,professional_registration_uf=null where user_id=$1",[ids.assistant]);
 });
 await t.test('SQL constraints independently reject invalid credentials while incomplete profiles remain representable',async()=>{
  for(const fields of ["professional_role='admin'","professional_registration=' '","professional_registration=repeat('x',81)","professional_registration=E'x\\ny'","professional_registration_uf='XX'","professional_registration_uf='sp'"]) await denies(()=>owner(`update public.team_members set ${fields} where user_id=$1`,[ids.unknown]),'23514');
  await owner("update public.team_members set professional_role='safety_engineer',professional_registration=null,professional_registration_uf=null where user_id=$1",[ids.unknown]);
 });
 await t.test('manage_gro_admin preserves omitted fields, clears explicit keys and never changes identity permissions',async()=>{
  const data={user_id:ids.engineer,display_name:'Synthetic engineer',username:'engineer',role:'editor',active:true,team_id:ids.team};
  const manage=async(fields,actor=ids.admin)=>(await q('select public.manage_gro_admin($1,\'update_user\',$2::jsonb) as member',[actor,JSON.stringify({...data,...fields})]))[0].member;
  await as(ids.admin,'service_role');let member=await manage({});assert.equal(member.professional_role,'safety_engineer');assert.equal(member.professional_registration,'CREA-456');assert.equal(member.professional_registration_uf,'SP');
  member=await manage({professional_registration:'  NEW-123  ',professional_registration_uf:' rj ',is_super_admin:true});assert.equal(member.professional_registration,'NEW-123');assert.equal(member.professional_registration_uf,'RJ');assert.equal(member.role,'editor');assert.equal(member.is_super_admin,false);
  member=await manage({professional_registration:null});assert.equal(member.professional_registration,null);assert.equal(member.professional_role,'safety_engineer');
  member=await manage({professional_role:'',professional_registration_uf:null});assert.equal(member.professional_role,null);assert.equal(member.professional_registration_uf,null);
  for(const value of [4,{},true]) await denies(()=>manage({professional_registration:value}),'22023');
  await denies(()=>manage({professional_role:'admin'}),'23514');await denies(()=>manage({professional_registration_uf:'XX'}),'23514');
  await denies(()=>manage({},ids.assistant),'42501');await denies(()=>manage({team_id:ids.other}),'42501');
  await as(ids.admin);await denies(()=>manage({professional_role:'safety_engineer'}),'42501');
  const newId='30000000-0000-4000-8000-000000000099';await owner('insert into auth.users(id) values($1)',[newId]);
  await as(ids.admin,'service_role');const created=(await q('select public.manage_gro_admin($1,\'create_user\',$2::jsonb) as member',[ids.admin,JSON.stringify({user_id:newId,display_name:'Synthetic new user',username:'synthetic.new',role:'editor',team_id:ids.team})]))[0].member;
  assert.equal(created.professional_role,null);assert.equal(created.professional_registration,null);assert.equal(created.professional_registration_uf,null);assert.equal(created.role,'editor');
 });
 await t.test('existing team/ownership isolation survives; actor revocation cannot be bypassed using the helper',async()=>{
  await as(ids.outsider);assert.deepEqual(await q('select id from public.assessments where client_id=$1',[ids.client]),[]);
  await denies(()=>draft(ids.outsider,ids.outsider,ids.client),'42501');
  await as(ids.assistant);await denies(()=>q('select private.assessment_professional_snapshot($1,$2,null,$3,true)',[ids.client,ids.admin,ids.tech]),'42501');
  await owner('update public.team_members set active=false where user_id=$1',[ids.assistant]);await as();
  await denies(()=>q('select private.assessment_professional_snapshot($1,$2,null,$3,true)',[ids.client,ids.assistant,ids.tech]),'42501');
  await owner('update public.team_members set active=true where user_id=$1',[ids.assistant]);
  await as(ids.tech);const keys=(await q('select private.current_team_role() as role,private.is_global_admin() as global'))[0];assert.deepEqual(keys,{role:'editor',global:false});
  await owner('update public.teams set active=false where id=$1',[ids.team]);await as(ids.tech);
  await denies(()=>q('select private.assessment_professional_snapshot($1,$2,null,$3,true)',[ids.client,ids.tech,ids.tech]),'42501');
  await owner('update public.teams set active=true where id=$1',[ids.team]);
 });
});
