// Navigation changes presentation only; the original form owns data and validation.
export function initAssessmentWizard(){
 const $=s=>document.querySelector(s);
 const steps=['Empresa','Dimensionamento','Setores e cargos','Organização dos riscos','Riscos e detalhamento','EPIs','Revisão e relatório'];
 const titles=['Empresa e identificação',...steps.slice(1)];
 const groups=[['#company-card > .company-header','#company-card > .details-grid'],['#dimension-form','#dimension-results'],['.sectors-section','#jobs-section'],['#risk-mode-section'],['#risk-selection-section','#risk-source-section'],[],['#final-report-section']];
 const management=document.createElement('div');management.id='ghe-management-list';management.className='risk-selection-grid';
 $('#risk-mode-section').append($('#ghe-form'),management);
 const blocks=groups.map(selectors=>selectors.flatMap(s=>[...document.querySelectorAll(s)]));
 const hints=['Escolha um cliente cadastrado para começar.','Informe o número de funcionários e confira o dimensionamento.','Cadastre os setores e os cargos da empresa.','Escolha a organização e configure os grupos e seus vínculos.','Abra um grupo para selecionar e detalhar seus riscos.','Confira os equipamentos de proteção de cada risco.','Gere o relatório após conferir as informações. Os campos pendentes serão indicados.'];
 let active=0,ready=false,draftId='',scheduled=false;
 const nav=$('#wizard-steps'),select=$('#wizard-step-select'),save=$('#save-draft-button');
 $('#wizard-save-slot').append(save);save.disabled=true;save.title='Escolha a empresa e continue para salvar o rascunho';
 blocks.forEach((items,index)=>items.forEach(el=>el.dataset.wizardStep=String(index)));
 const buttons=steps.map((name,index)=>{const button=document.createElement('button');button.type='button';button.className='wizard-step';const number=document.createElement('span');number.textContent=String(index+1);number.setAttribute('aria-hidden','true');button.append(number,document.createTextNode(name));button.onclick=()=>go(index);nav.append(button);const option=document.createElement('option');option.value=String(index);option.textContent=`${index+1}. ${name}`;select.append(option);return button;});
 function remember(){if(!draftId)return;try{sessionStorage.setItem('gro-wizard-step:'+draftId,String(active));}catch{}}
 function update(){
  buttons.forEach((button,i)=>{button.disabled=!ready&&i!==0;button.classList.toggle('is-active',i===active);if(i===active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');select.options[i].disabled=!ready&&i!==0;});
  select.value=String(active);$('#wizard-progress-label').textContent=`Etapa ${active+1} de ${steps.length}`;$('#wizard-progress').value=active+1;$('#wizard-step-title').textContent=titles[active];$('#wizard-step-hint').textContent=ready&&active===0?'Dados da empresa deste levantamento.':hints[active];
  blocks.forEach((items,index)=>items.forEach(el=>{el.classList.toggle('wizard-inactive',index!==active);}));
  $('#wizard-epi').hidden=!ready||active!==5;
  $('#wizard-back').hidden=!ready||active===0;$('#wizard-next').hidden=!ready||active===6;$('.wizard-footer').hidden=!ready;
  $('#wizard-next').textContent=active<6?'Continuar para '+steps[active+1].toLocaleLowerCase('pt-BR')+' →':'Continuar';
  $('.draft-actions').hidden=!ready||active!==6;
  const empty=ready&&active!==5&&!blocks[active].some(el=>!el.hidden);
  $('#wizard-empty').hidden=!empty;
  $('#wizard-empty').textContent=active===3?'Adicione pelo menos um cargo na etapa Setores e cargos para escolher a organização dos riscos.':active===4?'Escolha a organização dos riscos na etapa anterior para continuar.':active===6?'Selecione os riscos da empresa na etapa Riscos e detalhamento para gerar o relatório.':'Preencha as etapas anteriores para continuar.';
  const details=$('#open-risk-details');$('#wizard-open-epi').disabled=!details;
  if(ready&&active===5){const data=globalThis.GRO_FORM?.snapshot();const entries=data?.epiBySelection||[];const risks=(data?.selectedRisksByTarget||[]).flatMap(([,codes])=>codes).filter(code=>code!=='09.01.001').length;const filled=entries.filter(([,value])=>value.applicable==='Não'||(value.applicable==='Sim'&&value.items?.some(x=>String(x).trim()))).length;$('#wizard-epi-summary').textContent=details?`${filled} registro(s) de EPI preenchido(s) para ${risks} risco(s) selecionado(s).`:'Selecione os riscos na etapa anterior para conferir os EPIs.';}
 }
 function go(index,focus=true){if(!Number.isInteger(index)||index<0||index>=steps.length||(!ready&&index!==0))return;active=index;update();remember();if(focus){$('#wizard-step-title').focus({preventScroll:true});$('.wizard-content').scrollIntoView({block:'start',behavior:'smooth'});}}
 select.onchange=()=>go(Number(select.value));$('#wizard-back').onclick=()=>go(active-1);$('#wizard-next').onclick=()=>go(active+1);
 $('#wizard-open-epi').onclick=()=>{$('#open-risk-details')?.click();};
 function reveal(target){const group=target.closest('[data-wizard-step]');if(group)go(Number(group.dataset.wizardStep),false);}
 globalThis.GRO_WIZARD={reveal};
 // Existing renderers toggle availability; keep their hidden state intact.
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;update();});});
 observer.observe($('#company-card'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 update();
 return {loaded({id,title,isNew}){ready=true;draftId=id;$('#wizard-title').textContent=title||'Novo levantamento';save.disabled=false;save.removeAttribute('title');$('#wizard-save-status').textContent=isNew?'Novo levantamento ainda não salvo.':'Rascunho carregado. Salve para guardar novas alterações.';let restored=1;try{const stored=sessionStorage.getItem('gro-wizard-step:'+id);if(!isNew&&stored!==null)restored=Number(stored);}catch{}go(Number.isInteger(restored)&&restored>=0&&restored<7?restored:1,false);}};
}
