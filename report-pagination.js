// Build fixed A4 sheets from the disposable print copy. Page references are
// resolved from the resulting sheets, never estimated from text length.
export function paginateReport(content,title='Relatório do levantamento'){
 for(const el of content.querySelectorAll('[data-search-hidden]'))el.removeAttribute('data-search-hidden');
 for(const el of content.querySelectorAll('.viewer-section'))el.setAttribute('data-active','true');
 const source=[...content.children];
 const holder=document.createElement('div');holder.className='report-sheets';
 content.replaceChildren(holder);
 let sheet,body,parents,context,hasContent=false;
 const sheets=[];
 function next(ctx=''){
  sheet=document.createElement('section');sheet.className='report-sheet';
  context=document.createElement('div');context.className='report-sheet-context';context.textContent=ctx;
  body=document.createElement('div');body.className='report-sheet-body';
  sheet.append(context,body);holder.append(sheet);sheets.push(sheet);parents=new Map();hasContent=false;
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
   piece.textContent=remaining.slice(0,low);remaining=remaining.slice(low);hasContent=true;
   if(remaining)next(ctx);
  }
 }
 function put(original,chain=[],ctx=''){
  if(original.nodeType===3){if(original.textContent.trim())textPieces(original,chain,ctx);return;}
  if(original.nodeType!==1)return;
  const tag=original.tagName;
  // Group and section containers may naturally span sheets.
  const container=original.matches('.report-block,.viewer-group,.viewer-category,.report-card-list,.viewer-inventory,table,tbody');
  if(container){
   if(original.matches('.viewer-group')&&original.querySelector('.viewer-risk'))ctx=original.querySelector(':scope > summary > strong')?.textContent.trim()||ctx;
   if(original.classList.contains('compact-training'))ctx='Treinamentos sugeridos — continuação';
   for(const child of original.childNodes){if(child.nodeType===1&&child.tagName==='THEAD')continue;put(child,[...chain,original],ctx);}
   return;
  }
  const heading=/^H[1-6]$/.test(tag)||tag==='SUMMARY';
  const reserve=heading?38:0;
  let copy=original.cloneNode(true);parent(chain).append(copy);
  if(fits(reserve)){hasContent=true;return;}
  copy.remove();cleanEmpty();
  if(hasContent){next(ctx);copy=original.cloneNode(true);parent(chain).append(copy);if(fits(reserve)){hasContent=true;return;}copy.remove();cleanEmpty();}
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
    hasContent=true;first=false;if(values.some(Boolean))next(ctx);
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
