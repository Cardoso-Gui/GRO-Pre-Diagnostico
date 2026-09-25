import { authClient, getTeamMember } from './auth-client.js';

const home = document.querySelector('#home');
const check = document.querySelector('#session-check');
const dialog = document.querySelector('#records-dialog');
const list = document.querySelector('#records-list');
const status = document.querySelector('#records-status');
const more = document.querySelector('#more-records');
const retry = document.querySelector('#retry-records');
const pageSize = 20;
let checking = false;
let currentView = 'clients';
let offset = 0;
let generation = 0;

function goToLogin(reason) { location.replace(new URL(`./index.html?reason=${reason}`, location.href).href); }
function hideWorkspace() { home.hidden = true; if (dialog.open) dialog.close(); generation++; }
async function refreshCounts() {
  const results = await Promise.allSettled([
    authClient.from('clients').select('id', { count: 'exact', head: true }).eq('archived', false),
    authClient.from('assessments').select('id', { count: 'exact', head: true }).eq('status', 'completed')
  ]);
  let failed = false;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== 'fulfilled' || result.value.error || result.value.count === null) { failed = true; continue; }
    const count = result.value.count;
    document.querySelector(i === 0 ? '#client-count' : '#report-count').textContent = i === 0
      ? `${count} ${count === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}`
      : `${count} ${count === 1 ? 'relatório concluído' : 'relatórios concluídos'}`;
  }
  document.querySelector('#home-error').hidden = !failed;
}
async function verifyAccess() {
  if (checking) return;
  checking = true; hideWorkspace(); check.hidden = false;
  document.querySelector('#retry-session').hidden = true;
  try {
    const { member, error, reason } = await getTeamMember();
    if (error && reason === 'network') throw error;
    if (!member) { await authClient.auth.signOut({ scope: 'local' }); goToLogin(reason === 'session' ? 'expired' : 'denied'); return; }
    const name = member.display_name.trim();
    document.querySelector('#user-name').textContent = name;
    document.querySelector('#greeting-name').textContent = name.split(/\s+/)[0];
    document.querySelector('#user-avatar').textContent = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    document.querySelector('#user-role').textContent = member.role === 'admin' ? 'Administrador' : 'Equipe';
    document.querySelector('#today').textContent = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    home.hidden = false; check.hidden = true;
    await refreshCounts();
  } catch { check.querySelector('p').textContent = 'Não foi possível verificar seu acesso. Confira a conexão e tente novamente.'; document.querySelector('#retry-session').hidden = false; }
  finally { checking = false; }
}

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
    const { data, error } = await query.range(offset, offset + pageSize);
    if (ticket !== generation || !dialog.open) return;
    if (error) throw error;
    const rows = data.slice(0, pageSize);
    rows.forEach(row => appendRecord(row, view)); offset += rows.length;
    more.hidden = data.length <= pageSize;
    status.textContent = offset ? '' : view === 'clients' ? 'Ainda não há clientes cadastrados.' : 'Ainda não há levantamentos concluídos salvos no sistema.';
  } catch {
    if (ticket !== generation || !dialog.open) return;
    status.textContent = 'Não foi possível carregar os registros. Confira a conexão e tente novamente.'; retry.hidden = false;
  }
}
function openRecords(view) {
  currentView = view;
  document.querySelector('#records-title').textContent = view === 'clients' ? 'Clientes' : 'Relatórios';
  document.querySelector('#records-description').textContent = view === 'clients'
    ? 'Empresas cadastradas e disponíveis para sua equipe.'
    : 'Levantamentos concluídos e registrados no sistema.';
  dialog.showModal(); loadRecords(true);
}
document.querySelector('#open-clients').addEventListener('click', () => openRecords('clients'));
document.querySelector('#open-reports').addEventListener('click', () => openRecords('reports'));
for (const id of ['close-records', 'back-home']) document.getElementById(id).addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { generation++; });
dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close(); });
more.addEventListener('click', () => loadRecords()); retry.addEventListener('click', () => loadRecords());
document.querySelector('#retry-session').addEventListener('click', verifyAccess);
document.querySelector('#sign-out').addEventListener('click', async () => { hideWorkspace(); await authClient.auth.signOut({ scope: 'local' }); goToLogin('signedout'); });
authClient.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { hideWorkspace(); goToLogin('signedout'); } });
window.addEventListener('pageshow', event => { if (event.persisted) verifyAccess(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) hideWorkspace(); else verifyAccess(); });
await verifyAccess();

