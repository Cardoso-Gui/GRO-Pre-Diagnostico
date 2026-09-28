import {authClient,getTeamMember} from './auth-client.js?v=20260928-admin1';
import {updateHeader} from './app-header.js?v=20260928-team1';
const $=s=>document.querySelector(s);
let member,offset=0,busy=false,rows=[],more=false;
function node(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function render(){
 const query=$('#member-search').value.trim().toLocaleLowerCase('pt-BR');
 const found=rows.filter(row=>`${row.display_name} ${row.username||''}`.toLocaleLowerCase('pt-BR').includes(query));
 $('#member-list').replaceChildren();
 for(const row of found){const article=node('article','','admin-row'),info=node('div','');info.append(node('strong',row.display_name+(row.user_id===member.user_id?' (você)':'')),node('p',row.username||''));article.append(info,node('span',!row.active?'Inativo':row.is_super_admin?'Administrador geral':row.role==='admin'?'Administrador':'Colaborador',`admin-badge${row.active?'':' inactive'}`));$('#member-list').append(article);}
 $('#team-status').textContent=found.length?`${found.length} integrante(s)${query?' encontrado(s)':''}${more?' nesta lista':''}.`:query?'Nenhum integrante encontrado na lista carregada.':'Nenhum integrante disponível.';
 $('#more-members').hidden=!more;
}
async function load(reset=false){
 if(busy)return;busy=true;$('#retry-list').hidden=true;$('#more-members').disabled=true;
 try{
  const result=await getTeamMember();if(result.error)throw result.error;
  if(!result.member){$('#team-page').hidden=true;location.replace('./index.html?reason=expired');return;}
  const changed=member?.team_id!==result.member.team_id;member=result.member;updateHeader(member);
  if(reset||changed){rows=[];offset=0;$('#member-list').replaceChildren();}
  const [team,members]=await Promise.all([
   authClient.from('teams').select('name').eq('id',member.team_id).single(),
   authClient.from('team_members').select('user_id,display_name,username,role,active,is_super_admin').eq('team_id',member.team_id).order('display_name').order('user_id').range(offset,offset+49)
  ]);
  if(team.error||members.error)throw team.error||members.error;
  $('#team-name').textContent=team.data.name;rows.push(...members.data);offset=rows.length;more=members.data.length===50;
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
