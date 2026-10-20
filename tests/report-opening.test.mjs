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
 assert.match(workspace,/'report-opening\.js','visit-date\.js','script\.js'/);
 assert.match(viewer,/import '\.\/report-opening\.js\?v=20261020-opening2'/);
 assert.match(viewer,/report-generator\.js\?v=20261020-opening2/);
 for(const loader of [workspace,generator])assert.match(loader,/file==='report-opening\.js'\?'20261020-opening2'/);
 assert.match(viewer,/GRO_REPORT_OPENING\.apply\(cover\)/);
 assert.match(read('levantamento.html'),/workspace\.js\?v=20261020-opening2/);
 assert.match(read('report.html'),/report\.js\?v=20261020-opening2/);
});
