import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('../',import.meta.url),TEAM='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d',OTHER='20000000-0000-4000-8000-000000000001';
const A='30000000-0000-4000-8000-000000000001',B='30000000-0000-4000-8000-000000000002';
const C='40000000-0000-4000-8000-000000000001',D='50000000-0000-4000-8000-000000000001',F='50000000-0000-4000-8000-000000000002';
const session=id=>id.replace(/^30000000/,'70000000');
test('draft deletion migration restricts only DELETE, validates actual Team 1 and protects completed reports',async t=>{
 const db=new PGlite();t.after(()=>db.close());const q=async(sql,p=[])=> (await db.query(sql,p)).rows;
 const owner=async sql=>{await db.exec('reset role');return db.exec(sql)};
 const as=async(id=A,role='authenticated')=>{await db.exec(`reset role;set role ${role}`);await q("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id,session_id:session(id),role,user_metadata:{team_id:TEAM}})]);};
 const del=async(rev=4,id=D)=>q('delete from public.assessments where id=$1 and revision=$2 returning id',[id,rev]);
 await db.exec(await readFile(new URL('supabase/tests/rectification-fixture.sql',root),'utf8'));
 await db.exec(await readFile(new URL('supabase/migrations/20261020001758_report_rectification.sql',root),'utf8'));
 await db.exec(`grant delete on public.assessments to authenticated;create policy assessments_delete_draft on public.assessments for delete to authenticated using(status='draft');create policy assessments_delete_completed_admin on public.assessments for delete to authenticated using(status='completed');`);
 const policies=await q("select policyname,roles,cmd,qual,with_check from pg_policies where tablename='assessments' and cmd<>'DELETE' order by policyname");
 const acl=await q("select relacl::text from pg_class where oid='public.assessments'::regclass");
 await db.exec(await readFile(new URL('supabase/migrations/20261021182230_restrict_draft_deletion_to_team_one.sql',root),'utf8'));
 assert.deepEqual(await q("select policyname,roles,cmd,qual,with_check from pg_policies where tablename='assessments' and cmd<>'DELETE' order by policyname"),policies);assert.deepEqual(await q("select relacl::text from pg_class where oid='public.assessments'::regclass"),acl);
 await q('insert into public.teams(id,name,grants_global_access) values($1,\'Team1\',true),($2,\'Other\',false)',[TEAM,OTHER]);
 for(const [id,team,role,superAdmin] of [[A,TEAM,'editor',false],[B,OTHER,'admin',true]]){await q('insert into auth.users(id) values($1)',[id]);await q('insert into auth.sessions(id,user_id) values($1,$2)',[session(id),id]);await q('insert into public.team_members(user_id,team_id,display_name,role,is_super_admin) values($1,$2,\'Test\',$3,$4)',[id,team,role,superAdmin]);}
 await q('insert into public.clients(id,team_id) values($1,$2)',[C,OTHER]);
 await q("insert into public.assessments(id,client_id,responsible_id,status,revision,answers) values($1,$3,$4,'draft',4,'{}'),($2,$3,$4,'completed',4,'{}')",[D,F,C,B]);
 await t.test('other team admin, global admin and responsible owner cannot delete',async()=>{await as(B);assert.equal((await del()).length,0);});
 await t.test('Team1 active editor allowed but stale revision and completed stay intact',async()=>{await as();assert.equal((await q('select private.draft_deletion_allowed() allowed'))[0].allowed,true);assert.equal((await del(3)).length,0);assert.equal((await del(4,F)).length,0);});
 await t.test('inactive team/member, banned user, revoked session and changed team denied',async()=>{
  for(const [off,on] of [[`update public.teams set active=false where id='${TEAM}'`,`update public.teams set active=true where id='${TEAM}'`],[`update public.team_members set active=false where user_id='${A}'`,`update public.team_members set active=true where user_id='${A}'`],[`update auth.users set banned_until=now()+interval '1 day' where id='${A}'`,`update auth.users set banned_until=null where id='${A}'`],[`update auth.sessions set not_after=now()-interval '1 day' where user_id='${A}'`,`update auth.sessions set not_after=null where user_id='${A}'`],[`update public.team_members set team_id='${OTHER}' where user_id='${A}'`,`update public.team_members set team_id='${TEAM}' where user_id='${A}'`]]){await owner(off);await as();assert.equal((await del()).length,0);await owner(on);}
 });
 await t.test('restrictive guard resists another permissive policy',async()=>{await owner('create policy future_delete on public.assessments for delete to authenticated using(true)');await as(B);assert.equal((await del()).length,0);await as();assert.equal((await del(4,F)).length,0);});
 await t.test('anon cannot invoke eligibility helper or delete',async()=>{await as(A,'anon');await assert.rejects(()=>q('select private.draft_deletion_allowed()'),e=>e.code==='42501');await assert.rejects(()=>del(),e=>e.code==='42501');});
 await t.test('exact eligible draft deletion only; later saved-draft update returns no row',async()=>{await as();assert.deepEqual(await del(),[{id:D}]);assert.equal((await q("update public.assessments set answers='{}' where id=$1 and revision=4 and status='draft' returning id",[D])).length,0);assert.equal((await q('select id from public.assessments')).length,1);assert.equal((await q('select id from public.clients')).length,1);});
});
