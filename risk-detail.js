import {riskDetailStatus} from './risk-detail-status.js?v=20261019-epi1';
import {updateHeader} from './app-header.js?v=20260928-occ1';
import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {saveAssessment} from './assessment-data.js';
import {detailKey,detailTargets,detailAnswers} from './risk-detail-data.js';
const $=s=>document.querySelector(s),id=new URLSearchParams(location.search).get('id');
let row,targets=[],details=new Map(),epis=new Map(),current=0,index=0,saving=false,baseline='';
const fingerprint=()=>JSON.stringify({details:Array.from(details.entries()),epis:Array.from(epis.entries())});
const dirty=()=>fingerprint()!==baseline;
const say=text=>{ $('#message').textContent=text; $('#message').hidden=!$('#editor').hidden; $('#save-status').textContent=text; if(!$('#editor').hidden) updateProgress(); };
const catalog=[...ESOCIAL_RISK_TABLE_24.map(r=>({...r,source:'eSocial · Tabela 24'})),...OCCUPATIONAL_RISK_TABLE.map(r=>({...r,source:'GRO complementar · identificador interno'}))];
function render(){
 const moveFocus=$('#editor').contains(document.activeElement);
 const target=targets[current];$('#risk-nav').replaceChildren();$('#cards').replaceChildren();
 if(!target){say('Nenhum cargo ou GHE disponível. Volte ao levantamento para organizar os riscos.');$('#next').disabled=true;return;}
 $('#target-title').textContent=target.title;$('#target-description').textContent=target.description;
 $('#next').disabled=saving;
 const hasNextTarget=targets.some((item,i)=>i>current&&item.risks.length>0);
 $('#next').textContent=index<target.risks.length-1?'Salvar e continuar →':hasNextTarget?(row.answers.selectedRiskMode==='ghe'?'Salvar e ir ao próximo GHE →':'Salvar e ir ao próximo cargo →'):'Salvar e voltar ao levantamento';

 $('#previous').disabled=saving||index===0;
 $('#mobile-risk-select').replaceChildren();
 const heading=document.createElement('h3');heading.textContent='Riscos selecionados';heading.className='sr-only';$('#risk-nav').append(heading);
 const groups=new Map();
 target.risks.forEach((risk,i)=>{
  if(!groups.has(risk.group)){const group=document.createElement('section');group.dataset.group=groupKey(risk.group);const title=document.createElement('h3');title.textContent=risk.group;group.append(title);groups.set(risk.group,group);$('#risk-nav').append(group);}
  const button=document.createElement('button');button.type='button';button.className=i===index?'active':'';button.setAttribute('aria-current',i===index?'true':'false');button.dataset.riskIndex=i;
  const name=document.createElement('span');name.textContent=risk.name;const small=document.createElement('small');button.append(name,small);
  button.onclick=()=>{if(saving)return;index=i;render()};groups.get(risk.group).append(button);
  const option=document.createElement('option');option.value=i;$('#mobile-risk-select').append(option);
 });
 $('#mobile-risk-select').value=String(index);

 const risk=target.risks[index];if(!risk){$('#next').disabled=true;updateProgress();const p=document.createElement('p');p.textContent='Nenhum risco para detalhar neste cargo ou GHE. A opção de ausência do eSocial não exige detalhamento.';$('#cards').append(p);return;}
 const key=detailKey('source',target.id,risk.code),data=details.get(key)||{};
 const article=document.createElement('article');article.append($('#detail-template').content.cloneNode(true));article.querySelector('h2').textContent=risk.name;article.querySelector('.tag').textContent=`${risk.group} · ${risk.code} · ${risk.source}`;article.dataset.group=groupKey(risk.group);
 if(risk.code==='SAN.001') article.querySelector('.hint').textContent='Contato do trabalhador com vírus, bactérias, fungos ou parasitas presentes em alimentos, resíduos, utensílios ou superfícies contaminadas.';
 article.querySelectorAll('[data-field]').forEach(field=>{field.maxLength=4000;field.value=data[field.dataset.field]||'';field.addEventListener('input',()=>{data[field.dataset.field]=field.value;details.set(key,data);say('Alterações ainda não salvas. Você pode alternar entre cargos ou GHEs antes de salvar.');});});
 const choices=Array.from(article.querySelectorAll('.choices input'));
 choices.forEach((field,i)=>{field.checked=Boolean(data.controls?.[i]);field.onchange=()=>{data.controls=[...choices.map(el=>el.checked),Boolean(data.controls?.[2])];details.set(key,data);say('Alterações ainda não salvas.');};});
 $('#cards').append(article);updateProgress();
 if(moveFocus){const title=article.querySelector('h2');title.tabIndex=-1;title.focus({preventScroll:true});article.scrollIntoView({block:'start'});}
}
$('#target-select').onchange=()=>{if(saving){$('#target-select').value=String(current);return;}current=Number($('#target-select').value);index=0;render()};
$('#mobile-risk-select').onchange=()=>{if(saving){$('#mobile-risk-select').value=String(index);return;}index=Number($('#mobile-risk-select').value);render()};
$('#previous').onclick=()=>{if(saving||index===0)return;index--;render()};
$('#next').onclick=async()=>{
 if(saving||!targets[current]||!validateCurrentRisk())return;
 if(!await persistDetails())return;
 if(index<targets[current].risks.length-1){index++;render();return;}
 const nextTarget=targets.findIndex((item,i)=>i>current&&item.risks.length>0);
 if(nextTarget!==-1){current=nextTarget;index=0;$('#target-select').value=String(current);render();return;}
 location.assign('./levantamento.html?id='+encodeURIComponent(id)+'#risk-source-section');
};
$('#back').onclick=e=>{if(saving){e.preventDefault();say('Aguarde o salvamento terminar.');return;}if(dirty()&&!confirm('Voltar sem salvar o detalhamento? As alterações desta página serão descartadas.')){e.preventDefault();return;}baseline=fingerprint()};
window.addEventListener('beforeunload',event=>{if(dirty()||saving){event.preventDefault();event.returnValue=''}});

async function persistDetails(){
 if(saving||!row)return false;saving=true;$('#next').disabled=true;const version=fingerprint();const snapshot=JSON.parse(JSON.stringify(detailAnswers(row.answers,details)));
 try{const access=await getTeamMember();if(!access.member)throw Error('Não foi possível confirmar seu acesso. Mantenha esta página aberta e tente novamente.');row=await saveAssessment(authClient,row,snapshot);baseline=version;say(dirty()?'Detalhamento salvo. Há alterações posteriores ainda não salvas.':'Detalhamento salvo no rascunho.');return !dirty();}
 catch(error){say(error.message);return false}finally{saving=false;$('#next').disabled=false}
}
async function load(){try{
 const access=await getTeamMember();if(!access.member)throw Error('Entre na sua conta para acessar o detalhamento.');
 updateHeader(access.member);
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw Error('Abra o detalhamento a partir de um levantamento.');
 const result=await authClient.from('assessments').select('*').eq('id',id).maybeSingle();if(result.error||!result.data)throw Error('Não foi possível carregar o levantamento. Recarregue para tentar novamente.');
 row=result.data;if(row.status!=='draft'||(access.member.role!=='admin'&&row.responsible_id!==access.member.user_id))throw Error('Somente o responsável ou administrador pode editar um rascunho.');
 details=new Map(row.answers.riskSourcesBySelection||[]);epis=new Map(row.answers.epiBySelection||[]);baseline=fingerprint();targets=detailTargets(row.answers,catalog);
 $('#back').href='./levantamento.html?id='+encodeURIComponent(id);const label=row.answers.selectedRiskMode==='ghe'?'Selecione o GHE':'Selecione o cargo';$('#target-mode').textContent=label;$('#target-select').setAttribute('aria-label',label);
 targets.forEach((t,i)=>{const option=document.createElement('option');option.value=i;option.textContent=t.title;$('#target-select').append(option)});
 const params=new URLSearchParams(location.search);
 const requested=targets.findIndex(t=>t.id===params.get('target'));
 if(requested>=0){current=requested;index=Math.max(0,targets[current].risks.findIndex(r=>r.code===params.get('risk')));$('#target-select').value=String(current);}
 $('#editor').hidden=false;say('Use Salvar e continuar para guardar as alterações e avançar.');render();
 }catch(error){say(error.message)}}
for(const link of document.querySelectorAll('.gro-header a'))link.onclick=event=>$('#back').onclick(event);
$('#sign-out').onclick=async()=>{if(saving)return;if(dirty()&&!confirm('Sair sem salvar o detalhamento?'))return;baseline=fingerprint();await authClient.auth.signOut({scope:'local'});location.assign('./index.html?reason=signedout');};
await load();

window.addEventListener('pageshow',event=>{if(event.persisted){if(!dirty()&&!saving)location.reload();else say('Há alterações não salvas nesta tela. Salve antes de sair; se houver conflito, mantenha a página aberta.');}});

function validateCurrentRisk(){
 const card=$('#cards'),missing=[];
 const labels={source:'Informe a fonte ou situação de exposição.',frequency:'Selecione a frequência.',duration:'Informe o tempo ou circunstância de exposição.',damage:'Descreva os possíveis danos à saúde.',measures:'Descreva as medidas existentes; informe se não houver.',measure:'Informe se precisa medir ou avaliar.'};
 for(const [key,text] of Object.entries(labels)){const el=card.querySelector('[data-field="'+key+'"]');if(el&&!el.value.trim())missing.push({text,element:el});}
 return GRO_VALIDATE.show(missing);
}

function groupKey(group){return String(group||'Outros').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function stateFor(target,risk){return riskDetailStatus(details.get(detailKey('source',target.id,risk.code)),epis.get(detailKey('epi-data',target.id,risk.code)));}
function updateProgress(){
 const target=targets[current];if(!target)return;
 const completed=target.risks.filter(r=>stateFor(target,r)==='Preenchido').length;
 $('#progress-label').textContent=completed+' de '+target.risks.length+' riscos preenchidos';
 $('#detail-progress').max=Math.max(1,target.risks.length);$('#detail-progress').value=completed;
 $('#risk-nav').querySelectorAll('button[data-risk-index]').forEach(button=>{const risk=target.risks[Number(button.dataset.riskIndex)],status=stateFor(target,risk);button.querySelector('small').textContent=(status==='Preenchido'?'✓ ':'')+status;button.dataset.complete=String(status==='Preenchido');});
 Array.from($('#mobile-risk-select').options).forEach((option,i)=>{option.textContent=target.risks[i].name+' — '+stateFor(target,target.risks[i]);});
 const status=$('#cards .status');if(status&&target.risks[index])status.textContent=stateFor(target,target.risks[index]);
}
