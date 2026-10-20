// Optional real multi-session local PostgreSQL test. Never accepts a database URL.
// Install pinned packages in a temporary directory and supply that directory as argv[2].
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
const packageDir=resolve(process.argv[2]||'');
assert.ok(process.argv[2],'Supply the temporary package directory, not a database connection string.');
const require=createRequire(join(packageDir,'package.json'));
const {default:EmbeddedPostgres}=await import(pathToFileURL(require.resolve('embedded-postgres')));
const {Client}=require('pg');
const temp=await mkdtemp(join(tmpdir(),'rectification-postgres-'));await mkdir(join(temp,'socket'));
const password=randomBytes(24).toString('hex'),port=55993;
let startupLog='';
const server=new EmbeddedPostgres({databaseDir:join(temp,'db'),user:'postgres',password,port,persistent:true,createPostgresUser:false,postgresFlags:['-c','listen_addresses=','-c',`unix_socket_directories=${join(temp,'socket')}`],onLog:message=>{startupLog=(startupLog+message).slice(-5000);},onError:console.error});
const connections=[];let started=false;
const root=new URL('../../',import.meta.url);
const team='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d',user='30000000-0000-4000-8000-000000000001',session='70000000-0000-4000-8000-000000000001',clientId='40000000-0000-4000-8000-000000000001',assessment='50000000-0000-4000-8000-000000000001';
const req=n=>`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function connect(){const c=new Client({host:join(temp,'socket'),port,user:'postgres',password,database:'postgres'});await c.connect();connections.push(c);await c.query("set statement_timeout='10s'");return c;}
async function authenticate(c){await c.query('reset role;set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,session_id:session,role:'authenticated'})]);}
const append=(c,sequence,id,title)=>c.query('select public.rectify_assessment($1,$2,$3,$4,$5::jsonb) as state',[assessment,sequence,req(id),'Synthetic concurrency correction',JSON.stringify({title})]);
const capture=promise=>promise.then(result=>({result}),error=>({error}));
async function blocked(monitor,pid,blocker){for(let i=0;i<100;i++){const {rows}=await monitor.query('select wait_event_type,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1',[pid]);if(rows[0]?.wait_event_type==='Lock'&&rows[0].blockers.includes(blocker))return;await new Promise(r=>setTimeout(r,20));}throw Error('Expected lock wait was not observed.');}
async function state(c){return (await c.query('select public.read_assessment_report($1) as state',[assessment])).rows[0].state;}
try{
 await server.initialise();try{await server.start();started=true;}catch(error){throw new Error('Local PostgreSQL could not start. No concurrency assertion ran. '+startupLog,{cause:error});}
 const owner=await connect(),a=await connect(),b=await connect();
 console.log((await owner.query('select version()')).rows[0].version);
 await owner.query(await readFile(new URL('supabase/tests/rectification-fixture.sql',root),'utf8'));
 await owner.query(await readFile(new URL('supabase/migrations/20261019235450_report_rectification.sql',root),'utf8'));
 await owner.query("insert into public.teams(id,name,grants_global_access) values($1,'Synthetic administrators',true)",[team]);
 await owner.query('insert into auth.users(id) values($1)',[user]);await owner.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
 await owner.query("insert into public.team_members(user_id,team_id,display_name,role) values($1,$2,'Synthetic administrator','admin')",[user,team]);
 await owner.query("insert into public.clients(id,team_id,legal_name) values($1,$2,'Synthetic company')",[clientId,team]);
 const snapshot={title:'Original fixture',client:{id:clientId,legal_name:'Synthetic company'},answers:{report_document:{version:1,children:[]}},schema_version:1};
 await owner.query("insert into public.assessments(id,client_id,title,responsible_id,status,revision,report_revision,final_snapshot) values($1,$2,'Original fixture',$3,'completed',9,2,$4::jsonb)",[assessment,clientId,user,JSON.stringify(snapshot)]);
 const before=(await owner.query('select to_jsonb(a) as row from public.assessments a where id=$1',[assessment])).rows[0].row;
 await authenticate(a);await authenticate(b);
 const pa=(await a.query('select pg_backend_pid() pid')).rows[0].pid,pb=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
 await a.query('begin');await append(a,0,1,'Correction one');await b.query('begin');const stale=capture(append(b,0,2,'Stale correction'));
 await blocked(owner,pb,pa);await a.query('commit');const staleResult=await stale;assert.equal(staleResult.error?.code,'40001');await b.query('rollback');assert.equal((await state(a)).sequence,1);
 console.log('PASS: second simultaneous writer waited on original assessment row; after first commit it failed 40001, no overwrite.');
 await a.query('begin');await append(a,1,3,'Idempotent correction');await b.query('begin');const duplicate=capture(append(b,1,3,'Idempotent correction'));
 await blocked(owner,pb,pa);await a.query('commit');const duplicateResult=await duplicate;assert.ifError(duplicateResult.error);assert.equal(duplicateResult.result.rows[0].state.sequence,2);await b.query('commit');assert.equal((await state(a)).history.length,2);
 console.log('PASS: simultaneous identical request waited and returned success with only one new audit row.');
 // A correction already holding the session lock completes before a concurrent sign-out.
 await a.query('begin');await append(a,2,4,'Before session revocation');await b.query('reset role;begin');const signout=capture(b.query('delete from auth.sessions where id=$1',[session]));await blocked(owner,pb,pa);await a.query('commit');assert.ifError((await signout).error);await b.query('commit');
 const signedOut=await capture(append(a,3,5,'Stale signed-out token'));assert.equal(signedOut.error?.code,'42501');
 console.log('PASS: concurrent session revocation waited for the in-flight write, then the stale token was denied.');
 // Revocation that has acquired the membership lock first prevents a waiting write.
 await owner.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);await authenticate(a);await b.query('begin');await b.query('update public.team_members set active=false where user_id=$1',[user]);const waitingWrite=capture(append(a,3,5,'Must not survive revocation'));await blocked(owner,pa,pb);await b.query('commit');const revokedResult=await waitingWrite;assert.equal(revokedResult.error?.code,'42501');
 console.log('PASS: write waiting behind membership revocation rechecked current row and was denied, with no audit append.');
 const after=(await owner.query('select to_jsonb(a) as row from public.assessments a where id=$1',[assessment])).rows[0].row;assert.deepEqual(after,before);
 assert.equal((await owner.query('select count(*)::int count from private.assessment_rectifications')).rows[0].count,3);
 console.log('PASS: all original assessment columns unchanged; exact final history count 3.');
}finally{
 for(const c of connections)await c.end().catch(()=>{});
 if(started)await server.stop();
 await rm(temp,{recursive:true,force:true});
}
