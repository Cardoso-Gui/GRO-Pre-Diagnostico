import {updateHeader} from './app-header.js?v=20260928-occ1';
import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {saveAssessment} from './assessment-data.js';
import {detailKey,detailTargets,detailAnswers} from './risk-detail-data.js';
const $=s=>document.querySelector(s),id=new URLSearchParams(location.search).get('id');
let row,targets=[],details=new Map(),epis=new Map(),current=0,index=0,saving=false,baseline='';
const fingerprint=()=>JSON.stringify({details:Array.from(details.entries()),epis:Array.from(epis.entries())});
const dirty=()=>fingerprint()!==baseline;
const say=text=>{ $('#message').textContent=text; $('#save-status').textContent=text; };
const catalog=[...ESOCIAL_RISK_TABLE_24.map(r=>({...r,source:'eSocial · Tabela 24'})),...OCCUPATIONAL_RISK_TABLE.map(r=>({...r,source:'GRO complementar · identificador interno'}))];
function render(){
 const target=targets[current];$('#risk-nav').replaceChildren();$('#cards').replaceChildren();
 if(!target){say('Nenhum cargo ou GHE disponível. Volte ao levantamento para organizar os riscos.');$('#next').disabled=true;return;}
 $('#target-title').textContent=target.title;$('#target-description').textContent=target.description;
 $('#next').disabled=saving;
 const hasNextTarget=targets.some((item,i)=>i>current&&item.risks.length>0);
 $('#next').textContent=index<target.risks.length-1?'Salvar e avançar →':hasNextTarget?(row.answers.selectedRiskMode==='ghe'?'Salvar e ir ao próximo GHE →':'Salvar e ir ao próximo cargo →'):'Salvar e voltar ao levantamento';
 target.risks.forEach((risk,i)=>{const button=document.createElement('button');button.type='button';button.textContent=risk.name;button.className=i===index?'active':'';button.setAttribute('aria-pressed',String(i===index));const small=document.createElement('small');small.textContent=risk.group;button.append(small);button.onclick=()=>{if(i!==index&&!validateCurrentRisk())return;index=i;render()};$('#risk-nav').append(button)});
 const risk=target.risks[index];if(!risk){const p=document.createElement('p');p.textContent='Nenhum risco para detalhar neste cargo ou GHE. A opção de ausência do eSocial não exige detalhamento.';$('#cards').append(p);return;}
 const key=detailKey('source',target.id,risk.code),data=details.get(key)||{};
 const article=document.createElement('article');article.append($('#detail-template').content.cloneNode(true));article.querySelector('h2').textContent=risk.name;article.querySelector('.tag').textContent=`${risk.group} · ${risk.code} · ${risk.source}`;article.querySelector('.status').textContent='Detalhamento';
 if(risk.code==='SAN.001') article.querySelector('.hint').textContent='Contato do trabalhador com vírus, bactérias, fungos ou parasitas presentes em alimentos, resíduos, utensílios ou superfícies contaminadas.';
 article.querySelectorAll('[data-field]').forEach(field=>{field.maxLength=4000;field.value=data[field.dataset.field]||'';field.addEventListener('input',()=>{data[field.dataset.field]=field.value;details.set(key,data);say('Alterações ainda não salvas. Você pode alternar entre cargos ou GHEs antes de salvar.');});});
 const epiKey=detailKey('epi-data',target.id,risk.code),epi=epis.get(epiKey)||{applicable:'',items:[]};
 const choices=Array.from(article.querySelectorAll('.choices input'));
 const items=article.querySelector('#detail-epi-items'),epiLabel=article.querySelector('#detail-epi-label');
 choices.forEach((field,i)=>{field.checked=Boolean(data.controls?.[i])||(i===2&&epi.applicable==='Sim');});
 if(choices[2].checked){data.controls=choices.map(el=>el.checked);details.set(key,data);epi.applicable='Sim';epis.set(epiKey,epi);}
 items.value=(epi.items||[]).join('\n');epiLabel.hidden=!choices[2].checked;
 choices.forEach(field=>{field.onchange=()=>{
  data.controls=choices.map(el=>el.checked);details.set(key,data);
  epi.applicable=choices[2].checked?'Sim':'Não';epis.set(epiKey,epi);
  epiLabel.hidden=!choices[2].checked;say('Alterações ainda não salvas.');
 };});
 items.oninput=()=>{epi.items=[...new Set(items.value.split('\n').map(v=>v.trim()).filter(Boolean))];epis.set(epiKey,epi);say('Alterações ainda não salvas.');};
 $('#cards').append(article);
}
$('#target-select').onchange=()=>{if(!validateCurrentRisk()){$('#target-select').value=String(current);return;}current=Number($('#target-select').value);index=0;render()};
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
 const risk=targets[current]?.risks[index];if(risk){const key=detailKey('epi-data',targets[current].id,risk.code);const epi=epis.get(key)||{items:[]};epi.applicable=$('#detail-epi-label')?.hidden?'Não':'Sim';epis.set(key,epi);}

 if(saving||!row)return false;saving=true;$('#next').disabled=true;const version=fingerprint();const snapshot=JSON.parse(JSON.stringify(detailAnswers(row.answers,details,epis)));
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
 $('#editor').hidden=false;say('Use Salvar e avançar para guardar as alterações e continuar.');render();
 }catch(error){say(error.message)}}
for(const link of document.querySelectorAll('.gro-header a'))link.onclick=event=>$('#back').onclick(event);
$('#sign-out').onclick=async()=>{if(saving)return;if(dirty()&&!confirm('Sair sem salvar o detalhamento?'))return;baseline=fingerprint();await authClient.auth.signOut({scope:'local'});location.assign('./index.html?reason=signedout');};
await load();

window.addEventListener('pageshow',event=>{if(event.persisted){if(!dirty()&&!saving)location.reload();else say('Há alterações não salvas nesta tela. Salve antes de sair; se houver conflito, mantenha a página aberta.');}});

function validateCurrentRisk(){
 const card=$('#cards'),missing=[];
 const labels={source:'Informe a fonte ou situação de exposição.',frequency:'Selecione a frequência.',duration:'Informe o tempo ou circunstância de exposição.',damage:'Descreva os possíveis danos à saúde.',measures:'Descreva as medidas existentes; informe se não houver.',measure:'Informe se precisa medir ou avaliar.'};
 for(const [key,text] of Object.entries(labels)){const el=card.querySelector('[data-field="'+key+'"]');if(el&&!el.value.trim())missing.push({text,element:el});}
 const epi=card.querySelector('#detail-epi-items');if(epi&&!card.querySelector('#detail-epi-label').hidden&&!epi.value.trim())missing.push({text:'Informe quais EPIs são utilizados.',element:epi});
 return GRO_VALIDATE.show(missing);
}
