import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import '../visit-date.js';
import {saveAssessment,completeAssessment} from '../assessment-data.js';
import {reusedAnswers} from '../reuse-report.js';
import {reportVisitDate} from '../report-viewer.js';
import {installDOM,el} from './helpers/report-dom.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source=read('script.js');
function formFixture(){
 const dimensionInputs={'#preponderant-risk':{value:''},'#health-establishment':{checked:false}};
 const context=vm.createContext({input:{value:''},visitDateInput:{value:''},employeeCountInput:{value:''},currentCompany:null,currentRiskGrade:0,collapsedJobSectors:new Set(),
  document:{querySelector:selector=>dimensionInputs[selector]},selectedSectorNames:new Set(),jobsBySector:new Map(),selectedRiskMode:'',gheList:[],selectedRisksByTarget:new Map(),riskSourcesBySelection:new Map(),epiBySelection:new Map(),
  GRO_VISIT_DATE:globalThis.GRO_VISIT_DATE,sectorOptions:{},clearCheckboxes(){},addSectorOption(){},renderCompany(){},renderJobSections(){},renderRiskModeSummary(){},renderRiskSelection(){},setRiskModeInput(){},restoreMapOfSets(){},mapOfSetsToArray:map=>[...map].map(([key,value])=>[key,[...value]])});
 vm.runInContext(source.slice(source.indexOf('function getDraft()'),source.indexOf('function saveDraft()'))+source.slice(source.indexOf('function restoreDraft('),source.indexOf('function setRiskModeInput(')),context);
 return context;
}
function fakeClient(){
 const writes=[];let payload;
 const query={insert(value){payload=value;writes.push({kind:'insert',value});return this;},update(value){payload=value;writes.push({kind:'update',value});return this;},eq(){return this;},select(){return this;},async maybeSingle(){return {data:{id:'synthetic-assessment',revision:writes.length,status:payload.status||'draft'}};}};
 return {client:{from:()=>query},writes};
}

test('data explícita é capturada, salva, reaberta e preservada ao concluir',async()=>{
 const form=formFixture();form.visitDateInput.value='2024-02-29';
 const answers=form.getDraft();assert.equal(answers.visitDate,'2024-02-29');
 const fake=fakeClient(),row={id:'synthetic-assessment',client_id:'synthetic-client',responsible_id:'synthetic-user',title:'Visita sintética',unsaved:true};
 const saved=await saveAssessment(fake.client,row,JSON.parse(JSON.stringify(answers)));
 assert.equal(fake.writes[0].value.answers.visitDate,'2024-02-29');
 const reopened=formFixture();reopened.restoreDraft(saved.answers);assert.equal(reopened.visitDateInput.value,'2024-02-29');
 const updated=await saveAssessment(fake.client,saved,reopened.getDraft());assert.equal(fake.writes[1].kind,'update');assert.equal(updated.answers.visitDate,'2024-02-29');
 const completed=await completeAssessment(fake.client,updated,reopened.getDraft());assert.equal(fake.writes[2].value.status,'completed');assert.equal(completed.answers.visitDate,'2024-02-29');
 assert.equal(reportVisitDate(completed.answers),'29/02/2024');
});

test('legados permanecem em branco e não usam criação, conclusão ou título',()=>{
 const form=formFixture();form.visitDateInput.value='2024-02-29';
 for(const answers of [{},{created_at:'2025-01-01',completed_at:'2025-01-02',title:'Visita 03/01/2025'},{visitDate:'2025-02-30'},{visitDate:'invalid',visit_date:'2024-02-29'},{visitDate:'0000-01-01'}]){
  form.restoreDraft(answers);assert.equal(form.visitDateInput.value,'');assert.equal(form.getDraft().visitDate,'');assert.equal(reportVisitDate(answers),'Não informada');
 }
 form.restoreDraft({visit_date:'2024-02-29'});assert.equal(form.visitDateInput.value,'2024-02-29');assert.equal(form.getDraft().visitDate,'2024-02-29');
 form.restoreDraft({visitDate:'',visit_date:'2024-02-29'});assert.equal(form.visitDateInput.value,'');assert.equal(reportVisitDate({visitDate:'',visit_date:'2024-02-29'}),'Não informada');
});

test('reutilização inicia nova visita sem copiar nenhuma das chaves de data',()=>{
 const snapshot={visitDate:'2024-02-29',visit_date:'2023-01-01',employees:'3',jobsBySector:[['Setor sintético',[{name:'Cargo sintético'}]]]};
 const before=JSON.stringify(snapshot),answers=reusedAnswers(snapshot,{cnpj:'synthetic',legal_name:'Empresa sintética'});
 assert.equal(answers.visitDate,undefined);assert.equal(answers.visit_date,undefined);assert.equal(JSON.stringify(snapshot),before);
 const form=formFixture();form.visitDateInput.value='2024-02-29';form.restoreDraft(answers);assert.equal(form.visitDateInput.value,'');assert.equal(reportVisitDate(answers),'Não informada');
});

test('geração do documento mantém a data no pacote completo de respostas',async t=>{
 installDOM(t);let completed;
 const context=vm.createContext({validateReport:()=>true,getRiskSelections:()=>[],finalReport:el('div'),printReportButton:{hidden:false},getDraft:()=>({visitDate:'2024-02-29',employees:'3'}),GRO_CLOUD:{complete:async answers=>{completed=answers;}}});
 for(const name of ['createReportCover','createCompanyReportBlock','createDimensionReportBlock','createSectorJobReportBlock','createIdentifiedRiskReportBlock','createRiskSourceReportBlock','createEpiTrainingReportBlock','createNrReportBlock','createTechnicalPendingReportBlock'])context[name]=()=>el('section','Conteúdo sintético');
 vm.runInContext(source.slice(source.indexOf('async function renderFinalReport()'),source.indexOf('function createCompanyReportBlock()')),context);
 await context.renderFinalReport();assert.equal(completed.visitDate,'2024-02-29');assert.equal(completed.report_document.version,1);assert.equal(completed.report_document.children.length,9);
 assert.match(read('supabase/transferred-draft-responsible.sql'),/'answers',NEW\.answers/);
});

test('formatação brasileira não muda o dia em fusos diferentes',()=>{
 const moduleUrl=new URL('../report-viewer.js',import.meta.url).href;
 for(const zone of ['UTC','America/Sao_Paulo','Pacific/Kiritimati','America/Los_Angeles']){
  const result=spawnSync(process.execPath,['--input-type=module','-e',`import {reportVisitDate} from ${JSON.stringify(moduleUrl)}; process.stdout.write(reportVisitDate({visitDate:'2024-02-29'}));`],{encoding:'utf8',env:{...process.env,TZ:zone}});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'29/02/2024',zone);
 }
});

test('campo opcional fica no questionário persistente e no grupo da primeira etapa',()=>{
 const html=read('levantamento.html'),wizard=read('assessment-wizard.js'),workspace=read('workspace.js');
 const field=html.match(/<input id="visit-date"[^>]*>/)?.[0];assert.ok(field);assert.match(field,/type="date"/);assert.doesNotMatch(field,/required|\bvalue=/);
 assert.ok(html.indexOf('id="visit-date"')>html.indexOf('<main id="questionnaire"'));assert.ok(html.indexOf('id="visit-date"')<html.indexOf('id="dimension-form"'));
 const groupsExpression=wizard.match(/ const groups=(\[.*\]);/)[1];const groups=vm.runInNewContext(groupsExpression);assert.ok(groups[0].includes('#assessment-visit-details'));
 assert.match(workspace,/'visit-date\.js','script\.js'/);assert.match(workspace,/GRO_FORM\.restore\(row\.answers\)/);
});

test('nova visita abre na identificação; rascunho conserva a etapa que estava aberta',()=>{
 const wizard=read('assessment-wizard.js'),start=wizard.lastIndexOf('return {loaded('),body=wizard.slice(start+'return '.length,wizard.lastIndexOf('\n}')).trim().replace(/;$/,'');
 for(const [isNew,stored,expected] of [[true,null,0],[true,'4',0],[false,null,0],[false,'4',4],[false,'99',0]]){
  let selected;const context=vm.createContext({ready:false,draftId:'',save:{removeAttribute(){}},$:()=>({}),sessionStorage:{getItem:()=>stored},go:index=>{selected=index;}});
  vm.runInContext('api='+body,context);context.api.loaded({id:'synthetic',title:'Visita sintética',isNew});assert.equal(selected,expected);
 }
});
