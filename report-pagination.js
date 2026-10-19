// Build fixed A4 sheets from the disposable print copy. Page references are
// resolved from the resulting sheets, never estimated from text length.
export function paginateReport(content,title='Relatório do levantamento'){
 for(const el of content.querySelectorAll('[data-search-hidden]'))el.removeAttribute('data-search-hidden');
 for(const el of content.querySelectorAll('.viewer-section'))el.setAttribute('data-active','true');
 const source=[...content.children];
 const holder=document.createElement('div');holder.className='report-sheets';
 content.replaceChildren(holder);
 let sheet,body,parents,context,hasContent=false,pendingHeadings=[];
 const sheets=[];
 function next(ctx=''){
  const carry=pendingHeadings;pendingHeadings=[];
  for(const item of carry)item.copy.remove();
  if(body)cleanEmpty();
  sheet=document.createElement('section');sheet.className='report-sheet';
  context=document.createElement('div');context.className='report-sheet-context';context.textContent=ctx;
  body=document.createElement('div');body.className='report-sheet-body';
  sheet.append(context,body);holder.append(sheet);sheets.push(sheet);parents=new Map();hasContent=false;
  for(const item of carry)put(item.original,item.chain,item.ctx);
 }
 function parent(chain){
  let result=body;
  for(const original of chain){
   if(!parents.has(original)){
    const copy=original.cloneNode(false);copy.removeAttribute('id');
    // A repeated table heading belongs to each physical sheet.
    if(original.tagName==='TABLE'){
     const head=original.querySelector(':scope > thead');if(head)copy.append(head.cloneNode(true));
    }
    result.append(copy);parents.set(original,copy);
   }
   result=parents.get(original);
  }
  return result;
 }
 const fits=(reserve=0)=>body.getBoundingClientRect().bottom+reserve<=sheet.getBoundingClientRect().bottom+0.5;
 function cleanEmpty(){
  for(const [original,copy] of [...parents].reverse()){
   if(!copy.textContent.trim()&&!copy.querySelector('img')){copy.remove();parents.delete(original);}
   else if(copy.tagName==='TABLE'&&!copy.querySelector('tbody tr')){copy.remove();parents.delete(original);}
  }
 }
 function textPieces(original,chain,ctx){
  let remaining=original.textContent;
  while(remaining){
   const p=parent(chain),piece=document.createTextNode('');p.append(piece);
   let low=0,high=remaining.length;
   while(low<high){const mid=Math.ceil((low+high)/2);piece.textContent=remaining.slice(0,mid);if(fits())low=mid;else high=mid-1;}
   if(low===0){piece.remove();cleanEmpty();if(!hasContent)throw new Error('Não foi possível acomodar um trecho do relatório.');next(ctx);continue;}
   // Prefer a word boundary, but also support long unbroken values.
   const space=remaining.lastIndexOf(' ',low);if(low<remaining.length&&space>low/2)low=space+1;
   piece.textContent=remaining.slice(0,low);remaining=remaining.slice(low);hasContent=true;pendingHeadings=[];
   if(remaining)next(ctx);
  }
 }
 // Stack cards independently, but never cross a category or group boundary.
 function putCategory(category,chain,ctx){
  const nested=[...chain,category];
  const risks=[...category.children].filter(el=>el.classList.contains('viewer-risk'));
  const measure=document.createElement('div');measure.className='print-risk-measure';content.append(measure);
  measure.replaceChildren(...risks.map(r=>r.cloneNode(true)));
  const fullHeight=measure.getBoundingClientRect().height;
  const trial=document.createElement('div');trial.className='print-risk-columns';
  const trialColumns=[document.createElement('div'),document.createElement('div')];
  for(const col of trialColumns){col.className='print-risk-column';trial.append(col);}
  measure.replaceChildren(trial);
  for(const risk of risks){
   const clone=risk.cloneNode(true);clone.classList.add('print-risk-card');
   const col=trialColumns[0].getBoundingClientRect().height<=trialColumns[1].getBoundingClientRect().height?trialColumns[0]:trialColumns[1];col.append(clone);
  }
  const useColumns=risks.length>1&&trial.getBoundingClientRect().height<fullHeight;
  measure.remove();
  let grid=null,columns=[];
  function startColumns(){
   grid=document.createElement('div');grid.className='print-risk-columns';
   columns=[0,1].map(()=>{const col=document.createElement('div');col.className='print-risk-column';grid.append(col);return col;});
   parent(nested).append(grid);
  }
  for(const child of category.childNodes){
   if(child.nodeType===3&&!child.textContent.trim())continue;
   if(child.nodeType!==1||!child.classList.contains('viewer-risk')||!useColumns){
    grid=null;put(child,nested,ctx);continue;
   }
   if(!grid)startColumns();
   const card=child.cloneNode(true);card.classList.add('print-risk-card');card.dataset.printOrder=risks.indexOf(child);
   const column=columns[0].getBoundingClientRect().height<=columns[1].getBoundingClientRect().height?columns[0]:columns[1];
   column.append(card);
   // Very long cards retain the full-width field-by-field pagination.
   if(card.getBoundingClientRect().height>540){
    card.remove();if(!grid.querySelector('.viewer-risk'))grid.remove();grid=null;
    put(child,nested,ctx);continue;
   }
   if(!fits()){
    card.remove();
    const populated=!!grid.querySelector('.viewer-risk');
    if(!populated){
     grid.remove();grid=null;
     const single=child.cloneNode(true);parent(nested).append(single);
     if(fits()){hasContent=true;pendingHeadings=[];continue;}
     single.remove();next(ctx);startColumns();columns[0].append(card);
     if(!fits()){card.remove();grid.remove();grid=null;put(child,nested,ctx);continue;}
     hasContent=true;pendingHeadings=[];continue;
    }
    // A narrow card can be taller than a full-width one. Try the complete
    // current batch at full width before spending another physical sheet.
    const stack=document.createElement('div');
    for(const risk of [...grid.querySelectorAll('.viewer-risk'),card].sort((a,b)=>Number(a.dataset.printOrder)-Number(b.dataset.printOrder))){
     const single=risk.cloneNode(true);single.classList.remove('print-risk-card');stack.append(single);
    }
    grid.replaceWith(stack);
    if(fits()){grid=null;hasContent=true;pendingHeadings=[];continue;}
    stack.replaceWith(grid);
    const single=child.cloneNode(true);parent(nested).append(single);
    if(fits()){grid=null;hasContent=true;pendingHeadings=[];continue;}
    single.remove();
    grid=null;next(ctx);startColumns();columns[0].append(card);
    if(!fits()){card.remove();grid.remove();grid=null;put(child,nested,ctx);continue;}
   }
   hasContent=true;pendingHeadings=[];
  }
 }
 // Keep each complete category in its own column when both fit on one sheet.
 function categoryPair(left,right){
  if(left?.dataset?.type!=='physical'||right?.dataset?.type!=='ergonomic')return null;
  const grid=document.createElement('div');grid.className='print-risk-columns print-category-pair';
  for(const category of [left,right]){
   const column=category.cloneNode(true);column.classList.add('print-risk-column');
   for(const risk of column.querySelectorAll('.viewer-risk'))risk.classList.add('print-risk-card');
   grid.append(column);
  }
  const measure=document.createElement('div');measure.className='print-risk-measure';measure.append(grid);content.append(measure);
  const height=grid.getBoundingClientRect().height;measure.remove();
  // Reserve room for the repeated group heading and page context. Larger
  // categories keep the existing independently paginated layout.
  return height>0&&height<=900?grid:null;
 }
 function put(original,chain=[],ctx=''){
  if(original.nodeType===3){if(original.textContent.trim())textPieces(original,chain,ctx);return;}
  if(original.nodeType!==1)return;
  const tag=original.tagName;
  if(original.classList.contains('viewer-category')){putCategory(original,chain,ctx);return;}
  // Group and section containers may naturally span sheets.
  const container=original.matches('.report-block,.viewer-group,.viewer-category,.report-card-list,.viewer-inventory,table,tbody');
  if(container){
   // Keep the sector section out of the cover, including its heading.
   if(original.classList.contains('report-sectors')&&hasContent)next();
   if(original.matches('.viewer-group')&&original.querySelector('.viewer-risk'))ctx=original.querySelector(':scope > summary > strong')?.textContent.trim()||ctx;
   if(original.classList.contains('compact-training'))ctx='Treinamentos sugeridos — continuação';
   const children=[...original.childNodes];
   for(let i=0;i<children.length;i++){
    const child=children[i];if(child.nodeType===1&&child.tagName==='THEAD')continue;
    const pair=original.classList.contains('viewer-group')?categoryPair(child,children[i+1]):null;
    if(pair){put(pair,[...chain,original],ctx);i++;}else put(child,[...chain,original],ctx);
   }
   return;
  }
  const heading=/^H[1-6]$/.test(tag)||tag==='SUMMARY';
  const reserve=heading?38:0;
  let copy=original.cloneNode(true);parent(chain).append(copy);
  // Screen-only controls must not count as content or detach pending headings.
  if(getComputedStyle(copy).display==='none'){copy.remove();cleanEmpty();return;}
  const accepted=()=>{hasContent=true;if(heading)pendingHeadings.push({copy,original,chain,ctx});else pendingHeadings=[];};
  if(fits(reserve)){accepted();return;}
  copy.remove();cleanEmpty();
  if(hasContent){next(ctx);copy=original.cloneNode(true);parent(chain).append(copy);if(fits(reserve)){accepted();return;}copy.remove();cleanEmpty();}
  // Oversized records are split by their existing fields, preserving all text.
  if(tag==='TR'){
   // Split a very tall table row into synchronized cell fragments.
   const cells=[...original.children];let values=cells.map(c=>c.textContent),first=true;
   while(values.some(Boolean)){
    const row=original.cloneNode(false);if(!first)row.removeAttribute('id');
    const fragments=cells.map(c=>c.cloneNode(false));row.append(...fragments);parent(chain).append(row);
    let low=0,high=Math.max(...values.map(v=>v.length));
    while(low<high){const mid=Math.ceil((low+high)/2);fragments.forEach((c,i)=>c.textContent=values[i].slice(0,mid));if(fits())low=mid;else high=mid-1;}
    if(!low)throw new Error('Não foi possível acomodar uma linha do relatório.');
    fragments.forEach((c,i)=>{let end=Math.min(low,values[i].length);const space=values[i].lastIndexOf(' ',end);if(end<values[i].length&&space>end/2)end=space+1;c.textContent=values[i].slice(0,end);values[i]=values[i].slice(end);});
    hasContent=true;pendingHeadings=[];first=false;if(values.some(Boolean))next(ctx);
   }
  }else if(original.childNodes.length){for(const child of original.childNodes)put(child,[...chain,original],ctx);}
  else{parent(chain).append(original.cloneNode(true));if(!fits())throw new Error('Um elemento do relatório excede o tamanho da página.');hasContent=true;}
 }
 next();
 const heading=document.createElement('h2');heading.className='report-print-title';heading.textContent=title;put(heading);
 for(const node of source)put(node);
 for(const page of sheets){
  if(!page.querySelector('.report-sheet-body').textContent.trim()&&!page.querySelector('img'))page.remove();
 }
 const pages=[...holder.children],references=new Map();
 pages.forEach((page,index)=>{for(const row of page.querySelectorAll('[data-recommendation-ref]'))if(!references.has(row.dataset.recommendationRef))references.set(row.dataset.recommendationRef,index+1);});
 for(const link of holder.querySelectorAll('[data-print-reference]')){
  const number=references.get(link.dataset.printReference);
  if(!number)throw new Error('Referência de recomendação não encontrada.');
  link.textContent=link.dataset.printReference+' — Recomendações consolidadas, pág. '+number;
 }
 return pages.length;
}
