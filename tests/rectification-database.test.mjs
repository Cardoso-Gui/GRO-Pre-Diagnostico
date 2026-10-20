import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Real embedded PostgreSQL, exclusively synthetic rows. No network/database URL is accepted.
const ADMIN_TEAM='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d';
const TEAM='20000000-0000-4000-8000-000000000001',OTHER='20000000-0000-4000-8000-000000000002';
const ADMIN='30000000-0000-4000-8000-000000000001',EDITOR='30000000-0000-4000-8000-000000000002',GLOBAL='30000000-0000-4000-8000-000000000003',READER='30000000-0000-4000-8000-000000000004',OUTSIDER='30000000-0000-4000-8000-000000000005';
const CLIENT='40000000-0000-4000-8000-000000000001',ASSESSMENT='50000000-0000-4000-8000-000000000001',DRAFT='50000000-0000-4000-8000-000000000002';
const sessionFor=id=>id?.replace(/^30000000/,'70000000');
const request=n=>`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const answers={cnpj:'00000000000000',visitDate:'2026-01-15',employees:'5',currentCompany:{cnpj:'00000000000000',razao_social:'Synthetic Company',cnae_fiscal_descricao:'Old CNAE',descricao_tipo_de_logradouro:'Old prefix',legacy_extra:'preserve'},dimensionOptions:{preponderantRisk:'',health:false},selectedSectors:['Office'],jobsBySector:[['Office',[{name:'Clerk',quantity:5,activities:'Synthetic work',foodHandling:false,legacy_extra:'preserve'}]]],selectedRiskMode:'job',gheList:[],selectedRisksByTarget:[['job__office__clerk',['ERG.001']]],riskSourcesBySelection:[['source__job__office__clerk__erg.001',{source:'Desk',frequency:'Diária',duration:'8h',damage:'Fatigue',measures:'Breaks',controls:[false,true,false],improve:'Review desk',measure:'Não'}]],epiBySelection:[['epi-data__job__office__clerk__erg.001',{applicable:'Não',items:[]}]],report_document:{version:1,children:[{text:'Original frozen document'}]},legacy_answer:'preserve'};
const snapshot={client:{id:CLIENT,team_id:TEAM,created_at:'2026-01-01T00:00:00Z',legal_name:'Synthetic Company',trade_name:null,cnpj:'00000000000000',cnae:'0000000',address:{street:'Old street',number:'1',complement:'',district:'Test',city:'Test',state:'SP',postal_code:'00000000',legacy_address:'preserve'},contact_name:'Synthetic Contact',contact_phone:'00000000000',contact_email:null,legacy_client:'preserve'},answers,schema_version:1,title:'Synthetic assessment',responsible_id:READER,completed_at:'2026-01-15T14:00:00Z',legacy_snapshot:'preserve'};
const root=new URL('../',import.meta.url);
let db;
async function q(sql,values=[]){return (await db.query(sql,values)).rows;}
async function asUser(id=ADMIN,role='authenticated') {await db.exec(`reset role;set role ${role};`);await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sessionFor(id),role})]);}
async function owner(sql,values=[]){await db.exec('reset role');return q(sql,values);}
async function read(id=ASSESSMENT,original=false){return (await q('select public.read_assessment_report($1,$2) as state',[id,original]))[0].state;}
async function save(changes,{sequence=0,id=1,reason='Synthetic correction reason',assessment=ASSESSMENT}={}){return (await q('select public.rectify_assessment($1,$2,$3,$4,$5::jsonb) as state',[assessment,sequence,request(id),reason,JSON.stringify(changes)]))[0].state;}
async function denies(fn,code){await assert.rejects(fn,e=>{assert.equal(e.code,code,e.message);return true;});}

test('append-only rectification SQL authorization, isolation, validation, history and rollback',async t=>{
 db=new PGlite(); t.after(()=>db.close());
 await db.exec(await readFile(new URL('supabase/tests/rectification-fixture.sql',root),'utf8'));
 const permissionsBefore=await q("select c.oid::regclass::text as name,c.relacl::text as acl from pg_class c where c.relnamespace in ('public'::regnamespace,'auth'::regnamespace) and c.relkind='r' order by 1");
 const existingPoliciesBefore=await q("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname");
 const migration=await readFile(new URL('supabase/migrations/20261020001758_report_rectification.sql',root),'utf8');
 const embedded=JSON.parse(migration.match(/patch_schema jsonb:='(.*)'::jsonb;/)[1]);assert.deepEqual(embedded,JSON.parse(await readFile(new URL('supabase/rectification-patch-schema.json',root),'utf8')));
 await db.exec(migration);
 assert.deepEqual(await q("select c.oid::regclass::text as name,c.relacl::text as acl from pg_class c where c.relnamespace in ('public'::regnamespace,'auth'::regnamespace) and c.relkind='r' order by 1"),permissionsBefore);
 assert.deepEqual(await q("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname"),existingPoliciesBefore);
 await q('insert into public.teams(id,name,grants_global_access) values ($1,\'Administrators fixture\',true),($2,\'Team fixture\',false),($3,\'Other fixture\',false)',[ADMIN_TEAM,TEAM,OTHER]);
 for(const [id,team,role,superAdmin] of [[ADMIN,ADMIN_TEAM,'admin',false],[EDITOR,ADMIN_TEAM,'editor',false],[GLOBAL,OTHER,'admin',true],[READER,TEAM,'editor',false],[OUTSIDER,OTHER,'editor',false]]){
  await q('insert into auth.users(id) values($1)',[id]);await q('insert into auth.sessions(id,user_id) values($1,$2)',[sessionFor(id),id]);
  await q('insert into public.team_members(user_id,team_id,display_name,role,is_super_admin) values($1,$2,$3,$4,$5)',[id,team,'Synthetic '+id.slice(-1),role,superAdmin]);
 }
 await q('insert into public.clients(id,team_id,legal_name,cnpj) values($1,$2,\'Synthetic Company\',\'00000000000000\')',[CLIENT,TEAM]);
 await q("insert into public.assessments(id,client_id,title,responsible_id,status,revision,report_revision,created_at,updated_at,created_by,completed_at,completed_by,schema_version,answers,final_snapshot) values($1,$2,'Synthetic assessment',$3,'completed',17,4,'2026-01-01','2026-01-15',$3,'2026-01-15T14:00:00Z',$3,1,$4::jsonb,$5::jsonb)",[ASSESSMENT,CLIENT,READER,JSON.stringify(answers),JSON.stringify(snapshot)]);
 await q("insert into public.assessments(id,client_id,title,responsible_id,status,revision) values($1,$2,'Synthetic draft',$3,'draft',2)",[DRAFT,CLIENT,READER]);
 const original=(await q('select to_jsonb(a) as data from public.assessments a where id=$1',[ASSESSMENT]))[0].data;
 const oldGuard=(await q("select pg_get_functiondef('private.guard_assessment()'::regprocedure) as definition"))[0].definition;
 await t.test('exact designated team AND actual admin role, not generic global access',async()=>{
  await asUser(ADMIN);assert.equal((await read()).can_rectify,true);
  await asUser(EDITOR);await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:EDITOR,session_id:sessionFor(EDITOR),role:'authenticated',user_metadata:{role:'admin',team_id:ADMIN_TEAM}})]);await denies(()=>q('select private.append_assessment_rectification($1,0,$2,\'Forged helper\',\'{"title":"Forged"}\')',[ASSESSMENT,request(99)]),'42501');assert.equal((await read()).can_rectify,false);await denies(()=>save({title:'Forged editor'}),'42501');
  await asUser(GLOBAL);assert.equal((await read()).can_rectify,false);await denies(()=>save({title:'Global outsider'}),'42501');await denies(()=>q('select private.append_assessment_rectification($1,0,$2,\'Direct global helper\',\'{"title":"Forbidden"}\')',[ASSESSMENT,request(99)]),'42501');
  await asUser(READER);assert.equal((await read()).can_rectify,false);await denies(()=>save({title:'Regular reader'}),'42501');
  await asUser(OUTSIDER);await denies(()=>read(),'42501');await denies(()=>save({title:'Outsider'}),'42501');
  assert.equal((await q('select count(*)::int as n from private.assessment_rectifications'))[0].n,0);
 });
 await t.test('anonymous, absent, disabled, banned and deleted identities fail closed',async()=>{
  await asUser(null);await denies(()=>read(),'42501');
  await asUser(ADMIN,'anon');await denies(()=>read(),'42501');await denies(()=>save({title:'Anon'}),'42501');
  for(const [sql,undo] of [
   ['update auth.users set is_anonymous=true where id=$1','update auth.users set is_anonymous=false where id=$1'],
   ["update auth.users set banned_until=now()+interval '1 day' where id=$1",'update auth.users set banned_until=null where id=$1'],
   ['update auth.users set deleted_at=now() where id=$1','update auth.users set deleted_at=null where id=$1'],
   ['update public.team_members set active=false where user_id=$1','update public.team_members set active=true where user_id=$1'],
  ]){await owner(sql,[ADMIN]);await asUser();await denies(()=>save({title:'Disabled'}),'42501');assert.equal((await q('select public.can_rectify_assessment($1) as ok',[ASSESSMENT]))[0].ok,false);await owner(undo,[ADMIN]);}
  await owner('update public.teams set active=false where id=$1',[ADMIN_TEAM]);await asUser();await denies(()=>save({title:'Inactive team'}),'42501');await owner('update public.teams set active=true where id=$1',[ADMIN_TEAM]);
  await asUser();await denies(()=>save({title:'Draft not allowed'},{assessment:DRAFT}),'42501');
 });
 await t.test('revoked, expired, missing, malformed and mismatched sessions cannot use a stale JWT',async()=>{
  await owner('delete from auth.sessions where id=$1',[sessionFor(ADMIN)]);await asUser();await denies(()=>read(),'42501');await denies(()=>save({title:'Signed-out token'}),'42501');
  await owner('insert into auth.sessions(id,user_id,not_after) values($1,$2,now()-interval \'1 second\')',[sessionFor(ADMIN),ADMIN]);await asUser();await denies(()=>save({title:'Expired session'}),'42501');
  await owner('update auth.sessions set not_after=null,user_id=$2 where id=$1',[sessionFor(ADMIN),READER]);await asUser();await denies(()=>save({title:'Wrong session owner'}),'42501');
  await owner('update auth.sessions set user_id=$2 where id=$1',[sessionFor(ADMIN),ADMIN]);await asUser();
  for(const session_id of [undefined,'invalid-session-id']){await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ADMIN,role:'authenticated',session_id})]);await denies(()=>save({title:'Bad session claim'}),'42501');}
  await asUser();assert.equal((await read()).can_rectify,true);
  await denies(()=>q('select * from auth.sessions'),'42501');
 });
 await t.test('strict allowlists reject row metadata, forged documents and nested authority',async()=>{
  await asUser();
  for(const changes of [{revision:19},{report_revision:8},{completed_at:'2027-01-01'},{responsible_id:ADMIN},{client_id:CLIENT},{actor_id:ADMIN},{team_id:ADMIN_TEAM},{final_snapshot:{}},{client:{team_id:ADMIN_TEAM}},{client:{id:CLIENT}},{client:{address:{created_by:ADMIN}}},{answers:{report_document:{version:1,children:[]}}},{answers:{cnpj:'11111111111111'}},{answers:{currentCompany:{role:'admin'}}},{answers:{jobsBySector:[['Office',[{name:'Clerk',quantity:5,activities:'work',actor_id:ADMIN}]]]}}])await denies(()=>save(changes),'22023');
  for(const changes of [{answers:{employees:{}}},{answers:{selectedSectors:[17]}},{answers:{dimensionOptions:{health:'true'}}},{answers:{jobsBySector:[['Only one tuple field']]}},{answers:{visitDate:'2026-02-30'}},{title:''},{answers:{employees:'x'}},{answers:{employees:'0'}},{answers:{employees:'1.5'}},{answers:{employees:-1}},{client:{legal_name:null}},{client:{legal_name:'  '}}])await denies(()=>save(changes),'22023');
  await denies(()=>save({title:'Anything'},{reason:'  '}),'22023');await denies(()=>save({title:'Anything'},{reason:'\t\n\r'}),'22023');await denies(()=>save({title:'\t\n\r'}),'22023');await denies(()=>save({}),'22023');await denies(()=>save({title:original.title}),'22023');await denies(()=>save({client:{cnae:'0000000',address:{street:'Old street'}}}),'22023');
 });
 await t.test('valid business correction changes effective content but zero original columns',async()=>{
  const state=await save({answers:{visitDate:'2026-01-16',employees:'6'},client:{legal_name:'Corrected synthetic name',cnae:'1234567',address:{street:'Corrected street'}},title:'Corrected title'});
  assert.equal(state.sequence,1);assert.deepEqual(state.original_report_document,answers.report_document);assert.equal(state.assessment.report_revision,4);assert.equal(state.assessment.revision,17);
  assert.equal(state.assessment.completed_at,original.completed_at);assert.equal(state.assessment.final_snapshot.responsible_id,READER);
  assert.equal(state.assessment.final_snapshot.answers.visitDate,'2026-01-16');assert.equal(state.assessment.final_snapshot.answers.currentCompany.razao_social,'Corrected synthetic name');
  assert.equal(state.assessment.final_snapshot.answers.currentCompany.cnae_fiscal_descricao,'');assert.equal(state.assessment.final_snapshot.answers.currentCompany.descricao_tipo_de_logradouro,'');
  assert.equal(state.assessment.final_snapshot.answers.currentCompany.legacy_extra,'preserve');assert.equal(state.assessment.final_snapshot.client.address.legacy_address,'preserve');assert.equal(state.assessment.final_snapshot.legacy_snapshot,'preserve');assert.equal(state.assessment.final_snapshot.answers.legacy_answer,'preserve');
  assert.equal(Object.hasOwn(state.assessment.final_snapshot.answers,'report_document'),false);assert.equal(state.history[0].actor_id,ADMIN);assert.equal(state.history[0].actor_name,'Synthetic 1');
  assert.match(state.history[0].created_at,/^\d{4}-/);assert.equal(state.history[0].reason,'Synthetic correction reason');
  assert.ok(state.history[0].changes.some(c=>c.path==='/answers/visitDate'&&c.before==='2026-01-15'&&c.after==='2026-01-16'));
  assert.deepEqual((await read(ASSESSMENT,true)).assessment.final_snapshot,snapshot);
  assert.deepEqual((await owner('select to_jsonb(a) as data from public.assessments a where id=$1',[ASSESSMENT]))[0].data,original);
  assert.equal((await q("select pg_get_functiondef('private.guard_assessment()'::regprocedure) as definition"))[0].definition,oldGuard);
 });
 await t.test('current original RLS controls effective content and direct history reads',async()=>{
  await asUser(READER);assert.equal((await read()).sequence,1);assert.equal((await q('select count(*)::int n from private.assessment_rectifications'))[0].n,1);
  await asUser(OUTSIDER);await denies(()=>read(),'42501');assert.equal((await q('select count(*)::int n from private.assessment_rectifications'))[0].n,0);
  await owner('update public.clients set team_id=$1 where id=$2',[OTHER,CLIENT]);await asUser(READER);await denies(()=>read(),'42501');await asUser(OUTSIDER);assert.equal((await read()).sequence,1);
  await owner('update public.clients set team_id=$1 where id=$2',[TEAM,CLIENT]);
 });
 await t.test('retries are idempotent and stale expected sequence cannot overwrite',async()=>{
  await asUser();
  const patch={answers:{visitDate:'2026-01-16',employees:'6'},client:{legal_name:'Corrected synthetic name',cnae:'1234567',address:{street:'Corrected street'}},title:'Corrected title'};
  assert.equal((await save(patch)).sequence,1);
  await denies(()=>save({title:'Different reuse'}),'22023');await denies(()=>save({title:'Stale edit'},{id:2}),'40001');
  const second=await save({answers:{employees:'7'}},{sequence:1,id:2});assert.equal(second.sequence,2);assert.equal(second.history.length,2);
  assert.equal((await save(patch)).sequence,2);assert.equal((await q('select count(*)::int n from private.assessment_rectifications'))[0].n,2);
 });
 await t.test('invalid relationships cannot silently erase risks from rendered output',async()=>{
  await asUser();
  for(const changes of [
   {answers:{selectedSectors:['Different sector']}},
   {answers:{jobsBySector:[['Office',[{name:'Renamed',quantity:5,activities:'work'}]]]}},
   {answers:{selectedRiskMode:'ghe',gheList:[{}]}},
   {answers:{selectedRiskMode:'ghe',gheList:[{id:'ghe__test',name:'Test'}]}},
   {answers:{jobsBySector:[['Office',[{...answers.jobsBySector[0][1][0],workstations:[{name:'Desk',photoPaths:['evil']}]}]]]}},
   {answers:{jobsBySector:[['Office',[{...answers.jobsBySector[0][1][0],workstations:[{name:'Desk',photoPaths:[`${CLIENT}/${ADMIN}/${request(99)}.jpg`]}]}]]]}},
   {answers:{selectedRiskMode:'ghe',gheList:[{id:'ghe__new',name:'New',linkedJobs:[{sectorName:'Missing',jobName:'Missing'}]}]}},
   {answers:{selectedRisksByTarget:[['job__office__clerk',['NOT.A.RISK']]]}},
   {answers:{riskSourcesBySelection:[['source__missing__erg.001',{source:'Unknown target'}]]}},
  ])await denies(()=>save(changes,{sequence:2,id:3}),'22023');
  const state=await save({answers:{riskSourcesBySelection:[['source__job__office__clerk__erg.001',{...answers.riskSourcesBySelection[0][1],improve:'Corrected recommendation',damage:'Corrected damage',damageSelections:[],damageOther:'Corrected damage',damageOtherEnabled:true}]]}},{sequence:2,id:3});
  assert.equal(state.sequence,3);assert.equal(state.assessment.final_snapshot.answers.riskSourcesBySelection[0][1].improve,'Corrected recommendation');
 });
 await t.test('bounded list metadata uses effective titles and original RLS only',async()=>{
  await asUser(ADMIN);const summary=(await q('select public.read_assessment_report_summaries($1::uuid[]) as data',[[ASSESSMENT,DRAFT]]))[0].data;
  assert.deepEqual(summary,[{id:ASSESSMENT,title:'Corrected title',sequence:3,can_rectify:true}]);
  await asUser(OUTSIDER);assert.deepEqual((await q('select public.read_assessment_report_summaries($1::uuid[]) as data',[[ASSESSMENT]]))[0].data,[]);
  await denies(()=>q('select public.read_assessment_report_summaries($1::uuid[])',[Array(1001).fill(ASSESSMENT)]),'22023');
 });
 await t.test('legacy business extras survive sibling removal and cannot be silently removed',async()=>{
  await owner('select 1');
  const schema=JSON.parse(await readFile(new URL('supabase/rectification-patch-schema.json',root),'utf8')).properties.answers.properties.jobsBySector;
  const old=[['Office',[{name:'Removed',quantity:1,activities:'A',legacy_extra:'first'},{name:'Kept',quantity:2,activities:'B',legacy_extra:'second'}]]];
  const kept=[['Office',[old[0][1][1]]]];
  await q('select private.validate_rectification_value($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(kept),JSON.stringify(old),JSON.stringify(schema)]);
  const legacyOld=[['Office',[{name:'Old no activities',quantity:1},{name:'Changed',quantity:2,activities:'Work'}]]];
  const legacyNew=structuredClone(legacyOld);legacyNew[0][1][1].quantity=3;
  await q('select private.validate_rectification_value($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(legacyNew),JSON.stringify(legacyOld),JSON.stringify(schema)]);
  const missing=[['Office',[{name:'Kept',quantity:2,activities:'B'}]]];
  await denies(()=>q('select private.validate_rectification_value($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(missing),JSON.stringify(old),JSON.stringify(schema)]),'22023');
  const forged=[['Office',[{...kept[0][1][0],legacy_extra:'changed'}]]];
  await denies(()=>q('select private.validate_rectification_value($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(forged),JSON.stringify(old),JSON.stringify(schema)]),'22023');
 });
 await t.test('valid existing same-client photo accepted; missing and foreign photos rejected',async()=>{
  const path=`${CLIENT}/${ADMIN}/${request(91)}.jpg`;
  await owner("insert into storage.objects(bucket_id,name) values('workstation-photos',$1)",[path]);
  const withPhoto=structuredClone(answers);withPhoto.jobsBySector[0][1][0].workstations=[{name:'Synthetic desk',photoPaths:[path]}];
  await q('select private.validate_rectification_photos($1::jsonb,$2::jsonb,$3)',[JSON.stringify(withPhoto),JSON.stringify(answers),CLIENT]);
  for(const bad of [`${CLIENT}/${ADMIN}/${request(92)}.jpg`,`40000000-0000-4000-8000-000000000999/${ADMIN}/${request(91)}.jpg`,'https://example.invalid/photo.jpg']){
   withPhoto.jobsBySector[0][1][0].workstations[0].photoPaths=[bad];
   await denies(()=>q('select private.validate_rectification_photos($1::jsonb,$2::jsonb,$3)',[JSON.stringify(withPhoto),JSON.stringify(answers),CLIENT]),'22023');
  }
 });
 await t.test('all direct table writes denied and even privileged audit rewrites fail',async()=>{
  await asUser();
  for(const sql of ["insert into private.assessment_rectifications(assessment_id) values('"+ASSESSMENT+"')",'update private.assessment_rectifications set reason=\'tampered\'','delete from private.assessment_rectifications','truncate private.assessment_rectifications'])await denies(()=>q(sql),'42501');
  await denies(()=>q("update public.assessments set title='forbidden' where id=$1",[ASSESSMENT]),'23514');
  await owner('select 1');
  for(const sql of ['update private.assessment_rectifications set reason=\'tampered\'','delete from private.assessment_rectifications','truncate private.assessment_rectifications'])await denies(()=>q(sql),'23514');
  await denies(()=>q('delete from public.assessments where id=$1',[ASSESSMENT]),'23001');
 });
 await t.test('deactivation preserves history/read, removes capability and stops writes',async()=>{
  await owner('select 1');await db.exec(await readFile(new URL('supabase/disable-report-rectification.sql',root),'utf8'));
  await asUser();const state=await read();assert.equal(state.sequence,3);assert.equal(state.can_rectify,false);assert.equal(state.history.length,3);
  await denies(()=>save({title:'Disabled correction'},{sequence:3,id:4}),'42501');
  await denies(()=>q('select private.append_assessment_rectification($1,3,$2,\'Synthetic reason\',\'{"title":"Disabled"}\')',[ASSESSMENT,request(4)]),'42501');
  assert.deepEqual((await owner('select to_jsonb(a) as data from public.assessments a where id=$1',[ASSESSMENT]))[0].data,original);
 });
});
