import {authClient,getTeamMember} from './auth-client.js';
import {updateHeader} from './app-header.js?v=20260925-header2';
const page=document.querySelector('#clients-page'),check=document.querySelector('#session-check'),list=document.querySelector('#records-list'),status=document.querySelector('#records-status'),more=document.querySelector('#more-records'),retry=document.querySelector('#retry-records'),search=document.querySelector('#client-search');
let filters={name:'',cnpj:''},offset=0,generation=0,checking=false;const pageSize=20,currentView='clients';
function appendRecord(row, view) {
  const article = document.createElement('article'); article.className = 'record';
  const title = document.createElement('h3'); title.textContent = view === 'clients' ? row.legal_name : row.title;
  const detail = document.createElement('p');
  if (view === 'clients') {
    detail.textContent = [row.trade_name, row.cnpj ? `CNPJ: ${row.cnpj}` : null, row.contact_phone].filter(Boolean).join(' · ') || 'Sem informações complementares.';
  } else {
    detail.textContent = [row.clients?.legal_name, row.completed_at ? `Concluído em ${new Date(row.completed_at).toLocaleDateString('pt-BR')}` : null].filter(Boolean).join(' · ');
  }
  article.append(title, detail); list.append(article);
  if(view==='reports'){
    for(const [label,suffix] of [['Visualizar',''],['Imprimir / salvar PDF','&print=1']]){
      const link=document.createElement('a');link.className='record-link';link.textContent=label;link.href='./report.html?id='+encodeURIComponent(row.id)+suffix;article.append(link);
    }
  }
  if (view === 'clients') {
    const link = document.createElement('a'); link.href = `./client.html?id=${encodeURIComponent(row.id)}`;
    link.textContent = 'Consultar / editar'; link.className = 'record-link'; article.append(link);
  }
}
async function loadRecords(reset = false) {
  const ticket = ++generation;
  const view = currentView;
  if (reset) { offset = 0; list.replaceChildren(); }
  status.textContent = 'Carregando…'; more.hidden = true; retry.hidden = true;
  let query = view === 'clients'
    ? authClient.from('clients').select('id,legal_name,trade_name,cnpj,contact_phone').eq('archived', false).order('legal_name').order('id')
    : authClient.from('assessments').select('id,title,completed_at,clients(legal_name)').eq('status', 'completed').order('completed_at', { ascending: false }).order('id');
  try {
    if (view === 'clients') {
      if (filters.name) {
        const pattern = `%${filters.name.replace(/[\\%_]/g, '\\$&')}%`;
        const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        query = query.or(`legal_name.ilike.${quoted},trade_name.ilike.${quoted}`);
      }
      if (filters.cnpj) query = query.ilike('cnpj', `%${filters.cnpj}%`);
    }
    const { data, error } = await query.range(offset, offset + pageSize);
    if (ticket !== generation || page.hidden) return;
    if (error) throw error;
    const rows = data.slice(0, pageSize);
    rows.forEach(row => appendRecord(row, view)); offset += rows.length;
    more.hidden = data.length <= pageSize;
    status.textContent = offset ? '' : view === 'clients' ? (filters.name || filters.cnpj ? 'Nenhum cliente encontrado para esta busca. Tente outro nome ou CNPJ.' : 'Ainda não há clientes cadastrados.') : 'Ainda não há levantamentos concluídos salvos no sistema.';
  } catch {
    if (ticket !== generation || page.hidden) return;
    status.textContent = 'Não foi possível carregar os registros. Confira a conexão e tente novamente.'; retry.hidden = false;
  }
}

search.addEventListener('submit', event => {
  event.preventDefault();
  filters = {
    name: document.querySelector('#search-name').value.trim(),
    cnpj: document.querySelector('#search-cnpj').value.replace(/[^a-z0-9]/gi, '').toUpperCase()
  };
  loadRecords(true);
});
document.querySelector('#clear-search').addEventListener('click', () => {
  search.reset(); filters = { name: '', cnpj: '' }; loadRecords(true);
  document.querySelector('#search-name').focus();
});

async function initialize(){if(checking)return;checking=true;page.hidden=true;generation++;check.hidden=false;try{const access=await getTeamMember();if(!access.member){if(access.reason==='network')throw Error();location.replace('./index.html?reason=expired');return;}updateHeader(access.member);check.hidden=true;page.hidden=false;await loadRecords(true);}catch{check.querySelector('p').textContent='Não foi possível carregar seus clientes. Tente novamente.';document.querySelector('#retry-session').hidden=false;}finally{checking=false;}}
more.onclick=()=>loadRecords();retry.onclick=()=>loadRecords();document.querySelector('#retry-session').onclick=initialize;
document.querySelector('#sign-out').onclick=async()=>{page.hidden=true;generation++;await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
authClient.auth.onAuthStateChange(e=>{if(e==='SIGNED_OUT'){page.hidden=true;generation++;location.replace('./index.html?reason=expired');}});
window.addEventListener('pageshow',e=>{if(e.persisted)initialize();});
await initialize();