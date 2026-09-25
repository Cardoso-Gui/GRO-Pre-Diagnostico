import {authClient,getTeamMember} from './auth-client.js';
import {companyFromClient,saveAssessment,clientOptionLabel} from './assessment-data.js';
const $=s=>document.querySelector(s);
const workspace=$('#protected-workspace'), notice=$('#session-check');
let member, row, selected, saving=false, dirty=false, loading=false, loaded=false, sequence=0, offset=0, historyOffset=0;
const login=()=>location.replace('./index.html?reason=expired');
const say=(text,error=false)=>{ $('#cloud-status').textContent=text; $('#cloud-status').classList.toggle('error',error); };
async function access(){const result=await getTeamMember();if(result.error&&result.reason==='network')throw Error('Não foi possível verificar seu acesso. Recarregue para tentar novamente.');if(!result.member){dirty=false;login();throw Error('Sua sessão terminou.');}member=result.member;$('#session-name').textContent=member.display_name;}
const clientChoices = new Map();
async function clientList(){
 const ticket=++sequence;const select=$('#client-select');select.disabled=true;select.replaceChildren();clientChoices.clear();selected=null;$('#client-history').hidden=true;$('#retry-clients').hidden=true;say('Carregando empresas cadastradas…');
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione uma empresa';select.append(placeholder);
 try{
  for(let start=0;;start+=200){
   const {data,error}=await authClient.from('clients').select('id,legal_name,trade_name,cnpj,cnae,address,contact_phone,contact_email').eq('archived',false).order('legal_name').order('id').range(start,start+199);
   if(ticket!==sequence)return;if(error)throw error;
   for(const client of data){clientChoices.set(client.id,client);const option=document.createElement('option');option.value=client.id;option.textContent=clientOptionLabel(client);select.append(option);}
   if(data.length<200)break;
  }
  select.disabled=clientChoices.size===0;say(clientChoices.size?'Selecione a empresa para ver seus levantamentos.':'Nenhuma empresa cadastrada. Cadastre uma empresa para começar.');
 }catch{select.disabled=true;$('#retry-clients').hidden=false;say('Não foi possível carregar as empresas. Tente novamente.',true);}
}
function choose(client){if(saving)return;if(selected?.id!==client.id)creationId=null;selected=client;$('#selected-client').textContent=client.legal_name;$('#client-history').hidden=false;$('#assessment-title').value=`Levantamento — ${new Date().toLocaleDateString('pt-BR')}`;historyList(true);}
async function historyList(reset=true){
 const clientId=selected.id;if(reset){historyOffset=0;$('#draft-list').replaceChildren();}$('#more-drafts').hidden=true;
 const start=historyOffset;
 $('#history-status').textContent='Carregando histórico…';
 try{const {data,error}=await authClient.from('assessments').select('id,title,status,updated_at,responsible_id,team_members!assessments_responsible_id_fkey(display_name)').eq('client_id',clientId).order('created_at',{ascending:false}).order('id').range(start,start+20);
 if(selected?.id!==clientId)return;if(error)throw error;
 for(const item of data.slice(0,20)){const article=document.createElement('article');const label=document.createElement('p');label.textContent=`${item.title} · ${item.status==='draft'?'Rascunho':'Concluído'} · ${new Date(item.updated_at).toLocaleString('pt-BR')} · ${item.team_members?.display_name || 'Equipe'}`;article.append(label);
 if(item.status==='draft'&&(member.role==='admin'||item.responsible_id===member.user_id)){const a=document.createElement('a');a.href=`./levantamento.html?id=${encodeURIComponent(item.id)}`;a.textContent='Continuar rascunho';article.append(a);}$('#draft-list').append(article);}
 historyOffset+=Math.min(data.length,20);$('#more-drafts').hidden=data.length<=20;$('#history-status').textContent=historyOffset?'':'Nenhum levantamento para este cliente ainda.';
 }catch{$('#history-status').textContent='Não foi possível carregar o histórico. Selecione o cliente novamente para tentar.';}
}
let creationId=null;
$('#create-assessment').addEventListener('submit',async event=>{
 event.preventDefault();if(!selected||saving)return;const title=$('#assessment-title').value.trim();if(!title)return;
 saving=true;$('#client-select').disabled=true;$('#start-assessment').disabled=true;say('Criando levantamento…');
 const client=selected;creationId ||= crypto.randomUUID();
 try{await access();const answers={cnpj:client.cnpj,currentCompany:companyFromClient(client)};
 const {error}=await authClient.from('assessments').insert({id:creationId,client_id:client.id,title,responsible_id:member.user_id,answers});
 if(error&&error.code!=='23505')throw error;
 if(error){const result=await authClient.from('assessments').select('id').eq('id',creationId).eq('client_id',client.id).maybeSingle();if(result.error||!result.data)throw error;}
 saving=false; location.assign(`./levantamento.html?id=${creationId}`);
 }catch{say('Não foi possível confirmar a criação. Tente novamente; o mesmo registro será conferido para evitar duplicação.',true);}
 finally{saving=false;$('#client-select').disabled=false;$('#start-assessment').disabled=false;}
});
async function loadForm(){
 const id=new URLSearchParams(location.search).get('id');
 if(!id){$('#assessment-picker').hidden=false;await clientList();return;}
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Endereço de levantamento inválido. Volte ao início.');
 const {data,error}=await authClient.from('assessments').select('*').eq('id',id).maybeSingle();
 if(error)throw Error('Não foi possível carregar o levantamento. Recarregue para tentar novamente.');
 if(!data)throw Error('Levantamento não encontrado. Volte ao início.');
 if(data.status!=='draft')throw Error('Este levantamento está concluído e preservado no histórico.');
 if(member.role!=='admin'&&data.responsible_id!==member.user_id)throw Error('Somente o responsável ou administrador pode editar este rascunho.');
 row=data;
 globalThis.GRO_CLOUD={save:async answers=>{
 if(saving)return;saving=true;$('#save-draft-button').disabled=true;
 const version=changes; const snapshot=JSON.parse(JSON.stringify(answers));
 try{await access();row=await saveAssessment(authClient,row,snapshot);dirty=changes!==version;say(dirty?'Rascunho salvo. Há alterações novas nesta tela; salve novamente.':`Rascunho salvo no sistema às ${new Date().toLocaleTimeString('pt-BR')}.`);}
 catch(error){say(error.message,true);}finally{saving=false;$('#save-draft-button').disabled=false;}
 },reload:()=>{if(!dirty||confirm('Descartar alterações não salvas e recarregar o rascunho?')){dirty=false;location.reload();}}};
 for(const file of ['cnae-descriptions.js','cnae-risk-map.js','esocial-risk-table.js','occupational-risk-table.js','training-rules.js','nr-report-rules.js','script.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=file;script.onload=resolve;script.onerror=reject;document.body.append(script);});
 globalThis.GRO_FORM.restore(row.answers);
 $('#questionnaire').hidden=false;$('#page-title').textContent=row.title;$('#cnpj-form').hidden=true;$('#clear-draft-button').hidden=true;$('#load-draft-button').textContent='Recarregar rascunho';
 say('Rascunho carregado. Clique em Salvar rascunho para guardar suas alterações no sistema.');
}
let changes=0;
for(const event of ['input','change','submit','click'])$('#questionnaire').addEventListener(event,e=>{if(['save-draft-button','load-draft-button','print-report-button'].includes(e.target.id))return;dirty=true;changes++;});
async function initialize(){if(loading)return;loading=true;workspace.hidden=true;notice.hidden=false;try{await access();if(!loaded){await loadForm();loaded=true;}workspace.hidden=false;notice.hidden=true;}catch(error){notice.querySelector('p').textContent=error.message;}finally{loading=false;}}
$('#client-select').addEventListener('change',()=>{const client=clientChoices.get($('#client-select').value);if(client)choose(client);else{selected=null;creationId=null;$('#client-history').hidden=true;}});
$('#retry-clients').addEventListener('click',()=>clientList());
$('#more-drafts').addEventListener('click',()=>historyList(false));
$('#sign-out').addEventListener('click',async()=>{if(dirty&&!confirm('Sair sem salvar as alterações?'))return;dirty=false;await authClient.auth.signOut({scope:'local'});login();});
authClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){workspace.hidden=true;dirty=false;login();}});
window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)workspace.hidden=true;else initialize();});
window.addEventListener('pageshow',event=>{if(event.persisted)initialize();});
await initialize();





