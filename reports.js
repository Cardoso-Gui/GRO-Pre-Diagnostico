import {authClient,getTeamMember} from './auth-client.js';
import {updateHeader} from './app-header.js?v=20260925-header2';
import {clientOptionLabel} from './assessment-data.js';
const select=document.querySelector('#report-client'),list=document.querySelector('#report-list'),status=document.querySelector('#list-status'),more=document.querySelector('#list-more');
let sequence=0,offset=0,isAdmin=false;
async function load(reset=true){
 const ticket=++sequence,client=select.value;if(reset){offset=0;list.replaceChildren();}more.hidden=true;
 if(!client){status.textContent='Selecione um cliente para consultar seus relatórios.';return;}
 history.replaceState(null,'','./reports.html?client='+encodeURIComponent(client));status.textContent='Carregando relatórios…';
 try{const {data,error}=await authClient.from('assessments').select('id,title,revision,completed_at,team_members!assessments_responsible_id_fkey(display_name)').eq('client_id',client).eq('status','completed').order('completed_at',{ascending:false}).order('id').range(offset,offset+20);
 if(ticket!==sequence)return;if(error)throw error;
 for(const row of data.slice(0,20)){
 const card=document.createElement('article');card.className='report-record';
 const title=document.createElement('h2');title.textContent=row.title;
 const info=document.createElement('p');info.textContent=new Date(row.completed_at).toLocaleString('pt-BR')+' · '+(row.team_members?.display_name||'Equipe');
 const actions=document.createElement('div');actions.className='report-actions';
 for(const [label,suffix] of [['Visualizar',''],['Imprimir / salvar PDF','&print=1']]){const a=document.createElement('a');a.textContent=label;a.href='./report.html?id='+encodeURIComponent(row.id)+suffix;actions.append(a);}
 if(isAdmin){const remove=document.createElement('button');remove.className='delete-report';remove.setAttribute('aria-label','Excluir relatório');remove.title='Excluir relatório';const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7');icon.append(path);remove.append(icon);remove.onclick=()=>askDelete(row,remove);actions.append(remove);}
 card.append(title,info,actions);list.append(card);
 }offset+=Math.min(20,data.length);more.hidden=data.length<=20;status.textContent=offset?'':'Este cliente ainda não tem relatórios gerados.';
 }catch{if(ticket===sequence)status.textContent='Não foi possível carregar os relatórios. Clique em Atualizar para tentar novamente.';}
}
async function initialize(){try{
 const access=await getTeamMember();if(!access.member){if(access.reason==='network')throw Error();location.replace('./index.html?reason=expired');return;}updateHeader(access.member);isAdmin=access.member.role==='admin';
 for(let start=0;;start+=200){const {data,error}=await authClient.from('clients').select('id,legal_name,trade_name,cnpj').order('legal_name').order('id').range(start,start+199);if(error)throw error;for(const c of data){const o=document.createElement('option');o.value=c.id;o.textContent=clientOptionLabel(c);select.append(o);}if(data.length<200)break;}
 select.disabled=false;const requested=new URLSearchParams(location.search).get('client');if(requested)select.value=requested;await load();
 }catch{status.textContent='Não foi possível carregar os clientes. Recarregue a página para tentar novamente.';}}
select.onchange=()=>load();more.onclick=()=>load(false);document.querySelector('#list-refresh').onclick=()=>select.disabled?location.reload():load();
document.querySelector('#sign-out').onclick=async()=>{await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
authClient.auth.onAuthStateChange(e=>{if(e==='SIGNED_OUT'){list.replaceChildren();location.replace('./index.html');}});
async function askDelete(row,button){
 if(!confirm('Excluir permanentemente o relatório “'+row.title+'”? Esta ação não pode ser desfeita.'))return;
 button.disabled=true;
 try{
 const access=await getTeamMember();if(access.member?.role!=='admin')throw Error('Somente administradores podem excluir relatórios.');
 const {data,error}=await authClient.from('assessments').delete().eq('id',row.id).eq('revision',row.revision).eq('status','completed').select('id').maybeSingle();
 if(error||!data)throw Error('Não foi possível confirmar a exclusão. Atualize a lista e confira o relatório.');
 await load();
 }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
}
await initialize();
