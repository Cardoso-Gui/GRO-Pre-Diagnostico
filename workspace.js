import { authClient, getTeamMember } from './auth-client.js';

const workspace = document.querySelector('#protected-workspace');
const notice = document.querySelector('#session-check');
let loading = false;
let loaded = false;
const login = reason => location.replace(new URL(`./index.html?reason=${reason}`, location.href).href);
async function verifyAccess() {
  if (loading) return;
  loading = true;
  workspace.hidden = true;
  notice.hidden = false;
  try {
    const { member, reason, error } = await getTeamMember();
    if (error && reason === 'network') throw error;
    if (!member) {
      await authClient.auth.signOut({ scope: 'local' });
      login(reason === 'session' ? 'expired' : 'denied'); return;
    }
    document.querySelector('#session-name').textContent = member.display_name;
    // Keep local drafts scoped to the signed-in member, never to the shared browser.
    globalThis.GRO_DRAFT_KEY = `gro-draft:${member.user_id}`;
    if (!loaded) {
      for (const file of ['cnae-risk-map.js','esocial-risk-table.js','occupational-risk-table.js','training-rules.js','nr-report-rules.js','script.js']) {
        await new Promise((resolve,reject) => {
          const script = document.createElement('script'); script.src = new URL(file, location.href).href;
          script.onload = resolve; script.onerror = reject; document.body.append(script);
        });
      }
      loaded = true;
    }
    workspace.hidden = false; notice.hidden = true;
  } catch {
    notice.querySelector('p').textContent = 'Não foi possível verificar seu acesso. Confira a conexão e recarregue a página.';
  } finally { loading = false; }
}
document.querySelector('#sign-out').addEventListener('click', async () => {
  workspace.hidden = true;
  await authClient.auth.signOut({ scope: 'local' });
  login('signedout');
});
authClient.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') { workspace.hidden = true; login('signedout'); }
});
window.addEventListener('pageshow', event => { if (event.persisted) verifyAccess(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) workspace.hidden = true;
  else verifyAccess();
});
await verifyAccess();
