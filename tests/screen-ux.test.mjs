import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {initScreenUX} from '../screen-ux.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const tick=window=>new Promise(resolve=>window.setTimeout(resolve,0));

test('clearing directory filters dispatches the existing rendering events and leaves access forms untouched',()=>{
 const dom=new JSDOM('<section class="team-filters"><input id="member-search" value="Ana"><select id="role-filter"><option value="">Todos</option><option selected value="admin">Admin</option></select></section><form><input name="role" value="admin"></form>');
 const d=dom.window.document;let renders=0;
 d.querySelector('#member-search').addEventListener('input',()=>renders++);d.querySelector('#role-filter').addEventListener('change',()=>renders++);
 initScreenUX(d);initScreenUX(d);assert.equal(d.querySelectorAll('.filter-tools').length,1);
 d.querySelector('.filter-tools button').click();assert.equal(renders,2);assert.equal(d.querySelector('#role-filter').value,'');assert.equal(d.querySelector('[name=role]').value,'admin');assert.equal(d.activeElement.id,'member-search');dom.window.close();
});
test('risk controls use actual completion markers and retain the active risk while filtering',async()=>{
 const dom=new JSDOM('<body class="risk-editor-page"><div id="editor"><aside><nav id="risk-nav"><section><button data-risk-index="0" data-complete="true" aria-current="true">A</button><button data-risk-index="1" data-complete="false" aria-current="false">B</button><button data-risk-index="2" data-complete="false" aria-current="false">C</button></section></nav></aside><div id="cards"><article><section class="section"><h3>Exposição</h3><textarea>Resposta preservada</textarea></section></article></div></div>');
 const d=dom.window.document;let target;d.querySelectorAll('[data-risk-index]').forEach(b=>b.addEventListener('click',()=>{target=b.dataset.riskIndex;}));initScreenUX(d);
 d.querySelector('.risk-pending-filter input').click();assert.equal(d.querySelector('[data-risk-index="0"]').hidden,false);
 d.querySelector('.risk-pending-tools button').click();assert.equal(target,'1');
 d.querySelector('[data-risk-index="1"]').dataset.complete='true';await tick(dom.window);
 assert.equal(d.querySelector('[data-risk-index="1"]').hidden,true);assert.match(d.querySelector('.risk-pending-count').textContent,/1 de 3/);
 assert.equal(d.querySelector('textarea').value,'Resposta preservada');assert.equal(d.querySelector('.risk-form-outline a').getAttribute('href'),'#risk-section-1');dom.window.close();
});
test('report filter feedback distinguishes changed selections from a submitted search',()=>{
 const dom=new JSDOM('<form id="report-search-form"><input></form><button id="clear-filters">Limpar</button>');const d=dom.window.document;initScreenUX(d);
 d.querySelector('input').dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.match(d.querySelector('#report-filter-feedback').textContent,/Pesquisar/);
 d.querySelector('form').dispatchEvent(new dom.window.Event('submit'));assert.equal(d.querySelector('#report-filter-feedback').textContent,'');dom.window.close();
});
test('occurrence counter updates after typing and reset without storing the description',async()=>{
 const dom=new JSDOM('<form id="occ-form"><textarea name="description" maxlength="5000"></textarea></form>');const d=dom.window.document;initScreenUX(d);const field=d.querySelector('textarea');field.value='Teste';field.dispatchEvent(new dom.window.Event('input'));assert.equal(d.querySelector('#occ-description-count').textContent,'5 / 5000 caracteres');d.querySelector('form').reset();await tick(dom.window);assert.equal(d.querySelector('#occ-description-count').textContent,'0 / 5000 caracteres');dom.window.close();
});
test('all improved work areas load the screen controls exactly once',()=>{
 for(const page of ['levantamento','rectify','risk-detail','clients','client','reports','team','admin','occurrences']){const d=new JSDOM(read(page+'.html')).window.document;assert.equal(d.querySelectorAll('script[src="./screen-ux.js?v=20261112-ux1"]').length,1,page);assert.equal(d.querySelectorAll('link[href="./screen-ux.css?v=20261112-ux1"]').length,1,page);}
});
