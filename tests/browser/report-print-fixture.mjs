// Entirely invented records. No auth client, Supabase request, or saved report.
import {organizeReport} from '/report-layout.js';
import {mountReportViewer} from '/report-viewer.js';
import {hydrateReportPhotos} from '/workstation-photos.js';
import '/report-opening.js';
import {createReportVisitIntroduction} from '/report-visit-introduction.js';

const content=document.querySelector('#report-content');
const parameters=new URLSearchParams(location.search);
const scenario=parameters.get('scenario')||'full';
const make=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const block=(title)=>{const el=make('section','','report-block');el.append(make('h3',title));return el;};
const types=['Físicos','Químicos','Biológicos','Ergonômicos','Acidentes'];
const groups=['Setor sintético A / Cargo sintético A','Setor sintético B / Cargo sintético B','Setor sintético C / Cargo sintético C'];
const expected=[];
const clientId='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';
const photoPaths=Array.from({length:6},(_,i)=>`${clientId}/${userId}/33333333-3333-4333-8333-${String(i+1).padStart(12,'0')}.jpg`);
const answers={visitDate:'2026-01-01',employees:3,selectedSectors:['Setor sintético A','Setor sintético B','Setor sintético C'],jobsBySector:[]};
for(let i=0;i<3;i++)answers.jobsBySector.push([answers.selectedSectors[i],[{name:`Cargo sintético ${'ABC'[i]}`,quantity:1,activities:'Atividade fictícia criada exclusivamente para teste.',workstations:i===0?[{name:'Posto sintético com seis fotos',note:'Imagens geradas por canvas. Nenhuma foto de cliente.',photoPaths}]:[]}]]);
const saved=JSON.stringify(answers);
if(scenario==='full'){
 const cover=make('section','','report-cover');cover.append(make('span','Fixture sintética'),make('h3','Empresa fictícia de teste'));globalThis.GRO_REPORT_OPENING.apply(cover);
 const visitValues={identity:'Empresa fictícia de teste (Unidade sintética)',cnpj:'12.345.678/0001-99',fullAddress:'Rua Sintética, 100, Bloco de Teste, Bairro Fictício, Cidade Sintética/SP, CEP: 01000-000',visitDate:'01/01/2026',responsible:'Responsável fictício pela visita'};
 cover.append(createReportVisitIntroduction(visitValues));
 cover.append(make('p','O levantamento tem como objetivo apoiar a identificação dos perigos e o planejamento das ações de prevenção, considerando as atividades desenvolvidas e as informações fornecidas pela empresa.','report-objective'));
 const summary=make('div','','report-summary-grid');
 for(const pairs of [[['CNAE principal','0000-0/00 · Atividade fictícia para teste']],[['Grau de risco','2'],['Funcionários','3']],[['Revisão','Rev 01'],['Data da visita','01/01/2026']]]){const item=make('div','','report-summary-item');for(const [i,[label,value]] of pairs.entries())item.append(make('span',label,i?'report-second-label':''),make('strong',value));summary.append(item);}
 const dimensions=make('div','','report-dimension-grid');
 for(const label of ['CIPA','SESMT']){const card=make('section','','report-dimension-card');card.append(make('h4',label),make('p','Resultado sintético de dimensionamento. Não constitui orientação técnica.'),make('p','Observação fictícia para verificar o espaço reservado às informações complementares de cada quadro.'));dimensions.append(card);}
 cover.append(summary,dimensions);globalThis.GRO_REPORT_OPENING.apply(cover);content.append(cover);
 const sectors=block('Setores e cargos');sectors.classList.add('report-sectors');sectors.append(make('div','','report-card-list'));content.append(sectors);
}
const details=block('Detalhamento dos riscos'),list=make('div','','report-card-list');details.append(list);content.append(details);
function risk(index,type,group){
 const token=String(index).padStart(2,'0'),card=make('article','','report-mini-card report-risk-detail');
 card.dataset.fixtureRecord=`RISK${token}`;
 card.append(make('strong',`Risco sintético ${token}`),make('span',`TEST${token} · ${type}`));
 const fields=[['Fonte/situação',`SRC${token} Fonte sintética independente.`],['Frequência','Diária'],['Tempo/circunstância','Uma hora em tarefa fictícia.'],['Possíveis danos/consequências',`DANO${token} Consequência fictícia.`],['Medidas existentes',`MED${token} Medida fictícia.`],['Melhorias propostas',scenario==='full'?`REC${token} Recomendação fictícia.`:'n/a'],['Precisa medir/avaliar','Não']];
 for(const [label,value] of fields){if(scenario==='packing'&&!['Fonte/situação','Possíveis danos/consequências','Medidas existentes'].includes(label))continue;const field=make('div','','report-detail-field');field.append(make('strong',label,'report-field-label'),make('p',value));card.append(field);}
 list.append(card);expected.push({id:`RISK${token}`,token,group,type,source:`SRC${token}`,damage:`DANO${token}`,measure:`MED${token}`});
}
if(scenario==='full'){
 let index=0;
 for(const [g,categories] of [[0,[[types[0],2],[types[3],6]]],[1,[[types[3],1],[types[4],9]]],[2,[[types[3],1]]]]){
  list.append(make('h4',groups[g]));for(const [type,count] of categories)for(let i=0;i<count;i++)risk(++index,type,groups[g]);
 }
}else{
 list.append(make('h4',groups[0]));types.forEach((type,i)=>risk(i+1,type,groups[0]));
}
organizeReport(content,answers);
// Production hydration path, with an in-memory storage stub and six real JPEGs.
const blobs=new Map();
if(scenario==='full'){
 for(const [i,path] of photoPaths.entries()){
  const canvas=document.createElement('canvas');canvas.width=360+i*7;canvas.height=240+i*5;
  const ctx=canvas.getContext('2d');ctx.fillStyle=['#dc2626','#16a34a','#2563eb','#ca8a04','#9333ea','#0891b2'][i];ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='white';ctx.fillRect(20,20,65+i*8,50);ctx.fillStyle='black';ctx.font='bold 32px Arial';ctx.fillText(`SYNTHETIC ${i+1}`,20,canvas.height-30);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));blobs.set(path,blob);
 }
 await hydrateReportPhotos(content,{storage:{from(bucket){if(bucket!=='workstation-photos')throw Error('Unexpected bucket');return {async download(path){if(!blobs.has(path))throw Error('Unexpected synthetic photo path');return {data:blobs.get(path),error:null};}};}}},clientId);
}
const viewer=mountReportViewer(content,{completed_at:'2026-01-01T12:00:00Z',title:'Levantamento sintético',report_revision:1,final_snapshot:{answers,client:{trade_name:'Empresa fictícia de teste'},professional:{name:'Profissional fictício'}}});
const originalImageNodes=[...content.querySelectorAll('img')];
const originalContentNodes=[...content.childNodes];
const originalDetails=[...content.querySelectorAll('details')].map(el=>[el,el.open]);
const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
function snapshot(){
 const pages=[...content.querySelectorAll('.report-sheet')];
 return {
  pageCount:pages.length,
  sheets:pages.map((sheet,index)=>({page:index+1,rect:rect(sheet),body:rect(sheet.querySelector('.report-sheet-body')),context:sheet.querySelector('.report-sheet-context').textContent,
   cover:[...sheet.querySelectorAll('.report-cover > p,.report-cover > .report-summary-grid,.report-cover > .report-dimension-grid')].map(el=>({className:el.className,text:el.textContent,rect:rect(el)})),
   cards:[...sheet.querySelectorAll('.viewer-risk')].map(card=>({id:card.querySelector('[data-fixture-record]')?.dataset.fixtureRecord,heading:card.querySelector('.viewer-risk-heading')?.textContent,group:card.closest('.viewer-group')?.querySelector(':scope > summary > strong')?.textContent||sheet.querySelector('.report-sheet-context').textContent,category:card.closest('.viewer-category')?.dataset.type,rect:rect(card),fields:[...card.querySelectorAll('.compact-risk-fields tbody tr')].map(field=>({text:field.textContent,rect:rect(field)}))})),
   images:[...sheet.querySelectorAll('img')].map(img=>({path:img.dataset.photoPath,complete:img.complete,naturalWidth:img.naturalWidth,sourceKind:img.src.split(':')[0],sameOriginal:originalImageNodes.includes(img),rect:rect(img)}))})),
  restored:!document.body.classList.contains('report-paginated'),
  originalNodesRestored:originalContentNodes.every((node,i)=>content.childNodes[i]===node)&&originalImageNodes.every(img=>content.contains(img)),
  detailsRestored:originalDetails.every(([el,open])=>el.open===open),
  answersUnchanged:JSON.stringify(answers)===saved
 };
}
window.synthetic={expected,photoSizes:photoPaths.map((_,i)=>({width:360+i*7,height:240+i*5})),viewer,snapshot,prints:[],beforeCount:0,afterCount:0};
// Register after the real viewer so this records its synchronous export state.
window.addEventListener('beforeprint',()=>{window.synthetic.beforeCount++;window.synthetic.prints.push(snapshot());});
window.addEventListener('afterprint',()=>{window.synthetic.afterCount++;});
await document.fonts.ready;
window.synthetic.originals=[...content.querySelectorAll('img')].map(img=>({complete:img.complete,naturalWidth:img.naturalWidth,sourceKind:img.src.split(':')[0]}));
window.synthetic.ready=true;
