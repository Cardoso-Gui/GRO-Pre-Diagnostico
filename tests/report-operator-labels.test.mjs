import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync(new URL('../reports.js',import.meta.url),'utf8');
test('report list labels responsible_id as operator rather than visit professional',t=>{
 const dom=new JSDOM('<div id="list"></div><p id="status"></p>');t.after(()=>dom.window.close());const document=dom.window.document;
 const context=vm.createContext({document,list:document.querySelector('#list'),status:document.querySelector('#status'),rows:[{id:'report',client_id:'company',title:'Relatório sintético',completed_at:'2026-01-01',team_members:{display_name:'Auxiliar operador'}}],clients:[{id:'company',legal_name:'Empresa sintética'}],hasMore:false,isAdmin:false,authClient:{},getTeamMember(){},addReuseButton(){},encodeURIComponent,Date});
 vm.runInContext(source.slice(source.indexOf('function node('),source.indexOf('function matches(')),context);
 vm.runInContext(source.slice(source.indexOf('function render()'),source.indexOf('async function load(')),context);context.render();
 assert.match(document.querySelector('#list').textContent,/OperadorAuxiliar operador/);assert.doesNotMatch(document.querySelector('#list').textContent,/Responsável/);
 const page=new JSDOM(fs.readFileSync(new URL('../reports.html',import.meta.url),'utf8'));t.after(()=>page.window.close());assert.equal(page.window.document.querySelector('label[for="report-author"]').textContent,'Operador');assert.equal(page.window.document.querySelector('#report-author option').textContent,'Todos os operadores');
});
test('operator filter retains existing RLS query and explicit ownership FK, without new professional authority',async()=>{
 const calls=[];const query={select(value){calls.push(['select',value]);return query;},eq(...args){calls.push(args);return query;},order(){return query;},range:async()=>({data:[]})};
 const context=vm.createContext({authClient:{from:()=>query},filters:{author:'operator',ascending:false}});vm.runInContext(source.slice(source.indexOf('async function queryPage('),source.indexOf('async function fetchPage(')),context);await context.queryPage(null,0,20);
 assert.ok(calls.some(([key,value])=>key==='responsible_id'&&value==='operator'));assert.match(calls[0][1],/team_members!assessments_responsible_id_fkey/);assert.doesNotMatch(calls[0][1],/visit_responsible/);
});
