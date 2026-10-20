import test from 'node:test';
import assert from 'node:assert/strict';
import {describeRectificationChange as describe} from '../rectification-diff-view.js';
import {fixture} from './helpers/rectification-fixture.mjs';
test('campos conhecidos recebem rótulos sem alterar caminhos ou valores',()=>{
 for(const [path,label] of Object.entries({'title':'Título do levantamento','client.legal_name':'Razão social','client.address.city':'Município','answers.employees':'Número de funcionários','answers.dimensionOptions.health':'Atividade de saúde','answers.selectedSectors':'Setores','answers.jobsBySector':'Cargos por setor','answers.gheList':'Grupos homogêneos de exposição','answers.selectedRisksByTarget':'Riscos selecionados','answers.riskSourcesBySelection':'Detalhamento dos riscos','answers.epiBySelection':'Equipamentos de proteção individual','answers.currentCompany.razao_social':'Razão social no relatório'})){
  const diff={path,before:null,after:'Texto completo'},copy=structuredClone(diff),result=describe(diff);assert.equal(result.label,label);assert.equal(result.path,path);assert.equal(result.after,'Texto completo');assert.deepEqual(diff,copy);
 }
});
test('datas são formatadas apenas na exibição e somente quando válidas',()=>{
 assert.equal(describe({path:'answers.visitDate',before:null,after:'2026-09-29'}).after,'29/09/2026');
 assert.equal(describe({path:'/answers/visitDate',before:'2024-02-29',after:''}).before,'29/02/2024');
 for(const value of ['2023-02-29','2026-13-01','2026-02-31','0000-01-01','texto'])assert.equal(describe({path:'answers.visitDate',after:value}).after,value);
 assert.equal(describe({path:'client.contact_name',after:'2026-09-29'}).after,'2026-09-29');
 assert.equal(describe({path:'answers.visitDate',after:null}).after,'Não informado');
});
test('cargos, postos, riscos e EPIs conservam contexto da empresa sintética',()=>{
 const value=fixture().assessment.final_snapshot;value.answers.jobsBySector[0][1][0].workstations=[{name:'Posto sintético'}];
 let result=describe({path:'answers.jobsBySector.0.1.0.activities',before:'A',after:'B'},{before:value,after:value});assert.equal(result.label,'Atividades do cargo');assert.match(result.context,/Operacional.*Cargo sintético/);
 result=describe({path:'answers.jobsBySector.0.1.0.workstations.0.name',after:'Novo posto'},{after:value});assert.equal(result.label,'Nome do posto');assert.match(result.context,/Posto sintético/);
 result=describe({path:'answers.riskSourcesBySelection.0.1.improve',after:'Texto'},{after:value});assert.equal(result.label,'Melhorias propostas');assert.match(result.context,/Cargo sintético.*ERG\.001/);
 result=describe({path:['answers','epiBySelection','0','1','items','0'],after:'Luva'},{after:value});assert.equal(result.label,'Equipamentos informados');assert.match(result.context,/Cargo sintético/);
});
test('fallback técnico e valores extensos permanecem completos e literais',()=>{
 const text='<img src=x onerror=alert(1)> & '+('x'.repeat(5000)),diff={path:'/answers/legacy~1key/unknown_field',before:{list:[text,false,7]},after:text},result=describe(diff);
 assert.equal(result.label,'Campo: unknown field');assert.equal(result.path,diff.path);assert.equal(result.after,text);assert.deepEqual(JSON.parse(result.before),diff.before);
 assert.equal(describe({path:'answers.constructor',after:'abc'}).label,'Campo: constructor');
 assert.equal(describe({path:'answers.selectedRiskMode',after:'__proto__'}).after,'__proto__');
 assert.equal(describe({path:'answers.selectedRiskMode',after:'job'}).after,'Por cargo');
});
