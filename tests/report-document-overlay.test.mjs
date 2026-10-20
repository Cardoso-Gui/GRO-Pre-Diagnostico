import test from 'node:test';
import assert from 'node:assert/strict';
import {affectedReportSections,overlayReportDocument} from '../report-document-overlay.js';
const section=(title,value=title)=>({tag:'section',className:'report-block',children:[{tag:'h3',children:[{text:title}]},{tag:'p',children:[{text:value}]}]});
const titles=['Dados da empresa','Dimensionamento CIPA/SESMT','Setores e cargos','Riscos identificados','Fontes geradoras','EPIs e treinamentos sugeridos','NRs identificadas no levantamento','Pendências para validação técnica'];
const doc=label=>({version:1,children:[{tag:'section',className:'report-cover',children:[{text:label}]},...titles.map(title=>section(title,label+' '+title))]});

test('data e título preservam documento original integral, incluindo conteúdo legado',()=>{
 const original=doc('Original');original.children.push(section('Anexo legado exclusivo','Informação não presente em answers'));
 const result=overlayReportDocument(original,null,[{path:'/answers/visitDate'},{path:'/title'}]);assert.deepEqual(result,original);assert.notEqual(result,original);
});
test('risco retificado atualiza dependências e preserva identidade, setores e anexo legado',()=>{
 const original=doc('Original'),generated=doc('Atualizado');original.children.push(section('Anexo legado exclusivo','Texto preservado'));
 const result=overlayReportDocument(original,generated,[{path:'/answers/riskSourcesBySelection/0/1/improve'}]);
 for(const index of [0,1,2,3,4,9])assert.deepEqual(result.children[index],original.children[index]);
 for(const index of [5,6,7,8])assert.deepEqual(result.children[index],generated.children[index]);
});
test('CNAE recalcula dimensionamento e referências sem recriar setores e riscos',()=>{
 const affected=affectedReportSections([{path:'client.cnae'},{path:'/answers/currentCompany/cnae_fiscal'}]);
 for(const title of ['@cover','Dados da empresa','Dimensionamento CIPA/SESMT','EPIs e treinamentos sugeridos','NRs identificadas no levantamento'])assert.equal(affected.has(title),true);
 assert.equal(affected.has('Fontes geradoras'),false);assert.equal(affected.has('Setores e cargos'),false);
});
test('faltam documento original ou trecho gerado: falha explícita em vez de versão parcial',()=>{
 assert.throws(()=>overlayReportDocument(null,doc('x'),[]),/original/);
 assert.throws(()=>overlayReportDocument(doc('old'),{version:1,children:[]},[{path:'/answers/employees'}]),/seção necessária/);
});

test('nome legado do detalhamento é substituído sem duplicação ou conteúdo velho',()=>{
 const original=doc('Antigo');original.children[5]=section('Detalhamento dos riscos','Recomendação antiga');
 const result=overlayReportDocument(original,doc('Corrigido'),[{path:'/answers/riskSourcesBySelection/0/1/improve'}]);
 assert.equal(result.children.length,original.children.length);assert.deepEqual(result.children[5],doc('Corrigido').children[5]);assert.doesNotMatch(JSON.stringify(result),/Recomendação antiga/);
});
test('retificação da foto ou quantidade preserva texto dos riscos sem reconstrução',()=>{
 const original=doc('Original'),generated=doc('Novo');
 for(const path of ['/answers/jobsBySector/0/1/0/workstations/0/note','/answers/jobsBySector/0/1/0/quantity']){
  const result=overlayReportDocument(original,generated,[{path}]);assert.deepEqual(result.children[3],generated.children[3]);assert.deepEqual(result.children[5],original.children[5]);assert.deepEqual(result.children[6],original.children[6]);
 }
});

test('diff real de array inteiro do SQL é expandido antes de escolher dependências',()=>{
 const original=doc('Original'),generated=doc('Novo'),before=[['Setor',[{name:'Cargo',quantity:1,activities:'Preservada'}]]],after=structuredClone(before);after[0][1][0].quantity=2;
 const result=overlayReportDocument(original,generated,[{path:'/answers/jobsBySector',before,after}]);assert.deepEqual(result.children[3],generated.children[3]);for(const index of [0,1,2,4,5,6,7,8])assert.deepEqual(result.children[index],original.children[index]);
});
