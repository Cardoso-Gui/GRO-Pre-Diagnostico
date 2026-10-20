import './visit-date.js?v=20261019-visit1';
import {paginateReport} from './report-pagination.js?v=20261019-layout2';
import {compactPrintReport} from './report-print-compact.js?v=20261019-layout2';
const make=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function reportVisitDate(answers){return globalThis.GRO_VISIT_DATE.format(answers);}
export function riskCountLabel(count){return count+' '+(count===1?'risco':'riscos');}
function riskType(text){
 const value=normalized(text);
 for(const [match,label,key] of [['fisic','Físicos','physical'],['quimic','Químicos','chemical'],['biologic','Biológicos','biological'],['ergonom','Ergonômicos','ergonomic'],['acidente','Acidentes','accident']])if(value.includes(match))return {label,key};
 return {label:'Outros',key:'other'};
}
function disclosure(title,className,open=false){
 const details=make('details','',className),summary=make('summary'),label=make('strong',title);
 summary.append(label);details.append(summary);details.open=open;return details;
}
export function mountReportViewer(content,data){
 const $=selector=>document.querySelector(selector),answers=data.final_snapshot?.answers||{};
 const controls=new AbortController(),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:controls.signal});
 const blocks=[...content.children],blockWith=title=>blocks.find(el=>el.querySelector('h3')?.textContent.trim()===title);
 const cover=content.querySelector('.report-cover'),identified=blockWith('Riscos identificados'),riskBlock=blockWith('Detalhamento dos riscos');
 const riskCards=[...content.querySelectorAll('.report-risk-detail')],groups=[];
 const staff=answers.employees||[...content.querySelectorAll('.report-summary-item span')].find(el=>el.textContent.trim()==='Funcionários')?.nextElementSibling?.textContent||'—';
 const sectors=Array.isArray(answers.selectedSectors)?answers.selectedSectors.length:content.querySelectorAll('.report-sector').length;
 const jobs=content.querySelectorAll('.report-job').length;
 const byGhe=answers.selectedRiskMode==='ghe'||/Por GHE/i.test(identified?.textContent||'');
 // Keep sector contents intact so search and printing share the same disclosure behavior.
 for(const sector of content.querySelectorAll('.report-sector')){
  const title=sector.querySelector(':scope > .report-sector-title');
  if(!title)continue;
  const group=disclosure(title.textContent,'viewer-group viewer-sector',false);
  const count=sector.querySelectorAll('.report-job').length;
  group.querySelector('summary').append(make('span',count+' '+(count===1?'cargo':'cargos'),'viewer-count'));
  for(const child of [...sector.childNodes])if(child!==title)group.append(child);
  sector.replaceWith(group);
 }
 // Move the preserved risk inventory into the detail section, retaining legacy-only content.
 if(riskBlock&&identified){
  const inventory=disclosure('Lista de riscos identificados','viewer-inventory');
  for(const child of [...identified.children])if(child.tagName!=='H3')inventory.append(child);
  identified.remove();riskBlock.insertBefore(inventory,riskBlock.children[1]||null);
 }
 if(riskBlock){
  riskBlock.querySelector('h3').textContent='Riscos e detalhamento';
  const container=riskBlock.querySelector(':scope > .report-card-list');
  if(container){
   let current=null;
   for(const child of [...container.children]){
    if(child.tagName==='H4'){
     current=disclosure(child.textContent,'viewer-group',groups.length===0);groups.push(current);child.replaceWith(current);
    }else if(current)current.append(child);
   }
   for(const group of groups){
    const cards=[...group.querySelectorAll('.report-risk-detail')],categories=new Map();
    group.querySelector('summary').append(make('span',riskCountLabel(cards.length),'viewer-count'));
    const chips=make('div','','viewer-risk-types');group.querySelector('summary').after(chips);
    for(const card of cards){
     const title=card.querySelector(':scope > strong'),code=card.querySelector(':scope > span'),type=riskType(code?.textContent);
     if(!categories.has(type.key)){
      const category=make('section','','viewer-category');category.dataset.type=type.key;
      category.id='risk-type-'+groups.indexOf(group)+'-'+type.key;
      category.append(make('h4',type.label,'viewer-category-title'));categories.set(type.key,category);group.append(category);
     }
     const risk=disclosure(title?.textContent||'Risco','viewer-risk',cards.indexOf(card)===0);risk.dataset.type=type.key;
     const summary=risk.querySelector('summary'),heading=make('span','','viewer-risk-heading');
     heading.append(...summary.childNodes);if(code)heading.append(make('small',code.textContent));summary.append(heading);
     const measure=[...card.querySelectorAll('.report-detail-field')].find(field=>field.querySelector('strong')?.textContent==='Precisa medir/avaliar');
     if(measure?.querySelector('p')?.textContent.trim()==='Sim')summary.append(make('span','Avaliação indicada','viewer-evaluation'));
     title?.remove();code?.remove();risk.append(card);categories.get(type.key).append(risk);
    }
    for(const category of categories.values()){
     const button=make('button',category.querySelector('h4').textContent+' '+category.querySelectorAll('.viewer-risk').length,'viewer-type-chip');
     button.type='button';button.dataset.type=category.dataset.type;
     on(button,'click',()=>{category.querySelectorAll('details').forEach(el=>el.open=true);category.scrollIntoView({block:'start',behavior:'smooth'});});
     chips.append(button);
    }
   }
  }
 }
 // EPI and training headings keep the same target boundaries as the saved report.
 for(const block of [...content.children].filter(el=>/^(EPIs informados|Treinamentos sugeridos)$/.test(el.querySelector('h3')?.textContent||''))){
  let group;
  for(const child of [...(block.querySelector('.report-card-list')?.children||[])]){
   if(child.tagName==='H4'){group=disclosure(child.textContent,'viewer-group',false);child.replaceWith(group);}
   else if(group)group.append(child);
  }
 }
 const company=data.final_snapshot?.client;
 const companyName=company?.trade_name?.trim()||company?.legal_name||cover?.querySelector('h3')?.textContent||'Empresa';
 const revision=Number.isInteger(data.report_revision)?'Revisão '+String(data.report_revision).padStart(2,'0'):'Revisão não informada';
 const completed=new Date(data.completed_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
 $('#report-title').textContent='Relatório do levantamento';
 $('#report-dates').textContent='Visita: '+reportVisitDate(answers)+' · Conclusão: '+completed+' · '+revision;
 const overview=$('#report-overview'),identity=make('div','','viewer-company');
 identity.append(make('h2',companyName),make('p',data.title||'Levantamento'),make('small','Responsável: '+(data.team_members?.display_name||'Não informado')));
 const metrics=make('div','','viewer-metrics');
 for(const [value,label] of [[staff,'Funcionários'],[sectors,'Setores'],[byGhe?(groups.length||answers.gheList?.length||0):jobs,byGhe?'GHEs':'Cargos'],[riskCards.length,'Registros de riscos']]){
  const item=make('div');item.append(make('strong',String(value)),make('span',label));metrics.append(item);
 }
 overview.replaceChildren(identity,metrics);
 $('#report-mode').textContent=byGhe?'Organização por GHE':'Organização por cargo';
 // CSS string escaping prevents report text from becoming stylesheet syntax.
 const printStyle=make('style');printStyle.textContent='@page { @top-left { content: '+JSON.stringify(companyName.replace(/[\r\n]/g,' ').slice(0,110))+'; font: 8pt Arial; color: #36584e; } @top-right { content: '+JSON.stringify(revision)+'; font: 8pt Arial; color: #36584e; } }';document.head.append(printStyle);
 const sections=[...content.children],index=$('#report-index'),select=$('#report-section-select');
 index.replaceChildren();select.replaceChildren();
 let active=0,searchState=null,printState=null,printLayoutStyle=null;
 const titles=sections.map((section,i)=>{section.classList.add('viewer-section');section.id='report-section-'+i;return section===cover?'Visão geral':section.querySelector('h3')?.textContent||'Informações complementares';});
 const activate=(i,focus=false)=>{
  active=i;sections.forEach((el,n)=>el.dataset.active=String(i===n));
  [...index.children].forEach((el,n)=>{if(n===i)el.setAttribute('aria-current','location');else el.removeAttribute('aria-current');});
  select.value=String(i);if(focus){const heading=sections[i].querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}content.scrollIntoView({block:'start',behavior:'smooth'});}
 };
 sections.forEach((section,i)=>{
  const link=make('a');link.href='#'+section.id;link.append(make('span',String(i+1)),make('strong',titles[i]));
  on(link,'click',event=>{event.preventDefault();clearSearch();activate(i,true);});index.append(link);
  const option=make('option',titles[i]);option.value=String(i);select.append(option);
 });
 const input=$('#report-find'),searchStatus=$('#report-find-status');
 function clearSearch(){input.value='';applySearch();}
 function applySearch(){
  const query=normalized(input.value.trim());
  if(query&&!searchState)searchState=new Map([...content.querySelectorAll('details')].map(el=>[el,el.open]));
  content.classList.toggle('viewer-searching',!!query);let matches=0;
  sections.forEach(section=>{
   const match=!query||normalized(section.textContent).includes(query);section.dataset.searchHidden=String(!match);if(query&&match)matches++;
   for(const el of section.querySelectorAll('details,.viewer-category')){
    let ancestor=el.parentElement,inherited=normalized(section.querySelector('h3')?.textContent).includes(query);
    while(ancestor&&ancestor!==section){if(ancestor.matches('details')&&normalized(ancestor.querySelector(':scope > summary')?.textContent).includes(query))inherited=true;ancestor=ancestor.parentElement;}
    const found=!query||inherited||normalized(el.textContent).includes(query);
    el.dataset.searchHidden=String(!found);if(query&&found&&el.tagName==='DETAILS')el.open=true;
   }
  });
  if(!query&&searchState){for(const [el,open] of searchState)el.open=open;searchState=null;}
  searchStatus.textContent=query?(matches?matches+' seção(ões) encontrada(s).':'Nenhum resultado. Tente outra palavra.'):'';
  activate(active);
 }
 on(input,'input',applySearch);
 on(select,'change',()=>{const target=Number(select.value);clearSearch();activate(target,true);});
 on($('#report-expand'),'click',()=>content.querySelectorAll('details').forEach(el=>el.open=true));
 on($('#report-collapse'),'click',()=>content.querySelectorAll('details').forEach(el=>el.open=false));
 activate(0);
 const dialog=$('#report-photo-dialog'),large=$('#report-photo-large');
 const closePhoto=()=>{if(dialog.open)dialog.close();large.removeAttribute('src');};
 on($('#report-photo-close'),'click',closePhoto);
 on(dialog,'close',()=>large.removeAttribute('src'));
 for(const image of content.querySelectorAll('.report-workstation-photo')){
  const button=make('button','','viewer-photo');button.type='button';button.setAttribute('aria-label','Ampliar foto: '+image.alt);
  image.replaceWith(button);button.append(image);
  on(button,'click',()=>{large.src=image.src;large.alt=image.alt;$('#report-photo-title').textContent=image.alt;dialog.showModal();});
 }
 // Format a disposable print copy; restore the original nodes, listeners and states.
 const beforePrint=()=>{
  if(printState)return;
  printState=[...content.childNodes];
  const copies=printState.map(el=>el.cloneNode(true));
  content.replaceChildren(...copies);
  try{
   for(const original of [...content.querySelectorAll('details')]){
    const replacement=make('div');
    for(const attribute of original.attributes)if(attribute.name!=='open')replacement.setAttribute(attribute.name,attribute.value);
    replacement.append(...original.childNodes);original.replaceWith(replacement);
   }
   compactPrintReport(content);
   // beforeprint may run before the browser activates print media. Apply the
   // same rules while measuring, then remove them when printing finishes.
   printLayoutStyle=make('style');
   const rules=[];
   for(const sheet of [...document.styleSheets]){try{for(const rule of sheet.cssRules)if(rule.type===CSSRule.MEDIA_RULE&&rule.conditionText==='print')rules.push(...[...rule.cssRules].map(r=>r.cssText));}catch{}}
   printLayoutStyle.textContent=rules.join('\n');document.head.append(printLayoutStyle);
   document.body.classList.add('report-paginated');paginateReport(content,document.querySelector('#report-title')?.textContent||'Relatório do levantamento');
  }catch(error){printLayoutStyle?.remove();printLayoutStyle=null;document.body.classList.remove('report-paginated');content.replaceChildren(...printState);printState=null;throw error;}
 };
 const afterPrint=()=>{
  printLayoutStyle?.remove();printLayoutStyle=null;
  document.body.classList.remove('report-paginated');
  if(printState){content.replaceChildren(...printState);printState=null;}
 };
 on(window,'beforeprint',beforePrint);on(window,'afterprint',afterPrint);
 return {destroy(){controls.abort();afterPrint();closePhoto();printStyle.remove();index.replaceChildren();select.replaceChildren();overview.replaceChildren();input.value='';searchStatus.textContent='';content.classList.remove('viewer-searching');}};
}
