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
