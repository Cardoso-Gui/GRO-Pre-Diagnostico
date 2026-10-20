import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {paginateReport} from '../report-pagination.js';
import {compactPrintReport} from '../report-print-compact.js';
import {organizeReport} from '../report-layout.js';
import {riskCountLabel} from '../report-viewer.js';
import {installDOM,el} from './helpers/report-dom.mjs';

const heading=(title)=>el('summary','','',el('strong',title));
const section=(title,...children)=>el('section','','report-block',el('h3',title),...children);
const group=(title,...children)=>el('div','','viewer-group',heading(title),...children);
function category(type,...risks){const node=el('section','','viewer-category',el('h4',type,'viewer-category-title'),...risks);node.dataset.type=type;return node;}
function risk(index,{length=1,improvement=''}={}){
 const detail=el('article','','report-risk-detail');
 for(const [label,value] of [['Fonte/situação',`Fonte sintética ${index}. `.repeat(length)],['Frequência','Diária'],['Tempo/circunstância','Uma hora'],['Possíveis danos/consequências','Dano sintético'],['Medidas existentes','Medida sintética'],['Melhorias propostas',improvement],['Precisa medir/avaliar',index%2?'Sim':'Não']])detail.append(el('div','','report-detail-field',el('strong',label,'report-field-label'),el('p',value)));
 return el('div','','viewer-risk',el('summary','','',el('span','','viewer-risk-heading',el('strong',`Risco sintético ${index}`),el('small','Código de teste'))),detail);
}
function prepare(...sections){const content=el('div','','',...sections);content.append(section('Pendências e recomendações'));content.children.at(-1).classList.add('report-recommendations');compactPrintReport(content);return content;}
function checkSheets(content){for(const sheet of content.querySelectorAll('.report-sheet'))assert.ok(sheet.querySelector('.report-sheet-body').getBoundingClientRect().bottom<=sheet.getBoundingClientRect().bottom+.5,'sheet must not overflow');}

test('riscos usam singular e plural corretos',()=>{assert.equal(riskCountLabel(1),'1 risco');assert.equal(riskCountLabel(0),'0 riscos');assert.equal(riskCountLabel(8),'8 riscos');});

test('19 riscos mantêm cartões, categorias, grupos e referências nas folhas calculadas',t=>{
 installDOM(t);
 const content=prepare(section('Riscos e detalhamento',group('Cargo sintético A',category('physical',risk(1),risk(2)),category('ergonomic',...Array.from({length:6},(_,n)=>risk(n+3,{improvement:`Recomendação ${n+1}`})))),group('Cargo sintético B',category('ergonomic',risk(9,{length:4,improvement:'Recomendação 7'})),category('accident',...Array.from({length:9},(_,n)=>risk(n+10,{length:n%3+1,improvement:`Recomendação ${n+5}`})))),group('Cargo sintético C',category('ergonomic',risk(19,{improvement:'Recomendação 14'})))));
 paginateReport(content);
 const cards=content.querySelectorAll('.viewer-risk');assert.equal(cards.length,19);
 for(let index=1;index<=19;index++)assert.equal(cards.filter(card=>card.querySelector('.viewer-risk-heading strong').textContent.startsWith(`K${String(index).padStart(2,'0')} ·`)).length,1);
 for(const card of cards){assert.ok(card.classList.contains('print-risk-card'));assert.ok(card.closest('.print-risk-columns'),'ordinary risks, including singletons, stay in columns');assert.ok(card.closest('.viewer-group'));}
 assert.equal(content.querySelectorAll('.print-risk-columns .print-risk-columns').length,0);
 assert.equal(content.querySelectorAll('[data-print-reference]').length,17);
 assert.equal(content.querySelectorAll('[data-recommendation-ref]').length,14);
 const pages=content.querySelectorAll('.report-sheet');
 for(const link of content.querySelectorAll('[data-print-reference]')){const page=pages.findIndex(page=>page.querySelectorAll('[data-recommendation-ref]').some(row=>row.dataset.recommendationRef===link.dataset.printReference))+1;assert.ok(page);assert.equal(link.textContent,`${link.dataset.printReference} — Recomendações consolidadas, pág. ${page}`);}
 checkSheets(content);
});

test('quebra de par de categorias preserva duas colunas sem aninhamento ou perda',t=>{
 installDOM(t);
 const filler=el('p','Introdução sintética');filler.dataset.testHeight='650';
 const tall=index=>{const card=risk(index);card.dataset.testHeight='430';return card;};
 const content=prepare(section('Riscos e detalhamento',filler,group('Cargo de teste',category('physical',tall(1),tall(2)),category('ergonomic',tall(3),tall(4)))));
 paginateReport(content);
 assert.equal(content.querySelectorAll('.viewer-risk').length,4);
 assert.ok(content.querySelectorAll('.print-category-pair').length>1,'exercise pair splitting, not just moving the complete pair');
 assert.equal(content.querySelectorAll('.print-risk-columns .print-risk-columns').length,0);
 for(const card of content.querySelectorAll('.viewer-risk')){
  const code=card.querySelector('.viewer-risk-heading strong').textContent.slice(0,3),physical=['K01','K02'].includes(code);
  const column=card.closest('.print-risk-column');assert.ok(column);
  assert.equal(card.closest('.viewer-category').dataset.type,physical?'physical':'ergonomic');
  assert.equal(column.parentElement.children.indexOf(column),physical?0:1);
 }
 checkSheets(content);
});

test('par que não acomoda nenhum cartão usa fallback sem perder categoria ou conteúdo',t=>{
 installDOM(t);
 const filler=el('p','Introdução sintética');filler.dataset.testHeight='650';
 const content=prepare(section('Riscos e detalhamento',filler,group('Cargo do par alto',category('physical',risk(1,{length:88})),category('ergonomic',risk(2,{length:88})))));
 const before=content.querySelectorAll('.compact-risk-fields').map(table=>table.textContent);
 paginateReport(content);
 const cards=content.querySelectorAll('.viewer-risk');assert.equal(cards.length,2);
 for(const [index,card] of cards.entries()){
  assert.ok(card.classList.contains('print-risk-card'));assert.equal(card.closest('.print-risk-columns'),null);
  assert.equal(card.closest('.viewer-category').dataset.type,index===0?'physical':'ergonomic');
  assert.equal(card.querySelector('.compact-risk-fields').textContent,before[index]);
 }
 assert.equal(content.querySelectorAll('.print-risk-columns .print-risk-columns').length,0);checkSheets(content);
});

test('título de cargo levado à página seguinte não repete a faixa de contexto',t=>{
 installDOM(t);
 const filler=el('p','Introdução sintética');filler.dataset.testHeight='700';
 const content=prepare(section('Riscos e detalhamento',filler,group('Cargo único',category('accident',risk(1,{length:4})))));
 paginateReport(content);
 const page=content.querySelectorAll('.report-sheet').find(page=>page.querySelector('.viewer-group > summary'));
 assert.equal(page.querySelector('.report-sheet-context').textContent,'');
 assert.equal(page.querySelectorAll('.viewer-group > summary').length,1);
 checkSheets(content);
});

test('primeiro título de seção não recebe rótulo falso de continuação',t=>{
 installDOM(t);
 const filler=el('p','Conteúdo anterior');filler.dataset.testHeight='810';
 const content=el('div','','',section('Seção anterior',filler),section('NRs identificadas no levantamento',el('p','Conteúdo sintético')));
 paginateReport(content);
 const page=content.querySelectorAll('.report-sheet').find(page=>page.querySelectorAll('h3').some(heading=>heading.textContent==='NRs identificadas no levantamento'));
 assert.equal(page.querySelector('.report-sheet-context').textContent,'');checkSheets(content);
});

test('cartão único e quebra após coluna preenchida não voltam a tabela larga',t=>{
 installDOM(t);
 const tall=index=>{const card=risk(index);card.dataset.testHeight='360';return card;};
 const content=prepare(section('Riscos e detalhamento',group('Cargo A',category('accident',tall(1),tall(2),tall(3),tall(4),tall(5))),group('Cargo B',category('ergonomic',risk(6)))));
 paginateReport(content);
 const cards=content.querySelectorAll('.viewer-risk');assert.equal(cards.length,6);
 assert.ok(content.querySelectorAll('.print-risk-columns').length>=3);
 for(const card of cards)assert.ok(card.closest('.print-risk-column'));
 const singleton=cards.find(card=>card.textContent.includes('K06 ·'));
 assert.equal(singleton.closest('.print-risk-columns').querySelectorAll('.viewer-risk').length,1);
 assert.equal(singleton.closest('.print-risk-columns').children.length,2);checkSheets(content);
});

test('continuações de NRs e recomendações repetem contexto e cabeçalho da tabela',t=>{
 installDOM(t);
 const makeTable=()=>{const table=el('table','','compact-table',el('thead','','',el('tr','','',el('th','Coluna sintética'))));const body=el('tbody');for(let i=0;i<18;i++){const row=el('tr','','',el('td',`Linha sintética ${i}`));row.dataset.testHeight='70';body.append(row);}table.append(body);return table;};
 const content=el('div','','',section('NRs identificadas no levantamento',makeTable()),section('Recomendações consolidadas',makeTable()));
 paginateReport(content);
 for(const title of ['NRs identificadas no levantamento','Recomendações consolidadas']){
  const continued=content.querySelectorAll('.report-sheet').filter(page=>page.querySelector('.report-sheet-context').textContent===title+' — continuação');assert.ok(continued.length);
  for(const page of continued)assert.ok(page.querySelector('thead'));
 }
 assert.equal(content.querySelectorAll('tbody tr').length,36);checkSheets(content);
});

test('registro excepcionalmente alto preserva todos os campos e o estilo de cartão',t=>{
 installDOM(t);
 const content=prepare(section('Riscos e detalhamento',group('Cargo com registro longo',category('accident',risk(1,{length:400,improvement:'Recomendação longa'})))));
 const before=content.querySelectorAll('.compact-risk-fields tbody tr').map(row=>row.textContent).join('');
 paginateReport(content);
 assert.ok(content.querySelectorAll('.viewer-risk').length>1,'exercise record fragmentation across sheets');
 const after=content.querySelectorAll('.compact-risk-fields tbody tr').map(row=>row.textContent).join('');
 assert.equal(after,before.replace('pág. 0000',`pág. ${content.querySelector('[data-print-reference]')?.textContent.match(/pág\. (\d+)/)?.[1]}`));
 for(const card of content.querySelectorAll('.viewer-risk'))assert.ok(card.classList.contains('print-risk-card'));
 assert.equal(content.querySelectorAll('.print-risk-columns .print-risk-columns').length,0);checkSheets(content);
});

test('postos com nomes iguais mantêm fotos no cargo de origem sem alterar respostas',t=>{
 installDOM(t);
 const answers={selectedSectors:['Setor A','Setor B'],jobsBySector:[['Setor A',[{name:'Cargo A',quantity:1,activities:'Atividade A',workstations:[{name:'Posto igual',photoPaths:['synthetic-a']}]}]],['Setor B',[{name:'Cargo B',quantity:1,activities:'Atividade B',workstations:[{name:'Posto igual',photoPaths:['synthetic-b']}]}]]]};
 const saved=JSON.stringify(answers),content=el('div','','',section('Setores e cargos',el('div','','report-card-list')));
 organizeReport(content,answers);
 for(const image of content.querySelectorAll('img'))assert.equal(image.closest('.report-job').querySelector('strong').textContent,image.dataset.photoPath==='synthetic-a'?'Cargo A':'Cargo B');
 assert.equal(content.querySelectorAll('img').length,2);assert.equal(JSON.stringify(answers),saved);
 paginateReport(content);
 for(const image of content.querySelectorAll('img'))assert.equal(image.closest('.report-job').querySelector('strong').textContent,image.dataset.photoPath==='synthetic-a'?'Cargo A':'Cargo B');
 assert.equal(content.querySelectorAll('img').length,2);assert.equal(JSON.stringify(answers),saved);
});

test('CSS de cartão também cobre o fallback, sem reduzir fonte ou dimensões da folha',()=>{
 const css=fs.readFileSync(new URL('../report-print.css',import.meta.url),'utf8');
 assert.match(css,/#report-content \.viewer-risk\.print-risk-card\{/);
 assert.match(css,/\.print-risk-card \.compact-risk-fields\{display:block!important;font-size:8\.5pt\}/);
 assert.match(css,/width:180mm;height:258mm/);
});
