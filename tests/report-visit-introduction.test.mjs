import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createReportVisitIntroduction} from '../report-visit-introduction.js';
import {installDOM} from './helpers/report-dom.mjs';
const approvedContext='O levantamento teve como foco conhecer as atividades desenvolvidas nos setores abrangidos pela visita e registrar as condições de trabalho, os riscos identificados e as medidas de prevenção informadas. Para contextualizar esses registros, foram consideradas as observações realizadas no local e as informações fornecidas pela empresa, dentro do escopo da visita.';
const values={identity:'Empresa sintética (Nome sintético)',cnpj:'12.345.678/0001-99',fullAddress:'Rua Sintética, 1, Cidade de Teste/SP',visitDate:'01/01/2026',responsible:'Responsável sintético'};
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('visita usa exatamente o texto aprovado em dois parágrafos visuais',t=>{
 installDOM(t);const input=structuredClone(values),before=JSON.stringify(input),node=createReportVisitIntroduction(input);
 assert.equal(node.className,'report-introduction');assert.equal(node.tagName,'P');
 assert.equal(node.childNodes[0].textContent,'A visita à empresa Empresa sintética (Nome sintético), inscrita no CNPJ sob o nº 12.345.678/0001-99 e situada em Rua Sintética, 1, Cidade de Teste/SP, foi realizada em 01/01/2026, por Responsável sintético. ');
 assert.equal(node.childNodes[3].textContent,approvedContext);assert.deepEqual(node.children.map(child=>child.tagName),['BR','BR']);
 assert.equal(JSON.stringify(input),before);
});
test('campos opcionais ausentes não deixam conjunções, vírgulas ou valores inventados',t=>{
 installDOM(t);
 for(let mask=0;mask<16;mask++){
  const input={...values,cnpj:mask&1?values.cnpj:'',fullAddress:mask&2?values.fullAddress:'',visitDate:mask&4?values.visitDate:'Não informada',responsible:mask&8?values.responsible:''};
  const text=createReportVisitIntroduction(input).childNodes[0].textContent;
  assert.equal(text.includes('inscrita no CNPJ'),Boolean(mask&1));assert.equal(text.includes('situada em'),Boolean(mask&2));
  assert.equal(text.includes(' em '+values.visitDate),Boolean(mask&4));assert.equal(text.includes('A data da visita não foi informada.'),!(mask&4));
  assert.equal(text.includes(', por '+values.responsible),Boolean(mask&8));assert.doesNotMatch(text,/undefined|null|,\s*,| e ,|em Não informada/);
  if(!(mask&3))assert.match(text,/Empresa sintética \(Nome sintético\) foi realizada/);
 }
 for(const visitDate of ['',null,undefined])assert.match(createReportVisitIntroduction({...values,visitDate}).textContent,/A data da visita não foi informada/);
 const unavailable=createReportVisitIntroduction({...values,responsible:'Responsável não disponível'});
 assert.doesNotMatch(unavailable.textContent,/, por |Responsável não disponível/);
 const noAddress=createReportVisitIntroduction({...values,fullAddress:'Endereço não informado'});
 assert.doesNotMatch(noAddress.textContent,/situada em|Endereço não informado| e ,/);
 assert.match(noAddress.textContent,/CNPJ sob o nº 12\.345\.678\/0001-99, foi realizada/);
});
test('dados da visita são texto literal sem interpretar HTML nem acrescentar credenciais',t=>{
 installDOM(t);const attack='<img src=x onerror=alert(1)>';
 const node=createReportVisitIntroduction({identity:attack,cnpj:attack,fullAddress:attack,visitDate:attack,responsible:attack,completed_at:'2020-01-01',professional_registration:'99999'});
 assert.equal(node.querySelectorAll('img').length,0);assert.equal(node.textContent.split(attack).length-1,5);
 assert.doesNotMatch(node.textContent,/99999|2020-01-01|CREA|MTE/);
});
test('visualizador mantém a origem da data e da identidade e atualiza somente a apresentação',()=>{
 const viewer=read('report.js');assert.match(viewer,/import \{createReportVisitIntroduction\} from '\.\/report-visit-introduction\.js\?v=20261020-visitcopy1'/);
 assert.match(viewer,/const visitDate=reportVisitDate\(data\.final_snapshot\?\.answers\|\|\{\}\)/);
 assert.match(viewer,/const professional=reportProfessionalIdentity\(data\),responsible=professional\.name/);
 assert.match(viewer,/createReportVisitIntroduction\(\{identity,cnpj,fullAddress,visitDate,responsible\}\)/);
 assert.match(read('report.html'),/report\.js\?v=20261020-objective1/);
 assert.doesNotMatch(read('report-visit-introduction.js'),/innerHTML|completed_at|team_members|professional_registration|\.rpc\(|\.from\(/);
});
