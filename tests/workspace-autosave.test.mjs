import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createDraftAutosave,findDraftRecovery} from '../draft-autosave.js';
const source=fs.readFileSync(new URL('../workspace.js',import.meta.url),'utf8');
class Storage{constructor(){this.data=new Map()}get length(){return this.data.size}key(i){return [...this.data.keys()][i]}getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,v)}removeItem(k){this.data.delete(k)}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(overrides={}){
 const storage=new Storage(),writes=[],status=[],elements=new Map();let answers={employees:'10'},busy=false,online=true;
 const $=selector=>{if(!elements.has(selector))elements.set(selector,{disabled:false,textContent:'',dataset:{}});return elements.get(selector)};
 const ctx=vm.createContext({$,saving:false,accessEnded:false,dirty:false,cleanState:'',member:{user_id:'u',team_id:'t'},row:{id:'d',client_id:'c',responsible_id:'u',status:'draft',revision:1,answers:{employees:'10'}},visitResponsiblePicker:{value:()=> 'tech'},GRO_FORM:{snapshot:()=>answers},GRO_POSTS:{busy:()=>busy},captureDraftInputs:()=>({}),fingerprint:()=>JSON.stringify(answers),say:(...args)=>status.push(args),authClient:{},access:async()=>{},history:{replaceState(){}},encodeURIComponent,autosave:null,saveAssessment:async(_,row,answers)=>{writes.push({row,answers});return {...row,revision:row.revision+1,answers}},...overrides});
 ctx.createDraftAutosave=options=>createDraftAutosave({...options,storage,events:new EventTarget(),isOnline:()=>online,writerId:'test',delay:1e6});
 const start=source.indexOf(' const owner=');const end=source.indexOf(' autosave.initialize();',start)+' autosave.initialize();'.length;
 vm.runInContext(source.slice(start,end),ctx);
 return {ctx,storage,writes,status,elements,setAnswers(next){answers=next},setBusy(value){busy=value},setOnline(value){online=value},close(){ctx.autosave.dispose()}};
}
test('wizard autosave snapshot includes current answers and visit responsible, scoped by all identifiers',async()=>{
 const f=fixture();f.setAnswers({employees:'11'});f.ctx.autosave.changed();const local=findDraftRecovery({userId:'u',teamId:'t',clientId:'c',draftId:'d',page:'wizard'},{storage:f.storage});assert.equal(local.length,1);assert.equal(local[0].snapshot.visit_responsible_id,'tech');
 await f.ctx.autosave.flush();assert.equal(f.writes[0].answers.employees,'11');assert.equal(f.writes[0].row.visit_responsible_id,'tech');assert.equal(f.ctx.row.revision,2);assert.equal(f.ctx.saving,false);assert.equal(f.ctx.autosave.dirty(),false);f.close();
});
test('wizard local checkpoint precedes server save and offline edits do not write server',async()=>{
 const f=fixture();f.setOnline(false);f.setAnswers({employees:'12'});f.ctx.autosave.changed();assert.equal(f.storage.length,1);assert.equal(await f.ctx.autosave.flush(),null);assert.equal(f.writes.length,0);assert.equal(f.ctx.autosave.dirty(),true);f.close();
});
test('wizard queued second edit uses returned revision and preserves newest answers',async()=>{
 let resolveFirst;let calls=0;const revisions=[];const f=fixture({saveAssessment:async(_,row,answers)=>{revisions.push(row.revision);if(++calls===1)await new Promise(resolve=>resolveFirst=resolve);return {...row,revision:row.revision+1,answers}}});
 f.setAnswers({employees:'11'});f.ctx.autosave.changed();const first=f.ctx.autosave.flush();await tick();assert.equal(f.ctx.saving,true);f.setAnswers({employees:'12'});f.ctx.autosave.changed();const manual=f.ctx.autosave.flush();resolveFirst();await Promise.all([first,manual]);assert.deepEqual(revisions,[1,2]);assert.equal(f.ctx.row.answers.employees,'12');assert.equal(f.ctx.autosave.dirty(),false);f.close();
});
test('wizard revalidates access before any write and retains local data on transient failure',async()=>{
 const f=fixture({access:async()=>{throw Error('network')}});f.setAnswers({employees:'12'});f.ctx.autosave.changed();assert.equal(await f.ctx.autosave.flush(),null);assert.equal(f.writes.length,0);assert.equal(f.storage.length,1);assert.equal(f.ctx.saving,false);assert.equal(f.ctx.row.revision,1);f.close();
});
test('wizard does not save text while photo upload is busy',async()=>{
 const f=fixture();f.setBusy(true);f.setAnswers({employees:'12'});f.ctx.autosave.changed();assert.equal(await f.ctx.autosave.flush(),null);assert.equal(f.writes.length,0);assert.equal(f.storage.length,1);f.setBusy(false);await f.ctx.autosave.flush();assert.equal(f.writes.length,1);f.close();
});
test('wizard missing-record fallback only accepts same-account new-draft metadata',async()=>{
 const start=source.indexOf(' if(!data){const local=');const end=source.indexOf(" if(!data)throw Error('Levantamento não encontrado",start);
 assert.ok(start>=0,'fallback branch must be tested');
 const statement=source.slice(start,end);
 for(const [metadata,expected] of [[{id:'d',client_id:'c',responsible_id:'u',unsaved:true},true],[{id:'d',client_id:'c',responsible_id:'other',unsaved:true},false],[{id:'other',client_id:'c',responsible_id:'u',unsaved:true},false],[{id:'d',client_id:'other',responsible_id:'u',unsaved:true},false],[{id:'d',client_id:'c',responsible_id:'u',unsaved:false},false]]){
  let queried;const ctx=vm.createContext({data:null,id:'d',member:{user_id:'u',team_id:'t'},findDraftRecovery:scope=>{queried=scope;return [{metadata,scope:{clientId:'c'}}]},authClient:{from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'c'}})})}});await vm.runInContext('(async()=>{'+statement+'})()',ctx);assert.equal(Boolean(ctx.data),expected);assert.equal(queried.userId,'u');assert.equal(queried.teamId,'t');assert.equal(queried.draftId,'d');
 }
});
test('wizard access change rejects account/team/ownership swaps before replacing member',async()=>{
 const start=source.indexOf('async function access()');const end=source.indexOf('const clientChoices',start);
 for(const changed of [{user_id:'other',team_id:'t',role:'admin'},{user_id:'u',team_id:'other',role:'admin'},{user_id:'u',team_id:'t',role:'editor'}]){
  let disposed=false;const ctx=vm.createContext({getTeamMember:async()=>({member:changed}),member:{user_id:'u',team_id:'t'},row:{responsible_id:'owner'},autosave:{dispose(){disposed=true}},workspace:{hidden:false},accessEnded:false,dirty:true,login(){},updateHeader(){},$:()=>({})});vm.runInContext(source.slice(start,end),ctx);await assert.rejects(ctx.access(),e=>e.code==='DRAFT_ACCESS');assert.equal(disposed,true);assert.equal(ctx.workspace.hidden,true);assert.equal(ctx.accessEnded,true);assert.equal(ctx.member.user_id,'u');
 }
});
test('wizard leave confirmation pauses autosave, resumes on cancel, and discards only after explicit leave',()=>{
 const handlers=new Map(),events=[],dialog={showModal:()=>events.push('show'),close:()=>events.push('close'),addEventListener:(name,fn)=>handlers.set('dialog:'+name,fn)};
 const ctx=vm.createContext({dirty:true,saving:false,autosave:{isSaving:()=>false,pause:()=>events.push('pause'),resume:()=>events.push('resume'),discard:()=>events.push('discard'),dispose:()=>events.push('dispose')},$:selector=>selector==='#leave-dialog'?dialog:{addEventListener:(name,fn)=>handlers.set(selector+':'+name,fn)},document:{querySelector:()=>({addEventListener:(name,fn)=>handlers.set('home:'+name,fn)})},refreshDirty(){},say(){},location:{assign:()=>events.push('navigate')}});
 const start=source.indexOf("const leaveDialog=$('#leave-dialog')");const end=source.indexOf('async function initialize()',start);vm.runInContext(source.slice(start,end),ctx);
 handlers.get('home:click')({preventDefault(){}});assert.deepEqual(events,['pause','show']);handlers.get('dialog:cancel')();assert.equal(events.at(-1),'resume');handlers.get('#leave-without-saving:click')();assert.deepEqual(events.slice(-4),['discard','dispose','close','navigate']);assert.equal(ctx.dirty,false);
});
test('wizard beforeunload continues warning for pending local-only data',()=>{
 let callback;const ctx=vm.createContext({dirty:true,saving:false,window:{addEventListener:(_,fn)=>callback=fn}});const start=source.indexOf("window.addEventListener('beforeunload'");vm.runInContext(source.slice(start,source.indexOf('\n',start)),ctx);const event={preventDefault(){this.prevented=true}};callback(event);assert.equal(event.prevented,true);assert.equal(event.returnValue,'');
});
test('wizard initialization never reveals form if session changes during recovery/load',async()=>{
 const ctx=vm.createContext({loading:false,loaded:false,accessEnded:false,workspace:{hidden:false},notice:{hidden:true,querySelector:()=>({})},access:async()=>{},loadForm:async()=>{ctx.accessEnded=true;}});
 const start=source.indexOf('async function initialize()');const end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end),ctx);await ctx.initialize();assert.equal(ctx.workspace.hidden,true);assert.equal(ctx.loading,false);
});
test('wizard local new-draft recovery refuses a client hidden by current access rules',async()=>{
 const start=source.indexOf(' if(!data){const local=');const end=source.indexOf(" if(!data)throw Error('Levantamento não encontrado",start);const statement=source.slice(start,end);
 for(const result of [{data:null},{error:{message:'network'}}]){
  const ctx=vm.createContext({data:null,id:'d',member:{user_id:'u',team_id:'t'},findDraftRecovery:()=>[{metadata:{id:'d',client_id:'c',responsible_id:'u',unsaved:true},scope:{clientId:'c'}}],authClient:{from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>result})}});
  await assert.rejects(vm.runInContext('(async()=>{'+statement+'})()',ctx),/acesso à empresa/);assert.equal(ctx.data,null);
 }
});
import {JSDOM} from 'jsdom';
import {captureDraftInputs,restoreDraftInputs} from '../draft-form-state.js';
test('wizard staged Add fields roundtrip without becoming registered entities',()=>{
 const dom=new JSDOM('<input id="custom-sector-input" maxlength="80"><input id="ghe-name-input" maxlength="120"><article class="job-card"><h3>Recepção</h3><form hidden class="job-form"><input name="jobName" maxlength="100"><input name="quantity" type="number"><textarea name="activities" maxlength="2000"></textarea></form></article>');const doc=dom.window.document;
 doc.querySelector('#custom-sector-input').value='Novo setor';doc.querySelector('#ghe-name-input').value='Grupo A';const form=doc.querySelector('form');form.elements.jobName.value='Auxiliar';form.elements.quantity.value='2';form.elements.activities.value='Atende pessoas';const snapshot=captureDraftInputs(doc);
 form.reset();doc.querySelector('#custom-sector-input').value='';doc.querySelector('#ghe-name-input').value='';restoreDraftInputs(snapshot,doc);assert.equal(doc.querySelector('#custom-sector-input').value,'Novo setor');assert.equal(doc.querySelector('#ghe-name-input').value,'Grupo A');assert.equal(form.elements.jobName.value,'Auxiliar');assert.equal(form.elements.quantity.value,'2');assert.equal(form.elements.activities.value,'Atende pessoas');assert.equal(form.hidden,false);assert.equal(doc.querySelectorAll('.job-edit-row').length,0);dom.window.close();
});
test('wizard staged recovery constrains lengths and never creates missing sector or arbitrary fields',()=>{
 const dom=new JSDOM('<input id="custom-sector-input" maxlength="4"><input id="unrelated"><article class="job-card"><h3>Atual</h3><form class="job-form"><input name="jobName" maxlength="3"></form></article>');const doc=dom.window.document;
 restoreDraftInputs({fields:{'custom-sector-input':'123456','unrelated':'changed'},jobs:[{sector:'Ausente',values:{jobName:'Ghost'}},{sector:'Atual',values:{jobName:'Long name'}}]},doc);assert.equal(doc.querySelector('#custom-sector-input').value,'1234');assert.equal(doc.querySelector('#unrelated').value,'');assert.equal(doc.querySelector('[name=jobName]').value,'Lon');assert.equal(doc.querySelectorAll('.job-card').length,1);dom.window.close();
});
