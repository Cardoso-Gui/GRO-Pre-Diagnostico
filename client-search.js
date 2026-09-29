// A busca filtra somente as empresas já autorizadas e carregadas pela página.
export function addClientSearch(select){
 const wrap=document.createElement('div');wrap.className='client-search';
 const label=document.createElement('label');label.textContent='Buscar empresa';
 const input=document.createElement('input');input.type='search';input.placeholder='Nome ou CNPJ';input.autocomplete='off';
 const status=document.createElement('small');status.setAttribute('role','status');
 label.append(input);wrap.append(label,status);
 const selectLabel=document.querySelector(`label[for="${select.id}"]`);
 (selectLabel||select).before(wrap);
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const filter=()=>{
  const query=normalize(input.value.trim()),digits=query.replace(/\D/g,'');let count=0;
  for(const option of select.options){
   if(!option.value)continue;
   const text=normalize(option.textContent+' '+(option.dataset.search||''));
   const match=!query||text.includes(query)||(/^[-.\/\d\s]+$/.test(query)&&digits&&text.replace(/\D/g,'').includes(digits));
   option.hidden=!match;if(match)count++;
  }
  input.disabled=select.disabled;
  status.textContent=query?(count?`${count} empresa(s) encontrada(s). Selecione abaixo.`:'Nenhuma empresa encontrada.') : '';
 };
 input.addEventListener('input',filter);
 new MutationObserver(filter).observe(select,{childList:true,attributes:true,attributeFilter:['disabled']});
 filter();return {refresh:filter};
}

export function addClientPickerSearch(select){
 const wrap=document.createElement('div');wrap.className='client-search';
 const label=document.createElement('label');label.textContent='Buscar empresa';
 const input=document.createElement('input');input.type='search';input.placeholder='Nome ou CNPJ';input.autocomplete='off';label.append(input);
 const button=document.createElement('button');button.type='button';button.textContent='Pesquisar';button.className='client-search-button';
 const status=document.createElement('small');status.setAttribute('role','status');
 const results=document.createElement('div');results.className='client-search-results';
 wrap.append(label,button,status,results);
 const oldLabel=document.querySelector(`label[for="${select.id}"]`);(oldLabel||select).before(wrap);if(oldLabel)oldLabel.hidden=true;select.hidden=true;
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const choose=option=>{
  if(select.disabled)return;
  select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));
  // O formulário pode cancelar a troca quando houver dados não salvos.
  const selected=Array.from(select.options).find(o=>o.value===select.value);
  if(selected?.value){input.value=selected.textContent;status.textContent=`Empresa selecionada: ${selected.textContent}`;results.replaceChildren();}
 };
 const search=()=>{
  if(select.disabled)return;
  const query=normalize(input.value.trim()),digits=query.replace(/\D/g,'');
  const found=Array.from(select.options).filter(o=>o.value&&(!query||normalize(o.textContent+' '+(o.dataset.search||'')).includes(query)||(/^[-.\/\d\s]+$/.test(query)&&digits&&String(o.textContent+' '+(o.dataset.search||'')).replace(/\D/g,'').includes(digits))));
  results.replaceChildren();
  if(found.length===1){choose(found[0]);return;}
  status.textContent=found.length?'Escolha uma das empresas encontradas.':'Nenhuma empresa encontrada.';
  for(const option of found){const result=document.createElement('button');result.type='button';result.textContent=option.textContent;result.onclick=()=>choose(option);results.append(result);}
 };
 button.onclick=search;input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search();}});
 const sync=()=>{input.disabled=button.disabled=select.disabled;for(const result of results.children)result.disabled=select.disabled;};
 new MutationObserver(sync).observe(select,{childList:true,attributes:true,attributeFilter:['disabled']});sync();
 return {refresh:sync};
}
