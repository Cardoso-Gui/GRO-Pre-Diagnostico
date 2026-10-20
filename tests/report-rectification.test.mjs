import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {fixture} from './helpers/rectification-fixture.mjs';
import {ANSWER_FIELDS,correctionChanges,applyBusinessChanges,changedValues,readAssessmentReport,saveRectification} from '../report-rectification.js';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const runtimeFiles=['cnae-descriptions.js','cnae-risk-map.js','esocial-risk-table.js','occupational-risk-table.js','training-rules.js','nr-report-rules.js','dimension-data.js','report-opening.js','visit-date.js','script.js'];
function runtime(t){const dom=new JSDOM(read('levantamento.html'),{url:'https://synthetic.example.test/levantamento.html',runScripts:'outside-only'});t.after(()=>dom.window.close());const context=dom.getInternalVMContext();context.GRO_CLOUD={rectification:true};for(const file of runtimeFiles)vm.runInContext(read(file),context,{filename:file});return dom.window;}

test('retificação por data preserva respostas legadas, conclusão, revisão e identidade',()=>{
 const state=fixture(),before=structuredClone(state.assessment),baseline={...before.final_snapshot.answers,visitDate:''},current={...baseline,visitDate:'2024-02-29'};
 const changes=correctionChanges(before,baseline,current,before.final_snapshot.client,before.title);
 assert.deepEqual(changes,{answers:{visitDate:'2024-02-29'}});
 const result=applyBusinessChanges(before,changes);assert.equal(result.final_snapshot.answers.visitDate,'2024-02-29');assert.deepEqual(result.final_snapshot.answers.legacyBusiness,{untouched:true});
 for(const key of ['id','client_id','revision','report_revision','completed_at','status'])assert.deepEqual(result[key],before[key]);
 assert.deepEqual(before,state.assessment);assert.equal(result.final_snapshot.answers.report_document,undefined);assert.ok(before.final_snapshot.answers.report_document);
});
test('nenhuma normalização não solicitada vira retificação',()=>{
 const {assessment}=fixture(),baseline={...assessment.final_snapshot.answers,visitDate:'',selectedSectors:['Operacional']};
 assert.deepEqual(correctionChanges(assessment,baseline,structuredClone(baseline),structuredClone(assessment.final_snapshot.client),assessment.title),{});
});
test('identificação histórica mantém ownership e sincroniza somente campos corrigidos',()=>{
 const {assessment}=fixture(),result=applyBusinessChanges(assessment,{client:{cnpj:'98765432000188',cnae:'1234567',contact_name:'Pessoa sintética nova'},title:'Título corrigido'});
 assert.equal(result.final_snapshot.client.id,assessment.final_snapshot.client.id);assert.equal(result.final_snapshot.client.team_id,assessment.final_snapshot.client.team_id);
 assert.equal(result.final_snapshot.answers.cnpj,'98765432000188');assert.equal(result.final_snapshot.answers.currentCompany.cnae_fiscal,'1234567');assert.equal(result.final_snapshot.answers.currentCompany.cnae_fiscal_descricao,'');assert.equal(result.final_snapshot.answers.currentCompany.contact_name,'Pessoa sintética nova');assert.equal(result.title,'Título corrigido');assert.equal(result.final_snapshot.title,result.title);assert.equal(assessment.title,'Levantamento sintético');
});
test('diff explícito lista antes/depois, inclusões e exclusões, sem esconder arrays',()=>{
 assert.deepEqual(changedValues({list:['a','b'],one:1},{list:['a','c','d'],two:2}),[{path:'list.1',before:'b',after:'c'},{path:'list.2',before:null,after:'d'},{path:'one',before:1,after:null},{path:'two',before:null,after:2}]);
});
test('leitura falha fechada e nunca recorre ao snapshot original silenciosamente',async()=>{
 let calls=0;await assert.rejects(readAssessmentReport({rpc:async()=>{calls++;return {error:{code:'42501'}}},from(){throw Error('fallback proibido')}},'id'),/versão e o histórico/);assert.equal(calls,1);
 await assert.rejects(readAssessmentReport({rpc:async()=>({data:{assessment:{},sequence:-1}})},'id'),/Sequência/);
 const original=await readAssessmentReport({rpc:async(name,args)=>{assert.equal(name,'read_assessment_report');assert.equal(args.p_original,true);return {data:fixture()}}},'id',{original:true});assert.equal(original.sequence,0);
});
test('salvamento exige motivo e alterações antes de fazer qualquer chamada',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {data:fixture()}}};
 await assert.rejects(saveRectification(client,{reason:'   ',changes:{answers:{visitDate:''}}}),/motivo/);
 await assert.rejects(saveRectification(client,{reason:'Correção de teste',changes:{}}),/pelo menos/);assert.equal(calls,0);
});
test('RPC recebe somente patch, motivo e identificadores de concorrência, nunca autor/equipe/revisão',async()=>{
 const payload={id:'id',sequence:2,requestId:'request',reason:' Teste de correção ',changes:{answers:{visitDate:'2024-02-29'}},actor:'spoof',team:'spoof',revision:999};
 await saveRectification({rpc:async(name,args)=>{assert.equal(name,'rectify_assessment');assert.deepEqual(Object.keys(args).sort(),['p_assessment_id','p_expected_sequence','p_request_id','p_reason','p_changes'].sort());assert.equal(args.p_reason,'Teste de correção');assert.equal(args.p_expected_sequence,2);return {data:fixture()}}},payload);
});
test('conflito, revogação e resultado incerto nunca afirmam sucesso',async()=>{
 for(const [code,pattern] of [['40001',/Outra retificação/],['42501',/não foram salvas/],['NETWORK',/Não foi possível confirmar/]])await assert.rejects(saveRectification({rpc:async()=>({error:{code}})},{id:'id',sequence:0,requestId:'request',reason:'Teste',changes:{answers:{visitDate:''}}}),pattern);
});
test('retry mantém request_id e payload permitindo idempotência do servidor',async()=>{
 const calls=[],args={id:'id',sequence:0,requestId:'request',reason:'Teste',changes:{answers:{visitDate:'2024-02-29'}}};const client={rpc:async(_,payload)=>{calls.push(payload);return calls.length===1?{error:{code:'network'}}:{data:fixture()}}};
 await assert.rejects(saveRectification(client,args));await saveRectification(client,args);assert.deepEqual(calls[0],calls[1]);
});
test('gerador real regenera detalhes, recomendações, identificação e preserva original',t=>{
 const window=runtime(t),{assessment}=fixture(),before=JSON.stringify(assessment);
 window.GRO_FORM.restore(structuredClone(assessment.final_snapshot.answers));const originalDoc=window.GRO_FORM.document().report_document;
 const changed=structuredClone(assessment.final_snapshot.answers);changed.currentCompany.razao_social='Razão corrigida';changed.currentCompany.nome_fantasia='Empresa corrigida';changed.riskSourcesBySelection[0][1].improve='Melhoria retificada';changed.riskSourcesBySelection[0][1].source='Fonte retificada';changed.visitDate='2024-02-29';
 window.GRO_FORM.restore(changed);const regenerated=window.GRO_FORM.document();const serialized=JSON.stringify(regenerated.report_document);
 assert.match(serialized,/Empresa corrigida/);assert.match(serialized,/Melhoria retificada/);assert.match(serialized,/Fonte retificada/);assert.doesNotMatch(serialized,/Ajustar bancada/);assert.equal(regenerated.visitDate,'2024-02-29');assert.notDeepEqual(regenerated.report_document,originalDoc);assert.equal(JSON.stringify(assessment),before);
});
test('detalhamento de retificação permanece na tela e não cria rascunho ou navega',t=>{
 const window=runtime(t);window.GRO_FORM.restore(fixture().assessment.final_snapshot.answers);assert.equal(window.document.querySelector('#open-risk-details'),null);
 const fields=[...window.document.querySelectorAll('.rectification-risk textarea')];assert.equal(fields.length,7);fields.at(-1).value='Recomendação sintética nova';fields.at(-1).dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(window.GRO_FORM.snapshot().riskSourcesBySelection[0][1].improve,'Recomendação sintética nova');assert.equal(window.localStorage.length,0);
});
test('contratos do carregamento, revisão, cancelamento e modo original ficam explícitos',()=>{
 assert.match(read('report.js'),/!original&&state.sequence>0\?await generateEffectiveDocument/);
 assert.match(read('report.js'),/readAssessmentReport\(authClient,id,\{original\}\)/);
 assert.match(read('reuse-report.js'),/readAssessmentReport\(authClient,sourceId\)/);
 assert.match(read('rectification-workspace.js'),/if\(!state.can_rectify\)throw/);
 assert.match(read('rectification-workspace.js'),/if\(busy\|\|accessBlocked\|\|!pending\)return/);
 assert.match(read('rectification-workspace.js'),/if\(!busy\)review.close\(\)/);
 assert.match(read('rectification-workspace.js'),/if\(busy\)event.preventDefault\(\)/);
 assert.equal(ANSWER_FIELDS.includes('report_document'),false);assert.equal(ANSWER_FIELDS.includes('revision'),false);
});

test('endereço envia somente chaves corrigidas e mantém extras legados',()=>{
 const {assessment}=fixture();assessment.final_snapshot.client.address.extraLegacy='Preservar';assessment.final_snapshot.answers.currentCompany.descricao_tipo_de_logradouro='Rua';
 const baseline=structuredClone(assessment.final_snapshot.answers),client=structuredClone(assessment.final_snapshot.client);client.address.number='22';
 const changes=correctionChanges(assessment,baseline,baseline,client,assessment.title);assert.deepEqual(changes,{client:{address:{number:'22'}}});
 const result=applyBusinessChanges(assessment,changes);assert.equal(result.final_snapshot.client.address.extraLegacy,'Preservar');assert.equal(result.final_snapshot.client.address.street,'Rua de teste');assert.equal(result.final_snapshot.answers.currentCompany.logradouro,'Rua de teste');assert.equal(result.final_snapshot.answers.currentCompany.numero,'22');assert.equal(result.final_snapshot.answers.currentCompany.descricao_tipo_de_logradouro,'Rua');
});
test('danos corrigidos sincronizam metadados e não reaparecem antigos na reutilização',t=>{
 const window=runtime(t),answers=fixture().assessment.final_snapshot.answers;Object.assign(answers.riskSourcesBySelection[0][1],{damageSelections:['Fraturas'],damageOther:'',damageOtherEnabled:false});window.GRO_FORM.restore(answers);
 const field=[...window.document.querySelectorAll('.rectification-risk textarea')][4];field.value='Desconforto corrigido';field.dispatchEvent(new window.Event('input'));
 const detail=window.GRO_FORM.snapshot().riskSourcesBySelection[0][1];assert.deepEqual([...detail.damageSelections],[]);assert.equal(detail.damageOther,'Desconforto corrigido');assert.equal(detail.damageOtherEnabled,true);assert.equal(detail.damage,'Desconforto corrigido');
});

test('alterar um cargo não normaliza posto legado de outro cargo',()=>{
 const {assessment}=fixture(),jobs=assessment.final_snapshot.answers.jobsBySector[0][1];jobs.push({name:'Segundo cargo',quantity:1,activities:'Outras atividades',workstations:[{name:'Posto legado',photoPath:'arquivo-legado',note:'Preservar'}]});
 const baseline=structuredClone(assessment.final_snapshot.answers);baseline.jobsBySector[0][1][1].workstations[0].photoPaths=['arquivo-legado'];
 const current=structuredClone(baseline);current.jobsBySector[0][1][0].quantity=4;
 const patch=correctionChanges(assessment,baseline,current,assessment.final_snapshot.client,assessment.title);
 assert.deepEqual(patch.answers.jobsBySector[0][1][1],jobs[1]);assert.equal(patch.answers.jobsBySector[0][1][0].quantity,4);assert.equal(patch.answers.jobsBySector[0][1][0].legacyBusiness,'preservar');
});

test('editar detalhamento legado ausente mantém chave e não inclui defaults intocados',()=>{
 const {assessment}=fixture();assessment.final_snapshot.answers.riskSourcesBySelection=[];
 const baseline=structuredClone(assessment.final_snapshot.answers);baseline.riskSourcesBySelection=[['source__one',{source:'',note:''}],['source__two',{source:'',note:''}]];
 const current=structuredClone(baseline);current.riskSourcesBySelection[0][1].source='Correção sintética';
 const changes=correctionChanges(assessment,baseline,current,assessment.final_snapshot.client,assessment.title);
 assert.deepEqual(changes.answers.riskSourcesBySelection,[['source__one',{source:'Correção sintética',note:''}]]);
});

test('correção de nome de setor/cargo preserva riscos, detalhes, EPIs e vínculos',async()=>{
 const {renameBusinessReferences}=await import('../report-rectification.js');const answers=fixture().assessment.final_snapshot.answers;answers.gheList=[{id:'ghe__grupo',name:'Grupo',linkedJobs:[{sectorName:'Operacional',jobName:'Cargo sintético'}]}];const before=structuredClone(answers);
 const sector=renameBusinessReferences(answers,{kind:'sector',name:'Operacional',newName:'Setor corrigido'});assert.equal(sector.selectedSectors[0],'Setor corrigido');assert.equal(sector.gheList[0].linkedJobs[0].sectorName,'Setor corrigido');assert.equal(sector.selectedRisksByTarget[0][0],'job__setor corrigido__cargo sintetico');assert.equal(sector.riskSourcesBySelection[0][0],'source__job__setor corrigido__cargo sintetico__erg.001');assert.deepEqual(sector.riskSourcesBySelection[0][1],answers.riskSourcesBySelection[0][1]);
 const job=renameBusinessReferences(sector,{kind:'job',sector:'Setor corrigido',name:'Cargo sintético',newName:'Cargo corrigido'});assert.equal(job.jobsBySector[0][1][0].name,'Cargo corrigido');assert.equal(job.gheList[0].linkedJobs[0].jobName,'Cargo corrigido');assert.equal(job.epiBySelection[0][0],'epi-data__job__setor corrigido__cargo corrigido__erg.001');assert.deepEqual(answers,before);
 const ghe=renameBusinessReferences(job,{kind:'ghe',sector:'ghe__grupo',name:'Grupo',newName:'Grupo corrigido'});assert.equal(ghe.gheList[0].id,'ghe__grupo');assert.equal(ghe.gheList[0].name,'Grupo corrigido');
});
test('lista usa títulos retificados e falha fechada quando histórico não está disponível',async()=>{
 const {overlayReportSummaries}=await import('../report-rectification.js'),rows=[{id:'id',title:'Original',revision:4}];
 const overlaid=await overlayReportSummaries({rpc:async()=>({data:[{id:'id',title:'Corrigido',sequence:2,can_rectify:true}]})},rows);assert.equal(overlaid[0].title,'Corrigido');assert.equal(overlaid[0].revision,4);assert.equal(rows[0].title,'Original');
 await assert.rejects(overlayReportSummaries({rpc:async()=>({error:{code:'network'}})},rows));await assert.rejects(overlayReportSummaries({rpc:async()=>({data:[]})},rows));
});

test('renomear setor não colide com setor legado inativo',async()=>{
 const {renameBusinessReferences}=await import('../report-rectification.js'),answers=fixture().assessment.final_snapshot.answers;answers.jobsBySector.push(['Legado',[]]);assert.throws(()=>renameBusinessReferences(answers,{kind:'sector',name:'Operacional',newName:'Legado'}),/Já existe/);
});
