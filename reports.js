import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20260928-occ1';
import {clientOptionLabel} from './assessment-data.js';
import {addReuseButton} from './reuse-report.js?v=20260928-admin1';
const select={value:''},list=document.querySelector('#report-list'),status=document.querySelector('#list-status'),more=document.querySelector('#list-more');
const search=document.querySelector('#report-search'),results=document.querySelector('#client-results'),clients=[];
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function choose(client){select.value=client.id;search.value=clientOptionLabel(client);results.replaceChildren();load();}
function findClients(){
 sequence++;select.value='';list.replaceChildren();results.replaceChildren();more.hidden=true;history.replaceState(null,'','./reports.html');
 const query=normalize(search.value.trim()),digits=query.replace(/\D/g,'');
 const found=clients.filter(c=>!query||normalize(clientOptionLabel(c)+' '+c.legal_name).includes(query)||(/^[-.\/\d\s]+$/.test(query)&&digits&&String(c.cnpj||'').replace(/\D/g,'').includes(digits)));
 if(found.length===1){choose(found[0]);return;}
 status.textContent=found.length?'Escolha uma das empresas encontradas para ver os relatórios.':'Nenhuma empresa encontrada.';
 for(const c of found){
  const button=document.createElement('button');button.type='button';button.className='report-client-card';
  const icon=document.createElement('span');icon.className='report-client-icon';icon.textContent=(c.trade_name||c.legal_name||'E').trim().slice(0,2).toUpperCase();icon.setAttribute('aria-hidden','true');
  const info=document.createElement('span');info.className='report-client-info';
  const name=document.createElement('strong');name.textContent=c.trade_name?.trim()||c.legal_name;
  const cnpj=document.createElement('span');const digits=String(c.cnpj||'').replace(/\D/g,'');cnpj.textContent='CNPJ '+(digits.length===14?digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):c.cnpj||'não informado');
  info.append(name,cnpj);const action=document.createElement('span');action.className='report-client-action';action.textContent='Ver relatórios →';
  button.append(icon,info,action);button.onclick=()=>choose(c);results.append(button);
 }

}
let sequence=0,offset=0,isAdmin=false;
async function load(reset=true){
 const ticket=++sequence,client=select.value;if(reset){offset=0;list.replaceChildren();}more.hidden=true;
 if(!client){status.textContent='Digite o nome ou CNPJ e clique em Pesquisar.';return;}
 history.replaceState(null,'','./reports.html?client='+encodeURIComponent(client));status.textContent='Carregando relatórios…';
 try{const {data,error}=await authClient.from('assessments').select('id,title,revision,completed_at,team_members!assessments_responsible_id_fkey(display_name)').eq('client_id',client).eq('status','completed').order('completed_at',{ascending:false}).order('id').range(offset,offset+20);
 if(ticket!==sequence)return;if(error)throw error;
 for(const row of data.slice(0,20)){
 const card=document.createElement('article');card.className='report-record';
 const title=document.createElement('h2');title.textContent=row.title;
 const info=document.createElement('p');info.textContent=new Date(row.completed_at).toLocaleString('pt-BR')+' · '+(row.team_members?.display_name||'Equipe');
 const actions=document.createElement('div');actions.className='report-actions';
 addReuseButton(actions,row.id,authClient,getTeamMember,text=>{status.textContent=text;});
 for(const [label,suffix] of [['Visualizar',''],['Imprimir / salvar PDF','&print=1']]){const a=document.createElement('a');a.textContent=label;a.href='./report.html?id='+encodeURIComponent(row.id)+suffix;actions.append(a);}
 if(isAdmin){const remove=document.createElement('button');remove.className='delete-report';remove.setAttribute('aria-label','Excluir relatório');remove.title='Excluir relatório';const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7');icon.append(path);remove.append(icon);remove.onclick=()=>askDelete(row,remove);actions.append(remove);}
 card.append(title,info,actions);list.append(card);
 }offset+=Math.min(20,data.length);more.hidden=data.length<=20;status.textContent=offset?'':'Este cliente ainda não tem relatórios gerados.';
 }catch{if(ticket===sequence)status.textContent='Não foi possível carregar os relatórios. Clique em Pesquisar para tentar novamente.';}
}
async function initialize(){try{
 const access=await getTeamMember();if(!access.member){if(access.reason==='network')throw Error();location.replace('./index.html?reason=expired');return;}updateHeader(access.member);isAdmin=access.member.role==='admin';
 for(let start=0;;start+=200){const {data,error}=await authClient.from('clients').select('id,legal_name,trade_name,cnpj').order('legal_name').order('id').range(start,start+199);if(error)throw error;clients.push(...data);if(data.length<200)break;}
 search.disabled=false;document.querySelector('#list-refresh').disabled=false;const requested=new URLSearchParams(location.search).get('client'),client=clients.find(c=>c.id===requested);if(client){choose(client);}else await load();
 }catch{status.textContent='Não foi possível carregar os clientes. Recarregue a página para tentar novamente.';}}
more.onclick=()=>load(false);document.querySelector('#report-search-form').onsubmit=e=>{e.preventDefault();findClients();};
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
