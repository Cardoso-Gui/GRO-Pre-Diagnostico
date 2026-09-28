import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20260928-occ1';
const $=s=>document.querySelector(s);
let member,offset=0,busy=false,rows=[],more=false,teams=[];
function node(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function render(){
 const query=$('#member-search').value.trim().toLocaleLowerCase('pt-BR');
 const found=rows.filter(row=>`${row.display_name} ${row.username||''} ${teams.find(t=>t.id===row.team_id)?.name||''}`.toLocaleLowerCase('pt-BR').includes(query));
 $('#member-list').replaceChildren();
 for(const team of teams){
  const people=found.filter(row=>row.team_id===team.id);
  if(query&&!people.length&&!team.name.toLocaleLowerCase('pt-BR').includes(query))continue;
  const group=node('section','');
  if(member.is_super_admin)group.append(node('h3',team.name+(team.active?'':' · Inativa')));
  for(const row of people){const article=node('article','','admin-row'),info=node('div','');info.append(node('strong',row.display_name+(row.user_id===member.user_id?' (você)':'')),node('p',row.username||''));article.append(info,node('span',!row.active?'Inativo':row.is_super_admin||(team.active&&team.grants_global_access)?'Administrador geral':row.role==='admin'?'Administrador':'Colaborador',`admin-badge${row.active?'':' inactive'}`));group.append(article);}
  if(!people.length)group.append(node('p',more?'Nenhum integrante desta equipe na lista carregada.':'Nenhum integrante encontrado.'));
  $('#member-list').append(group);
 }
 $('#team-status').textContent=found.length?`${found.length} integrante(s)${query?' encontrado(s)':''}${more?' nesta lista':''}.`:query?'Nenhum integrante encontrado na lista carregada.':'Nenhum integrante disponível.';
 $('#more-members').hidden=!more;
}
async function load(reset=false){
 if(busy)return;busy=true;$('#retry-list').hidden=true;$('#more-members').disabled=true;
 try{
  const result=await getTeamMember();if(result.error)throw result.error;
  if(!result.member){$('#team-page').hidden=true;location.replace('./index.html?reason=expired');return;}
  const changed=member?.team_id!==result.member.team_id||member?.is_super_admin!==result.member.is_super_admin;member=result.member;updateHeader(member);
  if(reset||changed){rows=[];offset=0;$('#member-list').replaceChildren();}
  let teamQuery=authClient.from('teams').select('id,name,active,grants_global_access').order('name');
  let peopleQuery=authClient.from('team_members').select('user_id,display_name,username,role,active,is_super_admin,team_id').order('display_name').order('user_id').range(offset,offset+49);
  if(!member.is_super_admin){teamQuery=teamQuery.eq('id',member.team_id);peopleQuery=peopleQuery.eq('team_id',member.team_id);}
  const [team,members]=await Promise.all([teamQuery,peopleQuery]);
  if(team.error||members.error)throw team.error||members.error;
  teams=team.data;
  $('#team-name').textContent=member.is_super_admin?'Todas as equipes':teams[0]?.name||'Minha equipe';
  $('.admin-heading .eyebrow').textContent=member.is_super_admin?'Equipes do sistema':'Pessoas da sua equipe';
  $('.admin-heading h1 + p').textContent=member.is_super_admin?'Confira as equipes, seus integrantes e os perfis de acesso.':'Confira quem faz parte da sua equipe e os perfis de acesso.';
  $('.admin-note').textContent=member.is_super_admin?'Esta tela é apenas para consulta. Para gerenciar usuários e equipes, acesse Administração.':'Esta tela é apenas para consulta. Para alterar um acesso, fale com o administrador da sua equipe.';
  rows.push(...members.data);offset=rows.length;more=members.data.length===50;
  $('#session-check').hidden=true;$('#team-page').hidden=false;render();
 }catch{
  if($('#team-page').hidden){$('#session-check p').textContent='Não foi possível carregar sua equipe. Confira a conexão e tente novamente.';$('#retry-session').hidden=false;}
  else{$('#team-status').textContent='Não foi possível carregar os integrantes. Confira a conexão e tente novamente.';$('#retry-list').hidden=false;}
 }finally{busy=false;$('#more-members').disabled=false;}
}
$('#member-search').addEventListener('input',render);
$('#more-members').onclick=()=>load();$('#retry-list').onclick=()=>load();$('#retry-session').onclick=()=>load(true);
$('#sign-out').onclick=async()=>{await authClient.auth.signOut({scope:'local'});location.replace('./index.html?reason=signedout');};
document.addEventListener('visibilitychange',()=>{if(document.hidden)$('#team-page').hidden=true;else load(true);});
authClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){$('#team-page').hidden=true;location.replace('./index.html?reason=expired');}});
load(true);
