import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {PROFESSIONAL_ROLES,professionalRoleLabel,professionalRegistrationLabel,isEligibleProfessional,reportProfessionalIdentity} from '../professional-identity.js';
import {loadEligibleProfessionals,createVisitResponsiblePicker} from '../visit-responsible.js';
import {saveAssessment,completeAssessment} from '../assessment-data.js';
import {reusedAnswers} from '../reuse-report.js';

const technician={user_id:'tech',display_name:'Técnica sintética',active:true,team_id:'team',role:'editor',professional_role:'safety_technician',professional_registration:'12345',professional_registration_uf:null};
const engineer={...technician,user_id:'eng',display_name:'Engenheiro sintético',professional_role:'safety_engineer',professional_registration:'67890',professional_registration_uf:'SP'};
const assistant={...technician,user_id:'assistant',role:'admin',is_super_admin:true,professional_role:'safety_assistant'};
const teams=[{id:'team',active:true},{id:'global',active:true,grants_global_access:true},{id:'other',active:true}];
function clientFor({people=[technician,engineer,assistant],availableTeams=teams,fail=false}={}){
 const calls=[];
 const client={from(table){const filters=[],q={select(fields){calls.push({table,fields,filters});return q;},eq(key,value){filters.push([key,value]);return q;},in(key,value){filters.push([key,value]);return q;},order(){return q;},range(a,b){q.bounds=[a,b];return q;},maybeSingle(){return Promise.resolve(result());},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};
 function result(){if(fail)return {error:{message:'offline'}};if(table==='clients')return {data:{team_id:'team'}};if(table==='teams')return {data:availableTeams};return {data:people};}return q;}};
 return {client,calls};
}
function picker(t,options={}){
 const dom=new JSDOM('<select id="visit-responsible"></select><p id="visit-responsible-status"></p><button id="reload-visit-responsible"></button>');t.after(()=>dom.window.close());
 const f=clientFor(options);const control=createVisitResponsiblePicker({client:f.client,clientId:'company',selectedId:options.selectedId,root:dom.window.document});
 return {...f,dom,control,select:dom.window.document.querySelector('select'),status:dom.window.document.querySelector('p')};
}

test('professional labels and registrations never replace or infer access roles',()=>{
 assert.deepEqual(Object.keys(PROFESSIONAL_ROLES),['safety_technician','safety_engineer','safety_assistant']);
 assert.equal(professionalRoleLabel('constructor'),'Função profissional não informada');assert.equal(professionalRoleLabel('__proto__'),'Função profissional não informada');
 assert.equal(professionalRegistrationLabel(technician),'Registro MTE: 12345');assert.equal(professionalRegistrationLabel(engineer),'CREA/SP: 67890');assert.equal(professionalRegistrationLabel(assistant),'');
 assert.equal(technician.role,'editor');assert.equal(assistant.role,'admin');
});
test('auxiliary and unknown profession are never eligible, regardless of admin or registration',()=>{
 assert.equal(isEligibleProfessional(technician),true);assert.equal(isEligibleProfessional(engineer),true);
 for(const member of [assistant,{...technician,professional_role:null,role:'admin'},{...technician,professional_registration:' '},{...technician,active:false},{...engineer,professional_registration_uf:null},{...engineer,professional_registration_uf:'XX'}])assert.equal(isEligibleProfessional(member),false);
});
test('visible candidate query is restricted to the client team and visible global team',async()=>{
 const f=clientFor();const members=await loadEligibleProfessionals(f.client,'company');assert.deepEqual(members.map(x=>x.user_id),['tech','eng']);
 const query=f.calls.find(call=>call.table==='team_members');assert.ok(query.filters.some(([key,value])=>key==='team_id'&&JSON.stringify(value)==='["team","global"]'));assert.ok(query.filters.some(([key,value])=>key==='professional_role'&&JSON.stringify(value)==='["safety_technician","safety_engineer"]'));
 assert.equal(f.calls[0].filters[0][0],'id');assert.equal(f.calls[0].filters[0][1],'company');
});
test('new draft never auto-assigns even an eligible operator; selection is explicit',async t=>{
 const f=picker(t);await f.control.refresh();assert.equal(f.control.value(),null);assert.equal(f.control.summary().valid,false);assert.equal(f.control.validate(),false);
 assert.equal(f.select.options.length,3);assert.doesNotMatch(f.select.textContent,/Auxiliar/);
 f.select.value='eng';f.select.dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.control.value(),'eng');assert.equal(f.control.validate(),true);assert.match(f.control.summary().label,/CREA\/SP/);
});
test('unavailable/stale responsible remains in draft and is not silently replaced',async t=>{
 const f=picker(t,{selectedId:'inactive-id'});await f.control.refresh();assert.equal(f.control.value(),'inactive-id');assert.equal(f.select.selectedOptions[0].disabled,true);assert.equal(f.control.validate(),false);assert.match(f.status.textContent,/Auxiliares podem preencher/);
 f.select.value='';f.select.dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.control.value(),null);
});
test('candidate network error preserves persisted responsible without claiming eligibility',async t=>{
 const f=picker(t,{selectedId:'tech',fail:true});await f.control.refresh();assert.equal(f.control.value(),'tech');assert.equal(f.control.summary().valid,false);assert.match(f.status.textContent,/rascunho continuam disponíveis/);assert.equal(f.select.disabled,false);
});
test('untrusted names and registration render only as text',async t=>{
 const f=picker(t,{people:[{...technician,display_name:'<img src=x onerror=alert(1)>',professional_registration:'<script>oops</script>'}]});await f.control.refresh();assert.equal(f.select.querySelector('img,script'),null);assert.match(f.select.textContent,/<script>oops/);
});
test('report identity uses the immutable snapshot, never current operator or current credentials',()=>{
 const snapshot={user_id:'eng',display_name:'Responsável original',professional_role:'safety_engineer',registration_type:'CREA',registration_number:'1234',registration_uf:'RJ'};
 const row={team_members:{display_name:'Operador alterado',professional_role:'safety_assistant',professional_registration:'9999'},final_snapshot:{responsible_professional:snapshot}};
 const copy=structuredClone(row);assert.deepEqual(reportProfessionalIdentity(row),{name:'Responsável original',role:'Engenheiro de Segurança do Trabalho',registration:'CREA/RJ: 1234',frozen:true});assert.deepEqual(row,copy);
 delete row.final_snapshot.responsible_professional;assert.deepEqual(reportProfessionalIdentity(row),{name:'Operador alterado',role:'',registration:'',frozen:false});
});
test('draft/complete payload sends actual responsible separately and retains operator ownership',async()=>{
 const payloads=[];const q={insert(value){payloads.push(value);return q;},update(value){payloads.push(value);return q;},eq(){return q;},select(){return q;},maybeSingle:async()=>({data:{id:'draft',revision:2,status:'draft'}})};
 const row={id:'draft',client_id:'company',title:'Teste',responsible_id:'assistant',visit_responsible_id:'tech',unsaved:true};
 const saved=await saveAssessment({from:()=>q},row,{});assert.equal(payloads[0].responsible_id,'assistant');assert.equal(payloads[0].visit_responsible_id,'tech');
 await completeAssessment({from:()=>q},saved,{employees:'3'});assert.equal(payloads[1].visit_responsible_id,'tech');assert.equal('responsible_id' in payloads[1],false);assert.equal(payloads[1].status,'completed');
});
test('unknown or auxiliary operator can save an unassigned draft; server failure stays clear',async()=>{
 let payload;const q={insert(value){payload=value;return q;},update(value){payload=value;return q;},eq(){return q;},select(){return q;},maybeSingle:async()=>({data:{id:'draft',revision:1}})};
 await saveAssessment({from:()=>q},{id:'draft',responsible_id:'assistant',unsaved:true},{});assert.equal(payload.visit_responsible_id,null);
 q.maybeSingle=async()=>({error:{code:'23514'}});await assert.rejects(completeAssessment({from:()=>q},{id:'draft',revision:1,visit_responsible_id:'assistant'},{}),/Auxiliares podem preencher, mas não ser responsáveis/);
});
test('reuse never inherits the original responsible or registration through answers',()=>{
 const before={visit_responsible_id:'tech',responsible_professional:{display_name:'Old'},professional_registration:'123',employees:'3',report_document:{}};
 const result=reusedAnswers(before,{legal_name:'Synthetic'});assert.equal(result.visit_responsible_id,undefined);assert.equal(result.responsible_professional,undefined);assert.equal(result.professional_registration,undefined);assert.equal(result.report_document,undefined);assert.equal(result.employees,'3');
});

test('pending refresh cannot validate a stale selection or unlock completion controls',async t=>{
 const f=picker(t,{selectedId:'tech'});await f.control.refresh();let release,started;
 const gate=new Promise(resolve=>release=resolve),start=new Promise(resolve=>started=resolve),from=f.client.from;
 f.client.from=table=>{const q=from(table);if(table==='team_members'){q.then=(resolve,reject)=>{started();return gate.then(()=>({data:[technician]})).then(resolve,reject);};}return q;};
 const refresh=f.control.refresh();await start;assert.equal(f.control.validate(),false);assert.equal(f.control.summary().valid,false);assert.match(f.status.textContent,/Aguarde a consulta/);
 f.control.lock(true);release();await refresh;assert.equal(f.select.disabled,true);assert.equal(f.dom.window.document.querySelector('button').disabled,true);
 f.control.lock(false);assert.equal(f.select.disabled,false);assert.equal(f.dom.window.document.querySelector('button').disabled,false);assert.equal(f.control.validate(),true);
});
