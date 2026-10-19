import {detailTargets,detailKey} from './risk-detail-data.js';
let cached='',openIds=new Set(),initialized=false;
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
export function epiState(value={}){return value.applicable==='Não'?'Sem utilização de EPI':value.applicable==='Sim'&&value.items?.some(x=>String(x).trim())?'EPI informado':'Pendente';}
export function renderEpiStage(force=false){
 const host=document.querySelector('#epi-stage-content'),data=globalThis.GRO_FORM?.snapshot();if(!host||!data)return;
 const signature=JSON.stringify(data);if(!force&&signature===cached)return;cached=signature;
 const catalog=[...(typeof ESOCIAL_RISK_TABLE_24==='undefined'?[]:ESOCIAL_RISK_TABLE_24),...(typeof OCCUPATIONAL_RISK_TABLE==='undefined'?[]:OCCUPATIONAL_RISK_TABLE)];
 const targets=detailTargets(data,catalog),entries=new Map(data.epiBySelection||[]);
 if(initialized)openIds=new Set([...host.querySelectorAll('details[open]')].map(n=>n.dataset.target));
 else {openIds=new Set(targets.slice(0,1).map(t=>t.id));initialized=true;}
 host.replaceChildren();
 const totals=[0,0,0];targets.forEach(t=>t.risks.forEach(r=>{const state=epiState(entries.get(detailKey('epi-data',t.id,r.code)));totals[state==='EPI informado'?0:state==='Sem utilização de EPI'?1:2]++;}));
 const summary=el('div',null,'epi-summary');['riscos com EPI','sem utilização','pendentes'].forEach((label,i)=>{const item=el('div');item.append(el('strong',String(totals[i])),el('span',label));summary.append(item);});host.append(summary);
 if(!targets.some(t=>t.risks.length)){host.append(el('p','Selecione os riscos na etapa 5 para informar os EPIs.'));return;}
 targets.filter(t=>t.risks.length).forEach(target=>{
  const group=el('details',null,'epi-group');group.dataset.target=target.id;group.open=openIds.has(target.id);
  const heading=el('summary');const label=el('div');label.append(el('strong',(data.selectedRiskMode==='ghe'?'GHE • ':'Cargo • ')+target.title),el('small',target.description));
  const pending=target.risks.filter(r=>epiState(entries.get(detailKey('epi-data',target.id,r.code)))==='Pendente').length;
  heading.append(label,el('span',target.risks.length+' riscos · '+pending+' pendente(s)','epi-group-count'));group.append(heading);
  target.risks.forEach(risk=>{
   const value=entries.get(detailKey('epi-data',target.id,risk.code))||{},state=epiState(value);
   const row=el('div',null,'epi-risk-row'),name=el('div'),info=el('div');
   const category=el('small',risk.group,'epi-category');category.dataset.group=String(risk.group).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
   name.append(category,el('strong',risk.name));info.append(el('span',state,'epi-state '+(state==='Pendente'?'pending':'')));
   if(value.applicable==='Sim') {const chips=el('div',null,'epi-chips');(value.items||[]).forEach(item=>chips.append(el('span',item)));info.append(chips);}
   const button=el('button',state==='Pendente'?'Informar EPIs':'Editar EPIs');button.type='button';button.onclick=()=>edit(target,risk,value,button);
   row.append(name,info,button);group.append(row);
  });host.append(group);
 });host.append(el('p','EPIs não substituem as medidas coletivas e de organização do trabalho.','epi-note'));
}
function edit(target,risk,value,opener){
 const dialog=el('dialog',null,'epi-editor'),form=el('form');dialog.setAttribute('aria-labelledby','epi-editor-title');
 const title=el('h2','EPIs • '+risk.name);title.id='epi-editor-title';form.append(title,el('p',target.title));
 const label=el('label','Há utilização de EPI neste risco?'),select=el('select');select.required=true;
 for(const [value,text] of [['','Selecione'],['Sim','Sim'],['Não','Não']]){const option=el('option',text);option.value=value;select.append(option);}select.value=value.applicable||'';label.append(select);form.append(label);
 const itemLabel=el('label','Quais equipamentos? Um por linha.'),items=el('textarea');items.rows=5;items.maxLength=4000;items.value=(value.items||[]).join('\n');itemLabel.append(items);form.append(itemLabel);
 const update=()=>{itemLabel.hidden=select.value!=='Sim';items.required=select.value==='Sim';items.setCustomValidity('');};select.onchange=update;items.oninput=()=>items.setCustomValidity('');update();
 form.append(el('p','As alterações entram no rascunho. Use Salvar rascunho para guardá-las.','epi-note'));
 const actions=el('div',null,'epi-editor-actions'),cancel=el('button','Cancelar'),apply=el('button','Aplicar');cancel.type='button';apply.type='submit';cancel.onclick=()=>dialog.close();actions.append(cancel,apply);form.append(actions);dialog.append(form);document.body.append(dialog);
 dialog.addEventListener('close',()=>{dialog.remove();if(opener.isConnected)opener.focus();else document.querySelector('#wizard-epi').focus();});
 form.onsubmit=event=>{event.preventDefault();const names=[...new Set(items.value.split('\n').map(x=>x.trim()).filter(Boolean))];if(select.value==='Sim'&&!names.length){items.setCustomValidity('Informe pelo menos um equipamento.');items.reportValidity();return;}globalThis.GRO_FORM.setEpi(target.id,risk.code,{...value,applicable:select.value,items:select.value==='Sim'?names:[]});dialog.close();renderEpiStage(true);};
 dialog.showModal();
}
