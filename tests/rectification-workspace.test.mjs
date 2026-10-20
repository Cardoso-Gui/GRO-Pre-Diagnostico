import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM,VirtualConsole} from 'jsdom';
import {fixture} from './helpers/rectification-fixture.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const runtimeFiles=['cnae-descriptions.js','cnae-risk-map.js','esocial-risk-table.js','occupational-risk-table.js','training-rules.js','nr-report-rules.js','dimension-data.js','report-opening.js','visit-date.js','script.js'];
async function workspace(t,{state=fixture(),write,preflight,interruptDuringRuntime=false}={}){
 const dom=new JSDOM(read('rectify.html'),{url:'https://synthetic.example.test/rectify.html?id='+fixture().assessment.id,runScripts:'outside-only',virtualConsole:new VirtualConsole()});t.after(()=>dom.window.close());
 const win=dom.window,context=dom.getInternalVMContext(),calls=[],member={user_id:'synthetic-user',display_name:'Pessoa sintética',role:'admin',team_id:'synthetic-team'};
 context.structuredClone=structuredClone;win.HTMLElement.prototype.scrollIntoView=()=>{};win.confirm=()=>false;
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new win.Event('close'));};
 let onAccessChanged,onAuthStateChange;
 const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='read_assessment_report')return state?{data:structuredClone(state)}:{error:{code:'42501'}};return write?write(name,args):{data:{...fixture(),sequence:1}};},auth:{onAuthStateChange(fn){onAuthStateChange=fn;},signOut:async()=>{}}};
 const append=win.document.body.append.bind(win.document.body);win.document.body.append=(...nodes)=>{append(...nodes);for(const node of nodes)if(node.tagName==='SCRIPT'&&node.src.includes('workstation-editor')){vm.runInContext(read('workstation-editor.js'),context);queueMicrotask(()=>node.onload());}};
 const stubs={
 'auth-client.js':{authClient:client,getTeamMember:async()=>({member})},
 'app-header.js':{updateHeader(){}},
 'page-resume.js':{watchPageResume(options){onAccessChanged=options.onAccessChanged;}},
 'workstation-photos.js':{photoUrl:async()=>'',uploadPhoto:async()=>({path:'synthetic'})},
 'report-generator.js':{loadQuestionnaireRuntime:async()=>{if(interruptDuringRuntime)onAuthStateChange('SIGNED_OUT');for(const file of runtimeFiles)vm.runInContext(read(file),context,{filename:file});},generateEffectiveDocument:async answers=>{if(preflight)return preflight(answers);return {version:1,children:[]};}}
 };
 const modules=new Map();
 async function module(name){name=name.split('?')[0].replace(/^\.\//,'');if(modules.has(name))return modules.get(name);let result;
  if(stubs[name])result=new vm.SyntheticModule(Object.keys(stubs[name]),function(){for(const [key,value] of Object.entries(stubs[name]))this.setExport(key,value);},{context,identifier:name});
  else result=new vm.SourceTextModule(read(name),{context,identifier:name});modules.set(name,result);await result.link((specifier)=>module(specifier));return result;
 }
 await (await module('rectification-workspace.js')).evaluate();
 const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
 const editDate=()=>{const input=win.document.querySelector('#visit-date');input.value='2024-02-29';input.dispatchEvent(new win.Event('input',{bubbles:true}));};
 const click=async selector=>{win.document.querySelector(selector).click();await flush();};
 return {win,calls,flush,click,editDate,get accessChange(){return onAccessChanged;},get authChange(){return onAuthStateChange;},writes:()=>calls.filter(c=>c.name==='rectify_assessment')};
}

test('cancelar, reabrir e motivo vazio não escrevem no banco',async t=>{
 const f=await workspace(t);f.editDate();await f.click('#save-draft-button');assert.equal(f.win.document.querySelector('#rectification-review').open,true);assert.match(f.win.document.querySelector('#rectification-diff').textContent,/29\/02\/2024/);
 await f.click('#rectification-confirm');assert.equal(f.writes().length,0);assert.match(f.win.document.querySelector('#rectification-save-status').textContent,/motivo/);
 await f.click('#rectification-back');assert.equal(f.win.document.querySelector('#rectification-review').open,false);assert.equal(f.win.document.querySelector('#visit-date').value,'2024-02-29');await f.click('#save-draft-button');assert.equal(f.win.document.querySelector('#rectification-review').open,true);assert.equal(f.writes().length,0);
});
test('duplo clique só envia uma retificação, com motivo e sequência originais',async t=>{
 let release;const f=await workspace(t,{write:()=>new Promise(resolve=>{release=resolve;})});f.editDate();await f.click('#save-draft-button');f.win.document.querySelector('#rectification-reason').value='Corrigir data sintética';
 f.win.document.querySelector('#rectification-confirm').click();f.win.document.querySelector('#rectification-confirm').click();await f.flush();assert.equal(f.writes().length,1);assert.equal(f.writes()[0].args.p_expected_sequence,0);assert.equal(f.writes()[0].args.p_reason,'Corrigir data sintética');assert.equal(f.win.document.querySelector('#rectification-back').disabled,true);
 const cancel=new f.win.Event('cancel',{cancelable:true});f.win.document.querySelector('#rectification-review').dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);release({data:{...fixture(),sequence:1}});await f.flush();
});
test('falha incerta mantém edição e retry reutiliza mesmo identificador',async t=>{
 const f=await workspace(t,{write:async()=>({error:{code:'network'}})});f.editDate();await f.click('#save-draft-button');f.win.document.querySelector('#rectification-reason').value='Corrigir data sintética';await f.click('#rectification-confirm');await f.click('#rectification-confirm');assert.equal(f.writes().length,2);assert.equal(f.writes()[0].args.p_request_id,f.writes()[1].args.p_request_id);assert.equal(f.win.document.querySelector('#visit-date').value,'2024-02-29');assert.match(f.win.document.querySelector('#rectification-save-status').textContent,/Não foi possível confirmar/);
});
test('upload pendente impede revisão e confirmação sem omitir arquivo silenciosamente',async t=>{
 const f=await workspace(t);f.editDate();f.win.GRO_POSTS.busy=()=>true;await f.click('#save-draft-button');assert.equal(f.win.document.querySelector('#rectification-review').open,false);assert.match(f.win.document.querySelector('#cloud-status').textContent,/envio das fotos/);
 f.win.GRO_POSTS.busy=()=>false;await f.click('#save-draft-button');f.win.GRO_POSTS.busy=()=>true;f.win.document.querySelector('#rectification-reason').value='Teste sintético';await f.click('#rectification-confirm');assert.equal(f.writes().length,0);
});
test('mudança posterior à revisão impede salvar patch antigo',async t=>{
 const f=await workspace(t);f.editDate();await f.click('#save-draft-button');f.win.document.querySelector('#visit-date').value='2024-03-01';f.win.document.querySelector('#rectification-reason').value='Teste sintético';await f.click('#rectification-confirm');assert.equal(f.writes().length,0);assert.match(f.win.document.querySelector('#rectification-save-status').textContent,/dados mudaram/);
});
test('revogação fecha diálogo, bloqueia controles e mostra aviso visível',async t=>{
 const f=await workspace(t);f.editDate();await f.click('#save-draft-button');f.accessChange();assert.equal(f.win.document.querySelector('#rectification-review').open,false);assert.equal(f.win.document.querySelector('#protected-workspace').hidden,true);assert.equal(f.win.document.querySelector('#session-check').hidden,false);assert.match(f.win.document.querySelector('#session-check p').textContent,/acesso mudou/);await f.click('#rectification-confirm');assert.equal(f.writes().length,0);
});
test('sem permissão ou falha de histórico não mostra questionário',async t=>{
 for(const state of [{...fixture(),can_rectify:false},null]){const f=await workspace(t,{state});assert.equal(f.win.document.querySelector('#protected-workspace').hidden,true);assert.equal(f.win.document.querySelector('#session-check').hidden,false);assert.equal(f.writes().length,0);}
});
test('erro do gerador é bloqueante antes da confirmação ou gravação',async t=>{
 const f=await workspace(t,{preflight:async()=>{throw Error('Gerador sintético indisponível');}});f.editDate();await f.click('#save-draft-button');assert.equal(f.win.document.querySelector('#rectification-review').open,false);assert.match(f.win.document.querySelector('#cloud-status').textContent,/Gerador sintético indisponível/);assert.equal(f.writes().length,0);
});

test('revogação durante validação assíncrona não reabre diálogo',async t=>{
 let release;const f=await workspace(t,{preflight:()=>new Promise(resolve=>{release=resolve;})});f.editDate();f.win.document.querySelector('#save-draft-button').click();await f.flush();f.accessChange();release({version:1,children:[]});await f.flush();assert.equal(f.win.document.querySelector('#rectification-review').open,false);assert.equal(f.win.document.querySelector('#session-check').hidden,false);assert.equal(f.writes().length,0);
});
test('mudança estrutural sem evento ainda aciona proteção de saída',async t=>{
 const f=await workspace(t);f.win.GRO_FORM.snapshot().jobsBySector[0][1][0].activities='Atividade alterada sem evento';const event=new f.win.Event('beforeunload',{cancelable:true});f.win.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
});
test('descarte confirmado não repete aviso beforeunload',async t=>{
 const f=await workspace(t);f.editDate();f.win.confirm=()=>true;await f.click('.session-home');const event=new f.win.Event('beforeunload',{cancelable:true});f.win.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
});
test('retificação de data não é bloqueada por pendências antigas na etapa final',async t=>{
 const state=fixture();state.assessment.final_snapshot.answers.riskSourcesBySelection=[];const f=await workspace(t,{state});f.editDate();f.win.GRO_WIZARD.go(6);assert.equal(f.win.document.querySelector('#generate-report-button').disabled,false);await f.click('#generate-report-button');assert.equal(f.win.document.querySelector('#rectification-review').open,true);
});

test('sair durante carregamento inicial não revela questionário depois',async t=>{
 const f=await workspace(t,{interruptDuringRuntime:true});assert.equal(f.win.document.querySelector('#protected-workspace').hidden,true);assert.equal(f.win.document.querySelector('#session-check').hidden,false);assert.match(f.win.document.querySelector('#session-check p').textContent,/acesso mudou/);
});

test('detalhamento inline fica visível só na etapa de riscos da retificação, sem escrever',async t=>{
 const f=await workspace(t),doc=f.win.document;
 for(const file of ['styles.css','workspace.css','assessment-wizard.css','rectification.css']){const style=doc.createElement('style');style.textContent=read(file);doc.head.append(style);}
 const section=doc.querySelector('#risk-source-section'),card=doc.querySelector('.rectification-risk');
 assert.equal(f.win.getComputedStyle(section).display,'none');
 f.win.GRO_WIZARD.go(4);assert.equal(f.win.getComputedStyle(section).display,'block');assert.equal(section.hidden,false);
 await f.click('.target-risk-details');assert.equal(card.open,true);assert.equal(doc.activeElement,card.querySelector('summary'));assert.equal(f.writes().length,0);
 f.win.GRO_WIZARD.go(5);assert.equal(f.win.getComputedStyle(section).display,'none');
 f.win.GRO_WIZARD.go(4);section.hidden=true;assert.equal(f.win.getComputedStyle(section).display,'none');section.hidden=false;
 doc.body.classList.remove('rectification-page');assert.equal(f.win.getComputedStyle(section).display,'none');
 assert.match(read('rectify.html'),/rectification\.css\?v=20261020-review1/);
});

test('revisão usa rótulo amigável, data brasileira e referência técnica sem mudar o payload',async t=>{
 const f=await workspace(t),doc=f.win.document;f.editDate();await f.click('#save-draft-button');
 assert.equal(doc.querySelector('.rectification-diff-item h3').textContent,'Data da visita');
 assert.equal(doc.querySelector('.rectification-diff-values .before p').textContent,'Não informado');
 assert.equal(doc.querySelector('.rectification-diff-values .after p').textContent,'29/02/2024');
 assert.equal(doc.querySelector('.rectification-field-reference code').textContent,'answers.visitDate');
 assert.equal(doc.querySelector('#rectification-change-count').textContent,'1 alteração para conferir');
 assert.equal(doc.querySelector('#rectification-reason').required,true);assert.equal(doc.querySelector('#rectification-reason').maxLength,1000);
 assert.equal(doc.querySelector('#rectification-review').getAttribute('aria-describedby'),'rectification-review-description');
 doc.querySelector('#rectification-reason').value='Justificativa sintética preservada';await f.click('#rectification-confirm');
 assert.equal(f.writes()[0].args.p_changes.answers.visitDate,'2024-02-29');assert.equal(f.writes()[0].args.p_reason,'Justificativa sintética preservada');
});

test('texto da comparação permanece literal e botões têm hierarquia visual distinta',async t=>{
 const f=await workspace(t),doc=f.win.document;const title=doc.querySelector('#rectification-identity input');
 const value='<img src=x onerror=alert(1)> & texto completo';title.value=value;title.dispatchEvent(new f.win.Event('input',{bubbles:true}));await f.click('#save-draft-button');
 assert.equal(doc.querySelector('.rectification-diff-values .after p').textContent,value);assert.equal(doc.querySelector('#rectification-diff img'),null);assert.equal(f.writes().length,0);
 for(const file of ['styles.css','rectification.css']){const style=doc.createElement('style');style.textContent=read(file);doc.head.append(style);}
 assert.notEqual(f.win.getComputedStyle(doc.querySelector('#rectification-back')).backgroundColor,f.win.getComputedStyle(doc.querySelector('#rectification-confirm')).backgroundColor);
 assert.equal(f.win.getComputedStyle(doc.querySelector('#rectification-back')).minHeight,'44px');
});
