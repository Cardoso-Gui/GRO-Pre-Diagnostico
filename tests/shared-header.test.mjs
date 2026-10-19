import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const script = read('shared-header.js');
const css = read('shared-header.css');
const pages = ['inicio', 'clients', 'client', 'levantamento', 'reports', 'report', 'risk-detail', 'occurrences', 'team', 'admin'];

test('every application page loads the same version of the shared profile styling and script', () => {
 for (const page of pages) {
  const html = read(`${page}.html`);
  assert.match(html, /shared-header\.css\?v=20261019-profile2/, page);
  assert.match(html, /shared-header\.js\?v=20261019-profile2/, page);
  assert.match(html, /class="[^"]*unified-header gro-shared"/, page);
  if (html.includes('id="profile-toggle"')) {
   assert.match(html, /<span class="profile-chevron" aria-hidden="true"><\/span>/, page);
   assert.match(html, /id="profile-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="profile-panel"[^>]*aria-label="Abrir perfil"/, page);
  }
 }
});

test('profile has a bounded name, visible focus, expanded state and reduced-motion support', () => {
 assert.match(css, /\.profile-toggle\{[^}]*min-height:46px[^}]*border-radius:999px/);
 assert.match(css, /#profile-short-name\{[^}]*max-width:120px[^}]*text-overflow:ellipsis/);
 assert.match(css, /\.profile-toggle:hover,[^{]*\.profile-toggle\[aria-expanded="true"\]/);
 assert.match(css, /:focus-visible\{outline:3px solid/);
 assert.match(css, /\.profile-chevron::before\{[^}]*border-right:[^}]*border-bottom:/);
 assert.match(css, /\[aria-expanded="true"\] \.profile-chevron::before\{transform:/);
 assert.match(css, /@media\(prefers-reduced-motion:reduce\)[^\n]*transition:none/);
});

test('mobile profile keeps a 44px touch target and the dropdown stays right-aligned within viewport', () => {
 assert.match(css, /@media\(max-width:760px\)\{\s*[^\n]*#profile-short-name[^\n]*\.profile-chevron\{display:none\}/);
 assert.match(css, /\.profile-toggle\{min-height:44px;padding:4px\}/);
 assert.match(css, /\.profile-panel\{[^}]*right:0;top:calc\(100% \+ 10px\)[^}]*max-width:calc\(100vw - 32px\)/);
});

// Small DOM fixture: no network, credentials or application records are involved.
function setup({existingProfile = false} = {}) {
 class Element {
  constructor(tag, {id = '', className = '', textContent = ''} = {}) {
   Object.assign(this, {tag, id, className, textContent, childNodes: [], attributes: {}, events: {}, hidden: false});
   const classes = new Set();
   this.classList = {contains: name => classes.has(name), remove: name => classes.delete(name), toggle: (name, value) => value ? classes.add(name) : classes.delete(name)};
  }
  append(...children) {
   for (const child of children) {
    if (child.parent) child.parent.childNodes.splice(child.parent.childNodes.indexOf(child), 1);
    child.parent = this; this.childNodes.push(child);
   }
  }
  before(node) { node.parent = this.parent; this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 0, node); }
  querySelector(selector) {
   const matches = node => selector.split(',').some(part => {
    const s = part.trim();
    return s.startsWith('#') ? node.id === s.slice(1) : s.startsWith('.') ? node.className.split(' ').includes(s.slice(1)) : node.tag === s;
   });
   for (const child of this.childNodes) { if (matches(child)) return child; const nested = child.querySelector(selector); if (nested) return nested; }
   return null;
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, fn) { (this.events[event] ||= []).push(fn); }
  dispatch(event, detail = {}) { for (const fn of this.events[event] || []) fn({target: this, ...detail}); }
  contains(node) { return node === this || this.childNodes.some(child => child.contains(node)); }
  focus() { this.focused = true; }
 }
 const header = new Element('header');
 const nav = new Element('nav');
 const menu = new Element('div', {className: 'user-menu'});
 const avatar = new Element('span', {className: 'avatar', textContent: 'GC'});
 const info = new Element('div', {className: 'user-info'});
 const name = new Element('strong', {id: 'user-name', textContent: 'Guilherme Cardoso'});
 const signOut = new Element('button', {id: 'sign-out'});
 let signOutClicks = 0;
 signOut.addEventListener('click', () => signOutClicks++);
 info.append(name); menu.append(avatar, info, signOut); header.append(nav, menu);
 if (existingProfile) menu.append(new Element('button', {id: 'profile-toggle'}));
 const document = new Element('document');
 document.querySelector = selector => selector === 'header.unified-header' ? header : null;
 document.createElement = tag => new Element(tag);
 let syncName;
 class MutationObserver { constructor(callback) { syncName = callback; } observe() {} }
 vm.runInNewContext(script, {document, MutationObserver});
 return {header, nav, menu, avatar, info, name, signOut, document, signOutClicks: () => signOutClicks, syncName: () => syncName(), profile: menu.querySelector('#profile-toggle'), panel: menu.querySelector('#profile-panel'), toggle: header.querySelector('#home-menu-toggle')};
}

test('generated header reuses the identity and sign-out elements and decorates its chevron accessibly', () => {
 const s = setup();
 assert.equal(s.profile.querySelector('.avatar'), s.avatar);
 assert.equal(s.panel.querySelector('#sign-out'), s.signOut);
 assert.equal(s.panel.querySelector('.user-info'), s.info);
 assert.equal(s.profile.querySelector('#profile-short-name').textContent, 'Guilherme');
 const chevron = s.profile.querySelector('.profile-chevron');
 assert.equal(chevron.textContent, '');
 assert.equal(chevron.attributes['aria-hidden'], 'true');
 s.signOut.dispatch('click'); assert.equal(s.signOutClicks(), 1);
 s.name.textContent = 'Maria Silva'; s.syncName();
 assert.equal(s.profile.querySelector('#profile-short-name').textContent, 'Maria');
});

test('repeated profile clicks, outside click, Escape and mobile navigation keep existing dismissal behavior', () => {
 const s = setup();
 assert.equal(s.panel.hidden, true);
 for (let i = 0; i < 2; i++) {
  s.profile.dispatch('click'); assert.equal(s.panel.hidden, false); assert.equal(s.profile.attributes['aria-expanded'], 'true');
  s.profile.dispatch('click'); assert.equal(s.panel.hidden, true); assert.equal(s.profile.attributes['aria-expanded'], 'false');
 }
 s.profile.dispatch('click'); s.document.dispatch('click', {target: s.signOut}); assert.equal(s.panel.hidden, false);
 s.document.dispatch('click', {target: {}}); assert.equal(s.panel.hidden, true);
 s.profile.dispatch('click'); s.document.dispatch('keydown', {key: 'Escape'});
 assert.equal(s.panel.hidden, true); assert.equal(s.profile.focused, true);
 s.profile.dispatch('click'); s.toggle.dispatch('click');
 assert.equal(s.panel.hidden, true); assert.equal(s.nav.classList.contains('is-open'), true);
 s.profile.dispatch('click'); assert.equal(s.nav.classList.contains('is-open'), false); assert.equal(s.panel.hidden, false);
});

test('pre-rendered profile headers are not duplicated and keep their page-owned behavior', () => {
 const s = setup({existingProfile: true});
 assert.equal(s.menu.childNodes.length, 4);
 assert.equal(s.panel, null);
 assert.deepEqual(s.profile.events, {});
 assert.deepEqual(s.document.events, {});
});
