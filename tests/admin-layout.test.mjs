import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('admin.html'),source=read('admin.js');
const HOME='team-home',OTHER='team-other',INACTIVE='team-inactive';
const teamRows=[
 {id:HOME,name:'Equipe Aurora',active:true,grants_global_access:true},
 {id:OTHER,name:'Equipe Horizonte',active:true,grants_global_access:false},
 {id:INACTIVE,name:'Equipe Antiga',active:false,grants_global_access:false},
];
const person=(n,changes={})=>({user_id:'user-'+n,team_id:OTHER,display_name:'Pessoa '+String(n).padStart(3,'0'),username:'pessoa.'+n,contact_phone:'11900001234',role:'editor',active:true,is_super_admin:false,...changes});
const defaultMember=()=>person(1,{team_id:HOME,role:'admin',is_super_admin:true});
const defaultPeople=()=>[defaultMember(),person(2),person(3,{role:'admin',active:false}),person(4,{team_id:HOME,role:'admin',is_super_admin:true})];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const flush=async()=>{await tick();await tick();};

// jsdom does not implement native dialog methods. Model their observable state,
// close/cancel events and native focus restoration without a browser or network.
function installDialogShim(window){
 const prototype=window.HTMLDialogElement.prototype;
 prototype.showModal=function(){
  if(this.open)return;
  this.__opener=window.document.activeElement;
  this.setAttribute('open','');
  const candidate=[...this.querySelectorAll('[autofocus],input:not([type="hidden"]),select,button')].find(node=>!node.disabled&&!node.closest('[hidden]'));
  candidate?.focus();
 };
 prototype.close=function(returnValue=''){
  if(!this.open)return;
  this.returnValue=returnValue;
  this.removeAttribute('open');
  if(this.__opener?.isConnected)this.__opener.focus();
  this.dispatchEvent(new window.Event('close'));
 };
}

async function fixture(t,{member=defaultMember(),people=defaultPeople(),teams=teamRows,fail=false,memberError=null,holdQueries=false,holdInvoke=false,invokeResponse={data:{message:'Salvo com sucesso.'},error:null}}={}){
 const dom=new JSDOM(html,{url:'https://example.test/admin.html'}),document=dom.window.document;
 installDialogShim(dom.window);
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 const calls=[],invocations=[],redirects=[],confirmations=[],headerCalls=[],signOutCalls=[];
 const state={member,people,teams,fail,memberError,holdQueries,holdInvoke,invokeResponse,pendingQueries:[],pendingInvokes:[],confirm:true};
 const authClient={
  auth:{signOut:async options=>{signOutCalls.push(options);return {error:null};}},
  from(table){
   const call={table,methods:[]};calls.push(call);
   const query={};
   for(const method of ['select','order','eq','range','limit'])query[method]=(...args)=>{call.methods.push([method,...args]);return query;};
   query.then=resolve=>{const complete=()=>resolve({data:state[table==='teams'?'teams':'people'],error:state.fail?Error('offline'):null});if(state.holdQueries)state.pendingQueries.push(complete);else complete();};
   return query;
  },
  functions:{invoke:async(name,options)=>{
   invocations.push({name,...JSON.parse(JSON.stringify(options))});
   if(state.holdInvoke)return new Promise(resolve=>state.pendingInvokes.push(()=>resolve(state.invokeResponse)));
   return state.invokeResponse;
  }},
 };
 const location={replace:url=>redirects.push(url),href:''};
 const context=vm.createContext({document,window:dom.window,location,authClient,getTeamMember:async()=>({member:state.member,error:state.memberError}),updateHeader:value=>headerCalls.push(value),confirm:message=>{confirmations.push(message);return state.confirm;},console,requestAnimationFrame:callback=>callback(),setTimeout,clearTimeout});
 vm.runInContext(source.replace(/^import .*;\n/gm,''),context);
 await flush();
 t.after(()=>dom.window.close());
 const f={document,window:dom.window,state,calls,invocations,redirects,confirmations,headerCalls,signOutCalls,location,
  field:(form,name)=>document.getElementById(form).elements.namedItem(name),
  rows:list=>[...document.querySelectorAll('#'+list+' tbody tr')].filter(row=>row.querySelector('button')),
  async click(id){const target=typeof id==='string'?document.getElementById(id):id;assert.ok(target,'Missing click target '+id);target.focus();target.click();await flush();},
  async input(id,value,event='change'){const target=typeof id==='string'?document.getElementById(id):id;assert.ok(target,'Missing input target '+id);if(target.type==='checkbox')target.checked=value;else target.value=value;target.dispatchEvent(new dom.window.Event(event,{bubbles:true}));await flush();},
  async submit(id){document.getElementById(id).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();},
  async escape(id){const dialog=document.getElementById(id),event=new dom.window.Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close();await flush();},
  async releaseInvoke(){state.holdInvoke=false;for(const complete of state.pendingInvokes.splice(0))complete();await flush();},
  async releaseQueries(){state.holdQueries=false;for(const complete of state.pendingQueries.splice(0))complete();await flush();},
  async editUser(id){const row=[...document.querySelectorAll('#users-list tbody tr')].find(row=>row.textContent.includes(people.find(user=>user.user_id===id)?.display_name));assert.ok(row,'Missing user row '+id);await this.click(row.querySelector('button'));return row;},
  async editTeam(id){const row=[...document.querySelectorAll('#teams-list tbody tr')].find(row=>row.textContent.includes(teams.find(team=>team.id===id)?.name));assert.ok(row,'Missing team row '+id);await this.click(row.querySelector('button'));return row;},
 };
 return f;
}

const values=f=>Object.fromEntries(['user_id','display_name','username','contact_phone','team_id','role','password'].map(name=>[name,f.field('user-form',name).value]));
async function fillNewUser(f){
 await f.input(f.field('user-form','display_name'),'Nova Pessoa','input');
 await f.input(f.field('user-form','username'),'nova.pessoa','input');
 await f.input(f.field('user-form','contact_phone'),'11987654321','input');
 await f.input(f.field('user-form','team_id'),OTHER);
 await f.input(f.field('user-form','role'),'admin');
 await f.input(f.field('user-form','password'),'example-password','input');
}

// Guard and query invariants: this page intentionally keeps the existing
// unpaginated/RLS-backed queries, unlike the separate team directory page.
test('admin access fails closed for an editor before any data query',async t=>{
 const f=await fixture(t,{member:person(2)});
 assert.equal(f.document.querySelector('#admin-page').hidden,true);
 assert.match(f.document.querySelector('#session-check p').textContent,/exclusiva dos administradores/);
 assert.equal(f.calls.length,0);assert.equal(f.headerCalls.length,0);
 assert.equal(f.document.querySelector('#user-dialog').open,false);
});
test('absent membership redirects to login and a failed membership check exposes retry',async t=>{
 const f=await fixture(t,{member:null});
 assert.deepEqual(f.redirects,['./index.html?reason=expired']);assert.equal(f.calls.length,0);
 const g=await fixture(t,{memberError:Error('offline')});
 assert.equal(g.calls.length,0);assert.equal(g.document.querySelector('#retry-session').hidden,false);
 assert.equal(g.document.querySelector('#admin-page').hidden,true);
 g.state.memberError=null;await g.click('retry-session');
 assert.equal(g.document.querySelector('#admin-page').hidden,false);
});
test('global and ordinary administrators retain exact existing unpaginated query scope',async t=>{
 for(const member of [defaultMember(),person(2,{role:'admin'})]){
  const f=await fixture(t,{member});
  assert.deepEqual(f.calls,[
   {table:'team_members',methods:[['select','user_id,display_name,username,contact_phone,role,active,team_id,is_super_admin'],['order','display_name']]},
   {table:'teams',methods:[['select','id,name,active,grants_global_access'],['order','name']]},
  ]);
  assert.equal(f.document.querySelector('#admin-page').hidden,false);
  assert.equal(f.document.querySelector('#session-check').hidden,true);
  assert.equal(f.headerCalls.length,1);
 }
});
test('ordinary administrator cannot create or edit teams or another protected global administrator',async t=>{
 const f=await fixture(t,{member:person(2,{role:'admin'})});
 assert.equal(f.document.querySelector('#new-team').hidden,true);
 assert.equal(f.document.querySelectorAll('#teams-list tbody button').length,0);
 const protectedRow=[...f.document.querySelectorAll('#users-list tbody tr')].find(row=>row.textContent.includes('Pessoa 004'));
 assert.equal(protectedRow.querySelector('button').disabled,true);
 await f.click('new-user');assert.equal(f.field('user-form','team_id').disabled,true);
 assert.equal(f.field('user-form','team_id').value,OTHER);
});
test('users and teams start in list-first semantic tables with closed forms',async t=>{
 const f=await fixture(t);
 for(const id of ['user-dialog','team-dialog']){
  const dialog=f.document.getElementById(id);assert.equal(dialog.tagName,'DIALOG');assert.equal(dialog.open,false);
  assert.ok(dialog.getAttribute('aria-labelledby'));
  assert.ok(f.document.getElementById(dialog.getAttribute('aria-labelledby')));
 }
 for(const id of ['users-list','teams-list']){
  assert.ok(f.document.querySelector('#'+id+' table'));
  assert.ok(f.document.querySelector('#'+id+' thead th'));
 }
 assert.equal(f.document.querySelector('#users-section').hidden,false);
 assert.equal(f.document.querySelector('#teams-section').hidden,true);
 await f.click('tab-teams');
 assert.equal(f.document.querySelector('#tab-teams').getAttribute('aria-selected'),'true');
 assert.equal(f.document.querySelector('#teams-section').hidden,false);
 assert.equal(f.document.querySelector('#users-section').hidden,true);
});
test('role and activity remain separate, including inactive users and global grants',async t=>{
 const f=await fixture(t);
 const row=[...f.document.querySelectorAll('#users-list tbody tr')].find(row=>row.textContent.includes('Pessoa 003'));
 assert.equal(row.querySelector('.access-role').textContent,'Administrador');
 assert.equal(row.querySelector('.access-status').textContent,'Inativo');
 assert.match(row.textContent,/\(11\) 90000-1234/);
 const globalRow=[...f.document.querySelectorAll('#users-list tbody tr')].find(row=>row.textContent.includes('Pessoa 001'));
 assert.equal(globalRow.querySelector('.access-role').textContent,'Administrador geral');
 const g=await fixture(t,{people:[person(7,{team_id:HOME,role:'admin'})],teams:[{...teamRows[0],active:false}]});
 assert.equal(g.document.querySelector('#users-list .access-role').textContent,'Administrador');
});
test('all loaded admin users remain present without importing directory pagination',async t=>{
 const f=await fixture(t,{people:Array.from({length:61},(_,i)=>person(i))});
 assert.equal(f.document.querySelectorAll('#users-list tbody tr').length,61);
 assert.equal(f.calls.some(call=>call.methods.some(([method])=>['range','limit'].includes(method))),false);
 assert.match(f.document.querySelector('#users-count').textContent,/61/);
});

test('new-user dialog preserves existing creation defaults and field validation',async t=>{
 const f=await fixture(t);await f.click('new-user');
 assert.equal(f.document.querySelector('#user-dialog').open,true);
 assert.equal(f.document.activeElement,f.field('user-form','display_name'));
 assert.deepEqual(values(f),{user_id:'',display_name:'',username:'',contact_phone:'',team_id:HOME,role:'editor',password:''});
 assert.equal(f.field('user-form','active').checked,true);
 assert.equal(f.field('user-form','password').required,true);
 assert.equal(f.field('user-form','password').minLength,6);
 assert.equal(f.field('user-form','password').maxLength,128);
 assert.equal(f.field('user-form','username').minLength,3);
 assert.equal(f.field('user-form','username').maxLength,40);
 assert.equal(f.field('user-form','display_name').maxLength,160);
 assert.equal(f.field('user-form','contact_phone').maxLength,15);
 assert.equal(f.document.querySelector('#reset-password-section').hidden,true);
 assert.equal(f.document.querySelector('#active-label').hidden,true);
 assert.equal(f.document.querySelector('#cancel-user').hidden,false);
 assert.equal([...f.field('user-form','team_id').options].find(option=>option.value===INACTIVE).disabled,true);
});
test('clean close buttons and Escape close without save or confirmation and restore CTA focus',async t=>{
 const f=await fixture(t);
 for(const action of ['close-user','cancel-user','escape']){
  await f.click('new-user');
  if(action==='escape')await f.escape('user-dialog');else await f.click(action);
  assert.equal(f.document.querySelector('#user-dialog').open,false);
  assert.equal(f.document.activeElement,f.document.querySelector('#new-user'));
 }
 assert.equal(f.invocations.length,0);assert.equal(f.confirmations.length,0);
});
test('dirty close cancel and Escape each require discard confirmation and never save',async t=>{
 const f=await fixture(t);
 for(const action of ['close-user','cancel-user','escape']){
  await f.click('new-user');await f.input(f.field('user-form','display_name'),'Alteração pendente','input');
  f.state.confirm=false;
  if(action==='escape')await f.escape('user-dialog');else await f.click(action);
  assert.equal(f.document.querySelector('#user-dialog').open,true);
  assert.equal(f.field('user-form','display_name').value,'Alteração pendente');
  f.state.confirm=true;
  if(action==='escape')await f.escape('user-dialog');else await f.click(action);
  assert.equal(f.document.querySelector('#user-dialog').open,false);
 }
 assert.equal(f.confirmations.length,6);assert.equal(f.invocations.length,0);
 await f.click('new-user');assert.equal(f.field('user-form','display_name').value,'');
});
test('editing protected users keeps role activity and team locked and protects password reset',async t=>{
 const f=await fixture(t);
 for(const id of ['user-1','user-4']){
  await f.editUser(id);
  for(const name of ['role','active','team_id'])assert.equal(f.field('user-form',name).disabled,true);
  assert.equal(f.field('user-form','password').required,false);
  assert.equal(f.document.querySelector('#password-label').hidden,true);
  assert.equal(f.document.querySelector('#active-label').hidden,false);
  assert.equal(f.document.querySelector('#reset-password-section').hidden,id==='user-4');
  await f.click('cancel-user');
 }
 await f.editUser('user-2');
 for(const name of ['role','active','team_id'])assert.equal(f.field('user-form',name).disabled,false);
 assert.equal(f.document.querySelector('#reset-password-section').hidden,false);
 assert.equal(f.field('user-form','contact_phone').value,'(11) 90000-1234');
 await f.click('cancel-user');await f.click('new-user');
 assert.equal(f.field('user-form','user_id').value,'');assert.equal(f.field('user-form','password').required,true);
 assert.equal(f.document.querySelector('#reset-password-section').hidden,true);
});
test('editing restores focus to its original row button when the unchanged dialog closes',async t=>{
 const f=await fixture(t);
 const row=await f.editUser('user-2'),opener=row.querySelector('button');
 await f.click('close-user');
 assert.equal(f.document.activeElement,opener);
 assert.equal(f.invocations.length,0);
});
test('create and update user submit the exact existing gro-admin payload and close on success',async t=>{
 const f=await fixture(t);await f.click('new-user');await fillNewUser(f);await f.submit('user-form');
 assert.deepEqual(f.invocations,[{name:'gro-admin',body:{action:'create_user',data:{user_id:'',display_name:'Nova Pessoa',username:'nova.pessoa',contact_phone:'(11) 98765-4321',team_id:OTHER,role:'admin',password:'example-password',active:true}}}]);
 assert.equal(f.document.querySelector('#user-dialog').open,false);
 assert.equal(f.calls.length,4);
 await f.editUser('user-2');await f.input(f.field('user-form','display_name'),'Nome atualizado','input');await f.input(f.field('user-form','active'),false);await f.submit('user-form');
 assert.deepEqual(f.invocations[1],{name:'gro-admin',body:{action:'update_user',data:{user_id:'user-2',display_name:'Nome atualizado',username:'pessoa.2',contact_phone:'(11) 90000-1234',team_id:OTHER,role:'editor',password:'',active:false}}});
 assert.equal(f.document.querySelector('#user-dialog').open,false);
 assert.equal(f.document.activeElement.isConnected,true);
 assert.equal(f.document.activeElement.closest('dialog'),null);
 assert.equal(f.document.activeElement.matches('#new-user,#users-list button'),true);
});
test('failed save retains the open form and entered values without reloading',async t=>{
 const f=await fixture(t,{invokeResponse:{data:null,error:{context:{json:async()=>({message:'Usuário já existe.'})}}}});
 await f.click('new-user');await fillNewUser(f);const expected=values(f);await f.submit('user-form');
 assert.equal(f.document.querySelector('#user-dialog').open,true);assert.deepEqual(values(f),expected);
 assert.match(f.document.querySelector('#admin-status').textContent,/Usuário já existe/);
 assert.equal(f.calls.length,2);
 assert.equal(f.document.querySelector('#user-form [type="submit"]').disabled,false);
 assert.equal(f.field('user-form','team_id').disabled,false);
 f.state.invokeResponse={data:{message:'Salvo.'},error:null};await f.submit('user-form');
 assert.equal(f.document.querySelector('#user-dialog').open,false);assert.equal(f.invocations.length,2);
});
test('successful save followed by reload failure remains saved and exposes list retry',async t=>{
 const f=await fixture(t);await f.click('new-user');await fillNewUser(f);f.state.fail=true;await f.submit('user-form');
 assert.equal(f.document.querySelector('#user-dialog').open,false);
 assert.match(f.document.querySelector('#admin-status').textContent,/Salvo\./);
 assert.equal(f.document.querySelector('#reload-list').hidden,false);
 assert.equal(f.invocations.length,1);
 f.state.fail=false;await f.click('reload-list');
 assert.equal(f.document.querySelector('#reload-list').hidden,true);assert.equal(f.invocations.length,1);
});
test('pending save locks mutation controls and blocks repeated submits close and Escape',async t=>{
 const f=await fixture(t,{holdInvoke:true});await f.click('new-user');await fillNewUser(f);await f.submit('user-form');
 assert.equal(f.invocations.length,1);
 assert.equal(f.document.querySelector('#user-form [type="submit"]').disabled,true);
 assert.equal(f.document.querySelector('#new-user').disabled,true);
 assert.equal([...f.document.querySelectorAll('#users-list tbody button')].every(button=>button.disabled),true);
 await f.submit('user-form');await f.click('cancel-user');await f.click('close-user');await f.escape('user-dialog');
 assert.equal(f.invocations.length,1);assert.equal(f.document.querySelector('#user-dialog').open,true);
 assert.equal(f.confirmations.length,0);
 await f.releaseInvoke();
 assert.equal(f.document.querySelector('#user-dialog').open,false);
 assert.equal(f.document.querySelector('#new-user').disabled,false);
 assert.equal(f.document.querySelector('#user-form [type="submit"]').disabled,false);
});
test('team dialogs preserve defaults protect own team and discard without writes',async t=>{
 const f=await fixture(t);await f.click('tab-teams');await f.click('new-team');
 assert.equal(f.document.querySelector('#team-dialog').open,true);
 assert.equal(f.document.activeElement,f.field('team-form','name'));
 assert.equal(f.field('team-form','id').value,'');assert.equal(f.field('team-form','name').value,'');
 assert.equal(f.field('team-form','active').checked,true);assert.equal(f.field('team-form','name').maxLength,120);
 assert.equal(f.document.querySelector('#team-active-label').hidden,true);assert.equal(f.document.querySelector('#cancel-team').hidden,false);
 await f.input(f.field('team-form','name'),'Rascunho','input');f.state.confirm=false;await f.escape('team-dialog');
 assert.equal(f.document.querySelector('#team-dialog').open,true);
 f.state.confirm=true;await f.click('cancel-team');assert.equal(f.document.querySelector('#team-dialog').open,false);
 assert.equal(f.document.activeElement,f.document.querySelector('#new-team'));
 await f.editTeam(HOME);assert.equal(f.field('team-form','active').disabled,true);
 assert.equal(f.document.querySelector('#team-active-label').hidden,false);await f.click('close-team');
 await f.editTeam(OTHER);assert.equal(f.field('team-form','active').disabled,false);await f.click('close-team');
 assert.equal(f.invocations.length,0);
});
test('team create and update retain existing payloads and close only after successful save',async t=>{
 const f=await fixture(t);await f.click('tab-teams');await f.click('new-team');await f.input(f.field('team-form','name'),'Equipe Nova','input');await f.submit('team-form');
 assert.deepEqual(f.invocations[0],{name:'gro-admin',body:{action:'create_team',data:{id:'',name:'Equipe Nova',active:true}}});
 assert.equal(f.document.querySelector('#team-dialog').open,false);
 await f.editTeam(OTHER);await f.input(f.field('team-form','name'),'Equipe Atualizada','input');await f.input(f.field('team-form','active'),false);await f.submit('team-form');
 assert.deepEqual(f.invocations[1],{name:'gro-admin',body:{action:'update_team',data:{id:OTHER,name:'Equipe Atualizada',active:false}}});
 assert.equal(f.document.querySelector('#team-dialog').open,false);
 assert.equal(f.document.activeElement.matches('#new-team,#teams-list button'),true);
});
test('team save failure and retry retain values and prior active protection',async t=>{
 const f=await fixture(t,{invokeResponse:{data:null,error:{context:{json:async()=>({message:'Falha na equipe.'})}}}});
 await f.click('tab-teams');await f.editTeam(HOME);await f.input(f.field('team-form','name'),'Renomeada','input');await f.submit('team-form');
 assert.equal(f.document.querySelector('#team-dialog').open,true);assert.equal(f.field('team-form','name').value,'Renomeada');
 assert.equal(f.field('team-form','active').disabled,true);
 assert.match(f.document.querySelector('#admin-status').textContent,/Falha na equipe/);
 assert.equal(f.calls.length,2);
});

test('user search and combined team role and activity filters are local and update counts',async t=>{
 const f=await fixture(t),before=f.calls.length;
 await f.input('user-search','pEsSoA.3','input');
 assert.equal(f.rows('users-list').length,1);assert.match(f.document.querySelector('#users-list').textContent,/Pessoa 003/);
 await f.input('user-search','','input');await f.input('user-team-filter',OTHER);await f.input('user-role-filter','admin');await f.input('user-status-filter','inactive');
 assert.equal(f.rows('users-list').length,1);assert.match(f.document.querySelector('#users-count').textContent,/1/);
 await f.input('user-status-filter','active');assert.equal(f.rows('users-list').length,0);
 assert.match(f.document.querySelector('#users-list').textContent,/Nenhum usuário/);
 await f.input('user-team-filter','');await f.input('user-role-filter','global');
 assert.equal(f.rows('users-list').length,2);
 assert.equal(f.calls.length,before);assert.equal(f.invocations.length,0);
});
test('team search and status filters combine locally without being affected by user filters',async t=>{
 const f=await fixture(t),before=f.calls.length;
 await f.input('user-team-filter',OTHER);await f.input('user-search','inexistente','input');
 await f.click('tab-teams');await f.input('team-search','aNtIgA','input');await f.input('team-status-filter','inactive');
 assert.equal(f.rows('teams-list').length,1);assert.match(f.document.querySelector('#teams-list').textContent,/Equipe Antiga/);
 assert.match(f.document.querySelector('#teams-count').textContent,/1/);
 await f.input('team-status-filter','active');assert.equal(f.rows('teams-list').length,0);
 assert.match(f.document.querySelector('#teams-list').textContent,/Nenhuma equipe/);
 assert.equal(f.calls.length,before);assert.equal(f.invocations.length,0);
});
test('team member counts explicitly describe loaded data including inactive users, never authoritative totals',async t=>{
 const f=await fixture(t);
 const note=f.document.querySelector('#teams-filter-note').textContent;
 assert.match(note,/lista carregada/);assert.match(note,/incluindo inativos/);assert.match(note,/Não representa um total geral/);
 const row=()=>[...f.document.querySelectorAll('#teams-list tbody tr')].find(row=>row.textContent.includes('Equipe Horizonte'));
 assert.match(row().textContent,/2/);
 await f.input('user-status-filter','active');await f.input('user-search','Pessoa 001','input');
 assert.match(row().textContent,/2/);
 assert.match(f.document.querySelector('#users-filter-note').textContent,/carregados/);
});
test('untrusted member and team names render only as text in rows options and dialogs',async t=>{
 const attack='<img src=x onerror=alert(1)>',username='<script>bad()</script>';
 const f=await fixture(t,{people:[person(8,{display_name:attack,username,team_id:OTHER})],teams:[{...teamRows[1],name:attack}]});
 assert.equal(f.document.querySelectorAll('#users-list img,#users-list script,#teams-list img,#teams-list script').length,0);
 assert.ok(f.document.querySelector('#users-list').textContent.includes(attack));assert.ok(f.document.querySelector('#users-list').textContent.includes(username));
 assert.ok(f.document.querySelector('#teams-list').textContent.includes(attack));
 assert.ok([...f.document.querySelector('#user-team-filter').options].some(option=>option.textContent.includes(attack)));
 await f.editUser('user-8');assert.equal(f.field('user-form','display_name').value,attack);
 assert.equal(f.document.querySelector('#user-dialog img'),null);
});
test('initial load failure shows safe retry and retry does not create or save anything',async t=>{
 const f=await fixture(t,{fail:true});
 assert.equal(f.document.querySelector('#reload-list').hidden,false);
 assert.equal(f.document.querySelector('#new-user').disabled,true);
 assert.equal(f.document.querySelector('#user-dialog').open,false);
 f.state.fail=false;await f.click('reload-list');
 assert.equal(f.document.querySelector('#reload-list').hidden,true);
 assert.equal(f.document.querySelector('#new-user').disabled,false);
 assert.equal(f.rows('users-list').length,4);assert.equal(f.invocations.length,0);
});
test('empty loaded users and teams have explicit non-crashing empty states',async t=>{
 const f=await fixture(t,{people:[],teams:[]});
 assert.equal(f.rows('users-list').length,0);assert.equal(f.rows('teams-list').length,0);
 assert.match(f.document.querySelector('#users-list').textContent,/Nenhum usuário/);
 assert.match(f.document.querySelector('#teams-list').textContent,/Nenhuma equipe/);
 assert.match(f.document.querySelector('#users-count').textContent,/0/);
 assert.match(f.document.querySelector('#teams-count').textContent,/0/);
});
test('changing assigned team preserves the existing global-access warning',async t=>{
 const f=await fixture(t);await f.click('new-user');await f.input(f.field('user-form','team_id'),HOME);
 assert.match(f.document.querySelector('#user-note').textContent,/acesso geral a todos os clientes, relatórios, usuários e equipes/);
 await f.input(f.field('user-form','team_id'),OTHER);
 assert.match(f.document.querySelector('#user-note').textContent,/equipe escolhida/);
});
test('password reset validates minimum maximum and confirmation before any mutation',async t=>{
 const f=await fixture(t);await f.editUser('user-2');
 for(const password of ['short','x'.repeat(129)]){
  await f.input('reset-password',password,'input');await f.input('reset-password-confirm',password,'input');await f.click('reset-password-button');
  assert.match(f.document.querySelector('#reset-password-status').textContent,/6 a 128/);
 }
 await f.input('reset-password','valid-password','input');await f.input('reset-password-confirm','other-password','input');await f.click('reset-password-button');
 assert.match(f.document.querySelector('#reset-password-status').textContent,/não coincidem/);
 assert.equal(f.invocations.length,0);assert.equal(f.confirmations.length,0);
});
test('password reset requires confirmation and keeps the existing endpoint data shape',async t=>{
 const f=await fixture(t);await f.editUser('user-2');await f.input('reset-password','new-password','input');await f.input('reset-password-confirm','new-password','input');
 f.state.confirm=false;await f.click('reset-password-button');assert.equal(f.invocations.length,0);
 assert.match(f.confirmations[0],/Alterar a senha de Pessoa 002\?/);
 f.state.confirm=true;await f.click('reset-password-button');
 assert.deepEqual(f.invocations,[{name:'gro-admin',body:{action:'reset_password',data:{user_id:'user-2',password:'new-password'}}}]);
 assert.equal(f.document.querySelector('#reset-password').value,'');assert.equal(f.document.querySelector('#reset-password-confirm').value,'');
 assert.equal(f.document.querySelector('#user-dialog').open,true);
 assert.equal(f.calls.length,2);
});
test('password reset failure clears sensitive input and unlocks without weakening protected fields',async t=>{
 const f=await fixture(t,{holdInvoke:true,invokeResponse:{data:null,error:{context:{json:async()=>({message:'Senha não alterada.'})}}}});
 await f.editUser('user-1');await f.input('reset-password','new-password','input');await f.input('reset-password-confirm','new-password','input');await f.click('reset-password-button');
 assert.ok([...f.document.querySelectorAll('#user-form input,#user-form select,#user-form button')].every(control=>control.disabled));
 await f.click('close-user');await f.escape('user-dialog');assert.equal(f.document.querySelector('#user-dialog').open,true);
 assert.equal(f.invocations.length,1);await f.releaseInvoke();
 assert.match(f.document.querySelector('#reset-password-status').textContent,/Senha não alterada/);
 assert.equal(f.document.querySelector('#reset-password').value,'');assert.equal(f.document.querySelector('#reset-password-confirm').value,'');
 for(const name of ['role','active','team_id'])assert.equal(f.field('user-form',name).disabled,true);
 assert.equal(f.field('user-form','display_name').disabled,false);
 assert.equal(f.document.querySelector('#reset-password-button').disabled,false);
});
test('repeated create edit close flows do not attach duplicate submit or reset listeners',async t=>{
 const f=await fixture(t);
 for(let i=0;i<3;i++){
  await f.click('new-user');await f.click('cancel-user');await f.editUser('user-2');await f.click('cancel-user');
  await f.click('tab-teams');await f.click('new-team');await f.click('cancel-team');await f.click('tab-users');
 }
 await f.editUser('user-2');await f.input('reset-password','new-password','input');await f.input('reset-password-confirm','new-password','input');await f.click('reset-password-button');
 assert.equal(f.invocations.length,1);await f.click('cancel-user');await f.click('new-user');await fillNewUser(f);await f.submit('user-form');
 assert.equal(f.invocations.length,2);
});
test('layout assets stay scoped to admin and retain auth imports with no new direct database writes',()=>{
 assert.match(html,/access-management\.css\?v=/);
 assert.doesNotMatch(html,/href="\.\/admin\.css/);
 assert.match(source,/from '\.\/auth-client\.js\?v=20260928-global1'/);
 assert.match(source,/from '\.\/app-header\.js\?v=20260928-occ1'/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|authClient[^;]*\.delete\(|\.upsert\(|\.rpc\(/);
 assert.doesNotMatch(html,/name="grants_global_access"/);
 const css=read('access-management.css');assert.match(css,/:focus-visible/);assert.match(css,/@media/);
});

test('initial loading locks creation and exposes aria-busy until both existing queries complete',async t=>{
 const f=await fixture(t,{holdQueries:true});
 for(const name of ['users','teams'])assert.equal(f.document.querySelector('#'+name+'-section').getAttribute('aria-busy'),'true');
 assert.equal(f.document.querySelector('#new-user').disabled,true);await f.click('new-user');
 assert.equal(f.document.querySelector('#user-dialog').open,false);assert.equal(f.calls.length,2);
 await f.releaseQueries();
 for(const name of ['users','teams'])assert.equal(f.document.querySelector('#'+name+'-section').getAttribute('aria-busy'),'false');
 assert.equal(f.document.querySelector('#new-user').disabled,false);assert.equal(f.invocations.length,0);
});
test('keyboard tabs maintain a single selected tab and expose the matching creation action',async t=>{
 const f=await fixture(t);
 for(const [origin,key,target] of [['users','ArrowRight','teams'],['teams','Home','users'],['users','End','teams'],['teams','ArrowLeft','users']]){
  f.document.querySelector('#tab-'+origin).dispatchEvent(new f.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await flush();
  const tab=f.document.querySelector('#tab-'+target);
  assert.equal(tab.getAttribute('aria-selected'),'true');assert.equal(tab.tabIndex,0);assert.equal(f.document.activeElement,tab);
  assert.equal(f.document.querySelector('#new-user').hidden,target!=='users');assert.equal(f.document.querySelector('#new-team').hidden,target!=='teams');
  assert.equal(f.document.querySelectorAll('[role="tab"][aria-selected="true"]').length,1);
 }
 assert.equal(f.calls.length,2);assert.equal(f.invocations.length,0);
});
test('dirty reset-only input is protected on close and leaving a dirty dialog requests unload confirmation',async t=>{
 const f=await fixture(t);await f.editUser('user-2');
 let event=new f.window.Event('beforeunload',{cancelable:true});f.window.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
 await f.input('reset-password','unsaved-password','input');f.state.confirm=false;await f.click('cancel-user');
 assert.equal(f.document.querySelector('#user-dialog').open,true);assert.equal(f.confirmations.length,1);
 event=new f.window.Event('beforeunload',{cancelable:true});f.window.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 f.state.confirm=true;await f.click('close-user');
 assert.equal(f.document.querySelector('#reset-password').value,'');assert.equal(f.invocations.length,0);
 event=new f.window.Event('beforeunload',{cancelable:true});f.window.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
});
test('password reset accepts both documented boundary lengths without saving other form changes',async t=>{
 const f=await fixture(t);await f.editUser('user-2');await f.input(f.field('user-form','display_name'),'Nome ainda não salvo','input');
 for(const length of [6,128]){
  const password='a'.repeat(length);await f.input('reset-password',password,'input');await f.input('reset-password-confirm',password,'input');await f.click('reset-password-button');
  assert.equal(f.invocations.at(-1).body.action,'reset_password');assert.equal(f.invocations.at(-1).body.data.password.length,length);
  assert.equal(f.field('user-form','display_name').value,'Nome ainda não salvo');assert.equal(f.document.querySelector('#user-dialog').open,true);
 }
 assert.equal(f.invocations.length,2);assert.equal(f.calls.length,2);
 f.state.confirm=false;await f.click('cancel-user');assert.equal(f.document.querySelector('#user-dialog').open,true);
});
test('unreadable endpoint failure retains ordinary administrator form restrictions and readable retry advice',async t=>{
 const f=await fixture(t,{member:person(2,{role:'admin'}),invokeResponse:{data:null,error:{}}});
 await f.editUser('user-2');await f.input(f.field('user-form','display_name'),'Ainda editando','input');await f.submit('user-form');
 assert.equal(f.document.querySelector('#user-dialog').open,true);assert.equal(f.field('user-form','display_name').value,'Ainda editando');
 for(const name of ['role','active','team_id'])assert.equal(f.field('user-form',name).disabled,true);
 assert.match(f.document.querySelector('#user-form-status').textContent,/Não foi possível confirmar o salvamento/);
 assert.match(f.document.querySelector('#user-form-status').textContent,/Atualize a lista/);
 assert.equal(f.calls.length,2);
});
