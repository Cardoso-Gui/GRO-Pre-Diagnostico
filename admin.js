import {authClient,getTeamMember} from './auth-client.js?v=20260928-admin1';
import {updateHeader} from './app-header.js?v=20260928-team1';
const $=s=>document.querySelector(s), uf=$('#user-form'),tf=$('#team-form');
let member,users=[],teams=[],busy=false;
const field=(form,name)=>form.elements.namedItem(name);
function notice(message,error=false){$('#admin-status').textContent=message;$('#admin-status').classList.toggle('error',error);}
function el(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function editUser(user){
 uf.reset();for(const key of ['user_id','display_name','username','contact_email','team_id','role'])field(uf,key).value=user?.[key]|| (key==='team_id'?member.team_id:key==='role'?'editor':'');
 const editing=!!user;field(uf,'active').checked=user?.active!==false;
 $('#password-label').hidden=editing;field(uf,'password').required=!editing;field(uf,'password').value='';
 $('#active-label').hidden=!editing;$('#cancel-user').hidden=!editing;
 $('#user-form-title').textContent=editing?'Editar usuário':'Novo usuário';uf.querySelector('[type=submit]').textContent=editing?'Salvar alterações':'Criar usuário';
 const protectedUser=user?.is_super_admin || user?.user_id===member.user_id;
 field(uf,'role').disabled=!!protectedUser;field(uf,'active').disabled=!!protectedUser;field(uf,'team_id').disabled=!member.is_super_admin||!!protectedUser;
 $('#user-note').textContent=editing?'Alterar os dados não muda a senha. Ao desativar, o acesso é bloqueado e o histórico permanece salvo.':'O usuário terá acesso apenas aos dados da equipe escolhida.';
}
function editTeam(team){tf.reset();field(tf,'id').value=team?.id||'';field(tf,'name').value=team?.name||'';field(tf,'active').checked=team?.active!==false;field(tf,'active').disabled=team?.id===member.team_id;$('#team-active-label').hidden=!team;$('#cancel-team').hidden=!team;$('#team-form-title').textContent=team?'Editar equipe':'Nova equipe';tf.querySelector('[type=submit]').textContent=team?'Salvar alterações':'Criar equipe';}
function render(){
 const query=$('#user-search').value.trim().toLocaleLowerCase('pt-BR');$('#users-list').replaceChildren();
 for(const user of users.filter(u=>`${u.display_name} ${u.username}`.toLocaleLowerCase('pt-BR').includes(query))){
  const row=el('article','','admin-row'),info=el('div','');info.append(el('strong',user.display_name),el('p',`${user.username} · ${teams.find(t=>t.id===user.team_id)?.name||'Equipe'}`),el('span',!user.active?'Inativo':user.is_super_admin?'Administrador geral':user.role==='admin'?'Administrador':'Colaborador',`admin-badge${user.active?'':' inactive'}`));
  const button=el('button','Editar');button.type='button';button.disabled=busy||(!member.is_super_admin&&user.is_super_admin);button.addEventListener('click',()=>{editUser(user);uf.scrollIntoView({behavior:'smooth',block:'start'});field(uf,'display_name').focus({preventScroll:true});});row.append(info,button);$('#users-list').append(row);
 }
 if(!$('#users-list').children.length)$('#users-list').append(el('p','Nenhum usuário encontrado.'));
 $('#teams-list').replaceChildren();for(const team of teams){const row=el('article','','admin-row'),info=el('div','');info.append(el('strong',team.name),el('p',`${users.filter(u=>u.team_id===team.id).length} usuário(s) · ${team.active?'Ativa':'Inativa'}`));row.append(info);if(member.is_super_admin){const b=el('button','Editar');b.type='button';b.disabled=busy;b.onclick=()=>editTeam(team);row.append(b);}$('#teams-list').append(row);}
}
async function load(){
 $('#reload-list').hidden=true;
 const [ur,tr]=await Promise.all([authClient.from('team_members').select('user_id,display_name,username,contact_email,role,active,team_id,is_super_admin').order('display_name'),authClient.from('teams').select('id,name,active').order('name')]);
 if(ur.error||tr.error){$('#reload-list').hidden=false;throw new Error('Não foi possível carregar a lista. Confira a conexão e tente novamente.');}
 users=ur.data;teams=tr.data;const selected=field(uf,'team_id').value;field(uf,'team_id').replaceChildren();for(const t of teams){const option=el('option',t.name+(t.active?'':' (inativa)'));option.value=t.id;option.disabled=!t.active;field(uf,'team_id').append(option);}field(uf,'team_id').value=selected||member.team_id;render();
}
async function save(form,action,data){
 if(busy)return;busy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;notice('Salvando…');render();
 try {
  const response=await authClient.functions.invoke('gro-admin',{body:{action,data}});
  if(response.error){let message='Não foi possível confirmar o salvamento. Atualize a lista antes de tentar novamente.';try{message=(await response.error.context.json()).message||message;}catch{}throw new Error(message);}
  notice(response.data.message);if(form===uf)editUser(null);else editTeam(null);
  try{await load();}catch(e){notice('Salvo. '+e.message,true);}
 }catch(e){notice(e.message,true);}finally{busy=false;submit.disabled=false;render();}
}
uf.addEventListener('submit',e=>{e.preventDefault();const data={};for(const key of ['user_id','display_name','username','contact_email','team_id','role','password'])data[key]=field(uf,key).value;data.active=field(uf,'active').checked;save(uf,data.user_id?'update_user':'create_user',data);});
tf.addEventListener('submit',e=>{e.preventDefault();save(tf,field(tf,'id').value?'update_team':'create_team',{id:field(tf,'id').value,name:field(tf,'name').value,active:field(tf,'active').checked});});
$('#cancel-user').onclick=()=>{if(!busy)editUser(null);};$('#cancel-team').onclick=()=>{if(!busy)editTeam(null);};$('#user-search').oninput=render;
for(const tab of ['users','teams'])$('#tab-'+tab).onclick=()=>{for(const name of ['users','teams']){$('#tab-'+name).setAttribute('aria-selected',String(name===tab));$('#'+name+'-section').hidden=name!==tab;}};
$('#reload-list').onclick=()=>load().then(()=>notice('Lista atualizada.')).catch(e=>notice(e.message,true));
$('#sign-out').onclick=async()=>{if(busy)return;await authClient.auth.signOut({scope:'local'});location.href='./index.html?reason=signedout';};
async function init(){try{const result=await getTeamMember();if(result.error)throw result.error;member=result.member;if(!member){location.replace('./index.html?reason=expired');return;}if(member.role!=='admin'){$('#session-check p').textContent='Esta área é exclusiva dos administradores.';return;}updateHeader(member);$('#access-summary').textContent=member.is_super_admin?'Você gerencia todas as equipes. Os dados de cada equipe ficam separados.':'Gerencie os acessos da sua equipe.';$('#team-form').hidden=!member.is_super_admin;$('#admin-page').hidden=false;$('#session-check').hidden=true;await load();editUser(null);editTeam(null);}catch{$('#session-check p').textContent='Não foi possível verificar seu acesso. Confira a conexão e tente novamente.';$('#retry-session').hidden=false;if(member)notice('Não foi possível carregar os dados. Tente novamente.',true);}}
$('#retry-session').onclick=init;init();
