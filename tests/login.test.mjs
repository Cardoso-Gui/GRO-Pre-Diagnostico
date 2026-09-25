import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeUsername, friendlyAuthError } from '../auth-utils.js';

const source = await fs.readFile(new URL('../login.js', import.meta.url), 'utf8');
const utilities = await fs.readFile(new URL('../auth-utils.js', import.meta.url), 'utf8');
async function fixture({ signInError = null, member = { display_name: 'Teste' }, memberError = null, reason = 'membership', session = null } = {}) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', hidden: true, type: id === 'password' ? 'password' : 'text', dataset: {}, attrs: {}, handlers: {}, textContent: '', disabled: false,
      addEventListener(name, callback) { this.handlers[name] = callback; },
      setAttribute(k, v) { this.attrs[k] = v; }, querySelector() { return element(id + '-span'); }, focus() {}, reportValidity() { return true; } });
    return elements.get(id);
  }
  const calls = { signins: [], signouts: 0, redirects: [] };
  const client = { auth: {
    async getSession() { return { data: { session } }; },
    async signInWithPassword(input) { calls.signins.push(input); return { error: signInError }; },
    async signOut() { calls.signouts++; return {}; }
  } };
  const context = vm.createContext({ URL, URLSearchParams, navigator: { onLine: true }, document: { querySelector: s => element(s.slice(1)), getElementById: element },
    location: { href: 'https://example.test/GRO-Pre-Diagnostico/index.html', search: '', replace: url => calls.redirects.push(url) } });
  const auth = new vm.SyntheticModule(['authClient', 'getTeamMember', 'signInWithUsername'], function () {
    this.setExport('signInWithUsername', async (username, password) => { calls.signins.push({ username, password }); return { error: signInError }; });
    this.setExport('authClient', client); this.setExport('getTeamMember', async () => ({ member, error: memberError, reason }));
  }, { context });
  const utils = new vm.SourceTextModule(utilities, { context });
  const login = new vm.SourceTextModule(source, { context });
  await login.link(name => name === './auth-client.js' ? auth : utils);
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

