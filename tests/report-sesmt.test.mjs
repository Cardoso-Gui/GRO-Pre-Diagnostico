import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../report-cipa.js';
import '../report-sesmt.js';
import {installDOM,el} from './helpers/report-dom.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const legacy=['Sem equipe mínima nesta faixa','Pelo Anexo II da NR-4 não há profissionais mínimos para essa faixa.'];
const approved=[
 'O Serviço Especializado em Segurança e em Medicina do Trabalho (SESMT) reúne profissionais que atuam na prevenção dos riscos ocupacionais e na proteção da saúde dos trabalhadores. Considerando o número de empregados e o grau de risco utilizados neste levantamento, o dimensionamento pelo Anexo II da NR-4 não indica um quantitativo mínimo de profissionais para compor esse serviço.',
 'Esse resultado deve ser analisado em conjunto com a estrutura da organização, seus estabelecimentos e as modalidades de atendimento previstas na NR-4. A ausência de equipe mínima no dimensionamento não afasta a responsabilidade da empresa de adotar medidas de prevenção e cumprir as demais exigências aplicáveis à segurança e à saúde no trabalho.'
];

test('SESMT converte somente o par padrão completo, preservando entrada e repetição',()=>{
 const source=[...legacy],saved=JSON.stringify(source),formatter=globalThis.GRO_REPORT_SESMT;
 assert.deepEqual(formatter.present(source),approved);assert.equal(JSON.stringify(source),saved);
 assert.deepEqual(formatter.present(legacy.map(text=>' '+text.replace(/ /g,'\n ')+' ')),approved);
 assert.deepEqual(formatter.present(approved),approved);
 assert.deepEqual(formatter.present(['Antes',...legacy,'Depois']),['Antes',...approved,'Depois']);
 for(const details of [[],[legacy[0]],[legacy[1]],[...legacy].reverse(),[legacy[0],'Customizado',legacy[1]],[legacy[0],legacy[1]+' Complemento'],['2 tipo(s) de profissional','1 - Técnico em segurança do trabalho','1* - Médico do trabalho'],['Texto <img src=x onerror=alert(1)>']])assert.deepEqual(formatter.present(details),details);
});

test('SESMT legado e atual mantêm nós personalizados, CIPA e snapshot intactos',t=>{
 installDOM(t);
 for(const details of [legacy,approved]){
  const custom=el('p','Observação <img src=x onerror=alert(1)>'),nested=el('div','','',...legacy.map(text=>el('p',text)));
  const sesmt=el('section','','report-dimension-card',el('h4','SESMT'),...details.map(text=>el('p',text)),custom,nested);
  const cipa=el('section','','report-dimension-card',el('h4','CIPA'),...legacy.map(text=>el('p',text))),outside=el('div','','',...legacy.map(text=>el('p',text)));
  const cover=el('section','','report-cover',outside,el('div','','report-dimension-grid',cipa,sesmt)),snapshot=cover.cloneNode(true),saved=snapshot.textContent,cipaSaved=cipa.textContent;
  for(let i=0;i<3;i++)globalThis.GRO_REPORT_SESMT.apply(cover);
  assert.equal(sesmt.querySelector('h4').textContent,'SESMT — Resultado do dimensionamento');assert.ok(cover.classList.contains('report-cover-sesmt-result'));
  assert.deepEqual(sesmt.children.filter(node=>node.tagName==='P').map(node=>node.textContent),[...approved,custom.textContent]);
  assert.equal(custom.parentElement,sesmt);assert.equal(nested.textContent,legacy.join(''));assert.equal(outside.textContent,legacy.join(''));assert.equal(cipa.textContent,cipaSaved);assert.equal(sesmt.querySelector('img'),null);assert.equal(snapshot.textContent,saved);
 }
 assert.doesNotThrow(()=>globalThis.GRO_REPORT_SESMT.apply(null));
});

test('pares incompletos ou separados e resultados com equipe não são reescritos',t=>{
 installDOM(t);
 for(const nodes of [[el('p',legacy[0])],[el('p',legacy[0]),el('div','Separador'),el('p',legacy[1])],[el('p',legacy[0]),el('p',legacy[1]+' Complemento')],[el('p','1 tipo(s) de profissional'),el('p','1 - Técnico em segurança do trabalho')]]){
  const card=el('section','','report-dimension-card',el('h4','SESMT'),...nodes),cover=el('section','','report-cover',el('div','','report-dimension-grid',card)),saved=card.textContent;
  globalThis.GRO_REPORT_SESMT.apply(cover);assert.equal(cover.classList.contains('report-cover-sesmt-result'),false);assert.equal(card.textContent,saved);assert.equal(card.querySelector('h4').textContent,'SESMT');for(const node of nodes)assert.equal(node.parentElement,card);
 }
});

test('gerador usa a redação SESMT aprovada sem mudar o formulário ou outro resultado',t=>{
 installDOM(t);
 for(const details of [legacy,['2 tipo(s) de profissional','1 - Técnico em segurança do trabalho','1* - Médico do trabalho'],[legacy[0],legacy[1]+' Customizado']]){
  const dimensionFields={cipaSummary:{textContent:'CIPA preservada'},cipaNote:{textContent:'Nota preservada'},sesmtSummary:{textContent:details[0]},sesmtList:el('ul','','',...details.slice(1).map(text=>el('li',text)))},saved=JSON.stringify(details);
  const context=vm.createContext({document:globalThis.document,GRO_REPORT_CIPA:globalThis.GRO_REPORT_CIPA,GRO_REPORT_SESMT:globalThis.GRO_REPORT_SESMT,dimensionFields,employeeCountInput:{value:'4'},riskGradeOutput:{textContent:'Grau 1'},createReportBlock:title=>el('section','','report-block',el('h3',title)),addReportItem:(list,text)=>list.append(el('li',text))});
  const source=read('script.js');vm.runInContext(source.slice(source.indexOf('function createDimensionReportBlock()'),source.indexOf('function createSectorJobReportBlock()')),context);
  const lines=context.createDimensionReportBlock().querySelectorAll('li').map(node=>node.textContent);
  assert.deepEqual(lines.filter(line=>line.startsWith('SESMT: ')),(details===legacy?approved:details).map(text=>'SESMT: '+text));assert.deepEqual(lines.filter(line=>line.startsWith('CIPA: ')),['CIPA: CIPA preservada - Nota preservada']);
  assert.equal(JSON.stringify([dimensionFields.sesmtSummary.textContent,...dimensionFields.sesmtList.children.map(node=>node.textContent)]),saved);
 }
});

test('SESMT compartilha carregamento atualizado sem alterar cálculo ou persistência',()=>{
 for(const file of ['workspace.js','report-generator.js']){
  const source=read(file);assert.match(source,/'report-cipa\.js','report-sesmt\.js','visit-date\.js','script\.js'/);assert.ok(source.includes("file==='script.js'?'20261020-notices1':file==='report-sesmt.js'?'20261020-sesmt1'"));assert.ok(source.includes("file==='report-cipa.js'?'20261020-cipa1'"));
 }
 assert.match(read('report.js'),/import '\.\/report-sesmt\.js\?v=20261020-sesmt1'/);assert.match(read('report.js'),/GRO_REPORT_SESMT\.apply\(cover\)/);
 const source=read('script.js'),dimension=source.slice(source.indexOf('function renderDimension('),source.indexOf('function addSectorOption('));assert.doesNotMatch(dimension,/GRO_REPORT_SESMT/);assert.doesNotMatch(read('report-sesmt.js'),/innerHTML|calculateCipa|calculateSesmt|\.rpc\(|\.from\(|fetch\(|localStorage|sessionStorage/);
});

test('ajuste de espaço fica limitado à capa SESMT aprovada na impressão sem reduzir fontes',()=>{
 const css=read('report-print.css');assert.ok(css.includes('#report-content .report-cover.report-cover-sesmt-result{padding-top:3mm;padding-bottom:3mm}'));assert.ok(css.includes('#report-content .report-cover.report-cover-sesmt-result .report-dimension-grid{margin-top:3mm}'));
 for(const rule of css.split('}').filter(rule=>rule.includes('report-cover-sesmt-result')))assert.doesNotMatch(rule,/font-size|line-height|scale|zoom/);
 assert.match(read('report.html'),/report-print\.css\?v=20261020-sesmt1/);
});
