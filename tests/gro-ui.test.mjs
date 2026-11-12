import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const script = read('gro-ui.js');
test('sign-out from another work area clears list queries without touching other session data',()=>{
 const dom=new JSDOM('<button id="sign-out">Sair</button>',{url:'https://fixture.test',runScripts:'outside-only'});
 dom.window.sessionStorage.setItem('gro-list-v1:user:team:clients','query');dom.window.sessionStorage.setItem('unrelated','preserved');
 dom.window.eval(script);dom.window.document.querySelector('button').click();assert.equal(dom.window.sessionStorage.getItem('gro-list-v1:user:team:clients'),null);assert.equal(dom.window.sessionStorage.getItem('unrelated'),'preserved');dom.window.close();
});
function setup() {
  const dom = new JSDOM(`<body><header class="unified-header"><button id="home-menu-toggle" aria-expanded="true">Menu</button><nav class="is-open"><a href="clients.html">Clientes</a></nav><button id="profile-toggle" aria-expanded="false">Perfil</button><div id="profile-panel" hidden>Perfil</div></header><main><div class="draft-filter" hidden><input id="draft-filter"><button id="clear-draft-filter" hidden>Limpar</button><p id="draft-filter-status"></p></div><div id="draft-list"></div></main></body>`, {runScripts: 'outside-only'});
  let resize;
  dom.window.matchMedia = () => ({addEventListener: (_, fn) => { resize = fn; }});
  dom.window.eval(script);
  return {window: dom.window, document: dom.window.document, resize: () => resize()};
}

test('every work area and login loads the shared screen stylesheet and behavior', () => {
  for (const page of ['index', 'inicio', 'clients', 'client', 'levantamento', 'reports', 'report', 'risk-detail', 'occurrences', 'team', 'admin', 'rectify']) {
    const dom = new JSDOM(read(page + '.html'));
    const doc = dom.window.document;
    assert.ok(doc.body.classList.contains('gro-ui'), page);
    assert.equal(doc.querySelectorAll('link[href="./gro-ui.css?v=20261111-ui1"]').length, 1, page);
    assert.equal(doc.querySelectorAll('script[src="./gro-ui.js?v=20261112-memory1"]').length, 1, page);
    dom.window.close();
  }
});

test('filter handles accents, no results, clear, and asynchronously refreshed drafts without replacing records', async () => {
  const {window, document: doc} = setup();
  const list = doc.querySelector('#draft-list');
  const row = doc.createElement('article'); row.className = 'draft-row'; row.textContent = 'Manutenção São José';
  list.append(row);
  await new Promise(resolve => window.setTimeout(resolve, 0));
  assert.equal(doc.querySelector('.draft-filter').hidden, false);
  const input = doc.querySelector('#draft-filter');
  const type = value => {input.value = value; input.dispatchEvent(new window.Event('input'));};
  type('MANUTENCAO'); assert.equal(row.hidden, false);
  type('inexistente'); assert.equal(row.hidden, true);
  assert.match(doc.querySelector('#draft-filter-status').textContent, /Nenhum/);
  assert.equal(list.firstElementChild, row);
  const next = row.cloneNode(true); next.textContent = 'Empresa inexistente'; list.append(next);
  await new Promise(resolve => window.setTimeout(resolve, 0));
  assert.equal(next.hidden, false); assert.equal(row.hidden, true);
  doc.querySelector('#clear-draft-filter').click();
  assert.equal(input.value, ''); assert.equal(row.hidden, false); assert.equal(next.hidden, false);
  assert.equal(doc.activeElement, input);
  window.close();
});

test('Escape restores menu focus, resize closes navigation, and skip link targets the main content', () => {
  const {window, document: doc, resize} = setup();
  doc.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape'}));
  assert.equal(doc.querySelector('nav').classList.contains('is-open'), false);
  assert.equal(doc.querySelector('#home-menu-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(doc.activeElement.id, 'home-menu-toggle');
  doc.querySelector('nav').classList.add('is-open'); resize();
  assert.equal(doc.querySelector('nav').classList.contains('is-open'), false);
  assert.equal(doc.querySelector('.skip-link').getAttribute('href'), '#' + doc.querySelector('main').id);
  window.close();
});
