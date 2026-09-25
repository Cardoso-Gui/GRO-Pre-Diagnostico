import {updateHeader} from './app-header.js?v=20260925-header2';
import { authClient, getTeamMember } from './auth-client.js';
import { lookupCompany } from './cnpj.js';
const $ = selector => document.querySelector(selector);
const form = $('#client-form');
const fields = $('#fields');
const input = name => form.elements.namedItem(name);
input('cnpj').addEventListener('input', () => {
  input('cnpj').value = input('cnpj').value.replace(/\D/g, '').slice(0, 14);
});
input('cnpj').addEventListener('paste', event => {
  event.preventDefault();
  const field = input('cnpj');
  const digits = event.clipboardData.getData('text').replace(/\D/g, '');
  field.value = (field.value.slice(0, field.selectionStart) + digits + field.value.slice(field.selectionEnd)).slice(0, 14);
  field.setCustomValidity(''); dirty = true; message('');
});
const basic = ['legal_name','trade_name','cnpj','cnae','contact_name','contact_phone','contact_email'];
const addressFields = ['postal_code','state','street','number','complement','district','city'];
const requestedId = new URLSearchParams(location.search).get('id');
const id = requestedId || crypto.randomUUID();
let saved = null, dirty = false, busy = false, checking = false, initialized = false, uncertain = false;
let consulting = false;
$('#lookup-cnpj').addEventListener('click', async () => {
  if (consulting || busy || fields.disabled) return;
  consulting = true;
  const cnpj = input('cnpj').value;
  const before = Object.fromEntries([...basic, ...addressFields].map(key => [key, input(key).value]));
  $('#lookup-cnpj').disabled = true; $('#save').disabled = true; $('#cancel').disabled = true;
  $('#cnpj-status').textContent = 'Consultando CNPJ…';
  try {
    const values = await lookupCompany(cnpj, async () => {
      const {data, error} = await authClient.functions.invoke('gro-cnpj', {body:{cnpj}});
      return {ok:!error, status:error?.context?.status || 502, json:async()=>data};
    });
    if (input('cnpj').value !== cnpj) { $('#cnpj-status').textContent = 'O CNPJ mudou. Consulte novamente para preencher os dados corretos.'; return; }
    let filled = 0;
    for (const [key, value] of Object.entries(values)) {
      const field = input(key);
      if (value && !before[key].trim() && field.value === before[key]) {
        field.value = field.maxLength > 0 ? value.slice(0, field.maxLength) : value;
        field.setCustomValidity(''); filled++;
      }
    }
    if (filled) dirty = true;
    $('#cnpj-status').textContent = filled ? 'Dados disponíveis preenchidos. Confira antes de salvar. Campos já preenchidos foram mantidos.' : 'Consulta concluída. Os campos já preenchidos foram mantidos.';
  } catch (error) { $('#cnpj-status').textContent = error.message; }
  finally { consulting = false; $('#lookup-cnpj').disabled = false; $('#save').disabled = false; $('#cancel').disabled = false; }
});
for (const state of 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')) {
  const option = document.createElement('option'); option.value = option.textContent = state; input('state').append(option);
}
function message(text, error = false) { $('#feedback').textContent = text; $('#feedback').classList.toggle('error', error); }
function mode(editing) {
  fields.disabled = !editing; $('#save').hidden = !editing; $('#edit').hidden = editing;
  $('#cancel').hidden = !editing || !saved;
  $('#page-title').textContent = saved ? (editing ? 'Editar cliente' : saved.legal_name) : 'Novo cliente';
  $('#page-description').textContent = saved ? 'Dados da empresa disponíveis para sua equipe.' : 'Cadastre a empresa para organizar os próximos levantamentos.';
}
function populate(row) {
  saved = row;
  for (const key of basic) input(key).value = row[key] || '';
  for (const key of addressFields) input(key).value = row.address?.[key] || '';
  dirty = false; mode(false);
}
async function verify() {
  const result = await getTeamMember();
  if (result.error && result.reason === 'network') throw new Error('Não foi possível verificar seu acesso. Confira a conexão e tente novamente.');
  if (!result.member) { dirty = false; location.replace('./index.html?reason=expired'); throw new Error('Sua sessão terminou. Entre novamente.'); }
  updateHeader(result.member);
}
async function readClient() {
  const { data, error } = await authClient.from('clients').select('*').eq('id', id).eq('archived', false).maybeSingle();
  if (error) throw new Error('Não foi possível carregar o cliente. Confira a conexão e tente novamente.');
  return data;
}
async function initialize() {
  if (checking) return; checking = true;
  $('#content').hidden = true; $('#loading').hidden = false; $('#retry').hidden = true;
  try {
    await verify();
    if (!initialized) {
      if (requestedId) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Este endereço de cliente é inválido. Volte à lista de clientes.');
        const row = await readClient();
        if (!row) throw new Error('Cliente não encontrado ou indisponível para sua equipe.');
        populate(row);
      } else mode(true);
      initialized = true;
    }
    $('#loading').hidden = true; $('#content').hidden = false;
  } catch (error) { $('#loading p').textContent = error.message; $('#retry').hidden = false; }
  finally { checking = false; }
}
function validate() {
  for (const name of [...basic,...addressFields]) input(name).setCustomValidity('');
  for (const name of [...basic,...addressFields].filter(name => !['trade_name','complement'].includes(name))) {
    if (!input(name).value.trim()) input(name).setCustomValidity('Preencha este campo obrigatório.');
  }
  input('legal_name').setCustomValidity(input('legal_name').value.trim() ? '' : 'Informe a razão social.');
  const cnpj = input('cnpj').value.replace(/[.\/\s-]/g, '').toUpperCase();
  if (cnpj && !/^\d{14}$/.test(cnpj)) input('cnpj').setCustomValidity('Informe o CNPJ completo: 14 números.');
  const cnae = input('cnae').value.replace(/[.\/\s-]/g, '');
  if (cnae && !/^\d{7}$/.test(cnae)) input('cnae').setCustomValidity('Informe os 7 números do CNAE.');
  const cep = input('postal_code').value.replace(/[\s-]/g, '');
  if (cep && !/^\d{8}$/.test(cep)) input('postal_code').setCustomValidity('Informe os 8 números do CEP.');
  if (!form.reportValidity()) return null;
  const data = Object.fromEntries(basic.map(key => [key, input(key).value.trim() || null]));
  data.cnpj = cnpj || null; data.cnae = cnae || null;
  data.address = { ...saved?.address, ...Object.fromEntries(addressFields.map(key => [key,input(key).value.trim()])) };
  data.address.postal_code = cep;
  return data;
}
form.addEventListener('input', event => { dirty = true; if (event.target.setCustomValidity) event.target.setCustomValidity(''); message(''); });
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || consulting || fields.disabled) return;
  const payload = validate(); if (!payload) return;
  busy = true; fields.disabled = true; $('#save').disabled = true; $('#cancel').disabled = true; message('Salvando…');
  try {
    await verify();
    if (uncertain) {
      const row = await readClient();
      if (row && (!saved || row.updated_at !== saved.updated_at)) {
        populate(row); uncertain = false;
        message('O cadastro foi localizado no banco. Confira os dados salvos antes de fazer novas alterações.'); return;
      }
      uncertain = false;
    }
    const query = saved
      ? authClient.from('clients').update(payload).eq('id', id).eq('updated_at', saved.updated_at).eq('archived', false)
      : authClient.from('clients').insert({id, ...payload});
    const {data, error} = await query.select('*').maybeSingle();
    if (error) {
      if (error.code === '23505') throw new Error('Já existe um cliente com este CNPJ. Consulte a lista de clientes antes de cadastrar novamente.');
      if (error.code === '42501') throw new Error('Seu acesso não permite salvar este cliente. Entre em contato com o administrador.');
      uncertain = true; throw new Error('Não foi possível confirmar o salvamento. Seus campos foram mantidos. Confira a conexão e tente salvar novamente.');
    }
    if (!data) throw new Error('Este cadastro foi alterado por outra pessoa ou ficou indisponível. Copie suas alterações e recarregue a página antes de editar novamente.');
    populate(data); history.replaceState(null, '', `./client.html?id=${encodeURIComponent(id)}`); message('Cliente salvo com sucesso.');
  } catch (error) { message(error.message, true); }
  finally { busy = false; $('#save').disabled = false; $('#cancel').disabled = false; fields.disabled = $('#save').hidden; }
});
$('#edit').addEventListener('click', () => { mode(true); message(''); input('legal_name').focus(); });
$('#cancel').addEventListener('click', () => { if (!dirty || confirm('Descartar as alterações deste cadastro?')) { populate(saved); message(''); } });
$('#retry').addEventListener('click', initialize);
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
authClient.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { dirty = false; $('#content').hidden = true; location.replace('./index.html?reason=expired'); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) $('#content').hidden = true; else initialize(); });
window.addEventListener('pageshow', event => { if (event.persisted) initialize(); });
await initialize();



document.querySelector('#sign-out').addEventListener('click',async()=>{if(busy)return;if(dirty&&!confirm('Sair sem salvar as alterações do cadastro?'))return;dirty=false;await authClient.auth.signOut({scope:'local'});location.assign('./index.html?reason=signedout');});