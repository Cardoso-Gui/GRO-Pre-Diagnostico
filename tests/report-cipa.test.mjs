import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../report-cipa.js';
import '../report-sesmt.js';
import {installDOM,el} from './helpers/report-dom.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const legacy='Sem comissão nesta faixa - Sem atendimento pelo SESMT, nomear um representante entre os empregados. MEI é dispensado dessa nomeação (NR-5, 5.4.13).';
const approved=[
 'Com base no número de empregados e no grau de risco informados, o dimensionamento pelo Quadro I da NR-5 não indica a constituição de comissão.',
 'Caso o estabelecimento não seja atendido pelo SESMT, a organização deve nomear um empregado como seu representante para auxiliar nas ações de prevenção em segurança e saúde no trabalho. A nomeação e a forma de atuação do representante devem ser formalizadas anualmente pela organização (NR-5, item 5.4.14). O MEI está dispensado dessa nomeação, conforme os itens 5.4.13 e 5.4.13.2 da NR-5.'
];
const otherBranches=[
 'Sem comissão nesta faixa - Se o estabelecimento for atendido pelo SESMT, este desempenha as atribuições da CIPA (NR-5, 5.4.13.1).',
 'Revisão técnica necessária - Acima de 10.000 empregados, confira os acréscimos do Quadro I com o responsável técnico.',
 '1 efetivo(s) e 1 suplente(s) por representação - Empregados: 1 efetivo(s) + 1 suplente(s). Organização: a mesma composição. Total: 4 integrantes.'
];

test('CIPA converte somente a variante exata aprovada, preservando entrada e repetição',()=>{
 const source=[legacy],saved=JSON.stringify(source),formatter=globalThis.GRO_REPORT_CIPA;
 assert.deepEqual(formatter.present(source),approved);assert.equal(JSON.stringify(source),saved);
 assert.deepEqual(formatter.present(['  '+legacy.replace(/ /g,'\n ')+'  ']),approved);
 assert.deepEqual(formatter.present(approved),approved);
 for(const text of [...otherBranches,legacy+' Observação adicional.','Texto personalizado <img src=x onerror=alert(1)>','Não informado'])assert.deepEqual(formatter.present([text]),[text]);
 assert.deepEqual(formatter.present([]),[]);
});

test('capa legada recebe dois parágrafos e título sem perder nós personalizados ou snapshot',t=>{
 installDOM(t);
 for(const details of [[legacy],approved]){
  const custom=el('p','Observação específica <img src=x onerror=alert(1)>');
  const nested=el('div','', '',el('p',legacy));
  const cipa=el('section','','report-dimension-card',el('h4','CIPA'),...details.map(text=>el('p',text)),custom,nested);
  const sesmt=el('section','','report-dimension-card',el('h4','SESMT'),el('p',legacy));
  const outside=el('p',legacy),cover=el('section','','report-cover',outside,el('div','','report-dimension-grid',cipa,sesmt));
  const snapshot=cover.cloneNode(true),saved=snapshot.textContent;
  for(let i=0;i<3;i++)globalThis.GRO_REPORT_CIPA.apply(cover);
  assert.equal(cipa.querySelector('h4').textContent,'CIPA — Resultado do dimensionamento');
  assert.deepEqual(cipa.children.filter(node=>node.tagName==='P').map(node=>node.textContent),[...approved,custom.textContent]);
  assert.equal(custom.parentElement,cipa);assert.equal(nested.textContent,legacy);assert.equal(outside.textContent,legacy);assert.equal(sesmt.querySelector('p').textContent,legacy);
  assert.equal(cipa.querySelector('img'),null);assert.equal(snapshot.textContent,saved);
 }
 assert.doesNotThrow(()=>globalThis.GRO_REPORT_CIPA.apply(null));
});

test('outras variantes e texto customizado de CIPA não recebem título ou redação novos',t=>{
 installDOM(t);
 for(const text of [...otherBranches,legacy+' Complemento customizado.']){
  const paragraph=el('p',text),card=el('section','','report-dimension-card',el('h4','CIPA'),paragraph),cover=el('section','','report-cover',el('div','','report-dimension-grid',card));
  globalThis.GRO_REPORT_CIPA.apply(cover);assert.equal(card.querySelector('h4').textContent,'CIPA');assert.equal(card.querySelector('p'),paragraph);assert.equal(paragraph.textContent,text);
 }
});

test('geração PDF usa os mesmos parágrafos sem alterar resultados CIPA ou SESMT do formulário',t=>{
 installDOM(t);
 for(const text of [legacy,...otherBranches]){
  const [summary,note]=text.split(' - '),dimensionFields={cipaSummary:{textContent:summary},cipaNote:{textContent:note},sesmtSummary:{textContent:'SESMT preservado'},sesmtList:el('ul','', '',el('li','Detalhe SESMT preservado'))};
  const saved=JSON.stringify([summary,note]);
  const context=vm.createContext({document:globalThis.document,GRO_REPORT_CIPA:globalThis.GRO_REPORT_CIPA,GRO_REPORT_SESMT:globalThis.GRO_REPORT_SESMT,dimensionFields,employeeCountInput:{value:'4'},riskGradeOutput:{textContent:'Grau 1'},createReportBlock:title=>el('section','', 'report-block',el('h3',title)),addReportItem:(list,text)=>list.append(el('li',text))});
  const source=read('script.js');vm.runInContext(source.slice(source.indexOf('function createDimensionReportBlock()'),source.indexOf('function createSectorJobReportBlock()')),context);
  const lines=context.createDimensionReportBlock().querySelectorAll('li').map(node=>node.textContent);
  assert.deepEqual(lines.filter(line=>line.startsWith('CIPA: ')),(text===legacy?approved:[text]).map(line=>'CIPA: '+line));
  assert.deepEqual(lines.filter(line=>line.startsWith('SESMT: ')),['SESMT: SESMT preservado','SESMT: Detalhe SESMT preservado']);
  assert.equal(JSON.stringify([dimensionFields.cipaSummary.textContent,dimensionFields.cipaNote.textContent]),saved);
 }
});

test('carregamento compartilhado atualiza apresentação e script sem envolver persistência ou cálculo',()=>{
 for(const file of ['workspace.js','report-generator.js']){
  const source=read(file);assert.match(source,/'report-opening\.js','report-cipa\.js','report-sesmt\.js','visit-date\.js','script\.js'/);
  assert.ok(source.includes("file==='script.js'?'"+(file==='workspace.js'?'20261021-autosave1':'20261020-notices1')+"':file==='report-sesmt.js'?'20261020-sesmt1'"));
 }
 assert.match(read('report.js'),/import '\.\/report-cipa\.js\?v=20261020-cipa1'/);assert.match(read('report.js'),/GRO_REPORT_CIPA\.apply\(cover\)/);
 const source=read('script.js'),dimension=source.slice(source.indexOf('function renderDimension('),source.indexOf('function addSectorOption('));
 assert.doesNotMatch(dimension,/GRO_REPORT_CIPA/);assert.doesNotMatch(read('report-cipa.js'),/innerHTML|calculateCipa|calculateSesmt|\.rpc\(|\.from\(|fetch\(|localStorage|sessionStorage/);
});
