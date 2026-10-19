import {authClient, getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20261019-access1';
import {uploadPhoto, photoUrl} from './workstation-photos.js';
import {pageSize, companyColumns, fetchCompanies, filterCompanies, historyQuery, totalQuery, formatCnpj, countLabel, companyCount} from './occurrences-data.js?v=20261019-occ2';

const $ = selector => document.querySelector(selector);
const page = $('#team-page'), form = $('#occ-form'), dialog = $('#occ-dialog'), filtersForm = $('#history-filters');
const field = name => form.elements.namedItem(name);
const node = (tag, className = '', text) => {
 const element = document.createElement(tag);
 element.className = className;
 if (text !== undefined) element.textContent = text;
 return element;
};
let member, selected = null, busy = false, dirty = false, checking = false;
let companyOffset = 0, companyTicket = 0, companySearch = '', companies = null;
let offset = 0, historyTicket = 0, totalTicket = 0;
let filters = {kind: '', from: '', to: ''};
let recordId = crypto.randomUUID(), uploaded = null, previewUrl = null;
const companyIcon = '<svg viewBox="0 0 32 32"><path d="M6 27V8l14-3v22M20 13h6v14M3 27h26M11 12h3m-3 5h3m-3 5h3m9-4h1m-1 4h1"/></svg>';

function clearPhotos() {
 for (const img of $('#occ-list').querySelectorAll('img')) URL.revokeObjectURL(img.src);
}
function clearPreview() {
 if (previewUrl) URL.revokeObjectURL(previewUrl);
 previewUrl = null;
 $('#preview-image').removeAttribute('src');
 $('#photo-preview').hidden = true;
}
function resetForm() {
 clearPreview();
 form.reset();
 field('photo').setCustomValidity('');
 dirty = false;
 recordId = crypto.randomUUID();
 uploaded = null;
 $('#save-status').textContent = '';
 $('#photo-status').textContent = '';
 if (dialog.open) dialog.close();
}
function requestClose() {
 if (busy) return;
 if (!dirty || confirm('Descartar a ocorrência não salva?')) resetForm();
}
function syncUrl(clientId) {
 const url = new URL(location.href);
 if (clientId) url.searchParams.set('client', clientId);
 else url.searchParams.delete('client');
 window.history.replaceState(null, '', url);
}
function appendCompany(row) {
 const article = node('article', 'occ-company-row');
 const info = node('div', 'occ-company-info'), icon = node('span', 'occ-company-icon');
 icon.setAttribute('aria-hidden', 'true');
 icon.innerHTML = companyIcon;
 const copy = node('div');
 copy.append(node('h3', '', row.legal_name), node('p', '', row.cnpj ? 'CNPJ: ' + formatCnpj(row.cnpj) : 'CNPJ não informado'));
 if (row.trade_name && row.trade_name !== row.legal_name) copy.append(node('p', 'occ-trade-name', row.trade_name));
 info.append(icon, copy);
 const count = companyCount(row), badge = node('span', 'occ-count', count === null ? 'Total indisponível' : countLabel(count));
 const button = node('button', 'secondary-button', 'Selecionar →');
 button.type = 'button';
 button.setAttribute('aria-label', 'Selecionar ' + row.legal_name);
 button.onclick = () => selectCompany(row);
 article.append(info, badge, button);
 $('#company-list').append(article);
}
async function loadCompanies(reset = false) {
 const generation = ++companyTicket;
 if (reset) { companyOffset = 0; $('#company-list').replaceChildren(); $('#company-summary').textContent = ''; }
 $('#company-status').textContent = 'Carregando empresas…';
 $('#more-companies').hidden = true;
 $('#retry-companies').hidden = true;
 $('#company-list').setAttribute('aria-busy', 'true');
 try {
  const loaded = companies || await fetchCompanies(authClient);
  if (generation !== companyTicket || page.hidden || selected) return;
  companies = loaded;
  const matches = filterCompanies(companies, companySearch), rows = matches.slice(companyOffset, companyOffset + pageSize);
  rows.forEach(appendCompany);
  companyOffset += rows.length;
  const total = matches.length;
  $('#more-companies').hidden = companyOffset >= total;
  $('#company-summary').textContent = total ? `Mostrando ${companyOffset} de ${total} empresa${total === 1 ? '' : 's'}` : '';
  $('#company-status').textContent = companyOffset ? '' : companySearch ? 'Nenhuma empresa encontrada. Tente outro nome ou CNPJ.' : 'Ainda não há empresas cadastradas.';
 } catch {
  if (generation !== companyTicket || page.hidden || selected) return;
  $('#company-status').textContent = 'Não foi possível carregar as empresas e seus totais. Confira a conexão e tente novamente.';
  $('#retry-companies').hidden = false;
 } finally {
  if (generation === companyTicket) $('#company-list').setAttribute('aria-busy', 'false');
 }
}
async function refreshTotal() {
 const generation = ++totalTicket, clientId = selected?.id;
 if (!clientId) return;
 $('#retry-total').hidden = true;
 try {
  const {count, error} = await totalQuery(authClient, clientId);
  if (generation !== totalTicket || selected?.id !== clientId || page.hidden) return;
  if (error || !Number.isInteger(count)) throw error || Error('Total unavailable');
  $('#company-total').textContent = countLabel(count) + ' no total';
 } catch {
  if (generation !== totalTicket || selected?.id !== clientId || page.hidden) return;
  $('#company-total').textContent = 'Total indisponível';
  $('#retry-total').hidden = false;
 }
}
function selectCompany(row, focus = true) {
 if (busy || (dirty && !confirm('Descartar a ocorrência não salva?'))) return;
 resetForm();
 selected = row;
 companyTicket++;
 filters = {kind: '', from: '', to: ''};
 filtersForm.reset();
 $('#filter-error').textContent = '';
 $('#status').textContent = '';
 $('#selected-company-name').textContent = row.legal_name;
 $('#selected-company-cnpj').textContent = row.cnpj ? 'CNPJ: ' + formatCnpj(row.cnpj) : 'CNPJ não informado';
 $('#page-intro').textContent = 'Registre e consulte os acontecimentos da empresa.';
 const count = companyCount(row);
 $('#company-total').textContent = count === null ? 'Carregando total…' : countLabel(count) + ' no total';
 $('#company-selector').hidden = true;
 $('#client-content').hidden = false;
 $('#new-occurrence').hidden = false;
 syncUrl(row.id);
 if (focus) $('#selected-company-name').focus();
 refreshTotal();
 loadHistory(true);
}
function formatDate(value) {
 const [year, month, day] = value.split('-').map(Number);
 return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'});
}
function appendOccurrence(row, clientId) {
 const details = node('details', 'occ-record'), summary = node('summary');
 const date = node('time', 'occ-date', formatDate(row.occurred_on));
 date.dateTime = row.occurred_on;
 const kindClass = {Acidente: 'accident', Incidente: 'incident', Observação: 'observation'}[row.kind] || 'observation';
 const kind = node('span', 'occ-kind occ-kind-' + kindClass, row.kind);
 const copy = node('div', 'occ-record-copy');
 const author = row.team_members?.display_name || 'Integrante da equipe';
 copy.append(node('h3', '', row.description), node('p', 'occ-meta', 'Registrado por ' + author));
 const photoLabel = node('span', 'occ-photo-label');
 if (row.photo_path) {
  photoLabel.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 5-5 4 4 4-5 5 6"/><circle cx="8" cy="7" r="1"/></svg>';
  photoLabel.append(document.createTextNode('1 foto'));
 }
 summary.append(date, kind, copy, photoLabel);
 const body = node('div', 'occ-record-body');
 body.append(node('p', 'occ-description', row.description), node('p', 'occ-meta', 'Registrado por ' + author + ' em ' + new Date(row.created_at).toLocaleString('pt-BR')));
 if (row.photo_path) {
  const button = node('button', 'secondary-button', 'Visualizar foto');
  button.type = 'button';
  button.onclick = async () => {
   button.disabled = true;
   button.textContent = 'Carregando foto…';
   try {
    const url = await photoUrl(authClient, row.photo_path, clientId);
    if (!details.isConnected || selected?.id !== clientId || page.hidden) { URL.revokeObjectURL(url); return; }
    const img = node('img', 'occ-photo');
    img.alt = 'Foto da ocorrência de ' + row.occurred_on.split('-').reverse().join('/');
    img.src = url;
    body.append(img);
    button.remove();
   } catch {
    button.textContent = 'Foto indisponível. Tentar novamente';
    button.disabled = false;
   }
  };
  body.append(button);
 }
 details.append(summary, body);
 $('#occ-list').append(details);
}
async function loadHistory(reset = false) {
 const generation = ++historyTicket, clientId = selected?.id;
 if (reset) { offset = 0; clearPhotos(); $('#occ-list').replaceChildren(); $('#history-summary').textContent = ''; }
 $('#more').hidden = true;
 $('#retry-list').hidden = true;
 if (!clientId) return;
 $('#history-status').textContent = 'Carregando ocorrências…';
 $('#occ-list').setAttribute('aria-busy', 'true');
 try {
  const {data, error, count} = await historyQuery(authClient, clientId, filters, offset);
  if (generation !== historyTicket || selected?.id !== clientId || page.hidden) return;
  if (error) throw error;
  data.slice(0, pageSize).forEach(row => appendOccurrence(row, clientId));
  offset += Math.min(data.length, pageSize);
  $('#more').hidden = data.length <= pageSize;
  const total = count ?? offset, filtered = filters.kind || filters.from || filters.to;
  $('#history-summary').textContent = `${countLabel(total)} ${filtered ? 'nos filtros aplicados' : 'registrada' + (total === 1 ? '' : 's')}${offset ? ` · Mostrando ${offset} de ${total}` : ''}`;
  $('#history-status').textContent = offset ? '' : filtered ? 'Nenhuma ocorrência encontrada com esses filtros. Altere o período ou o tipo, ou clique em Limpar.' : 'Esta empresa ainda não tem ocorrências. Use “Nova ocorrência” para registrar a primeira.';
 } catch {
  if (generation !== historyTicket || selected?.id !== clientId || page.hidden) return;
  $('#history-status').textContent = 'Não foi possível carregar as ocorrências. Confira a conexão e tente novamente.';
  $('#retry-list').hidden = false;
 } finally {
  if (generation === historyTicket) $('#occ-list').setAttribute('aria-busy', 'false');
 }
}
$('#company-search').onsubmit = event => {
 event.preventDefault();
 companySearch = $('#search-company').value.trim();
 $('#clear-search').hidden = !companySearch;
 loadCompanies(true);
};
$('#clear-search').onclick = () => {
 $('#search-company').value = companySearch = '';
 $('#clear-search').hidden = true;
 loadCompanies(true);
 $('#search-company').focus();
};
$('#change-company').onclick = () => {
 if (busy || (dirty && !confirm('Descartar a ocorrência não salva?'))) return;
 resetForm();
 selected = null;
 companies = null;
 historyTicket++;
 totalTicket++;
 clearPhotos();
 $('#occ-list').replaceChildren();
 $('#client-content').hidden = true;
 $('#new-occurrence').hidden = true;
 $('#company-selector').hidden = false;
 $('#page-intro').textContent = 'Selecione uma empresa para consultar ou registrar ocorrências.';
 $('#status').textContent = '';
 syncUrl(null);
 loadCompanies(true);
 $('#search-company').focus();
};
filtersForm.onsubmit = event => {
 event.preventDefault();
 const value = name => filtersForm.elements.namedItem(name).value;
 const next = {kind: value('kind'), from: value('from'), to: value('to')};
 if (next.from && next.to && next.from > next.to) {
  $('#filter-error').textContent = 'A data inicial deve ser anterior ou igual à data final.';
  filtersForm.elements.namedItem('to').focus();
  return;
 }
 $('#filter-error').textContent = '';
 filters = next;
 loadHistory(true);
};
$('#clear-filters').onclick = () => {
 filtersForm.reset();
 filters = {kind: '', from: '', to: ''};
 $('#filter-error').textContent = '';
 loadHistory(true);
};
$('#new-occurrence').onclick = () => {
 if (busy || !selected || dialog.open) return;
 $('#form-company').textContent = selected.legal_name + (selected.cnpj ? ' · CNPJ: ' + formatCnpj(selected.cnpj) : '');
 dialog.showModal();
 field('kind').focus();
};
$('#cancel-occurrence').onclick = requestClose;
$('#close-occurrence').onclick = requestClose;
dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
form.oninput = () => { dirty = true; };
field('photo').onchange = () => {
 dirty = true;
 clearPreview();
 uploaded = null;
 field('photo').setCustomValidity('');
 $('#photo-status').textContent = '';
 const file = field('photo').files?.[0];
 if (!file) return;
 const error = !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? 'Escolha uma foto JPG, PNG ou WebP.' : file.size > 20 * 1024 * 1024 ? 'A foto deve ter no máximo 20 MB.' : '';
 if (error) { field('photo').setCustomValidity(error); $('#photo-status').textContent = error; return; }
 previewUrl = URL.createObjectURL(file);
 $('#preview-image').src = previewUrl;
 $('#photo-preview').hidden = false;
};
$('#remove-photo').onclick = () => {
 field('photo').value = '';
 field('photo').setCustomValidity('');
 clearPreview();
 uploaded = null;
 dirty = true;
 $('#photo-status').textContent = '';
};
form.onsubmit = async event => {
 event.preventDefault();
 if (busy || !selected || !form.reportValidity()) return;
 if (!field('description').value.trim()) { field('description').focus(); $('#save-status').textContent = 'Preencha a descrição da ocorrência.'; return; }
 const clientId = selected.id;
 busy = true;
 $('#occ-fields').disabled = true;
 $('#close-occurrence').disabled = true;
 $('#change-company').disabled = true;
 $('#new-occurrence').disabled = true;
 $('#save-status').textContent = 'Salvando ocorrência…';
 try {
  const access = await getTeamMember();
  if (!access.member || page.hidden) throw Error('Não foi possível verificar seu acesso. Entre novamente se sua sessão expirou.');
  member = access.member;
  const file = field('photo').files?.[0];
  if (file && (!uploaded || uploaded.file !== file)) {
   const photo = await uploadPhoto(authClient, file, clientId, member.user_id);
   URL.revokeObjectURL(photo.url);
   uploaded = {file, path: photo.path};
  }
  const payload = {id: recordId, client_id: clientId, kind: field('kind').value, occurred_on: field('occurred_on').value, description: field('description').value.trim(), photo_path: file ? uploaded.path : null};
  const {error} = await authClient.from('occurrences').insert(payload);
  if (error) {
   if (error.code !== '23505') throw Error('Não foi possível confirmar o salvamento. Seus dados foram mantidos. Tente novamente.');
   const check = await authClient.from('occurrences').select('id').eq('id', recordId).eq('client_id', clientId).maybeSingle();
   if (check.error || !check.data) throw Error('Não foi possível confirmar o salvamento. Tente novamente.');
  }
  resetForm();
  $('#status').textContent = 'Ocorrência salva.' + (filters.kind || filters.from || filters.to ? ' Ela pode estar fora dos filtros atuais.' : '');
  await Promise.all([loadHistory(true), refreshTotal()]);
 } catch (error) {
  $('#save-status').textContent = error.message || 'Não foi possível salvar. Tente novamente.';
 } finally {
  busy = false;
  $('#occ-fields').disabled = false;
  $('#close-occurrence').disabled = false;
  $('#change-company').disabled = false;
  $('#new-occurrence').disabled = false;
 }
};
$('#more-companies').onclick = () => loadCompanies();
$('#retry-companies').onclick = () => loadCompanies();
$('#more').onclick = () => loadHistory();
$('#retry-list').onclick = () => loadHistory();
$('#retry-total').onclick = refreshTotal;
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('click', event => {
 if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
 const link = event.target.closest('a[href]');
 if (!link || link.target === '_blank' || (!dirty && !busy)) return;
 if (busy || !confirm('Descartar a ocorrência não salva e sair desta página?')) event.preventDefault();
 else dirty = false;
});
$('#sign-out').onclick = async () => {
 if (busy || (dirty && !confirm('Descartar a ocorrência não salva e sair?'))) return;
 dirty = false;
 invalidate();
 await authClient.auth.signOut({scope: 'local'});
 location.replace('./index.html');
};
function invalidate() {
 page.hidden = true;
 companies = null;
 companyTicket++;
 historyTicket++;
 totalTicket++;
 clearPhotos();
 resetForm();
}
async function init() {
 if (checking) return;
 checking = true;
 invalidate();
 $('#session-check').hidden = false;
 $('#retry-session').hidden = true;
 $('#session-check p').textContent = 'Verificando acesso…';
 try {
  const access = await getTeamMember();
  if (!access.member) {
   if (access.reason === 'network') throw Error();
   location.replace('./index.html?reason=expired');
   return;
  }
  member = access.member;
  updateHeader(member);
  const requested = new URLSearchParams(location.search).get('client');
  let requestedCompany = null;
  if (requested) {
   const {data, error} = await authClient.from('clients').select(companyColumns).eq('archived', false).eq('id', requested).maybeSingle();
   // Invalid UUIDs and unavailable companies must not select a different company.
   if (error && error.code !== '22P02') throw error;
   requestedCompany = data;
  }
  $('#session-check').hidden = true;
  page.hidden = false;
  if (requestedCompany) selectCompany(requestedCompany, false);
  else {
   selected = null;
   $('#company-selector').hidden = false;
   $('#client-content').hidden = true;
   $('#new-occurrence').hidden = true;
   if (requested) { $('#status').textContent = 'A empresa do link não está disponível para seu acesso. Selecione uma empresa abaixo.'; syncUrl(null); }
   await loadCompanies(true);
  }
 } catch {
  $('#session-check p').textContent = 'Não foi possível carregar as ocorrências. Confira a conexão e tente novamente.';
  $('#retry-session').hidden = false;
 } finally { checking = false; }
}
$('#retry-session').onclick = init;
authClient.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { invalidate(); location.replace('./index.html?reason=expired'); } });
window.addEventListener('pageshow', event => { if (event.persisted) init(); });
init();
