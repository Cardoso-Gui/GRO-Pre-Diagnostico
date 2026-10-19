const node=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const text=el=>el?.textContent.trim()||'';
const filled=value=>value.trim()!==''&&!/^[-–—]$/.test(value.trim());
const meaningful=value=>filled(value)&&!/^n\/?a\.?$/i.test(value.trim());
function table(headings,rows,className=''){
 const table=node('table','','compact-table '+className),head=node('thead'),heading=node('tr'),body=node('tbody');
 for(const label of headings){const th=node('th',label);th.scope='col';heading.append(th);}
 head.append(heading);
 for(const values of rows){const row=node('tr');for(const value of values){const cell=node('td');if(value instanceof Node)cell.append(value);else cell.textContent=value;row.append(cell);}body.append(row);}
 table.append(head,body);return table;
}
function stacked(values){const div=node('div');for(const value of values)div.append(node('p',value));return div;}
export function compactPrintReport(content){
 const sections=[...content.children],find=title=>sections.find(el=>text(el.querySelector('h3'))===title);
 const recommendations=new Map(),measurements=[];
 let sequence=0;
 for(const risk of content.querySelectorAll('.viewer-risk')){
  const card=risk.querySelector('.report-risk-detail');if(!card)continue;
  const fields=[...card.querySelectorAll('.report-detail-field')].map(el=>({label:text(el.querySelector('.report-field-label')),value:text(el.querySelector('p'))}));
  const get=label=>fields.find(field=>field.label===label)?.value||'';
  const name=text(risk.querySelector('.viewer-risk-heading strong')),code=text(risk.querySelector('.viewer-risk-heading small'));
  const target=text(risk.closest('.viewer-group')?.querySelector(':scope > summary > strong'))||'Grupo não informado';
  const key='K'+String(++sequence).padStart(2,'0');
  const header=risk.querySelector('.viewer-risk-heading strong');if(header)header.textContent=key+' · '+name;
  const improvement=get('Melhorias propostas');let reference='';
  if(meaningful(improvement)){
   if(!recommendations.has(improvement))recommendations.set(improvement,{ref:'R'+String(recommendations.size+1).padStart(2,'0'),links:new Map(),value:improvement});
   const item=recommendations.get(improvement);
   if(!item.links.has(target))item.links.set(target,[]);
   item.links.get(target).push(key+' · '+name);reference=item.ref;
  }
  if(get('Precisa medir/avaliar')==='Sim')measurements.push([key,target,name,code]);
  const rows=[];let exposureAdded=false;
  for(const {label,value} of fields){
   if(!filled(value))continue;
   if(label==='Frequência'||label==='Tempo/circunstância'){
    if(!exposureAdded){const values=[['Frequência',get('Frequência')],['Tempo/circunstância',get('Tempo/circunstância')]].filter(([,v])=>filled(v));rows.push(['Exposição',values.map(([l,v])=>l+': '+v).join(' · ')]);exposureAdded=true;}
   }else if(label==='Melhorias propostas'&&reference)rows.push(['Recomendação',reference+' — ver Recomendações consolidadas']);
   else rows.push([label,value]);
  }
  const extra=[...card.children].filter(el=>!el.classList.contains('report-detail-field'));
  card.replaceChildren(table(['Campo','Informação registrada'],rows,'compact-risk-fields'),...extra);
  risk.classList.toggle('compact-long',risk.textContent.length>1500);
 }
 const originalRecommendations=content.querySelector('.report-recommendations');
 if(sequence&&originalRecommendations){
  const section=node('section','','report-block compact-recommendations');
  section.append(node('h3','Recomendações consolidadas'));
  if(recommendations.size)section.append(table(['Ref.','Cargo/GHE e risco','Recomendação registrada'],[...recommendations.values()].map(item=>[item.ref,stacked([...item.links].map(([target,risks])=>target+'\n'+risks.join('\n'))),item.value]),'compact-recommendations-table'));
  else section.append(node('p','Nenhuma melhoria adicional informada. Registros como “n/a” permanecem nas fichas dos riscos.'));
  section.append(node('h4','Medições e avaliações indicadas'));
  if(measurements.length)section.append(table(['Ref. do risco','Cargo/GHE','Risco'],measurements.map(([key,target,name,code])=>[key,target,name+' · '+code])));
  else section.append(node('p','Nenhuma medição ou avaliação marcada como necessária.'));
  // Sources and exposure details remain in the referenced risk record.
  originalRecommendations.replaceWith(section);
 }
 const training=find('Treinamentos sugeridos');
 if(training){
  const grouped=new Map(),groups=training.querySelectorAll('.viewer-group');
  for(const group of groups){
   const target=text(group.querySelector(':scope > summary > strong'));
   for(const card of group.querySelectorAll('.report-mini-card')){
    const title=text(card.querySelector('strong')),reason=text(card.querySelector('span')),key=JSON.stringify([title,reason]);
    if(!grouped.has(key))grouped.set(key,{title,reason,links:[]});
    const criteria=[...card.querySelectorAll('small')].map(text);
    grouped.get(key).links.push({target,criteria});
   }
  }
  if(grouped.size){
   const rows=[...grouped.values()].map(item=>{
    const bindings=node('div');for(const binding of item.links){const p=node('p');p.append(node('strong',binding.target));for(const line of binding.criteria)p.append(node('br'),document.createTextNode(line));bindings.append(p);}
    return [stacked([item.title,item.reason].filter(Boolean)),bindings];
   });
   training.querySelector('.report-card-list')?.replaceWith(table(['Treinamento / justificativa','Cargos/GHEs e critérios registrados'],rows));
  }
 }
 const epis=find('EPIs informados');
 if(epis){
  const rows=[];
  for(const group of epis.querySelectorAll('.viewer-group')){
   const target=text(group.querySelector(':scope > summary > strong'));
   for(const card of group.querySelectorAll('.report-mini-card')){
    const lines=[...card.querySelectorAll('small')].map(text),description=text(card.querySelector('span'));
    if(!lines.length)rows.push([target,'',description]);
    for(const line of lines){const colon=line.indexOf(':');if(colon>0)rows.push([target,line.slice(0,colon),line.slice(colon+1).trim()]);else rows.push([target,description,line]);}
   }
  }
  if(rows.length)epis.querySelector('.report-card-list')?.replaceWith(table(['Cargo/GHE','Risco / situação','EPI ou observação registrada'],rows));
 }
 const norms=find('NRs identificadas no levantamento');
 if(norms){
  const cards=[...norms.querySelectorAll('.report-mini-card')];
  if(cards.length){
   const rows=cards.map(card=>[text(card.querySelector('strong')),text(card.querySelector('.nr-status')),[...card.children].filter(el=>el.tagName!=='STRONG'&&!el.classList.contains('nr-status')).map(text).join('\n')]);
   norms.querySelector('.report-card-list')?.replaceWith(table(['Norma','Situação registrada','Critério / observação'],rows));
  }
 }
}
