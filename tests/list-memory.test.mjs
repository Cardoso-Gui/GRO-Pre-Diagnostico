import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {rememberList} from '../list-memory.js';
const member={user_id:'user-a',team_id:'team-a'};
function setup(){return new JSDOM('<form id="search"><input id="query"><select id="sort"><option value="asc">A–Z</option><option value="desc">Z–A</option></select></form><input name="password" value="must-not-be-stored"><button id="sign-out">Sair</button>',{url:'https://fixture.test/'});}
test('applied filters return after navigation; unfinished searches and unrelated fields are not stored',()=>{
 const dom=setup(),d=dom.window.document;let now=1000;
 const options={doc:d,member,page:'clients',fields:['query','sort'],submitForm:'#search',changeFields:['sort'],now:()=>now};
 let memory=rememberList(options);d.querySelector('#query').value='Empresa';assert.equal(dom.window.sessionStorage.length,0);
 d.querySelector('form').dispatchEvent(new dom.window.Event('submit'));assert.equal(dom.window.sessionStorage.length,1);
 assert.ok(!dom.window.sessionStorage.getItem(dom.window.sessionStorage.key(0)).includes('password'));
 memory.dispose();d.querySelector('#query').value='';memory=rememberList(options);assert.equal(d.querySelector('#query').value,'Empresa');
 now+=8*60*60*1000;memory.dispose();rememberList(options);assert.equal(d.querySelector('#query').value,'');dom.window.close();
});
test('account and team changes do not inherit another scope, and sign-out clears account filters',()=>{
 const dom=setup(),d=dom.window.document;const options={doc:d,member,page:'clients',fields:['query','sort']};let memory=rememberList(options);
 d.querySelector('#query').value='A';d.querySelector('#query').dispatchEvent(new dom.window.Event('input'));memory.dispose();
 memory=rememberList({...options,member:{...member,team_id:'team-b'}});assert.equal(d.querySelector('#query').value,'');memory.dispose();
 memory=rememberList({...options,member:{user_id:'user-b',team_id:'team-a'}});assert.equal(d.querySelector('#query').value,'');memory.dispose();
 rememberList(options);assert.equal(d.querySelector('#query').value,'A');d.querySelector('#sign-out').click();assert.equal(dom.window.sessionStorage.length,0);dom.window.close();
});
test('blocked storage and malformed or obsolete enum values do not prevent navigation',()=>{
 const dom=setup(),d=dom.window.document;const options={doc:d,member,page:'clients',fields:['query','sort']};
 const bad={getItem(){throw Error('blocked')},removeItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.doesNotThrow(()=>rememberList({...options,storage:bad}).save());
 const storage=dom.window.sessionStorage;storage.setItem('gro-list-v1:user-a:team-a:clients',JSON.stringify({at:100,values:{sort:'removed',query:'x'.repeat(241)}}));rememberList({...options,now:()=>101});assert.equal(d.querySelector('#sort').value,'asc');assert.equal(d.querySelector('#query').value,'');dom.window.close();
});
