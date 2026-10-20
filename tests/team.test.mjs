import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('team.html'),source=read('team.js');
const TEAM='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d',OTHER='other';
const teamRows=[{id:TEAM,name:'Equipe Aurora',active:true,grants_global_access:true},{id:OTHER,name:'Equipe Horizonte',active:true,grants_global_access:false}];
const person=(n,changes={})=>({user_id:'user-'+n,team_id:OTHER,display_name:'Pessoa '+String(n).padStart(3,'0'),username:'pessoa.'+n,contact_phone:'11900001234',role:'editor',active:true,is_super_admin:false,...changes});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t,{member={...person(1,{team_id:TEAM,role:'admin',is_super_admin:true}),teams:{active:true}},people=[person(1,{team_id:TEAM}),person(2),person(3,{role:'admin',active:false})],teams=teamRows,fail=false,hold=false}={}){
 const dom=new JSDOM(html),document=dom.window.document,calls=[],redirects=[];
 const state={member,people,teams,fail,hold,pending:[],memberError:null};let authChange,resume;
 const authClient={auth:{onAuthStateChange:callback=>authChange=callback,signOut:async()=>({error:null})},from(table){
  const call={table,methods:[]};calls.push(call);const filters=[];let range=[0,Infinity];
  const query={};for(const method of ['select','order','eq','range'])query[method]=(...args)=>{call.methods.push([method,...args]);if(method==='eq')filters.push(args);if(method==='range')range=args;return query;};
  query.then=resolve=>{const complete=()=>{let data=state[table==='teams'?'teams':'people'].filter(row=>filters.every(([key,value])=>row[key]===value));resolve({data:data.slice(range[0],range[1]+1),error:state.fail?Error('offline'):null});};if(state.hold)state.pending.push(complete);else complete();};return query;
 }};
 const context=vm.createContext({document,window:dom.window,location:{replace:url=>redirects.push(url)},getTeamMember:async()=>({member:state.member,error:state.memberError}),authClient,updateHeader:()=>{},watchPageResume:options=>resume=options,console});
 vm.runInContext(source.replace(/^import .*;\n/gm,''),context);await tick();await tick();
 t.after(()=>dom.window.close());
 return {document,calls,state,redirects,context,authChange:event=>authChange(event),resume:()=>resume,async input(id,value,event='change'){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new dom.window.Event(event));await tick();},async click(id){document.getElementById(id).click();await tick();await tick();},async release(){state.hold=false;for(const complete of state.pending.splice(0))complete();await tick();await tick();}};
}

test('team 1 global membership keeps existing all-team query scope and grouped directory',async t=>{
 const f=await fixture(t);
 assert.equal(f.document.querySelector('h1').textContent,'Minha equipe');
 assert.equal(f.document.querySelectorAll('details.directory-group').length,2);
 assert.ok([...f.document.querySelectorAll('details')].every(group=>group.open));
 assert.ok(f.calls.every(call=>!call.methods.some(([method])=>method==='eq')));
 assert.equal(f.document.querySelector('#team-picker').hidden,false);
 assert.match(f.document.querySelector('#directory-summary').textContent,/2 equipes · 3 integrantes/);
 assert.equal(f.document.querySelector('#team-search-hint').hidden,true);
 assert.equal(f.document.querySelector('.team-results').getAttribute('aria-busy'),'false');
});
test('ordinary administrator and collaborator retain own-team queries only',async t=>{
 for(const role of ['admin','editor']){
  const f=await fixture(t,{member:person(2,{role}),people:[person(2),person(3,{team_id:TEAM})]});
  assert.deepEqual(f.calls.map(call=>call.methods.filter(([method])=>method==='eq')),[ [['eq','id',OTHER]], [['eq','team_id',OTHER]] ]);
  assert.equal(f.document.querySelectorAll('.directory-group').length,1);
  assert.equal(f.document.querySelector('details'),null);
  assert.equal(f.document.querySelector('#team-picker').hidden,true);
  assert.equal(f.document.querySelector('#team-name').textContent,'Equipe Horizonte');
  assert.equal(f.document.querySelectorAll('tbody tr').length,1);
 }
});
test('generic superadmin keeps pre-existing access behavior without a new client restriction',async t=>{
 const f=await fixture(t,{member:person(2,{role:'admin',is_super_admin:true})});
 assert.ok(f.calls.every(call=>!call.methods.some(([method])=>method==='eq')));
 assert.equal(f.document.querySelectorAll('.directory-group').length,2);
});
test('queries preserve selected fields, deterministic order and the existing 50-row batch',async t=>{
 const f=await fixture(t);
 assert.deepEqual(f.calls[0].methods,[['select','id,name,active,grants_global_access'],['order','name']]);
 assert.deepEqual(f.calls[1].methods,[['select','user_id,display_name,username,contact_phone,role,active,is_super_admin,team_id'],['order','display_name'],['order','user_id'],['range',0,49]]);
});
test('disabled or absent membership returned by auth guard fails closed before directory queries',async t=>{
 const f=await fixture(t,{member:null});
 assert.equal(f.calls.length,0);assert.equal(f.document.querySelector('#team-page').hidden,true);
 assert.deepEqual(f.redirects,['./index.html?reason=expired']);
});
test('inactive status no longer obscures the role and contact remains visible',async t=>{
 const f=await fixture(t),row=[...f.document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('Pessoa 003'));
 assert.equal(row.querySelector('.directory-role').textContent,'Administrador');
 assert.equal(row.querySelector('.directory-status').textContent,'Inativo');
 assert.match(row.textContent,/\(11\) 90000-1234/);
 assert.ok(f.document.querySelector('.directory-you'));
});
test('team global designation retains the existing displayed role and inactive teams are labeled',async t=>{
 const f=await fixture(t,{teams:[{...teamRows[0],active:false},teamRows[1]],people:[person(1,{team_id:TEAM,role:'admin'}),person(2)]});
 assert.equal(f.document.querySelector('.directory-team-inactive').textContent,'Equipe inativa');
 assert.equal(f.document.querySelector('.directory-role').textContent,'Administrador');
 const g=await fixture(t);assert.equal(g.document.querySelector('.directory-role').textContent,'Administrador geral');
});
test('name, username and team search preserve case-insensitive existing matching',async t=>{
 const f=await fixture(t);
 for(const query of ['pEsSoA 002','pessoa.2','horizonte']){
  await f.input('member-search',query,'input');assert.ok(f.document.querySelectorAll('tbody tr').length>0);
  assert.equal(f.document.querySelector('#team-status').textContent,'');
 }
 await f.input('member-search','impossível','input');assert.equal(f.document.querySelectorAll('tbody tr').length,0);
 assert.match(f.document.querySelector('#team-status').textContent,/Nenhum integrante encontrado/);
});
test('team, function and status filters combine without changing data queries',async t=>{
 const f=await fixture(t);const before=f.calls.length;
 await f.input('team-filter',OTHER);await f.input('role-filter','admin');await f.input('status-filter','inactive');
 assert.equal(f.document.querySelectorAll('tbody tr').length,1);
 assert.match(f.document.querySelector('tbody').textContent,/Pessoa 003/);
 assert.equal(f.calls.length,before);
 await f.input('status-filter','active');assert.equal(f.document.querySelectorAll('tbody tr').length,0);
});
test('paginated counts and search explicitly describe loaded rows, not an unfetched total',async t=>{
 const people=Array.from({length:51},(_,i)=>person(i));const f=await fixture(t,{people});
 assert.match(f.document.querySelector('#directory-summary').textContent,/50 integrantes na lista carregada/);
 assert.equal(f.document.querySelector('#team-search-hint').hidden,false);
 await f.input('member-search','Pessoa 050','input');assert.equal(f.document.querySelectorAll('tbody tr').length,0);
 assert.match(f.document.querySelector('#team-status').textContent,/integrantes carregados/);
 await f.click('more-members');
 assert.equal(f.document.querySelectorAll('tbody tr').length,1);
 assert.deepEqual(f.calls.filter(call=>call.table==='team_members').map(call=>call.methods.find(([method])=>method==='range')),[['range',0,49],['range',50,99]]);
 assert.equal(f.document.querySelector('#more-members').hidden,true);
 assert.equal(f.document.querySelector('#team-search-hint').hidden,true);
});
test('exact 50-row batch only becomes final after the next existing pagination request',async t=>{
 const f=await fixture(t,{people:Array.from({length:50},(_,i)=>person(i))});
 assert.equal(f.document.querySelector('#more-members').hidden,false);
 await f.click('more-members');assert.equal(f.document.querySelectorAll('tbody tr').length,50);
 assert.equal(f.document.querySelector('#more-members').hidden,true);
 assert.doesNotMatch(f.document.querySelector('#directory-summary').textContent,/carregada/);
});
test('untrusted names, usernames and team names render as text, never HTML',async t=>{
 const attack='<img src=x onerror=alert(1)>',f=await fixture(t,{people:[person(1,{display_name:attack,username:'<script>bad()</script>',team_id:TEAM})],teams:[{...teamRows[0],name:attack}]});
 assert.equal(f.document.querySelectorAll('#member-list img,#member-list script').length,0);
 assert.ok(f.document.querySelector('#member-list').textContent.includes(attack));
});
test('empty directory is explicit and missing contact is not silently omitted',async t=>{
 const f=await fixture(t,{people:[]});assert.match(f.document.querySelector('#team-status').textContent,/Nenhum integrante disponível/);
 assert.match(f.document.querySelector('.directory-empty').textContent,/Nenhum integrante nesta equipe/);
 const g=await fixture(t,{people:[person(1,{username:null,contact_phone:null})]});assert.match(g.document.querySelector('tbody').textContent,/Não informado/);
});
test('initial failure exposes retry, then restores the content',async t=>{
 const f=await fixture(t,{fail:true});assert.equal(f.document.querySelector('#team-page').hidden,true);assert.equal(f.document.querySelector('#retry-session').hidden,false);
 f.state.fail=false;await f.click('retry-session');assert.equal(f.document.querySelector('#team-page').hidden,false);assert.equal(f.document.querySelector('#session-check').hidden,true);
});
test('pagination failure preserves rows and offers retry without advancing the offset',async t=>{
 const f=await fixture(t,{people:Array.from({length:51},(_,i)=>person(i))});f.state.fail=true;await f.click('more-members');
 assert.equal(f.document.querySelectorAll('tbody tr').length,50);assert.equal(f.document.querySelector('#retry-list').hidden,false);
 assert.ok(f.document.querySelector('#team-status').classList.contains('error'));
 f.state.fail=false;await f.click('retry-list');assert.equal(f.document.querySelectorAll('tbody tr').length,51);
 assert.equal(f.document.querySelector('#retry-list').hidden,true);
});
test('loading states prevent repeated load requests and clear busy state',async t=>{
 const f=await fixture(t,{people:Array.from({length:51},(_,i)=>person(i))});f.state.hold=true;
 await f.click('more-members');const before=f.calls.length;await f.click('more-members');
 assert.equal(f.calls.length,before);assert.equal(f.document.querySelector('.team-results').getAttribute('aria-busy'),'true');
 assert.equal(f.document.querySelector('#more-members').disabled,true);
 await f.release();assert.equal(f.document.querySelector('.team-results').getAttribute('aria-busy'),'false');
});
test('signout while data loads cannot reveal a late directory response',async t=>{
 const f=await fixture(t,{hold:true});f.authChange('SIGNED_OUT');await f.release();
 assert.equal(f.document.querySelector('#team-page').hidden,true);assert.equal(f.document.querySelector('#member-list').childElementCount,0);
 assert.ok(f.redirects.includes('./index.html?reason=expired'));
});
test('resume access-change still clears the directory and returns to login',async t=>{
 const f=await fixture(t);f.resume().onAccessChanged();assert.equal(f.document.querySelector('#team-page').hidden,true);assert.equal(f.document.querySelector('#member-list').childElementCount,0);
});
test('collapse preference survives filter changes and repeated toggles',async t=>{
 const f=await fixture(t);const group=f.document.querySelector('details');group.open=false;await new Promise(resolve=>setTimeout(resolve,15));
 await f.input('member-search','Pessoa','input');assert.equal(f.document.querySelector('details').open,true);
 await f.input('member-search','','input');assert.equal(f.document.querySelector('details').open,false);
 const again=f.document.querySelector('details');again.open=true;await new Promise(resolve=>setTimeout(resolve,15));await f.input('status-filter','active');await f.input('status-filter','');assert.equal(f.document.querySelector('details').open,true);
});
test('layout-only assets isolate this page and add no management writes or controls',()=>{
 assert.match(html,/team\.css\?v=20261020-directory1/);assert.doesNotMatch(html,/admin\.css/);
 assert.match(source,/from '\.\/auth-client\.js\?v=20260928-global1'/);assert.match(source,/from '\.\/app-header\.js\?v=20260928-occ1'/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|authClient[^;]*\.delete\(|\.upsert\(|\.rpc\(/);
 assert.doesNotMatch(html,/Convidar|Remover|Editar usuário|Nova equipe/);
 assert.match(html,/id="member-search"[^>]*aria-describedby="team-search-hint"/);
 assert.match(read('team.css'),/@media\(max-width:720px\)/);assert.match(read('team.css'),/\.team-directory :is\(input,select,summary,button\):focus-visible/);
});
