// Real multi-session LOCAL PostgreSQL. No URLs/credentials/project connections accepted.
// Uses the repository's already-installed pinned devDependencies, not a live Supabase.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {baseline,seedProfessionals,ids,sessionFor,source,migrationPath} from '../../tests/helpers/professional-database.mjs';
const temp=await mkdtemp(join(tmpdir(),'professional-identity-postgres-'));await mkdir(join(temp,'socket'));
const password=randomBytes(24).toString('hex'),port=55994;
let log='';const server=new EmbeddedPostgres({databaseDir:join(temp,'db'),user:'postgres',password,port,persistent:true,createPostgresUser:false,postgresFlags:['-c','listen_addresses=','-c',`unix_socket_directories=${join(temp,'socket')}`],onLog:message=>{log=(log+message).slice(-5000);},onError:console.error});
const connections=[];let started=false;
const capture=promise=>promise.then(result=>({result}),error=>({error}));
async function connect(){const c=new pg.Client({host:join(temp,'socket'),port,user:'postgres',password,database:'postgres'});await c.connect();connections.push(c);await c.query("set statement_timeout='10s'");return c;}
async function authenticate(c,id=ids.assistant){await c.query('reset role;set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id,session_id:sessionFor(id),role:'authenticated'})]);}
async function blocked(monitor,pid,blocker){for(let i=0;i<150;i++){const {rows}=await monitor.query('select wait_event_type,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1',[pid]);if(rows[0]?.wait_event_type==='Lock'&&rows[0].blockers.includes(blocker))return;await new Promise(r=>setTimeout(r,20));}throw Error('Expected lock wait was not observed.');}
async function draft(c,professional=ids.tech,operator=ids.assistant){return (await c.query("insert into public.assessments(client_id,title,responsible_id,created_by,visit_responsible_id,answers) values($1,'Synthetic concurrency draft',$2,auth.uid(),$3,'{\"visitDate\":\"2026-01-15\"}') returning id",[ids.client,operator,professional])).rows[0].id;}
const complete=(c,id)=>c.query("update public.assessments set status='completed' where id=$1 returning final_snapshot",[id]);
try{
 await server.initialise();try{await server.start();started=true;}catch(error){throw new Error('Local PostgreSQL did not start. No concurrency checks ran. '+log,{cause:error});}
 const owner=await connect(),a=await connect(),b=await connect();
 console.log((await owner.query('select version()')).rows[0].version);
 const q=async(sql,values)=>(await owner.query(sql,values)).rows;
 await baseline(sql=>owner.query(sql),q);await owner.query(await source(migrationPath));await seedProfessionals(q);
 await authenticate(a);const pa=(await a.query('select pg_backend_pid() pid')).rows[0].pid,pb=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
 // If conclusion holds the professional lock first, subsequent edits cannot rewrite its snapshot.
 const first=await draft(a);await a.query('begin');await complete(a,first);await b.query('begin');
 const edit=capture(b.query("update public.team_members set display_name='Concurrent new name',professional_registration='NEW' where user_id=$1",[ids.tech]));
 await blocked(owner,pb,pa);await a.query('commit');assert.ifError((await edit).error);await b.query('commit');
 const frozen=(await owner.query('select final_snapshot from public.assessments where id=$1',[first])).rows[0].final_snapshot.responsible_professional;
 assert.equal(frozen.display_name,'Synthetic tech');assert.equal(frozen.registration_number,'MTE-123');
 console.log('PASS: concurrent profile update waited for conclusion; snapshot retained the exact locked name and registration.');
 await owner.query("update public.team_members set display_name='Synthetic tech',professional_registration='MTE-123' where user_id=$1",[ids.tech]);
 async function revokeBefore({label,professional=ids.tech,operator=ids.assistant,actor=operator,change,params=[],restore,restoreParams=params,code='23514'}){
  await authenticate(a,actor);const id=await draft(a,professional,operator);
  await b.query('begin');await b.query(change,params);const result=capture(complete(a,id));
  await blocked(owner,pa,pb);await b.query('commit');assert.equal((await result).error?.code,code,label);
  assert.equal((await owner.query('select status from public.assessments where id=$1',[id])).rows[0].status,'draft');
  await owner.query(restore,restoreParams);console.log('PASS: '+label+' was rechecked after lock wait; conclusion rejected without changing the draft.');
 }
 await revokeBefore({label:'Professional deactivation',change:'update public.team_members set active=false where user_id=$1',params:[ids.tech],restore:'update public.team_members set active=true where user_id=$1'});
 await revokeBefore({label:'Professional changed to auxiliary',change:"update public.team_members set professional_role='safety_assistant' where user_id=$1",params:[ids.tech],restore:"update public.team_members set professional_role='safety_technician' where user_id=$1"});
 await revokeBefore({label:'Professional registration removal',change:'update public.team_members set professional_registration=null where user_id=$1',params:[ids.tech],restore:"update public.team_members set professional_registration='MTE-123' where user_id=$1"});
 await revokeBefore({label:'Engineer UF removal',professional:ids.engineer,change:'update public.team_members set professional_registration_uf=null where user_id=$1',params:[ids.engineer],restore:"update public.team_members set professional_registration_uf='SP' where user_id=$1"});
 await revokeBefore({label:'Professional transfer to unrelated team',change:'update public.team_members set team_id=$2 where user_id=$1',params:[ids.tech,ids.other],restore:'update public.team_members set team_id=$2 where user_id=$1',restoreParams:[ids.tech,ids.team]});
 await revokeBefore({label:'Professional-team deactivation',professional:ids.globalTech,operator:ids.superAdmin,change:'update public.teams set active=false where id=$1',params:[ids.globalTeam],restore:'update public.teams set active=true where id=$1'});
 await revokeBefore({label:'Actor deactivation',change:'update public.team_members set active=false where user_id=$1',params:[ids.assistant],restore:'update public.team_members set active=true where user_id=$1',code:'42501'});
 await revokeBefore({label:'Administrator permission revoked on another operator’s draft',actor:ids.admin,change:"update public.team_members set role='editor' where user_id=$1",params:[ids.admin],restore:"update public.team_members set role='admin' where user_id=$1",code:'42501'});
 await revokeBefore({label:'Client transfer revoking actor scope',change:'update public.clients set team_id=$2 where id=$1',params:[ids.client,ids.other],restore:'update public.clients set team_id=$2 where id=$1',restoreParams:[ids.client,ids.team],code:'42501'});
 await revokeBefore({label:'Global access revocation',operator:ids.global,change:'update public.teams set grants_global_access=false where id=$1',params:[ids.globalTeam],restore:'update public.teams set grants_global_access=true where id=$1',code:'42501'});
 console.log('PASS: all professional-identity concurrency checks used synthetic local records only.');
}finally{
 for(const c of connections)await c.end().catch(()=>{});
 if(started)await server.stop();await rm(temp,{recursive:true,force:true});
}
