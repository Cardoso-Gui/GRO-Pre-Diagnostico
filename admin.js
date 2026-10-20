import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20260928-occ1';
import {PROFESSIONAL_ROLES,REGISTRATION_UFS,professionalRoleLabel} from './professional-identity.js?v=20261020-professional1';
const $=s=>document.querySelector(s),uf=$('#user-form'),tf=$('#team-form');
let member,users=[],teams=[],busy=false,loading=false,loaded=false;
const field=(form,name)=>form.elements.namedItem(name);
for(const [value,label] of Object.entries(PROFESSIONAL_ROLES)){const option=document.createElement('option');option.value=value;option.textContent=label;field(uf,'professional_role').append(option);}
for(const value of REGISTRATION_UFS){const option=document.createElement('option');option.value=value;option.textContent=value;field(uf,'professional_registration_uf').append(option);}
function syncProfession(){
 const profession=field(uf,'professional_role').value,registered=['safety_technician','safety_engineer'].includes(profession),engineer=profession==='safety_engineer';
 const registration=field(uf,'professional_registration'),registrationUF=field(uf,'professional_registration_uf');
 $('#professional-registration-label').hidden=!registered;registration.disabled=!registered;registration.required=registered;
 $('#professional-registration-title').textContent=engineer?'Número de registro no CREA':'Número de registro no MTE';
 $('#professional-registration-uf-label').hidden=!engineer;registrationUF.disabled=!engineer;registrationUF.required=engineer;
 if(!registered)registration.value='';if(!engineer)registrationUF.value='';
 registration.setCustomValidity('');registrationUF.setCustomValidity('');
 $('#professional-responsibility-note').textContent=profession==='safety_assistant'?'O auxiliar pode acompanhar e preencher, mas não pode ser responsável pela visita, mesmo com perfil de Administrador.':registered?'A função profissional é independente do perfil de acesso. Informe o registro do profissional responsável.':'Sem função profissional informada, o usuário não pode ser responsável por visitas.';
}
field(uf,'professional_role').addEventListener('change',syncProfession);
for(const name of ['professional_registration','professional_registration_uf'])field(uf,name).addEventListener('input',e=>e.target.setCustomValidity(''));
function professionalData(){
 const role=field(uf,'professional_role'),registration=field(uf,'professional_registration'),registrationUF=field(uf,'professional_registration_uf');
 syncProfession();registration.value=registration.value.trim();
 if(registration.required&&!registration.value)registration.setCustomValidity('Informe o número de registro profissional.');
 if(registrationUF.required&&!REGISTRATION_UFS.includes(registrationUF.value))registrationUF.setCustomValidity('Selecione uma UF válida para o CREA.');
 for(const control of [role,registration,registrationUF])if(!control.checkValidity()){control.reportValidity();control.focus();return null;}
 return {professional_role:role.value||null,professional_registration:registration.value||null,professional_registration_uf:registrationUF.value||null};
}
const dialogs=new Map([[uf,$('#user-dialog')],[tf,$('#team-dialog')]]);
const baselines=new Map(),openers=new Map();
const icons={edit:'M16 3 21 8M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16l-1 5Z',team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[name]);svg.append(path);if(name==='team'){const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx','9');circle.setAttribute('cy','7');circle.setAttribute('r','4');svg.append(circle);}return svg;}
function formatPhone(value){const d=String(value||'').replace(/\D/g,'').slice(0,11);if(d.length<3)return d;const split=d.length>10?7:6;return `(${d.slice(0,2)}) ${d.slice(2,split)}${d.length>split?'-'+d.slice(split):''}`;}
field(uf,'contact_phone').addEventListener('input',e=>{e.target.value=formatPhone(e.target.value);});
function formNotice(form,message,error=false){const node=$(`#${form===uf?'user':'team'}-form-status`);node.textContent=message;node.classList.toggle('error',error);}
function notice(message,error=false,form){$('#admin-status').textContent=message;$('#admin-status').classList.toggle('error',error);if(form)formNotice(form,message,error);}
function el(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function snapshot(form){return JSON.stringify([...form.querySelectorAll('input,select')].map(control=>[control.name||control.id,control.type==='checkbox'?control.checked:control.value]));}
function isDirty(form){return dialogs.get(form).open&&baselines.get(form)!==snapshot(form);}
function remember(form){baselines.set(form,snapshot(form));}
function editUser(user){
 uf.reset();for(const key of ['user_id','display_name','username','contact_phone','team_id','role','professional_role','professional_registration','professional_registration_uf'])field(uf,key).value=user?.[key]|| (key==='team_id'?member.team_id:key==='role'?'editor':'');
 const editing=!!user;
 field(uf,'professional_role').required=!editing;syncProfession();
 field(uf,'contact_phone').value=formatPhone(field(uf,'contact_phone').value);
 $('#reset-password-section').hidden=!editing||!!(user?.is_super_admin&&user.user_id!==member.user_id);
 $('#password-section').hidden=editing&&$('#reset-password-section').hidden;
 $('#reset-password').value='';$('#reset-password-confirm').value='';$('#reset-password-status').textContent='';
 field(uf,'active').checked=user?.active!==false;
 $('#password-label').hidden=editing;field(uf,'password').required=!editing;field(uf,'password').value='';
 $('#active-label').hidden=!editing;
 $('#user-form-title').textContent=editing?'Editar usuário':'Novo usuário';uf.querySelector('[type=submit]').textContent=editing?'Salvar alterações':'Criar usuário';
 const protectedUser=user?.is_super_admin || user?.user_id===member.user_id;
 field(uf,'role').disabled=!!protectedUser;field(uf,'active').disabled=!!protectedUser;field(uf,'team_id').disabled=!member.is_super_admin||!!protectedUser;
 $('#user-note').textContent=editing?'Alterar os dados não muda a senha. Ao desativar, o acesso é bloqueado e o histórico permanece salvo.':'O usuário terá acesso apenas aos dados da equipe escolhida.';
 formNotice(uf,'');remember(uf);
}
function editTeam(team){tf.reset();field(tf,'id').value=team?.id||'';field(tf,'name').value=team?.name||'';field(tf,'active').checked=team?.active!==false;field(tf,'active').disabled=team?.id===member.team_id;$('#team-active-label').hidden=!team;$('#team-form-title').textContent=team?'Editar equipe':'Nova equipe';tf.querySelector('[type=submit]').textContent=team?'Salvar alterações':'Criar equipe';formNotice(tf,'');remember(tf);}
function openForm(form,record,opener){
 if(busy||loading||!loaded||!member||member.role!=='admin'||(form===tf&&!member.is_super_admin)||(form===uf&&record?.is_super_admin&&!member.is_super_admin))return;
 if([...dialogs.values()].some(dialog=>dialog.open))return;
 if(form===uf)editUser(record);else editTeam(record);
 openers.set(form,{element:opener,id:record?.user_id||record?.id||''});dialogs.get(form).showModal();field(form,form===uf?'display_name':'name').focus();
}
function closeForm(form,force=false){
 const dialog=dialogs.get(form);if(!dialog.open)return true;
 if(!force&&(busy||(isDirty(form)&&!confirm('Descartar as alterações não salvas?'))))return false;
 dialog.close();form.reset();if(form===uf){$('#reset-password').value='';$('#reset-password-confirm').value='';}baselines.delete(form);formNotice(form,'');
 const opener=openers.get(form);const replacement=opener?.id?[...document.querySelectorAll(form===uf?'[data-edit-user]':'[data-edit-team]')].find(button=>button.dataset[form===uf?'editUser':'editTeam']===opener.id):null;
 const target=opener?.element?.isConnected?opener.element:replacement||$(form===uf?'#new-user':'#new-team');if(!target.hidden&&!target.disabled)target.focus();
 return true;
}
for(const [form,dialog] of dialogs){dialog.addEventListener('cancel',e=>{e.preventDefault();closeForm(form);});}
window.addEventListener('beforeunload',event=>{if([...dialogs.keys()].some(isDirty)){event.preventDefault();event.returnValue='';}});
function userRole(user){return user.is_super_admin||teams.some(t=>t.id===user.team_id&&t.active&&t.grants_global_access)?'global':user.role==='admin'?'admin':'editor';}
function roleLabel(role){return role==='global'?'Administrador geral':role==='admin'?'Administrador':'Colaborador';}
function statusMatches(active,value){return !value||(value==='active'?!!active:!active);}
function cell(row,label,content){const td=el('td','');td.append(el('span',label,'access-mobile-label'));td.append(typeof content==='string'?document.createTextNode(content):content);row.append(td);return td;}
function table(headers,className,caption){const table=el('table','',`access-table ${className}`);table.append(el('caption',caption,'access-sr-only'));const head=el('thead',''),row=el('tr','');for(const label of headers){const th=el('th',label);th.scope='col';row.append(th);}head.append(row);table.append(head);const body=el('tbody','');table.append(body);return {table,body};}
function countLabel(shown,total,singular,plural){const label=total===1?singular:plural,ending=(singular==='equipe'?'a':'o')+(total===1?'':'s');return `${shown===total?'':shown+' de '}${total} ${label} carregad${ending}`;}
function editButton(kind,record){const button=el('button','', 'access-edit');button.type='button';button.append(icon('edit'),document.createTextNode('Editar'));button.setAttribute('aria-label',`Editar ${kind==='user'?'usuário':'equipe'} ${kind==='user'?record.display_name:record.name}`);button.dataset[kind==='user'?'editUser':'editTeam']=kind==='user'?record.user_id:record.id;button.disabled=busy||loading||(kind==='user'&&!member.is_super_admin&&record.is_super_admin);button.addEventListener('click',()=>openForm(kind==='user'?uf:tf,record,button));return button;}
function render(){
 $('#new-user').disabled=busy||loading||!loaded;$('#new-team').disabled=busy||loading||!loaded;
 for(const name of ['users','teams'])$('#'+name+'-section').setAttribute('aria-busy',String(loading));
 if(!loaded)return;
 const query=$('#user-search').value.trim().toLocaleLowerCase('pt-BR'),teamFilter=$('#user-team-filter').value,roleFilter=$('#user-role-filter').value,statusFilter=$('#user-status-filter').value;
 const visibleUsers=users.filter(user=>`${user.display_name} ${user.username}`.toLocaleLowerCase('pt-BR').includes(query)&&(!teamFilter||user.team_id===teamFilter)&&(!roleFilter||userRole(user)===roleFilter)&&statusMatches(user.active,statusFilter));
 $('#users-list').replaceChildren();$('#users-count').textContent=countLabel(visibleUsers.length,users.length,'usuário','usuários');
 if(visibleUsers.length){
  const result=table(['Nome','Usuário','Equipe','Perfil de acesso','Status','Ações'],'access-users-table','Usuários cadastrados na lista carregada');
  for(const user of visibleUsers){
   const row=el('tr',''),person=el('div','','access-person');
   const initials=(user.display_name||user.username||'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('pt-BR');
   const avatar=el('span',initials,'access-avatar');avatar.setAttribute('aria-hidden','true');avatar.dataset.tone=String(users.indexOf(user)%5);person.append(avatar);
   const details=el('div','');details.append(el('strong',user.display_name),el('span',professionalRoleLabel(user.professional_role),'access-profession'));if(user.contact_phone)details.append(el('span',formatPhone(user.contact_phone),'access-contact'));person.append(details);
   cell(row,'Nome',person);cell(row,'Usuário',user.username||'Não informado');cell(row,'Equipe',teams.find(t=>t.id===user.team_id)?.name||'Equipe');cell(row,'Perfil de acesso',el('span',roleLabel(userRole(user)),'access-badge access-role'));cell(row,'Status',el('span',user.active?'Ativo':'Inativo',`access-badge access-status${user.active?'':' inactive'}`));cell(row,'Ações',editButton('user',user));result.body.append(row);
  }$('#users-list').append(result.table);
 }else $('#users-list').append(el('p',users.length?'Nenhum usuário encontrado entre os registros carregados.':'Nenhum usuário disponível na lista carregada.','access-empty'));
 const teamQuery=$('#team-search').value.trim().toLocaleLowerCase('pt-BR'),teamStatus=$('#team-status-filter').value;
 const visibleTeams=teams.filter(team=>team.name.toLocaleLowerCase('pt-BR').includes(teamQuery)&&statusMatches(team.active,teamStatus));
 $('#teams-list').replaceChildren();$('#teams-count').textContent=countLabel(visibleTeams.length,teams.length,'equipe','equipes');
 if(visibleTeams.length){
  const result=table(['Equipe','Integrantes','Status','Ações'],'access-teams-table','Equipes cadastradas na lista carregada');
  for(const team of visibleTeams){const row=el('tr',''),info=el('div','','access-person'),symbol=el('span','',`access-team-icon${team.active?'':' inactive'}`);symbol.append(icon('team'));info.append(symbol,el('strong',team.name));cell(row,'Equipe',info);const members=users.filter(u=>u.team_id===team.id).length;cell(row,'Integrantes',`${members} ${members===1?'integrante':'integrantes'} na lista carregada`);cell(row,'Status',el('span',team.active?'Ativa':'Inativa',`access-badge access-status${team.active?'':' inactive'}`));cell(row,'Ações',member.is_super_admin?editButton('team',team):el('span','Somente leitura','access-readonly'));result.body.append(row);}$('#teams-list').append(result.table);
 }else $('#teams-list').append(el('p',teams.length?'Nenhuma equipe encontrada entre os registros carregados.':'Nenhuma equipe disponível na lista carregada.','access-empty'));
}
async function load(){
 if(loading)return;
 loading=true;$('#reload-list').hidden=true;render();
 try{
  const [ur,tr]=await Promise.all([authClient.from('team_members').select('user_id,display_name,username,contact_phone,role,active,team_id,is_super_admin,professional_role,professional_registration,professional_registration_uf').order('display_name'),authClient.from('teams').select('id,name,active,grants_global_access').order('name')]);
  if(ur.error||tr.error)throw new Error('Não foi possível carregar a lista. Confira a conexão e tente novamente.');
  users=ur.data;teams=tr.data;loaded=true;
  const selected=field(uf,'team_id').value,filter=$('#user-team-filter'),selectedFilter=filter.value;field(uf,'team_id').replaceChildren();filter.replaceChildren(el('option','Todas as equipes'));filter.firstChild.value='';
  for(const t of teams){const option=el('option',t.name+(t.active?'':' (inativa)'));option.value=t.id;option.disabled=!t.active;field(uf,'team_id').append(option);const choice=el('option',t.name);choice.value=t.id;filter.append(choice);}field(uf,'team_id').value=selected||member.team_id;filter.value=teams.some(t=>t.id===selectedFilter)?selectedFilter:'';
 }catch(error){$('#reload-list').hidden=false;if(!loaded){$('#users-list').replaceChildren(el('p','A lista de usuários não foi carregada. Tente novamente.','access-empty'));$('#teams-list').replaceChildren(el('p','A lista de equipes não foi carregada. Tente novamente.','access-empty'));}throw error;}
 finally{loading=false;render();}
}
function lockForms(){const controls=[...uf.querySelectorAll('input,select,button'),...tf.querySelectorAll('input,select,button')];const disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);return ()=>controls.forEach((c,i)=>c.disabled=disabled[i]);}
async function save(form,action,data){
 if(busy)return;busy=true;const unlock=lockForms();notice('Salvando…',false,form);render();
 try {
  const response=await authClient.functions.invoke('gro-admin',{body:{action,data}});
  if(response.error){let message='Não foi possível confirmar o salvamento. Atualize a lista antes de tentar novamente.';try{message=(await response.error.context.json()).message||message;}catch{}throw new Error(message);}
  notice(response.data.message);closeForm(form,true);
  try{await load();}catch(e){notice('Salvo. '+e.message,true);}
 }catch(e){notice(e.message,true,form);}finally{unlock();busy=false;render();if(!dialogs.get(form).open){const opener=openers.get(form);const target=opener?.id?[...document.querySelectorAll(form===uf?'[data-edit-user]':'[data-edit-team]')].find(button=>button.dataset[form===uf?'editUser':'editTeam']===opener.id):null;(target||$(form===uf?'#new-user':'#new-team')).focus();}}
}
uf.addEventListener('submit',e=>{e.preventDefault();if(busy)return;const profession=professionalData();if(!profession)return;const data={...profession};for(const key of ['user_id','display_name','username','contact_phone','team_id','role','password'])data[key]=field(uf,key).value;data.active=field(uf,'active').checked;save(uf,data.user_id?'update_user':'create_user',data);});
tf.addEventListener('submit',e=>{e.preventDefault();save(tf,field(tf,'id').value?'update_team':'create_team',{id:field(tf,'id').value,name:field(tf,'name').value,active:field(tf,'active').checked});});
$('#new-user').onclick=e=>openForm(uf,null,e.currentTarget);$('#new-team').onclick=e=>openForm(tf,null,e.currentTarget);
for(const id of ['cancel-user','close-user'])$('#'+id).onclick=()=>closeForm(uf);for(const id of ['cancel-team','close-team'])$('#'+id).onclick=()=>closeForm(tf);
for(const id of ['user-search','team-search'])$('#'+id).oninput=render;
for(const id of ['user-team-filter','user-role-filter','user-status-filter','team-status-filter'])$('#'+id).onchange=render;
function selectTab(tab){for(const name of ['users','teams']){const selected=name===tab;$('#tab-'+name).setAttribute('aria-selected',String(selected));$('#tab-'+name).tabIndex=selected?0:-1;$('#'+name+'-section').hidden=!selected;}$('#new-user').hidden=tab!=='users';$('#new-team').hidden=tab!=='teams'||!member?.is_super_admin;$('#access-form-hint span').textContent=tab==='users'?'O formulário aparece apenas ao clicar em Novo usuário ou Editar.':member?.is_super_admin?'Cada equipe mantém seus próprios dados. Use Nova equipe ou Editar para abrir o formulário.':'Cada equipe mantém seus próprios dados. Apenas o administrador geral pode alterar equipes.';}
for(const tab of ['users','teams']){$('#tab-'+tab).onclick=()=>selectTab(tab);$('#tab-'+tab).onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'users':e.key==='End'?'teams':tab==='users'?'teams':'users';selectTab(next);$('#tab-'+next).focus();};}
$('#reload-list').onclick=()=>load().then(()=>notice('Lista atualizada.')).catch(e=>notice(e.message,true));
$('#sign-out').onclick=async()=>{if(busy)return;await authClient.auth.signOut({scope:'local'});location.href='./index.html?reason=signedout';};
async function init(){try{const result=await getTeamMember();if(result.error)throw result.error;member=result.member;if(!member){location.replace('./index.html?reason=expired');return;}if(member.role!=='admin'){$('#session-check p').textContent='Esta área é exclusiva dos administradores.';return;}updateHeader(member);$('#access-summary').textContent=member.is_super_admin?'Você gerencia todas as equipes. Os dados de cada equipe ficam separados.':'Gerencie os acessos da sua equipe.';$('#team-form').hidden=!member.is_super_admin;$('#admin-page').hidden=false;$('#session-check').hidden=true;notice('Carregando usuários e equipes…');try{await load();notice('');}catch(e){notice(e.message,true);}}catch{$('#session-check p').textContent='Não foi possível verificar seu acesso. Confira a conexão e tente novamente.';$('#retry-session').hidden=false;}}
$('#retry-session').onclick=init;init();

field(uf,'team_id').addEventListener('change',()=>{if(teams.some(t=>t.id===field(uf,'team_id').value&&t.grants_global_access))$('#user-note').textContent='Esta equipe concede acesso geral a todos os clientes, relatórios, usuários e equipes.';else $('#user-note').textContent='O usuário terá acesso aos dados da equipe escolhida.';});

$('#reset-password-button').onclick=async()=>{
 if(busy)return;
 const targetId=field(uf,'user_id').value,password=$('#reset-password').value;
 if(!targetId)return;
 if(password.length<6||password.length>128){$('#reset-password-status').textContent='Informe uma senha de 6 a 128 caracteres.';return;}
 if(password!==$('#reset-password-confirm').value){$('#reset-password-status').textContent='As senhas não coincidem.';return;}
 const target=users.find(u=>u.user_id===targetId);
 if(!confirm('Alterar a senha de '+(target?.display_name||'este usuário')+'?'))return;
 busy=true;const unlock=lockForms();render();$('#reset-password-status').textContent='Alterando senha…';
 try{const result=await authClient.functions.invoke('gro-admin',{body:{action:'reset_password',data:{user_id:targetId,password}}});if(result.error){let text='Não foi possível confirmar a alteração. Tente novamente.';try{text=(await result.error.context.json()).message||text;}catch{}throw Error(text);}$('#reset-password-status').textContent=result.data.message;}
 catch(e){$('#reset-password-status').textContent=e.message;}
 finally{$('#reset-password').value='';$('#reset-password-confirm').value='';unlock();busy=false;render();}
};
