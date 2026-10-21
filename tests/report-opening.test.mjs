import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../report-opening.js';
import {installDOM,el} from './helpers/report-dom.mjs';

const approved=[
 'Este relatório apresenta os resultados do levantamento preliminar das atividades e das condições de trabalho da empresa. Reúne informações sobre os setores abrangidos pelo levantamento, os riscos ocupacionais identificados e as medidas de prevenção informadas, com o objetivo de apoiar a definição de prioridades e orientar a análise de eventuais necessidades de avaliação complementar.',
 'Seu conteúdo se limita ao escopo do levantamento e às informações registradas na ocasião. Por seu caráter preliminar, não substitui o PGR, o PCMSO, o LTCAT, os laudos técnicos ou as avaliações específicas aplicáveis, nem dispensa a análise dos profissionais responsáveis.'
];
const redundantObjective='O levantamento tem como objetivo apoiar a identificação dos perigos e o planejamento das ações de prevenção, considerando as atividades desenvolvidas e as informações fornecidas pela empresa.';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const opening=cover=>cover.querySelectorAll('.report-opening').map(node=>node.textContent);

test('nova capa grava exatamente os dois parágrafos aprovados, mantendo identificação e resumo',t=>{
 installDOM(t);
 const source=read('script.js'),context=vm.createContext({document:globalThis.document,GRO_REPORT_OPENING:globalThis.GRO_REPORT_OPENING,fields:{companyName:{textContent:'Empresa sintética'}},input:{value:'123'},formatCnpj:value=>value,employeeCountInput:{value:'4'},riskGradeOutput:{textContent:'2'},getRiskModeLabel:()=> 'Por cargo'});
 vm.runInContext(source.slice(source.indexOf('function createReportCover()'),source.indexOf('function getRiskModeLabel()')),context);
 const cover=context.createReportCover();
 assert.deepEqual(opening(cover),approved);
 assert.equal(cover.querySelector('h3').textContent,'Empresa sintética');
 assert.equal(cover.querySelectorAll('.report-summary-item').length,5);
 assert.deepEqual(cover.children.map(node=>node.tagName),['SPAN','H3','P','P','DIV']);
 assert.equal(cover.querySelector('.report-objective'),null);assert.equal(cover.textContent.includes(redundantObjective),false);
});

test('capa histórica recebe abertura atual sem alterar visita, objetivo, dados ou snapshot',t=>{
 installDOM(t);
 const legacy='Este relatório consolida as informações coletadas no questionário. Ele não substitui PGR, PCMSO, LTCAT, laudos técnicos, avaliações quantitativas ou validação dos responsáveis técnicos.';
 const cover=el('section','','report-cover',el('h3','Empresa sintética'),el('p',legacy),el('p','Trecho da visita preservado','report-introduction'),el('p','Objetivo preservado','report-objective'),el('div','Resumo preservado','report-summary-grid'));
 const snapshot=cover.cloneNode(true),saved=snapshot.textContent,visit=cover.querySelector('.report-introduction'),objective=cover.querySelector('.report-objective'),summary=cover.querySelector('.report-summary-grid');
 globalThis.GRO_REPORT_OPENING.apply(cover);
 assert.deepEqual(opening(cover),approved);assert.equal(cover.textContent.includes(legacy),false);
 assert.equal(cover.querySelector('.report-introduction'),visit);assert.equal(visit.textContent,'Trecho da visita preservado');
 assert.equal(cover.querySelector('.report-objective'),objective);assert.equal(objective.textContent,'Objetivo preservado');
 assert.equal(cover.querySelector('.report-summary-grid'),summary);assert.equal(summary.textContent,'Resumo preservado');
 assert.equal(snapshot.textContent,saved);assert.equal(snapshot.querySelectorAll('.report-opening').length,0);
});

test('abertura anterior em dois parágrafos recebe apenas a nova apresentação aprovada',t=>{
 installDOM(t);
 const previous=[
  'Este relatório apresenta uma visão inicial das atividades e das condições de trabalho da empresa, com base nas informações registradas durante o levantamento. Seu objetivo é apoiar a identificação dos riscos ocupacionais e orientar a análise das necessidades de prevenção e de avaliação complementar.',
  'De caráter preliminar, este documento não substitui o PGR, o PCMSO, o LTCAT, os laudos técnicos ou as avaliações quantitativas, nem dispensa a análise e a validação dos responsáveis técnicos.'
 ];
 const title=el('h3','Empresa sintética'),visit=el('p','Visita preservada','report-introduction'),objective=el('p','Objetivo preservado','report-objective');
 const cover=el('section','','report-cover',title,...previous.map(text=>el('p',text,'report-opening')),visit,objective);
 const snapshot=cover.cloneNode(true),saved=snapshot.textContent;
 globalThis.GRO_REPORT_OPENING.apply(cover);
 assert.deepEqual(opening(cover),approved);
 assert.deepEqual(cover.children,[title,...cover.querySelectorAll('.report-opening'),visit,objective]);
 assert.equal(snapshot.textContent,saved);assert.deepEqual(opening(snapshot),previous);
 globalThis.GRO_REPORT_OPENING.apply(cover);
 assert.deepEqual(opening(cover),approved);assert.equal(cover.children.length,5);
});

test('parágrafo não reconhecido da capa permanece intacto',t=>{
 installDOM(t);
 const unrelated=el('p','Observação específica preservada');
 const cover=el('section','','report-cover',el('h3','Empresa sintética'),unrelated);
 globalThis.GRO_REPORT_OPENING.apply(cover);
 assert.deepEqual(opening(cover),approved);assert.equal(unrelated.parentElement,cover);
 assert.equal(unrelated.textContent,'Observação específica preservada');assert.equal(cover.children.at(-1),unrelated);
});

test('renderização repetida mantém dois parágrafos, sem duplicação',t=>{
 installDOM(t);
 const cover=el('section','','report-cover',el('h3','Empresa sintética'));
 for(let i=0;i<3;i++)globalThis.GRO_REPORT_OPENING.apply(cover);
 assert.deepEqual(opening(cover),approved);assert.equal(cover.children.length,3);
 assert.doesNotThrow(()=>globalThis.GRO_REPORT_OPENING.apply(null));
});

test('gerador e visualizador usam a mesma abertura e carregamento atualizado',()=>{
 const workspace=read('workspace.js'),viewer=read('report.js'),generator=read('report-generator.js');
 assert.match(workspace,/'report-opening\.js','report-cipa\.js','report-sesmt\.js','visit-date\.js','script\.js'/);
 assert.match(viewer,/import '\.\/report-opening\.js\?v=20261020-objective1'/);
 assert.match(viewer,/report-generator\.js\?v=20261020-notices1/);
 for(const loader of [workspace,generator])assert.match(loader,/file==='report-opening\.js'\?'20261020-objective1'/);
 assert.match(viewer,/GRO_REPORT_OPENING\.apply\(cover\)/);
 assert.match(read('levantamento.html'),/workspace\.js\?v=20261021-autosave1/);
 assert.match(read('report.html'),/report\.js\?v=20261020-notices1/);
 assert.match(read('rectification-workspace.js'),/report-generator\.js\?v=20261020-notices1/);
 assert.match(read('rectify.html'),/rectification-workspace\.js\?v=20261020-notices1/);
});


test('normalização remove somente o objetivo padrão direto da capa, sem tocar no snapshot',t=>{
 installDOM(t);
 for(const className of ['', 'report-objective']){
  const obsolete=el('p','  '+redundantObjective.replace(/ /g,'\n  ')+'  ',className);
  const duplicate=el('p',redundantObjective,'report-objective');
  const custom=el('p',redundantObjective+' Observação específica preservada.','report-objective');
  const nested=el('section','', 'report-custom',el('p',redundantObjective));
  const nonParagraph=el('div',redundantObjective);
  const visit=el('p','Visita preservada','report-introduction'),summary=el('div','Dados preservados','report-summary-grid');
  const cover=el('section','','report-cover',el('h3','Empresa sintética'),obsolete,duplicate,visit,custom,nested,nonParagraph,summary);
  const snapshot=cover.cloneNode(true),saved=snapshot.textContent;
  globalThis.GRO_REPORT_OPENING.apply(cover);
  assert.equal(obsolete.parentElement,null);assert.equal(duplicate.parentElement,null);
  for(const node of [visit,custom,nested,nonParagraph,summary])assert.equal(node.parentElement,cover);
  assert.equal(custom.textContent,redundantObjective+' Observação específica preservada.');assert.equal(nested.textContent,redundantObjective);
  assert.equal(snapshot.textContent,saved);assert.equal(snapshot.children.length,8);
  globalThis.GRO_REPORT_OPENING.apply(cover);
  assert.deepEqual(opening(cover),approved);assert.equal(cover.children.length,8);
 }
});

test('visualizador não reinsere o objetivo removido nem altera o texto da visita',()=>{
 assert.doesNotMatch(read('report.js'),/introduction\.after\(objective\)|objective\.textContent|report-objective/);
 assert.ok(!read('report.js').includes(redundantObjective));
 assert.match(read('report.js'),/createReportVisitIntroduction\(\{identity,cnpj,fullAddress,visitDate,responsible\}\)/);
});
