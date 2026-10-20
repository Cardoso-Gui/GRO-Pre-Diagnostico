// Entirely invented records. No auth client, Supabase request, or saved report.
import {organizeReport} from '/report-layout.js';
import {mountReportViewer} from '/report-viewer.js';
import {hydrateReportPhotos} from '/workstation-photos.js';
import '/report-opening.js';
import {createReportVisitIntroduction} from '/report-visit-introduction.js';

const content=document.querySelector('#report-content');
const parameters=new URLSearchParams(location.search);
const scenario=parameters.get('scenario')||'full';
const current=parameters.get('version')!=='baseline';
await import('/report-cipa.js');
await import('/report-sesmt.js');
const notices=current?(await import('/report-notices.js')).REPORT_NOTICES:null;
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
if(scenario==='empty'){answers.selectedSectors=[];answers.jobsBySector=[];answers.employees=0;}
const saved=JSON.stringify(answers);
if(scenario==='full'){
 const cover=make('section','','report-cover');cover.append(make('span','Fixture sintética'),make('h3','Empresa fictícia de teste'));globalThis.GRO_REPORT_OPENING.apply(cover);
 const visitValues={identity:'Empresa fictícia de teste (Unidade sintética)',cnpj:'12.345.678/0001-99',fullAddress:'Rua Sintética, 100, Bloco de Teste, Bairro Fictício, Cidade Sintética/SP, CEP: 01000-000',visitDate:'01/01/2026',responsible:'Responsável fictício pela visita'};
 cover.append(createReportVisitIntroduction(visitValues));
 cover.append(make('p','O levantamento tem como objetivo apoiar a identificação dos perigos e o planejamento das ações de prevenção, considerando as atividades desenvolvidas e as informações fornecidas pela empresa.','report-objective'));
 const summary=make('div','','report-summary-grid');
 for(const pairs of [[['CNAE principal','0000-0/00 · Atividade fictícia para teste']],[['Grau de risco','2'],['Funcionários','3']],[['Revisão','Rev 01'],['Data da visita','01/01/2026']]]){const item=make('div','','report-summary-item');for(const [i,[label,value]] of pairs.entries())item.append(make('span',label,i?'report-second-label':''),make('strong',value));summary.append(item);}
 const dimensions=make('div','','report-dimension-grid');
 for(const [label,details] of [['CIPA',['Sem comissão nesta faixa - Sem atendimento pelo SESMT, nomear um representante entre os empregados. MEI é dispensado dessa nomeação (NR-5, 5.4.13).']],['SESMT',['Sem equipe mínima nesta faixa','Pelo Anexo II da NR-4 não há profissionais mínimos para essa faixa.']]]){const card=make('section','','report-dimension-card');card.append(make('h4',label),...details.map(text=>make('p',text)));dimensions.append(card);}
 cover.append(summary,dimensions);globalThis.GRO_REPORT_OPENING.apply(cover);globalThis.GRO_REPORT_CIPA.apply(cover);globalThis.GRO_REPORT_SESMT.apply(cover);content.append(cover);
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
}else if(scenario==='packing'){
 list.append(make('h4',groups[0]));types.forEach((type,i)=>risk(i+1,type,groups[0]));
}else if(scenario==='missing-fields'){
 list.append(make('h4',groups[0]));risk(1,types[0],groups[0]);
}
const expectedNotices=[];
const oldNorms='Normas gerais e normas com critérios identificados nos dados informados. Confirme o enquadramento e os requisitos com o responsável técnico; a ausência nesta lista não representa dispensa.';
const oldClosing='Este levantamento registra as condições observadas na data da visita e as informações fornecidas pela empresa. As necessidades de avaliação complementar e as melhorias apontadas deverão ser analisadas pelos responsáveis técnicos, para definição das medidas e dos prazos de implementação.';
function addNorms(empty=false){
 const norms=block('NRs identificadas no levantamento');norms.append(make('p',oldNorms));const cards=make('div','','report-card-list');norms.append(cards);
 if(empty){const card=make('article','','report-mini-card');card.append(make('strong','Nenhuma NR aplicável identificada'),make('span',''),make('small','Revise o levantamento ou valide com o responsável técnico.'));cards.append(card);}
 else for(const token of ['A','B']){const card=make('article','','report-mini-card');card.append(make('strong','Norma sintética '+token),make('span','Critério sintético para teste.'),make('span','Critério identificado','nr-status'));cards.append(card);}
 content.append(norms);if(current)expectedNotices.push(notices.normsIntroduction,...(empty?[notices.noNorms,notices.normsValidation]:[]));
}
function addClosing(){
 const closing=make('section','','report-closing');closing.append(make('h3','Considerações finais'),make('p',current?notices.closing:oldClosing));
 const signatures=make('div','','report-signatures');
 for(const label of ['Responsável da empresa','Responsável pela visita']){const signature=make('div','','report-signature');signature.append(make('div','','report-signature-line'),make('strong','Responsável fictício'),make('span',label));if(label==='Responsável pela visita')signature.append(make('small',current?notices.professional:'Função e registro não preservados neste relatório.','report-professional-legacy'));signatures.append(signature);}
 closing.append(signatures);content.append(closing);if(current)expectedNotices.push(notices.closing,notices.professional);
}
if(scenario==='full'){
 const combined=block('EPIs e treinamentos sugeridos'),cards=make('div','','report-card-list');combined.append(cards);
 for(const [index,target]of groups.entries()){
  cards.append(make('h4',target));const epi=make('article','','report-mini-card');epi.append(make('strong','EPIs'),make('span','EPIs informados no levantamento'),make('small','Situação sintética '+index+': Equipamento fictício preservado'));cards.append(epi);
  const training=make('article','','report-mini-card');training.append(make('strong','Treinamento: Capacitação sintética '+index),make('span','Justificativa fictícia preservada.'),make('small','Sugerido por: Critério fictício preservado'));cards.append(training);
 }
 content.append(combined);addNorms();content.append(block('Pendências para validação técnica'));addClosing();if(current)expectedNotices.push(notices.trainingIntroduction);
}
if(['empty','missing-fields'].includes(scenario)){
 const combined=block('EPIs e treinamentos sugeridos'),cards=make('div','','report-card-list');combined.append(cards);content.append(combined);
 if(scenario==='empty'){
  const inventory=block('Riscos identificados'),items=make('div','','report-card-list'),card=make('article','','report-mini-card');card.append(make('strong','Nenhum risco informado'),make('span',''),make('small','Selecione riscos para consolidar esta seção.'));items.append(card);inventory.append(items);details.before(inventory);
  const sectors=block('Setores e cargos'),sectorList=make('div','','report-card-list'),sectorCard=make('article','','report-mini-card');sectorCard.append(make('strong','Nenhum setor informado'),make('span',''),make('small','Preencha os setores para consolidar esta seção.'));sectorList.append(sectorCard);sectors.append(sectorList);content.prepend(sectors);
  if(current)expectedNotices.push(notices.risks,notices.sectors);
 }else{
  cards.append(make('h4',groups[0]));
  const epi=make('article','','report-mini-card');epi.append(make('strong','EPIs'),make('span','EPIs informados no levantamento'),make('small','Risco sintético 01: EPI aplicável, mas não informado'));cards.append(epi);
  const training=make('article','','report-mini-card');training.append(make('strong','Treinamentos'),make('span','Sem sugestão pré-cadastrada'),make('small','Validar necessidade com o responsável técnico.'));cards.append(training);
  if(current)expectedNotices.push(notices.epi);
 }
 addNorms(scenario==='empty');content.append(block('Pendências para validação técnica'));addClosing();
 if(current)expectedNotices.push(notices.training,notices.trainingValidation,notices.improvements,notices.measurements,notices.trainingIntroduction);
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
   dimensions:[...sheet.querySelectorAll('.report-dimension-card')].map(card=>({title:card.querySelector('h4').textContent,rect:rect(card),paragraphs:[...card.querySelectorAll('p')].map(p=>({text:p.textContent,rect:rect(p)}))})),
   cards:[...sheet.querySelectorAll('.viewer-risk')].map(card=>({id:card.querySelector('[data-fixture-record]')?.dataset.fixtureRecord,heading:card.querySelector('.viewer-risk-heading')?.textContent,group:card.closest('.viewer-group')?.querySelector(':scope > summary > strong')?.textContent||sheet.querySelector('.report-sheet-context').textContent,category:card.closest('.viewer-category')?.dataset.type,rect:rect(card),fields:[...card.querySelectorAll('.compact-risk-fields tbody tr')].map(field=>({text:field.textContent,rect:rect(field)}))})),
   images:[...sheet.querySelectorAll('img')].map(img=>({path:img.dataset.photoPath,complete:img.complete,naturalWidth:img.naturalWidth,sourceKind:img.src.split(':')[0],sameOriginal:originalImageNodes.includes(img),rect:rect(img)}))})),
  restored:!document.body.classList.contains('report-paginated'),
  originalNodesRestored:originalContentNodes.every((node,i)=>content.childNodes[i]===node)&&originalImageNodes.every(img=>content.contains(img)),
  detailsRestored:originalDetails.every(([el,open])=>el.open===open),
  answersUnchanged:JSON.stringify(answers)===saved
 };
}
window.synthetic={expected,expectedNotices,photoSizes:photoPaths.map((_,i)=>({width:360+i*7,height:240+i*5})),viewer,snapshot,prints:[],beforeCount:0,afterCount:0};
// Register after the real viewer so this records its synchronous export state.
window.addEventListener('beforeprint',()=>{window.synthetic.beforeCount++;window.synthetic.prints.push(snapshot());});
window.addEventListener('afterprint',()=>{window.synthetic.afterCount++;});
await document.fonts.ready;
window.synthetic.originals=[...content.querySelectorAll('img')].map(img=>({complete:img.complete,naturalWidth:img.naturalWidth,sourceKind:img.src.split(':')[0]}));
window.synthetic.ready=true;
