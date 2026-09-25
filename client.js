import { authClient, getTeamMember } from './auth-client.js';
const $ = selector => document.querySelector(selector);
const form = $('#client-form');
const fields = $('#fields');
const input = name => form.elements.namedItem(name);
const basic = ['legal_name','trade_name','cnpj','cnae','contact_name','contact_phone','contact_email'];
const addressFields = ['postal_code','state','street','number','complement','district','city'];
const requestedId = new URLSearchParams(location.search).get('id');
const id = requestedId || crypto.randomUUID();
let saved = null, dirty = false, busy = false, checking = false, initialized = false, uncertain = false;
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
  input('legal_name').setCustomValidity(input('legal_name').value.trim() ? '' : 'Informe a razão social.');
  const cnpj = input('cnpj').value.replace(/[.\/\s-]/g, '').toUpperCase();
  if (cnpj && !/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)) input('cnpj').setCustomValidity('Informe o CNPJ completo: 12 letras ou números e 2 dígitos finais.');
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
  event.preventDefault(); if (busy || fields.disabled) return;
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

