import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftAutosave,findDraftRecovery,clearDraftRecovery,showDraftRecovery} from '../draft-autosave.js';

const scope={userId:'user-a',teamId:'team-a',clientId:'client-a',draftId:'draft-a',page:'wizard'};
const copy=x=>JSON.parse(JSON.stringify(x));
class Storage {
 constructor(){this.values=new Map();this.fail=false;}
 get length(){return this.values.size;}
 key(i){return [...this.values.keys()][i]??null;}
 getItem(k){return this.values.get(k)??null;}
 setItem(k,v){if(this.fail)throw new Error('Quota exceeded');this.values.set(k,String(v));}
 removeItem(k){this.values.delete(k);}
}
function timerHarness(){let now=0,id=0;const tasks=new Map();return {setTimeout(fn,delay){const key=++id;tasks.set(key,{fn,at:now+delay});return key;},clearTimeout(key){tasks.delete(key);},tick(ms){now+=ms;for(const [key,task] of [...tasks])if(task.at<=now){tasks.delete(key);task.fn();}},size:()=>tasks.size};}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(options={}){
 let snapshot={answers:{employees:'10'},visit_responsible_id:null},revision=1,online=true;
 const storage=options.storage??new Storage(),events=new EventTarget(),timers=timerHarness(),statuses=[],saved=[],calls=[];
 const controller=createDraftAutosave({scope:options.scope??scope,getSnapshot:()=>snapshot,getRevision:()=>revision,
  persist:options.persist??(async value=>{calls.push(copy(value));return {id:scope.draftId,revision:++revision};}),
  onStatus:value=>statuses.push(value),onSaved:(value,result)=>saved.push([copy(value),result]),storage,events,timers,isOnline:()=>online,writerId:options.writerId??'writer-a',now:()=>1000,...options});
 controller.initialize();return {controller,storage,events,timers,statuses,saved,calls,set(value){snapshot=copy(value);},edit(value){snapshot.answers.employees=value;controller.changed();},get snapshot(){return snapshot;},get revision(){return revision;},set revision(v){revision=v;},set online(v){online=v;}};
}

test('autosave checkpoints immediately and debounces repeated edits for one second',async()=>{
 const f=fixture();f.edit('11');assert.equal(findDraftRecovery(scope,{storage:f.storage,now:1000})[0].snapshot.answers.employees,'11');
 f.timers.tick(600);f.edit('12');f.timers.tick(600);await settle();assert.equal(f.calls.length,0);
 f.timers.tick(400);await settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0].answers.employees,'12');assert.equal(f.controller.dirty(),false);assert.equal(f.storage.length,0);assert.equal(f.statuses.at(-1).state,'saved');
});

test('unchanged notifications do not write or schedule and clean manual save still works',async()=>{
 const f=fixture();f.controller.changed();assert.equal(f.storage.length,0);assert.equal(f.timers.size(),0);
 await f.controller.flush();assert.equal(f.calls.length,1);assert.equal(f.controller.dirty(),false);
});

test('offline edits remain local and reconnect submits newest snapshot',async()=>{
 const f=fixture();f.online=false;f.edit('15');f.timers.tick(1000);await settle();assert.equal(f.calls.length,0);assert.equal(f.controller.dirty(),true);assert.equal(f.statuses.at(-1).state,'offline');assert.match(f.statuses.at(-1).message,/ainda não salvas no servidor/);
 f.online=true;f.events.dispatchEvent(new Event('online'));await settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0].answers.employees,'15');assert.equal(f.storage.length,0);
});

test('in-flight edits serialize and manual flush waits for latest snapshot',async()=>{
 const requests=[],pending=[];let active=0,maxActive=0;
 const f=fixture({persist:async value=>{requests.push(copy(value));active++;maxActive=Math.max(maxActive,active);const wait=deferred();pending.push(wait);await wait.promise;active--;f.revision++;return {revision:f.revision};}});
 f.edit('20');const first=f.controller.flush();await settle();assert.equal(pending.length,1);
 f.edit('21');const manual=f.controller.flush();await settle();assert.equal(pending.length,1);
 pending[0].resolve();await settle();assert.equal(pending.length,2);assert.equal(requests[1].answers.employees,'21');
 pending[1].resolve();await Promise.all([first,manual]);assert.equal(maxActive,1);assert.equal(f.controller.dirty(),false);assert.equal(f.storage.length,0);assert.equal(f.saved.length,2);
});

test('failed save preserves dirty snapshot and allows manual retry without a new edit',async()=>{
 let fail=true;const f=fixture({persist:async value=>{if(fail)throw Error('Falha de conexão');return {revision:2};}});f.edit('22');assert.equal(await f.controller.flush(),null);assert.equal(f.controller.dirty(),true);assert.equal(f.controller.isSaving(),false);assert.equal(f.storage.length,1);assert.equal(f.statuses.at(-1).state,'error');
 fail=false;await f.controller.flush();assert.equal(f.controller.dirty(),false);assert.equal(f.storage.length,0);
});

test('revision conflicts block automatic and manual retry and preserve current local answers',async()=>{
 let count=0;const f=fixture({persist:async()=>{count++;throw Object.assign(Error('Outra edição'),{code:'DRAFT_CONFLICT'});}});f.edit('30');await f.controller.flush();assert.equal(f.controller.isBlocked(),true);assert.equal(f.controller.dirty(),true);
 f.edit('31');f.online=false;f.online=true;f.events.dispatchEvent(new Event('online'));f.timers.tick(2000);await f.controller.flush();assert.equal(count,1);assert.equal(findDraftRecovery(scope,{storage:f.storage,now:1000})[0].snapshot.answers.employees,'31');
});

test('missing local storage reports no recovery guarantee',async()=>{
 const storage=new Storage();storage.fail=true;const f=fixture({storage});f.online=false;f.edit('40');assert.equal(storage.length,0);assert.match(f.statuses.at(-1).message,/Não foi possível guardar neste aparelho/);assert.doesNotMatch(f.statuses.at(-1).message,/Alterações guardadas/);
});

test('recovery keys isolate account, team, company, draft, page and writer',()=>{
 const storage=new Storage(),instances=[];const variants=[scope,{...scope,userId:'b'},{...scope,teamId:'b'},{...scope,clientId:'b'},{...scope,draftId:'b'},{...scope,page:'details'}];
 for(const [i,s] of variants.entries()){const f=fixture({storage,scope:s,writerId:'w'+i});f.edit(String(i));instances.push(f);}
 const sibling=fixture({storage,writerId:'another-tab'});sibling.edit('99');
 assert.equal(findDraftRecovery(scope,{storage,now:1000}).length,2);assert.equal(storage.length,7);
 clearDraftRecovery({userId:scope.userId,teamId:scope.teamId},{storage});assert.equal(storage.length,2);assert.equal(findDraftRecovery({userId:scope.userId,teamId:scope.teamId},{storage,now:1000}).length,0);
});

test('pause prevents edits and queued sends; resume checkpoints changed snapshot',async()=>{
 const f=fixture();f.edit('50');f.controller.pause();f.set({answers:{employees:'51'}});f.controller.changed();f.timers.tick(2000);await settle();assert.equal(f.calls.length,0);assert.equal(findDraftRecovery(scope,{storage:f.storage,now:1000})[0].snapshot.answers.employees,'50');
 f.controller.resume();f.timers.tick(1000);await settle();assert.equal(f.calls[0].answers.employees,'51');
});

test('discard removes only this tab checkpoint and cancels scheduled saves',async()=>{
 const storage=new Storage(),f=fixture({storage}),other=fixture({storage,writerId:'other'});f.edit('60');other.edit('61');f.controller.discard();f.timers.tick(1000);await settle();assert.equal(f.calls.length,0);assert.equal(storage.length,1);assert.equal(f.controller.dirty(),false);
});

test('disposed controller ignores late failed request and cannot recreate cleared logout data',async()=>{
 const wait=deferred();const f=fixture({persist:()=>wait.promise});f.edit('70');const request=f.controller.flush();await settle();f.controller.dispose();clearDraftRecovery({userId:scope.userId,teamId:scope.teamId},{storage:f.storage});const statuses=f.statuses.length;
 wait.reject(Error('Late failure'));await request;assert.equal(f.storage.length,0);assert.equal(f.statuses.length,statuses);assert.equal(f.saved.length,0);
});

test('disposed controller ignores successful response callbacks',async()=>{
 const wait=deferred();const f=fixture({persist:()=>wait.promise});f.edit('71');const request=f.controller.flush();await settle();f.controller.dispose();const statuses=f.statuses.length;wait.resolve({revision:2});await request;assert.equal(f.saved.length,0);assert.equal(f.statuses.length,statuses);
});

test('synchronous persist errors release busy state and permit a retry',async()=>{
 let fail=true;const f=fixture({persist:()=>{if(fail)throw Error('synchronous');return Promise.resolve({revision:2});}});f.edit('80');await f.controller.flush();assert.equal(f.controller.isSaving(),false);fail=false;await f.controller.flush();assert.equal(f.controller.dirty(),false);
});

// Minimal DOM for the recovery prompt: it exercises actual button callbacks and
// the revision gate without browser/network dependencies.
class Node extends EventTarget {
 constructor(tag){super();this.tagName=tag;this.children=[];this.attributes={};this.textContent='';}
 setAttribute(k,v){this.attributes[k]=v;}
 append(...nodes){this.children.push(...nodes);}
 showModal(){}
 close(){this.dispatchEvent(new Event('close'));}
 remove(){this.removed=true;}
}
function documentFixture(){return {body:new Node('body'),createElement:tag=>new Node(tag)};}
function buttons(root){const dialog=root.body.children.at(-1);return dialog.children.at(-1).children;}

test('matching revision recovery requires explicit selection and schedules restored data',async()=>{
 const storage=new Storage(),old=fixture({storage,writerId:'old'});old.edit('91');old.controller.dispose();const f=fixture({storage,writerId:'new'}),root=documentFixture();let restored=0;
 const result=showDraftRecovery(f.controller,{revision:1,root,restore:snapshot=>{restored++;f.set(snapshot);}});assert.equal(restored,0);assert.equal(f.calls.length,0);buttons(root).find(b=>b.textContent==='Recuperar alterações').onclick();await result;
 assert.equal(restored,1);assert.equal(f.snapshot.answers.employees,'91');f.timers.tick(1000);await settle();assert.equal(f.calls.length,1);
});

test('stale recovery cannot be applied and continuing retains the old copy',async()=>{
 const storage=new Storage(),old=fixture({storage,writerId:'old'});old.edit('92');old.controller.dispose();const f=fixture({storage,writerId:'new'}),root=documentFixture();let restored=0;
 const result=showDraftRecovery(f.controller,{revision:2,root,restore:()=>restored++});assert.equal(buttons(root).some(b=>b.textContent==='Recuperar alterações'),false);buttons(root).find(b=>b.textContent==='Continuar com a versão do servidor').onclick();await result;
 assert.equal(restored,0);assert.equal(storage.length,1);f.timers.tick(2000);await settle();assert.equal(f.calls.length,0);
});

test('recovery scans ignore expired and malformed entries without leaking other account copies',()=>{
 const storage=new Storage(),f=fixture({storage});f.edit('93');storage.setItem('gro-draft-recovery:v1:broken','not json');
 assert.equal(findDraftRecovery(scope,{storage,now:1000+8*86400000}).length,0);assert.equal(findDraftRecovery({...scope,userId:'unrelated'},{storage,now:1000}).length,0);
});

test('recovering with storage quota failure retains original durable copy until server confirms',async()=>{
 const storage=new Storage(),old=fixture({storage,writerId:'old'});old.edit('94');old.controller.dispose();const f=fixture({storage,writerId:'new'}),root=documentFixture();f.online=false;
 const result=showDraftRecovery(f.controller,{revision:1,root,restore:snapshot=>f.set(snapshot)});storage.fail=true;buttons(root).find(b=>b.textContent==='Recuperar alterações').onclick();await result;
 assert.equal(storage.length,1);assert.equal(findDraftRecovery(scope,{storage,now:1000})[0].snapshot.answers.employees,'94');assert.match(f.statuses.at(-1).message,/Não foi possível guardar/);
 f.online=true;await f.controller.flush();assert.equal(f.controller.dirty(),false);assert.equal(storage.length,0);
});

test('pagehide writes latest model even when no change event has yet run',()=>{
 const f=fixture();f.set({answers:{employees:'95'}});f.events.dispatchEvent(new Event('pagehide'));assert.equal(findDraftRecovery(scope,{storage:f.storage,now:1000})[0].snapshot.answers.employees,'95');assert.equal(f.calls.length,0);
});

test('access errors block repeated writes as strictly as revision conflicts',async()=>{
 let count=0;const f=fixture({persist:async()=>{count++;throw Object.assign(Error('Acesso alterado'),{code:'DRAFT_ACCESS'});}});f.edit('96');await f.controller.flush();f.edit('97');f.events.dispatchEvent(new Event('online'));await f.controller.flush();assert.equal(count,1);assert.equal(f.controller.isBlocked(),true);assert.equal(f.storage.length,1);
});

test('reverting to baseline during in-flight save checkpoints reverted value before response',async()=>{
 const pending=[],requests=[];const f=fixture({persist:async snapshot=>{requests.push(copy(snapshot));const wait=deferred();pending.push(wait);await wait.promise;return {revision:requests.length+1};}});
 f.edit('changed');const request=f.controller.flush();await settle();f.edit('10');assert.equal(f.controller.dirty(),false);
 assert.equal(findDraftRecovery(scope,{storage:f.storage,now:1000})[0].snapshot.answers.employees,'10');
 pending[0].resolve();await settle();assert.equal(pending.length,2);assert.equal(requests[1].answers.employees,'10');pending[1].resolve();await request;assert.equal(f.controller.dirty(),false);assert.equal(f.storage.length,0);
});

test('pagehide checkpoints reverted value while earlier write is in-flight even without changed notification',async()=>{
 const wait=deferred(),f=fixture({persist:()=>wait.promise});f.edit('changed');const request=f.controller.flush();await settle();f.set({answers:{employees:'10'},visit_responsible_id:null});assert.equal(f.controller.dirty(),false);
 f.events.dispatchEvent(new Event('pagehide'));assert.equal(findDraftRecovery(scope,{storage:f.storage,now:1000})[0].snapshot.answers.employees,'10');
 f.controller.dispose();wait.resolve({revision:2});await request;
});

test('photo gate reached between serialized requests schedules retry after upload clears',async()=>{
 let allowed=true;const pending=[],requests=[];const f=fixture({canSave:()=>allowed,persist:async snapshot=>{requests.push(copy(snapshot));const wait=deferred();pending.push(wait);await wait.promise;return {revision:requests.length+1};}});
 f.edit('101');const first=f.controller.flush();await settle();f.edit('102');allowed=false;pending[0].resolve();await first;
 assert.equal(requests.length,1);assert.equal(f.statuses.at(-1).state,'waiting');assert.equal(f.controller.dirty(),true);assert.ok(f.timers.size()>0);
 allowed=true;f.timers.tick(1000);await settle();assert.equal(requests.length,2);assert.equal(requests[1].answers.employees,'102');pending[1].resolve();await settle();assert.equal(f.controller.dirty(),false);
});

test('auth disposal closes recovery modal and makes restore/download/discard callbacks inert',async()=>{
 const storage=new Storage(),old=fixture({storage,writerId:'old'});old.edit('private');old.controller.dispose();const f=fixture({storage,writerId:'new'}),root=documentFixture();let restored=0;
 const promise=showDraftRecovery(f.controller,{revision:1,root,restore:()=>restored++});const dialog=root.body.children.at(-1),actions=buttons(root);assert.equal(dialog.removed,undefined);
 f.controller.dispose();await promise;assert.equal(dialog.removed,true);assert.equal(f.controller.isDisposed(),true);
 for(const label of ['Recuperar alterações','Baixar cópia para comparar','Descartar esta cópia local'])actions.find(button=>button.textContent===label).onclick();
 assert.equal(restored,0);assert.equal(storage.length,1);assert.equal(f.timers.size(),0);assert.equal(f.calls.length,0);
});
