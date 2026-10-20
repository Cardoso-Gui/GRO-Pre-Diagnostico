import {reviewModel} from './review-model.js?v=20261019-review1';
let signature='';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(label,action)=>{const b=el('button',label,'review-action');b.type='button';b.onclick=action;return b;};
export function renderReviewStage(){
 const host=document.querySelector('#review-stage-content'),raw=globalThis.GRO_FORM?.review();if(!host||!raw)return;
 const key=JSON.stringify(raw);if(key===signature)return;signature=key;
 const opened=new Set([...host.querySelectorAll('details[open]')].map(x=>x.dataset.target)),first=!host.children.length;
 const {answers}=raw,{groups,points,missing}=reviewModel(raw);
 host.replaceChildren();
 const summary=el('section',null,'review-company');summary.append(el('h3',answers.currentCompany?.razao_social||answers.currentCompany?.nome_fantasia||'Empresa do levantamento'));
 const stats=el('div',null,'review-stats'),sectors=new Set(answers.selectedSectors||[]),jobs=(answers.jobsBySector||[]).filter(([sector])=>sectors.has(sector)).reduce((n,[,rows])=>n+rows.length,0);
 for(const [value,label] of [[answers.employees||0,'funcionários'],[sectors.size,'setores'],[jobs,'cargos'],[groups.length,answers.selectedRiskMode==='ghe'?'GHEs':'cargos com riscos']]){const item=el('div');item.append(el('strong',String(value)),el('span',label));stats.append(item);}summary.append(stats);
 const checks=el('div',null,'review-checks');
 for(const [label,sections,step] of [['Empresa e dimensionamento',['Dados da empresa','Dimensionamento'],1],['Setores e cargos',['Setores e cargos','Postos de trabalho'],2],['Organização dos riscos',['Organização dos riscos'],3]]){
  const pending=missing.some(m=>sections.includes(m.section)),item=el('div');item.append(el('span',label+': '+(pending?'há pendências':'preenchido')),button('Revisar',()=>globalThis.GRO_WIZARD.go(step)));checks.append(item);
 }summary.append(checks);host.append(summary);
 const pending=el('section',null,missing.length?'review-pending':'review-ready');pending.append(el('h3',missing.length?missing.length+' pendência(s) de preenchimento':'✓ Campos obrigatórios preenchidos'),el('p',missing.length?'Corrija os itens abaixo para gerar o relatório.':'Confira o resumo e gere o relatório quando estiver pronto.'));
 missing.forEach(item=>{const row=el('div',null,'review-pending-row'),copy=el('div');copy.append(el('small',item.section),el('span',item.text));row.append(copy,button('Corrigir',()=>correct(item)));pending.append(row);});host.append(pending);
 host.append(el('h3',answers.selectedRiskMode==='ghe'?'Conferência por GHE':'Conferência por cargo'));
 for(const group of groups){
  const card=el('details',null,'review-group');card.dataset.target=group.id;card.open=opened.has(group.id)||(first&&group.id===groups[0]?.id);
  const heading=el('summary'),label=el('strong',(answers.selectedRiskMode==='ghe'?'GHE • ':'Cargo • ')+group.title);
  const pendingLabel=[group.detailPending?group.detailPending+' risco(s) sem detalhamento':'',group.epiPending?group.epiPending+' EPI(s) pendente(s)':''].filter(Boolean);
  if(group.pending.some(m=>!['Detalhamento dos riscos','EPIs'].includes(m.section)))pendingLabel.push('Revisar organização/seleção');
  heading.append(label,el('span',group.pending.length?pendingLabel.join(' · '):'Preenchimento completo',group.pending.length?'review-badge pending':'review-badge'));card.append(heading);
  const counts=el('div',null,'review-stats');
  for(const text of [group.total+' risco(s) selecionado(s)',group.detailsDone+' de '+group.detailTotal+' detalhados',group.epiDone+' de '+group.detailTotal+' registros de EPI preenchidos'])counts.append(el('span',text));card.append(counts);
  const links=el('div',null,'review-links');links.append(button('Revisar riscos',()=>openGroup(4,'.risk-accordion',group.id)),button('Revisar EPIs',()=>openGroup(5,'.epi-group',group.id)));card.append(links);host.append(card);
 }
 if(points.length){const info=el('details',null,'review-points');info.append(el('summary','Pontos para revisão técnica · '+points.length),el('p','Riscos marcados para medir ou avaliar. Estes pontos não bloqueiam a geração do relatório.'));points.forEach(s=>info.append(el('p',s.targetTitle+' / '+s.risk.name)));host.append(info);}
 const generate=document.querySelector('#generate-report-button');generate.disabled=globalThis.GRO_CLOUD?.rectification?Boolean(globalThis.GRO_POSTS?.busy()):missing.length>0;
 document.querySelector('#review-generation-hint').textContent=globalThis.GRO_CLOUD?.rectification?'Na retificação, confira as diferenças e informe o motivo. Pendências anteriores não exigem alterações não relacionadas.':missing.length?'Disponível após corrigir os campos obrigatórios.':'Campos obrigatórios preenchidos. Você pode gerar o relatório.';
}
function openGroup(step,selector,id){
 globalThis.GRO_WIZARD.go(step);const card=[...document.querySelectorAll(selector)].find(n=>n.dataset.target===id);if(card){card.open=true;card.scrollIntoView({block:'center'});card.querySelector('summary')?.focus();}
}
function correct(item){
 if(item.section==='EPIs'){openGroup(5,'.epi-group',item.targetId);const card=[...document.querySelectorAll('.epi-group')].find(n=>n.dataset.target===item.targetId);const row=[...(card?.querySelectorAll('.epi-risk-row')||[])].find(n=>n.dataset.riskCode===item.riskCode);row?.querySelector('button')?.click();return;}
 if(globalThis.GRO_CLOUD?.rectification&&item.destination==='#open-risk-details'){globalThis.GRO_WIZARD.go(4);globalThis.GRO_CLOUD.openRiskDetails?.(item.riskTarget,item.riskCode);return;}
 const node=document.querySelector(item.destination);if(!node)return;
 globalThis.GRO_WIZARD.reveal(node);
 if(item.destination==='#open-risk-details'){node.dataset.target=item.riskTarget;node.dataset.risk=item.riskCode;node.click();return;}
 node.scrollIntoView({block:'center'});if(!node.matches('input,select,textarea,button,a'))node.tabIndex=-1;node.focus({preventScroll:true});
}
