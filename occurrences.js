import {addClientSearch} from './client-search.js?v=20260929-1';
addClientSearch(document.querySelector('#client-picker'));
import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20260928-occ1';
import {uploadPhoto,photoUrl} from './workstation-photos.js';
const $=s=>document.querySelector(s),form=$('#occ-form'),picker=$('#client-picker');
let member,busy=false,dirty=false,offset=0,ticket=0,recordId=crypto.randomUUID(),uploaded=null;
const field=name=>form.elements.namedItem(name);
const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
function clearPhotos(){for(const img of $('#occ-list').querySelectorAll('img'))URL.revokeObjectURL(img.src);}
function closeForm(){form.reset();form.hidden=true;dirty=false;recordId=crypto.randomUUID();uploaded=null;$('#save-status').textContent='';}
async function history(reset=true){
 const generation=++ticket,clientId=picker.value;
 if(reset){offset=0;clearPhotos();$('#occ-list').replaceChildren();}
 $('#more').hidden=true;$('#retry-list').hidden=true;$('#client-content').hidden=!clientId;if(!clientId)return;
 $('#status').textContent='Carregando ocorrências…';
 try{const {data,error}=await authClient.from('occurrences').select('id,kind,occurred_on,description,photo_path,created_at,created_by,team_members(display_name)').eq('client_id',clientId).order('occurred_on',{ascending:false}).order('id').range(offset,offset+20);if(generation!==ticket)return;if(error)throw error;
 for(const row of data.slice(0,20)){
 const card=node('article','');card.className='occ-card';card.append(node('h3',row.kind+' · '+row.occurred_on.split('-').reverse().join('/')));const desc=node('p',row.description);desc.className='occ-description';card.append(desc);const meta=node('p','Registrado por '+(row.team_members?.display_name||'Integrante da equipe')+' em '+new Date(row.created_at).toLocaleString('pt-BR'));meta.className='occ-meta';card.append(meta);
 if(row.photo_path){const button=node('button','Visualizar foto');button.className='secondary-button';button.onclick=async()=>{button.disabled=true;try{const url=await photoUrl(authClient,row.photo_path,clientId);if(!card.isConnected){URL.revokeObjectURL(url);return;}const img=node('img','');img.alt='Foto da ocorrência';img.className='occ-photo';img.src=url;card.append(img);button.remove();}catch{button.textContent='Foto indisponível. Tentar novamente';button.disabled=false;}};card.append(button);}
 $('#occ-list').append(card);}
 offset+=Math.min(data.length,20);$('#more').hidden=data.length<=20;$('#status').textContent=offset?'':'Nenhuma ocorrência registrada para este cliente.';
 }catch{if(generation!==ticket)return;$('#status').textContent='Não foi possível carregar as ocorrências. Confira a conexão e tente novamente.';$('#retry-list').hidden=false;}
}
picker.onchange=()=>{if(dirty&&!confirm('Descartar a ocorrência não salva?')){picker.value=picker.dataset.previous||'';return;}picker.dataset.previous=picker.value;closeForm();history();};
$('#new-occurrence').onclick=()=>{form.hidden=false;field('kind').focus();};
$('#cancel-occurrence').onclick=()=>{if(!dirty||confirm('Descartar a ocorrência não salva?'))closeForm();};
form.oninput=()=>{dirty=true;};
form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;if(!field('description').value.trim()){field('description').focus();$('#save-status').textContent='Preencha a descrição da ocorrência.';return;}busy=true;$('#occ-fields').disabled=true;picker.disabled=true;$('#new-occurrence').disabled=true;$('#save-status').textContent='Salvando ocorrência…';
 try{const access=await getTeamMember();if(!access.member)throw Error('Não foi possível verificar seu acesso. Entre novamente se sua sessão expirou.');member=access.member;
 const file=field('photo').files?.[0];if(file&&(!uploaded||uploaded.file!==file)){const photo=await uploadPhoto(authClient,file,picker.value,member.user_id);URL.revokeObjectURL(photo.url);uploaded={file,path:photo.path};}
 const payload={id:recordId,client_id:picker.value,kind:field('kind').value,occurred_on:field('occurred_on').value,description:field('description').value.trim(),photo_path:file?uploaded.path:null};
 const {error}=await authClient.from('occurrences').insert(payload);
 if(error){if(error.code!=='23505')throw Error('Não foi possível confirmar o salvamento. Seus dados foram mantidos. Tente novamente.');const check=await authClient.from('occurrences').select('id').eq('id',recordId).eq('client_id',picker.value).maybeSingle();if(check.error||!check.data)throw Error('Não foi possível confirmar o salvamento. Tente novamente.');}
 closeForm();await history();$('#save-status').textContent='';$('#status').textContent='Ocorrência salva.';
 }catch(e){$('#save-status').textContent=e.message||'Não foi possível salvar. Tente novamente.';}finally{busy=false;$('#occ-fields').disabled=false;picker.disabled=false;$('#new-occurrence').disabled=false;}
};
$('#more').onclick=()=>history(false);$('#retry-list').onclick=()=>history(false);
window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
$('#sign-out').onclick=async()=>{if(busy||dirty&&!confirm('Descartar a ocorrência não salva e sair?'))return;dirty=false;await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
async function init(){try{const access=await getTeamMember();if(!access.member){if(access.reason==='network')throw Error();location.replace('./index.html?reason=expired');return;}member=access.member;updateHeader(member);
 picker.replaceChildren(new Option('Selecione uma empresa',''));let start=0;while(true){const {data,error}=await authClient.from('clients').select('id,legal_name,trade_name,cnpj').eq('archived',false).order('legal_name').order('id').range(start,start+199);if(error)throw error;for(const c of data){const option=new Option(c.trade_name||c.legal_name,c.id);option.dataset.search=c.legal_name+' '+(c.cnpj||'');picker.append(option);}if(data.length<200)break;start+=200;}
 const requested=new URLSearchParams(location.search).get('client');if(requested&&[...picker.options].some(o=>o.value===requested))picker.value=requested;picker.dataset.previous=picker.value;
 $('#session-check').hidden=true;$('#team-page').hidden=false;await history();
 }catch{$('#session-check p').textContent='Não foi possível carregar as ocorrências. Confira a conexão e tente novamente.';$('#retry-session').hidden=false;}}
$('#retry-session').onclick=init;authClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){$('#team-page').hidden=true;dirty=false;location.replace('./index.html?reason=expired');}});init();
