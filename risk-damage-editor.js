import {damageSuggestions,damageDraft,damageText} from './risk-damage-options.js?v=20261019-damage1';
export function mountDamageEditor(article,risk,data,onChange){
 const original=article.querySelector('[data-field="damage"]'),oldLabel=original.closest('label');
 const state=damageDraft(data),options=[...new Set([...damageSuggestions(risk.code),...state.selected])];
 const fieldset=document.createElement('fieldset');fieldset.className='damage-editor';fieldset.tabIndex=-1;fieldset.id='damage-editor';
 const legend=document.createElement('legend');legend.textContent='Selecione as possíveis lesões ou agravos';fieldset.append(legend);
 const hint=document.createElement('p');hint.className='hint';hint.textContent=options.length?'Marque apenas as opções compatíveis com a situação observada. Você pode selecionar mais de uma.':'Descreva em Outros os possíveis danos deste risco.';fieldset.append(hint);
 const list=document.createElement('div');list.className='damage-options';fieldset.append(list);
 const otherLabel=document.createElement('label'),otherText=document.createElement('textarea');otherLabel.className='damage-other';otherLabel.append('Descreva outros possíveis danos',otherText);otherText.maxLength=Math.max(4000,state.other.length);otherText.value=state.other;
 const sync=()=>{otherLabel.hidden=!state.otherEnabled;data.damageSelections=[...state.selected];data.damageOther=state.other;data.damageOtherEnabled=state.otherEnabled;data.damage=damageText(state);original.value=data.damage;onChange();};
 for(const option of options){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=state.selected.includes(option);label.append(input,document.createTextNode(option));list.append(label);input.onchange=()=>{state.selected=input.checked?[...state.selected,option]:state.selected.filter(x=>x!==option);sync();};}
 const label=document.createElement('label'),other=document.createElement('input');other.type='checkbox';other.checked=state.otherEnabled;other.id='damage-other-toggle';label.append(other,document.createTextNode('Outros'));list.append(label);
 other.onchange=()=>{state.otherEnabled=other.checked;sync();if(other.checked)otherText.focus();};otherText.oninput=()=>{state.other=otherText.value;sync();};otherLabel.hidden=!state.otherEnabled;fieldset.append(otherLabel);
 oldLabel.hidden=true;oldLabel.after(fieldset);
}
