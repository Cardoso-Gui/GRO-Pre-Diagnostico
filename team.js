import {watchPageResume} from './page-resume.js?v=20260930-resume1';
import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20260928-occ1';
const $=s=>document.querySelector(s);
let member,offset=0,busy=false,rows=[],more=false,teams=[],generation=0;
const collapsedTeams=new Set();
function node(tag,text='',cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function formatPhone(value){const d=String(value||'').replace(/\D/g,'').slice(0,11);if(d.length<3)return d;const split=d.length>10?7:6;return `(${d.slice(0,2)}) ${d.slice(2,split)}${d.length>split?'-'+d.slice(split):''}`;}
function countLabel(count,singular,plural){return `${count} ${count===1?singular:plural}`;}
function memberRole(row,team){return row.is_super_admin||(team?.active&&team.grants_global_access)?'global':row.role==='admin'?'admin':'member';}
const roleLabels={global:'Administrador geral',admin:'Administrador',member:'Colaborador'};
function teamIcon(){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('directory-group-icon');
 for(const d of ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75']){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path);}
 return svg;
}
function tableFor(people,team){
 const table=node('table','','directory-table');table.setAttribute('aria-label',`Integrantes de ${team.name}`);
 const head=node('thead'),headRow=node('tr');
 for(const label of ['Integrante','Usuário','Contato','Função','Status']){const th=node('th',label);th.scope='col';headRow.append(th);}head.append(headRow);
 const body=node('tbody');
 for(const row of people){
  const tr=node('tr'),nameCell=node('td'),person=node('div','','directory-person');
  const name=String(row.display_name||'Nome não informado');
  const avatar=node('span',name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toLocaleUpperCase('pt-BR'),'directory-avatar');
  avatar.setAttribute('aria-hidden','true');avatar.dataset.tone=String([...name].reduce((total,char)=>total+char.charCodeAt(0),0)%5);
  const info=node('div');info.append(node('strong',name));if(row.user_id===member.user_id)info.append(node('span','Você','directory-you'));
  person.append(avatar,info);nameCell.append(person);tr.append(nameCell);
  const values=[['Usuário',row.username||'Não informado'],['Contato',formatPhone(row.contact_phone)||'Não informado'],['Função',roleLabels[memberRole(row,team)]],['Status',row.active?'Ativo':'Inativo']];
  for(const [label,value] of values){
   const td=node('td'),mobileLabel=node('span',label,'directory-mobile-label');mobileLabel.setAttribute('aria-hidden','true');td.append(mobileLabel);
   if(label==='Função')td.append(node('span',value,'directory-badge directory-role'));
   else if(label==='Status')td.append(node('span',value,`directory-badge directory-status${row.active?'':' inactive'}`));
   else td.append(node('span',value,label==='Contato'?'directory-contact':''));
   tr.append(td);
  }
  body.append(tr);
 }
 table.append(head,body);return table;
}
function render(){
 const query=$('#member-search').value.trim().toLocaleLowerCase('pt-BR'),role=$('#role-filter').value,status=$('#status-filter').value,teamId=$('#team-filter').value;
 const filtered=!!(query||role||status||teamId),byId=new Map(teams.map(team=>[team.id,team]));
 const found=rows.filter(row=>{
  const team=byId.get(row.team_id);
  return (!teamId||row.team_id===teamId)&&(!role||memberRole(row,team)===role)&&(!status||(status==='active'?row.active:!row.active))&&`${row.display_name} ${row.username||''} ${team?.name||''}`.toLocaleLowerCase('pt-BR').includes(query);
 });
 const shownTeams=teams.filter(team=>(!teamId||team.id===teamId)&&(!filtered||found.some(row=>row.team_id===team.id)));
 $('#member-list').replaceChildren();
 for(const team of shownTeams){
  const people=found.filter(row=>row.team_id===team.id),group=node(member.is_super_admin?'details':'section','','directory-group');
  if(member.is_super_admin){
   group.open=filtered||!collapsedTeams.has(team.id);
   group.addEventListener('toggle',()=>{if(!filtered){if(group.open)collapsedTeams.delete(team.id);else collapsedTeams.add(team.id);}});
  }
  const heading=node(member.is_super_admin?'summary':'div','','directory-group-heading');
  heading.append(teamIcon(),node('h2',team.name));
  if(!team.active)heading.append(node('span','Equipe inativa','directory-badge directory-team-inactive'));
  heading.append(node('span',`${countLabel(people.length,'integrante','integrantes')}${more?' na lista carregada':''}`,'directory-group-count'));
  if(member.is_super_admin){const chevron=node('span','','directory-chevron');chevron.setAttribute('aria-hidden','true');heading.append(chevron);}
  group.append(heading);
  if(people.length)group.append(tableFor(people,team));
  else group.append(node('p',more?'Nenhum integrante desta equipe na lista carregada.':'Nenhum integrante nesta equipe.','directory-empty'));
  $('#member-list').append(group);
 }
 $('#directory-summary').textContent=`${countLabel(shownTeams.length,'equipe','equipes')} · ${countLabel(found.length,'integrante','integrantes')}${more?' na lista carregada':filtered?(found.length===1?' encontrado':' encontrados'):''}`;
 $('#team-search-hint').hidden=!more;
 $('#team-status').classList.remove('error');
 $('#team-status').textContent=found.length?'':filtered?(more?'Nenhum resultado entre os integrantes carregados. Você pode carregar mais ou ajustar os filtros.':'Nenhum integrante encontrado. Tente outro nome ou ajuste os filtros.'):(more?'Nenhum integrante na lista carregada.':'Nenhum integrante disponível.');
 $('#more-members').hidden=!more;
}
function syncTeamContext(){
 const selected=$('#team-filter').value,select=$('#team-filter');select.replaceChildren(node('option','Todas as equipes'));select.firstChild.value='';
 for(const team of teams){const option=node('option',team.name);option.value=team.id;select.append(option);}
 select.value=teams.some(team=>team.id===selected)?selected:'';
 $('#team-picker').hidden=!member.is_super_admin;$('#team-name').hidden=!!member.is_super_admin;
 $('#team-name').textContent=teams[0]?.name||'Minha equipe';
 $('#team-eyebrow').textContent=member.is_super_admin?'Equipes do sistema':'Pessoas da sua equipe';
}
function clearDirectory(){generation++;rows=[];teams=[];offset=0;$('#member-list').replaceChildren();$('#team-page').hidden=true;}
async function load(reset=false){
 if(busy)return;busy=true;const request=generation;
 $('#retry-list').hidden=true;$('#more-members').disabled=true;$('#retry-session').disabled=true;
 $('#more-members').textContent='Carregando…';$('.team-results').setAttribute('aria-busy','true');
 try{
  const result=await getTeamMember();if(request!==generation)return;if(result.error)throw result.error;
  if(!result.member){clearDirectory();location.replace('./index.html?reason=expired');return;}
  const changed=member?.team_id!==result.member.team_id||member?.is_super_admin!==result.member.is_super_admin;member=result.member;updateHeader(member);
  if(reset||changed){rows=[];offset=0;collapsedTeams.clear();$('#member-list').replaceChildren();}
  // Keep the existing authorization scope and 50-row pagination. RLS is unchanged.
  let teamQuery=authClient.from('teams').select('id,name,active,grants_global_access').order('name');
  let peopleQuery=authClient.from('team_members').select('user_id,display_name,username,contact_phone,role,active,is_super_admin,team_id').order('display_name').order('user_id').range(offset,offset+49);
  if(!member.is_super_admin){teamQuery=teamQuery.eq('id',member.team_id);peopleQuery=peopleQuery.eq('team_id',member.team_id);}
  const [team,members]=await Promise.all([teamQuery,peopleQuery]);if(request!==generation)return;
  if(team.error||members.error)throw team.error||members.error;
  teams=team.data;rows.push(...members.data);offset=rows.length;more=members.data.length===50;
  syncTeamContext();$('#session-check').hidden=true;$('#team-page').hidden=false;render();
 }catch{
  if(request!==generation)return;
  if($('#team-page').hidden){$('#session-check p').textContent='Não foi possível carregar sua equipe. Confira a conexão e tente novamente.';$('#retry-session').hidden=false;}
  else{$('#team-status').classList.add('error');$('#team-status').textContent='Não foi possível carregar os integrantes. Confira a conexão e tente novamente.';$('#retry-list').hidden=false;}
 }finally{busy=false;$('#more-members').disabled=false;$('#retry-session').disabled=false;$('#more-members').textContent='Carregar mais';$('.team-results').setAttribute('aria-busy','false');}
}
$('#member-search').addEventListener('input',render);
for(const id of ['role-filter','status-filter','team-filter'])$('#'+id).addEventListener('change',render);
$('#more-members').onclick=()=>load();$('#retry-list').onclick=()=>load();$('#retry-session').onclick=()=>load(true);
$('#sign-out').onclick=async()=>{await authClient.auth.signOut({scope:'local'});clearDirectory();location.replace('./index.html?reason=signedout');};
authClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearDirectory();location.replace('./index.html?reason=expired');}});
load(true);
watchPageResume({getMember:getTeamMember,currentMember:()=>member,onAccessChanged:()=>{clearDirectory();location.replace('./index.html?reason=expired');}});
