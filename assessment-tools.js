export const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function assessmentIndex(answers={}){
 const sectors=new Set(answers.selectedSectors||[]),items=[];
 for(const sector of sectors)items.push({kind:'Setor',name:sector,sector});
 for(const [sector,jobs] of answers.jobsBySector||[])if(sectors.has(sector))for(const job of jobs)items.push({kind:'Cargo',name:job.name,sector});
 for(const ghe of answers.gheList||[])items.push({kind:'GHE',name:ghe.name,id:ghe.id});
 return items;
}
export function mountAssessmentTools({doc=document,go,getPending=raw=>raw.missing||[],correct=()=>{}}){
 const win=doc.defaultView,layout=doc.querySelector('.wizard-layout');if(!layout||doc.querySelector('#assessment-tools'))return;
 const make=(tag,text,cls)=>{const el=doc.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 const host=make('section','','assessment-tools');host.id='assessment-tools';host.setAttribute('aria-label','Localizar informações e revisar pendências');host.hidden=true;
 const searchLabel=make('label','Localizar setor, cargo ou GHE');searchLabel.htmlFor='assessment-find';
 const input=make('input','');input.id='assessment-find';input.type='search';input.placeholder='Digite um nome';input.autocomplete='off';input.maxLength=240;
 const results=make('div','','assessment-find-results');results.id='assessment-find-results';input.setAttribute('aria-controls',results.id);
 const searchStatus=make('p','','assessment-find-status');searchStatus.setAttribute('role','status');
 const search=make('div','','assessment-find');search.append(searchLabel,input,searchStatus,results);
 const pending=make('details','','assessment-pending'),summary=make('summary','Ver pendências do levantamento');
 const body=make('div','','assessment-pending-body'),count=make('p','','assessment-pending-count');count.setAttribute('role','status');
 const list=make('div','','assessment-pending-list'),refresh=make('button','Atualizar pendências','secondary-button');refresh.type='button';
 body.append(count,list,refresh);pending.append(summary,body);host.append(search,pending);layout.before(host);
 let ready=false,timer;
 const raw=()=>globalThis.GRO_FORM?.review?.();
 const focus=(node)=>{if(!node)return;node.tabIndex=-1;node.focus({preventScroll:true});node.scrollIntoView({block:'center',behavior:'auto'});};
 function openItem(item){
  if(item.kind==='GHE'){
   go(3);const cards=[...doc.querySelectorAll('#ghe-management-list > .risk-card')];
   const position=(raw()?.answers.gheList||[]).findIndex(ghe=>ghe.id===item.id);
   const card=cards.find(el=>el.dataset.target===item.id)||cards[position];
   if(card){if(card.tagName==='DETAILS')card.open=true;focus(card.querySelector('summary,h3')||card);return;}
   go(4);const risk=[...doc.querySelectorAll('.risk-accordion')].find(el=>el.dataset.target===item.id);if(risk){risk.open=true;focus(risk.querySelector('summary'));}return;
  }
  go(2);const sector=[...doc.querySelectorAll('.job-card')].find(el=>el.querySelector('.sector-card-header h3')?.textContent===item.sector);
  if(!sector)return;const toggle=sector.querySelector('.sector-collapse-button');if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();
  const row=item.kind==='Cargo'?[...sector.querySelectorAll('.job-edit-row')].find(el=>el.querySelector('.job-card-header strong')?.textContent===item.name):null;
  focus(row?.querySelector('strong')||sector.querySelector('h3'));
 }
 function find(){
  results.replaceChildren();searchStatus.textContent='';const query=normalizeSearch(input.value.trim());if(!ready||!query)return;
  const data=raw();if(!data)return;
  const matches=assessmentIndex(data.answers).filter(item=>normalizeSearch(item.name+' '+(item.sector||'')).includes(query));
  searchStatus.textContent=matches.length?`${matches.length} resultado(s)${matches.length>20?' · mostrando os primeiros 20':''}`:'Nenhum setor, cargo ou GHE encontrado.';
  for(const item of matches.slice(0,20)){const button=make('button',`${item.kind} · ${item.name}${item.kind==='Cargo'?' — '+item.sector:''}`);button.type='button';button.addEventListener('click',()=>openItem(item));results.append(button);}
 }
 function renderPending(){
  if(!ready)return;const data=raw();if(!data)return;
  const items=getPending(data);
  count.textContent=items.length?`${items.length} pendência(s) de preenchimento. Use os atalhos para corrigir.`:'Campos obrigatórios preenchidos. Confira a etapa Revisão e relatório.';
  summary.textContent=items.length?`Pendências do levantamento · ${items.length}`:'Pendências do levantamento · nenhuma';list.replaceChildren();
  for(const item of items){const row=make('div','','assessment-pending-row'),copy=make('div','');copy.append(make('small',item.section),make('span',item.text));const button=make('button','Corrigir','secondary-button');button.type='button';button.addEventListener('click',()=>correct(item));row.append(copy,button);list.append(row);}
 }
 input.addEventListener('input',find);refresh.addEventListener('click',renderPending);pending.addEventListener('toggle',()=>{if(pending.open)renderPending();});
 // Read current form state only while this panel is open. Never persist answers.
 const changed=event=>{if(host.contains(event.target))return;win.clearTimeout(timer);timer=win.setTimeout(()=>{if(pending.open)renderPending();if(input.value)find();},250);};
 doc.addEventListener('input',changed);doc.addEventListener('change',changed);
 return {loaded(){ready=true;host.hidden=false;input.value='';results.replaceChildren();searchStatus.textContent='';pending.open=false;summary.textContent='Ver pendências do levantamento';}};
}
