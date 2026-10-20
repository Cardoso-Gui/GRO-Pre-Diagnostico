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
 function repeatsContext(original,ctx){
  if(!original||!ctx)return false;
  const title=original.tagName==='H3'?original.textContent:original.tagName==='SUMMARY'&&original.parentElement?.classList.contains('viewer-group')?original.querySelector(':scope > strong')?.textContent:'';
  return title?.trim()===ctx.replace(/ — continuação$/,'');
 }
 function next(ctx='',startingHeading=null){
  const carry=pendingHeadings;pendingHeadings=[];
  for(const item of carry)item.copy.remove();
  if(body)cleanEmpty();
  sheet=document.createElement('section');sheet.className='report-sheet';
  context=document.createElement('div');context.className='report-sheet-context';context.textContent=carry.some(item=>repeatsContext(item.original,ctx))||repeatsContext(startingHeading,ctx)?'':ctx;
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
 // Keep the same card width and field layout, even for a single risk or a
 // partly filled sheet. Packing must not silently turn cards into wide tables.
 function putSeparateCategory(category,chain,ctx){
  const nested=[...chain,category];
  let grid=null,columns=[];
  function startColumns(){
   grid=document.createElement('div');grid.className='print-risk-columns';
   columns=[0,1].map(()=>{const col=document.createElement('div');col.className='print-risk-column';grid.append(col);return col;});
   parent(nested).append(grid);
  }
  for(const child of category.childNodes){
   if(child.nodeType===3&&!child.textContent.trim())continue;
   if(child.nodeType!==1||!child.classList.contains('viewer-risk')){
    grid=null;put(child,nested,ctx);continue;
   }
   if(!grid)startColumns();
   const card=child.cloneNode(true);card.classList.add('print-risk-card');
   const column=columns[0].getBoundingClientRect().height<=columns[1].getBoundingClientRect().height?columns[0]:columns[1];
   column.append(card);
   if(!fits()){
    card.remove();
    if(!grid.querySelector('.viewer-risk'))grid.remove();
    grid=null;cleanEmpty();
    if(hasContent)next(ctx);
    startColumns();columns[0].append(card);
    if(!fits()){
     // Only a card that cannot fit on a fresh sheet may use full-width
     // field-by-field pagination. Its stacked card styling is preserved.
     card.remove();grid.remove();grid=null;cleanEmpty();
     const oversized=child.cloneNode(true);oversized.classList.add('print-risk-card');
     put(oversized,nested,ctx);continue;
    }
   }
   hasContent=true;pendingHeadings=[];
  }
 }
 const isWhitespace=node=>node.nodeType===3&&!node.textContent.trim();
 function canFlowCategory(category){
  if(category?.nodeType!==1||!category.classList.contains('viewer-category'))return false;
  const heading=category.querySelector(':scope > h4');
  return !!heading&&[...category.children].some(child=>child.classList.contains('viewer-risk'))&&
   [...category.childNodes].every(child=>isWhitespace(child)||child===heading||child.nodeType===1&&child.classList.contains('viewer-risk'));
 }
 // Consecutive categories of one cargo/GHE share available column space.
 // Every segment keeps its category identity and its own repeated heading.
 function putCategoryRun(categories,chain,ctx){
  let grid=null,columns,segments;
  function startColumns(){
   grid=document.createElement('div');grid.className='print-risk-columns';
   columns=[0,1].map(()=>{const column=document.createElement('div');column.className='print-risk-column';grid.append(column);return column;});
   segments=[new Map(),new Map()];parent(chain).append(grid);
  }
  function place(category,card){
   const order=[0,1].sort((a,b)=>columns[a].getBoundingClientRect().height-columns[b].getBoundingClientRect().height);
   for(const index of order){
    let segment=segments[index].get(category);const fresh=!segment;
    if(fresh){
     segment=category.cloneNode(false);segment.removeAttribute('id');
     const heading=category.querySelector(':scope > h4').cloneNode(true);heading.removeAttribute('id');
     segment.append(heading);columns[index].append(segment);segments[index].set(category,segment);
    }
    segment.append(card);
    if(fits())return true;
    card.remove();
    if(fresh){segment.remove();segments[index].delete(category);}
   }
   return false;
  }
  for(const category of categories){
   for(const original of [...category.children].filter(child=>child.classList.contains('viewer-risk'))){
    const card=original.cloneNode(true);card.classList.add('print-risk-card');
    if(!grid)startColumns();
    if(!place(category,card)){
     if(!grid.querySelector('.viewer-risk'))grid.remove();
     grid=null;cleanEmpty();
     if(hasContent)next(ctx);
     startColumns();
     if(!place(category,card)){
      grid.remove();grid=null;cleanEmpty();
      // Only an exceptionally tall record falls back to full-width fields.
      // Never recursively paginate a two-column wrapper.
      const nested=[...chain,category];
      put(category.querySelector(':scope > h4'),nested,ctx);
      put(card,nested,ctx);continue;
     }
    }
    hasContent=true;pendingHeadings=[];
   }
  }
 }
 function put(original,chain=[],ctx=''){
  if(original.nodeType===3){if(original.textContent.trim())textPieces(original,chain,ctx);return;}
  if(original.nodeType!==1)return;
  const tag=original.tagName;
  if(original.classList.contains('viewer-category')){
   if(canFlowCategory(original))putCategoryRun([original],chain,ctx);else putSeparateCategory(original,chain,ctx);
   return;
  }
  // Group and section containers may naturally span sheets.
  const container=original.matches('.report-block,.viewer-group,.viewer-category,.report-card-list,.viewer-inventory,table,tbody');
  if(container){
   // Keep the sector section out of the cover, including its heading.
   if(original.classList.contains('report-sectors')&&hasContent)next();
   if(original.matches('.viewer-group')&&original.querySelector('.viewer-risk')){
    ctx=original.querySelector(':scope > summary > strong')?.textContent.trim()||ctx;
    // A different cargo/sector remains visually separate, even if it would fit.
    if(body.querySelector('.viewer-risk'))next(ctx,original.querySelector(':scope > summary'));
   }
   if(original.classList.contains('report-block')){
    const title=original.querySelector(':scope > h3')?.textContent.trim();
    if(title)ctx=title+' — continuação';
   }
   if(original.classList.contains('compact-training'))ctx='Treinamentos sugeridos — continuação';
   const children=[...original.childNodes];
   for(let i=0;i<children.length;i++){
    const child=children[i];if(child.nodeType===1&&child.tagName==='THEAD')continue;
    if(original.classList.contains('viewer-group')&&canFlowCategory(child)){
     const categories=[child];
     while(i+1<children.length){
      const following=children[i+1];
      if(isWhitespace(following)){i++;continue;}
      if(!canFlowCategory(following))break;
      categories.push(following);i++;
     }
     putCategoryRun(categories,[...chain,original],ctx);
    }else put(child,[...chain,original],ctx);
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
  if(hasContent){next(ctx,heading?original:null);copy=original.cloneNode(true);parent(chain).append(copy);if(fits(reserve)){accepted();return;}copy.remove();cleanEmpty();}
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
