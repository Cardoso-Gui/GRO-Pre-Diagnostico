import { authClient, getTeamMember, signInWithUsername, loginStorage } from './auth-client.js?v=20260928-remember1';
import { normalizeUsername, friendlyAuthError } from './auth-utils.js';

const form = document.querySelector('#login-form');
const submit = document.querySelector('#submit-login');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const message = document.querySelector('#login-message');
const reveal = document.querySelector('#reveal-password');
const keepConnected=document.querySelector('#keep-connected');
const rememberUsername=document.querySelector('#remember-username');
const preferences=loginStorage.preferences();
keepConnected.checked=preferences.keepConnected;
rememberUsername.checked=!!preferences.username;
if(preferences.username)username.value=preferences.username;
rememberUsername.addEventListener('change',()=>{if(!rememberUsername.checked)loginStorage.rememberUsername('');});
let busy = false;

function showMessage(text, kind = 'error') {
  message.textContent = text; message.dataset.kind = kind; message.hidden = !text;
}
function setBusy(value) {
  busy = value; submit.disabled = value; submit.setAttribute('aria-busy', String(value));
  submit.querySelector('span').textContent = value ? 'Verificando acesso…' : 'Entrar na minha conta';
  username.readOnly = value; password.readOnly = value;
  keepConnected.disabled=value;rememberUsername.disabled=value;
}
async function enterWorkspace() {
  const { member, error, reason } = await getTeamMember();
  if (error && reason === 'network') { showMessage(friendlyAuthError(error, navigator.onLine)); return; }
  if (!member) {
    await authClient.auth.signOut({ scope: 'local' });
    showMessage(reason === 'session' ? 'Sua sessão expirou. Entre novamente.' : 'Seu acesso à equipe ainda não está liberado. Fale com o administrador.');
    return;
  }
  password.value = '';
  location.replace(new URL('./inicio.html', location.href).href);
}

reveal.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  reveal.setAttribute('aria-pressed', String(visible));
  reveal.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
});
password.addEventListener('keyup', event => { document.querySelector('#caps-hint').hidden = !event.getModifierState('CapsLock'); });
password.addEventListener('blur', () => { document.querySelector('#caps-hint').hidden = true; });

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !form.reportValidity()) return;
  const loginName = normalizeUsername(username.value);
  if (!loginName) { showMessage('Use de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.'); username.focus(); return; }
  setBusy(true); showMessage('');
  try {
    const { error } = await signInWithUsername(loginName, password.value, keepConnected.checked);
    if (error) { showMessage(friendlyAuthError(error, navigator.onLine)); return; }
    loginStorage.rememberUsername(rememberUsername.checked?loginName:'');
    await enterWorkspace();
  } catch (error) { showMessage(friendlyAuthError(error, navigator.onLine)); }
  finally { setBusy(false); }
});

const reason = new URLSearchParams(location.search).get('reason');
if (reason === 'expired') showMessage('Sua sessão expirou. Entre novamente.', 'info');
if (reason === 'denied') showMessage('Seu acesso à equipe não está liberado. Fale com o administrador.');
if (reason === 'signedout') showMessage('Você saiu da sua conta.', 'success');
setBusy(true);
try {
  const { data: { session }, error } = await authClient.auth.getSession();
  if (error) showMessage(friendlyAuthError(error, navigator.onLine));
  else if (session) await enterWorkspace();
} catch (error) { showMessage(friendlyAuthError(error, navigator.onLine)); }
finally { setBusy(false); }
