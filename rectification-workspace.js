import {initAssessmentWizard} from './assessment-wizard.js?v=20261020-rectify1';
import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20261019-access1';
import {watchPageResume} from './page-resume.js?v=20260930-resume1';
import {photoUrl,uploadPhoto} from './workstation-photos.js?v=20260928-photos1';
import {loadQuestionnaireRuntime,generateEffectiveDocument} from './report-generator.js?v=20261020-objective1';
import {readAssessmentReport,saveRectification,correctionChanges,applyBusinessChanges,changedValues,equalValue,renameBusinessReferences} from './report-rectification.js?v=20261020-rectify1';
import {describeRectificationChange} from './rectification-diff-view.js?v=20261020-review1';
const $=s=>document.querySelector(s),wizard=initAssessmentWizard(),params=new URLSearchParams(location.search),id=params.get('id');
const review=$('#rectification-review'),status=$('#rectification-save-status');
let state,member,baseline,company,title,busy=false,dirty=false,pending=null,confirmed=false,accessBlocked=false,intentionalLeaving=false;
const back=()=>location.assign('./report.html?id='+encodeURIComponent(id));
const say=text=>{$('#cloud-status').hidden=false;$('#cloud-status').textContent=text;};
function make(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function editIdentity(){
 const block=make('section');block.id='rectification-identity';const header=make('h3','Identificação preservada neste relatório');header.style.gridColumn='1 / -1';block.append(header);
 const input=(label,value,change)=>{const caption=make('label',label),field=make('input');field.value=value||'';field.maxLength=240;field.oninput=()=>{change(field.value);dirty=true;};caption.append(field);block.append(caption);};
 input('Título do levantamento',title,value=>{title=value;});
 for(const [key,label] of Object.entries({legal_name:'Razão social',trade_name:'Nome fantasia',cnpj:'CNPJ',cnae:'CNAE principal',contact_name:'Responsável da empresa',contact_phone:'Telefone',contact_email:'E-mail'}))input(label,company[key],value=>{company[key]=value;});
 for(const [key,label] of Object.entries({street:'Logradouro',number:'Número',complement:'Complemento',district:'Bairro',city:'Município',state:'UF',postal_code:'CEP'}))input(label,company.address?.[key],value=>{company.address={...company.address,[key]:value};});
 $('#assessment-visit-details').append(block);
 block.append(make('p','Estas mudanças corrigem somente o conteúdo histórico deste relatório. O cadastro do cliente não será alterado.'));
}
function changes(){return correctionChanges(state.assessment,baseline,globalThis.GRO_FORM.snapshot(),company,title);}
function hasUnsavedChanges(){return dirty||Boolean(state&&baseline&&Object.keys(changes()).length);}
async function reviewChanges(){
 if(busy||accessBlocked||!state)return;
 if(globalThis.GRO_POSTS?.busy()){say('Aguarde o envio das fotos terminar antes de revisar.');return;}
 if(!title.trim()){say('Informe o título do levantamento.');return;}
 const patch=changes();
 if(!Object.keys(patch).length){say('Nenhuma informação foi alterada.');return;}
 // Only use locally regenerated content; no caller-supplied report document is saved.
 const effective=applyBusinessChanges(state.assessment,patch);
 busy=true;$('#save-draft-button').disabled=true;
 try{await generateEffectiveDocument(effective.final_snapshot.answers,{originalDocument:state.original_report_document||state.assessment.final_snapshot.answers.report_document,changes:[...(state.history||[]).flatMap(entry=>entry.changes),...changedValues({title:state.assessment.title,client:state.assessment.final_snapshot.client,answers:state.assessment.final_snapshot.answers},{title:effective.title,client:effective.final_snapshot.client,answers:effective.final_snapshot.answers})]});}catch(error){say(error.message||'Não foi possível validar o relatório retificado. Nenhuma alteração foi salva.');return;}finally{busy=false;$('#save-draft-button').disabled=false;}
 // The user may continue editing while validation runs. Never review an old patch.
 if(accessBlocked)return;
 if(!equalValue(patch,changes())){say('Há alterações posteriores à validação. Clique novamente em Revisar retificação.');return;}
 const host=$('#rectification-diff');host.replaceChildren();
 const original={title:state.assessment.title,answers:structuredClone(state.assessment.final_snapshot.answers),client:state.assessment.final_snapshot.client};delete original.answers.report_document;
 const current={title:effective.title,answers:effective.final_snapshot.answers,client:effective.final_snapshot.client};
 const differences=changedValues(original,current);
 $('#rectification-change-count').textContent=differences.length===1?'1 alteração para conferir':differences.length+' alterações para conferir';
 for(const diff of differences){
  const display=describeRectificationChange(diff,{before:original,after:current});
  const item=make('article');item.className='rectification-diff-item';item.append(make('h3',display.label));
  if(display.context){const context=make('p',display.context);context.className='rectification-diff-context';item.append(context);}
  const values=make('div');values.className='rectification-diff-values';
  for(const [key,label] of [['before','Antes'],['after','Depois']]){const cell=make('div');cell.className=key;cell.append(make('span',label),make('p',display[key]));values.append(cell);}item.append(values);
  const reference=make('details');reference.className='rectification-field-reference';reference.append(make('summary','Referência do campo'),make('code',display.path));item.append(reference);host.append(item);
 }
 if(!pending||!equalValue(pending.changes,patch)){pending={requestId:crypto.randomUUID(),changes:structuredClone(patch),reason:null};}
 status.textContent='';review.showModal();$('#rectification-reason').focus();
}
$('#rectification-back').onclick=()=>{if(!busy)review.close();};
review.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
$('#rectification-confirm').onclick=async()=>{
 if(busy||accessBlocked||!pending)return;
 if(globalThis.GRO_POSTS?.busy()){status.textContent='Aguarde o envio das fotos terminar e revise novamente.';return;}
 if(!equalValue(pending.changes,changes())){status.textContent='Os dados mudaram após a revisão. Volte e revise as diferenças novamente.';return;}
 const reason=$('#rectification-reason').value.trim();if(!reason){status.textContent='Informe o motivo da retificação.';$('#rectification-reason').focus();return;}
 if(pending.reason!==null&&pending.reason!==reason)pending={...pending,requestId:crypto.randomUUID()};pending.reason=reason;
 busy=true;$('#rectification-confirm').disabled=true;$('#rectification-back').disabled=true;$('#rectification-reason').disabled=true;status.textContent='Salvando retificação e histórico…';
 try{
  const saved=await saveRectification(authClient,{id,sequence:state.sequence,requestId:pending.requestId,reason:pending.reason,changes:pending.changes});
  confirmed=true;dirty=false;state=saved;status.textContent='Retificação confirmada. Abrindo o relatório atualizado…';back();
 }catch(error){status.textContent=error.message;}
 finally{busy=false;if(!confirmed){$('#rectification-confirm').disabled=false;$('#rectification-back').disabled=false;$('#rectification-reason').disabled=false;}}
};
async function load(){
 try{
  if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('Abra a retificação a partir de um relatório.');
  const access=await getTeamMember();if(!access.member)throw Error('Não foi possível confirmar seu acesso. Entre novamente.');member=access.member;updateHeader(member);
  state=await readAssessmentReport(authClient,id);if(accessBlocked)return;if(!state.can_rectify)throw Error('Somente administradores ativos da equipe Administradores podem retificar este relatório.');
  company=structuredClone(state.assessment.final_snapshot.client);title=state.assessment.title;
  // Corrections stay in this page until the review dialog is explicitly confirmed.
  globalThis.GRO_CLOUD={rectification:true,rename:(kind,name,sector)=>{if(busy||accessBlocked||globalThis.GRO_POSTS?.busy()){say('Aguarde a operação em andamento antes de corrigir nomes.');return;}const value=prompt('Novo nome (riscos e vínculos serão preservados):',name);if(value===null)return;try{const updated=renameBusinessReferences(globalThis.GRO_FORM.snapshot(),{kind,name,newName:value,sector});globalThis.GRO_FORM.restore(updated);dirty=true;}catch(error){say(error.message);}},openRiskDetails:(target,risk)=>{const card=[...document.querySelectorAll('.rectification-risk')].find(node=>node.dataset.target===target&&(!risk||node.dataset.riskCode===risk));if(card){card.open=true;card.scrollIntoView({block:'center',behavior:'smooth'});card.querySelector('summary').focus();}},save:async()=>{reviewChanges();return null;},complete:async()=>{reviewChanges();return false;},reload:()=>{if(!hasUnsavedChanges()||confirm('Descartar as alterações não salvas e recarregar o relatório?')){intentionalLeaving=true;dirty=false;location.reload();}},photoUrl:path=>photoUrl(authClient,path,state.assessment.client_id),uploadPhoto:async file=>{const access=await getTeamMember();if(!access.member)throw Error('Sua sessão expirou.');return uploadPhoto(authClient,file,state.assessment.client_id,access.member.user_id);}};
  await new Promise((resolve,reject)=>{const script=make('script');script.src='workstation-editor.js?v=20261020-rectify1';script.onload=resolve;script.onerror=reject;document.body.append(script);});
  await loadQuestionnaireRuntime();
  if(accessBlocked)return;
  globalThis.GRO_FORM.restore(structuredClone(state.assessment.final_snapshot.answers));baseline=structuredClone(globalThis.GRO_FORM.snapshot());
  editIdentity();$('#questionnaire').hidden=false;$('#cnpj-form').hidden=true;$('#assessment-picker').hidden=true;$('#clear-draft-button').hidden=true;
  wizard.loaded({id:'rectification:'+id,title:'Retificar · '+title,isNew:true});
  $('#save-draft-button').textContent='Revisar retificação';$('#load-draft-button').textContent='Recarregar relatório';$('#generate-report-button').textContent='Revisar retificação';
  // The completed source may predate current validation. A date-only correction
  // must not demand unrelated edits; the server validates every changed field.
  $('#generate-report-button').replaceWith($('#generate-report-button').cloneNode(true));$('#generate-report-button').onclick=reviewChanges;
  $('#wizard-save-status').textContent='Revisão '+String(state.assessment.report_revision).padStart(2,'0')+' preservada. Alterações ainda não salvas.';
  $('#protected-workspace').hidden=false;$('#session-check').hidden=true;
  say('Edite somente o necessário e use Revisar retificação. Nada é salvo automaticamente.');
 }catch(error){$('#session-check p').textContent=error.message||'Não foi possível abrir a retificação.';}
}
$('#questionnaire').addEventListener('input',()=>{dirty=true;});$('#questionnaire').addEventListener('change',()=>{dirty=true;});
window.addEventListener('beforeunload',event=>{if(!confirmed&&!intentionalLeaving&&(hasUnsavedChanges()||busy)){event.preventDefault();event.returnValue='';}});
$('#load-draft-button').textContent='Recarregar relatório';
for(const link of document.querySelectorAll('.session-home,.wizard-breadcrumb a'))link.onclick=event=>{event.preventDefault();if(busy)return;if(!hasUnsavedChanges()||confirm('Voltar ao relatório sem salvar esta retificação?')){intentionalLeaving=true;dirty=false;back();}};
$('#sign-out').onclick=async()=>{if(busy)return;if(hasUnsavedChanges()&&!confirm('Sair sem salvar a retificação?'))return;intentionalLeaving=true;dirty=false;await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
function blockAccess(){accessBlocked=true;if(review.open)review.close();pending=null;$('#protected-workspace').hidden=true;$('#session-check').hidden=false;$('#session-check p').textContent='Seu acesso mudou. As alterações desta tela não foram enviadas por esta ação. Entre novamente e confira o histórico antes de continuar.';}
authClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){blockAccess();}});
await load();
watchPageResume({getMember:getTeamMember,currentMember:()=>member,onAccessChanged:blockAccess});
