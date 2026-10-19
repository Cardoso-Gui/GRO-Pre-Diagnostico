import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeUsername, friendlyAuthError } from '../auth-utils.js';

const source = await fs.readFile(new URL('../login.js', import.meta.url), 'utf8');
const utilities = await fs.readFile(new URL('../auth-utils.js', import.meta.url), 'utf8');
async function fixture({ preferences = {keepConnected: false, username: ''}, signInError = null, member = { display_name: 'Teste' }, memberError = null, reason = 'membership', session = null } = {}) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', hidden: true, type: id === 'password' ? 'password' : 'text', dataset: {}, attrs: {}, handlers: {}, textContent: '', disabled: false,
      addEventListener(name, callback) { this.handlers[name] = callback; },
      setAttribute(k, v) { this.attrs[k] = v; }, querySelector() { return element(id + '-span'); }, focus() {}, reportValidity() { return true; } });
    return elements.get(id);
  }
  const calls = { signins: [], signouts: 0, redirects: [], remembered: [] };
  const client = { auth: {
    async getSession() { return { data: { session } }; },
    async signInWithPassword(input) { calls.signins.push(input); return { error: signInError }; },
    async signOut() { calls.signouts++; return {}; }
  } };
  const context = vm.createContext({ URL, URLSearchParams, navigator: { onLine: true }, document: { querySelector: s => element(s.slice(1)), getElementById: element },
    location: { href: 'https://example.test/GRO-Pre-Diagnostico/index.html', search: '', replace: url => calls.redirects.push(url) } });
  const auth = new vm.SyntheticModule(['authClient', 'getTeamMember', 'signInWithUsername', 'loginStorage'], function () {
    this.setExport('loginStorage',{preferences:()=>preferences,rememberUsername(value){calls.remembered.push(value);}});
    this.setExport('signInWithUsername', async (username, password, keepConnected) => { calls.signins.push({ username, password, keepConnected }); return { error: signInError }; });
    this.setExport('authClient', client); this.setExport('getTeamMember', async () => ({ member, error: memberError, reason }));
  }, { context });
  const utils = new vm.SourceTextModule(utilities, { context });
  const login = new vm.SourceTextModule(source, { context });
  await login.link(name => name.startsWith('./auth-client.js') ? auth : utils);
  await login.evaluate();
  return { element, calls, async submit() { element('username').value = ' Gui.Cardoso '; element('password').value = 'test-only-password'; await element('login-form').handlers.submit({ preventDefault() {} }); } };
}
test('username accepts normalized names and rejects email / injected destinations', () => {
  assert.equal(normalizeUsername(' Gui.Cardoso '), 'gui.cardoso');
  for (const value of ['a', 'gui@external.test', '../admin', 'a b', '<script>', 'a'.repeat(41)]) assert.equal(normalizeUsername(value), null);
});
test('valid member signs in and reaches fixed protected destination', async () => {
  const f = await fixture(); await f.submit();
  assert.equal(f.calls.signins[0].username, 'gui.cardoso');
  assert.equal(f.calls.redirects[0], 'https://example.test/GRO-Pre-Diagnostico/inicio.html');
  assert.equal(f.element('password').value, '');
});
test('invalid credentials give generic error and restore submit button', async () => {
  const f = await fixture({ signInError: { code: 'invalid_credentials' } }); await f.submit();
  assert.equal(f.calls.redirects.length, 0); assert.match(f.element('login-message').textContent, /Usuário ou senha incorretos/);
  assert.equal(f.element('submit-login').disabled, false);
});
test('authenticated non-member is signed out and denied', async () => {
  const f = await fixture({ member: null }); await f.submit();
  assert.equal(f.calls.signouts, 1); assert.equal(f.calls.redirects.length, 0);
  assert.match(f.element('login-message').textContent, /não está liberado/);
});
test('membership connection failure never grants access or destroys session', async () => {
  const f = await fixture({ member: null, memberError: { name: 'TimeoutError' }, reason: 'network' }); await f.submit();
  assert.equal(f.calls.redirects.length, 0); assert.equal(f.calls.signouts, 0);
  assert.match(f.element('login-message').textContent, /conectar/);
});
test('existing session is revalidated against membership', async () => {
  const f = await fixture({ session: { access_token: 'test' }, member: null });
  assert.equal(f.calls.signouts, 1); assert.equal(f.calls.redirects.length, 0);
});
test('password reveal can be toggled', async () => {
  const f = await fixture(); f.element('reveal-password').handlers.click();
  assert.equal(f.element('password').type, 'text');
  f.element('reveal-password').handlers.click(); assert.equal(f.element('password').type, 'password');
});
test('network and rate limit errors have actionable messages', () => {
  assert.match(friendlyAuthError({ status: 429 }), /Aguarde/);
  assert.match(friendlyAuthError({}, false), /internet/);
});

test('login preferences remain native labeled checkboxes without custom roles or forced defaults', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const [id, label] of [['keep-connected', 'Manter conectado'], ['remember-username', 'Lembrar usuário']]) {
    const tag = html.match(new RegExp(`<label><input ([^>]*id="${id}"[^>]*)> ${label}</label>`))?.[1];
    assert.ok(tag, `${id} keeps its accessible label`);
    assert.match(tag, /type="checkbox"/);
    assert.doesNotMatch(tag, /\b(?:role|tabindex|checked|disabled)(?:\s|=|$)/);
  }
});
test('login preferences preserve saved independent defaults', async () => {
  const f = await fixture({preferences: {keepConnected: false, username: 'ana.silva'}});
  assert.equal(f.element('keep-connected').checked, false);
  assert.equal(f.element('remember-username').checked, true);
  assert.equal(f.element('username').value, 'ana.silva');
  f.element('remember-username').checked = false;
  f.element('remember-username').handlers.change();
  assert.deepEqual(f.calls.remembered, ['']);
  assert.equal(f.element('keep-connected').checked, false);
});
for (const keepConnected of [false, true]) for (const rememberUsername of [false, true]) {
  test(`login preferences remain independent: connected=${keepConnected}, remember=${rememberUsername}`, async () => {
    const f = await fixture();
    f.element('keep-connected').checked = keepConnected;
    f.element('remember-username').checked = rememberUsername;
    await f.submit();
    assert.equal(f.calls.signins[0].keepConnected, keepConnected);
    assert.deepEqual(f.calls.remembered, [rememberUsername ? 'gui.cardoso' : '']);
  });
}
