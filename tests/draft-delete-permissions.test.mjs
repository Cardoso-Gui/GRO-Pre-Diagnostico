import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {canDeleteDraft,deleteDraft} from '../assessment-data.js';
const TEAM='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d';
const member={user_id:'admin',active:true,team_id:TEAM,role:'editor',teams:{active:true}};
const draft={id:'draft',client_id:'client',status:'draft',revision:7};
test('only active exact Team 1 can delete drafts, independent of generic role',()=>{
 assert.equal(canDeleteDraft(member,draft),true);
 for(const m of [null,{...member,user_id:''},{...member,active:false},{...member,teams:{active:false}},{...member,team_id:'other',role:'admin',is_super_admin:true},{...member,team_id:'other',teams:{active:true,grants_global_access:true}}])assert.equal(canDeleteDraft(m,draft),false);
 for(const d of [null,{...draft,status:'completed'},{...draft,status:'other'}])assert.equal(canDeleteDraft(member,d),false);
});
test('client service refuses ineligible deletion before network',async()=>{
 const client={from(){throw Error('network must not run')}};
 await assert.rejects(deleteDraft(client,draft,{...member,team_id:'other'}),/Equipe 1/);
 await assert.rejects(deleteDraft(client,{...draft,status:'completed'},member),/Equipe 1/);
});
test('history keeps edit links separate from deletion authorization',async()=>{
 const source=await readFile(new URL('../workspace.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('async function historyList('),source.indexOf('let creationId=null;'));
 const elements=new Map();const el=()=>({children:[],append(x){this.children.push(x)},replaceChildren(){this.children=[]},addEventListener(){}});
 const $=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)};
 let current=member;
 const data=[draft,{...draft,id:'completed',status:'completed'}];
 const q={select(){return this},eq(){return this},order(){return this},range:async()=>({data})};
 const ctx=vm.createContext({$,document:{createElement:el},selected:{id:'client'},historyOffset:0,authClient:{from:()=>q},member:current,canDeleteDraft,askDelete(){},encodeURIComponent});
 vm.runInContext(body+';globalThis.run=historyList;',ctx);
 await ctx.run();let cards=$('#draft-list').children;assert.equal(cards[0].children.filter(x=>x.textContent==='Excluir rascunho').length,1);assert.equal(cards[1].children.length,1);
 ctx.member={...member,team_id:'other',role:'admin'};await ctx.run();cards=$('#draft-list').children;assert.equal(cards[0].children.some(x=>x.textContent==='Continuar rascunho'),true);assert.equal(cards[0].children.some(x=>x.textContent==='Excluir rascunho'),false);
});
test('delete confirmation revalidates identity, serializes clicks, handles cancel and clears exact draft recovery',async()=>{
 const source=await readFile(new URL('../workspace.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('let pendingDelete=null'),source.indexOf("$('#create-assessment').addEventListener"));
 const events=new Map(),els=new Map(),calls=[],cleared=[];
 const el=id=>({textContent:'',disabled:false,showModal(){},close(){},addEventListener(e,f){events.set(id+':'+e,f)}});
 const $=id=>{if(!els.has(id))els.set(id,el(id));return els.get(id)};
 let nextAccess=async()=>{},pause;
 const ctx=vm.createContext({$,member:structuredClone(member),selected:{id:'different-client'},canDeleteDraft,access:()=>nextAccess(),authClient:{},deleteDraft:async(c,d,m)=>{if(!canDeleteDraft(m,d))throw Error('Denied');calls.push(d);if(pause)await pause;},clearDraftRecovery:s=>cleared.push(s),historyList:async()=>{throw Error('Must not reload wrong company')},say(){}});
 vm.runInContext(body+';globalThis.ask=askDelete;',ctx);
 ctx.ask(draft);await events.get('#cancel-delete:click')();await events.get('#confirm-delete:click')();assert.equal(calls.length,0);
 ctx.ask(draft);nextAccess=async()=>{ctx.member={...member,user_id:'new-team1-user'}};await events.get('#confirm-delete:click')();assert.equal(calls.length,0);assert.match($('#delete-status').textContent,/acesso mudou/);
 ctx.member=structuredClone(member);ctx.ask(draft);nextAccess=async()=>{ctx.member={...member,team_id:'other'}};await events.get('#confirm-delete:click')();assert.equal(calls.length,0);
 ctx.member=structuredClone(member);ctx.ask(draft);nextAccess=async()=>{throw Error('offline')};await events.get('#confirm-delete:click')();assert.equal(calls.length,0);
 nextAccess=async()=>{};ctx.ask(draft);let release;pause=new Promise(r=>release=r);const first=events.get('#confirm-delete:click')();await new Promise(r=>setImmediate(r));await events.get('#confirm-delete:click')();assert.equal(calls.length,1);release();await first;assert.deepEqual(JSON.parse(JSON.stringify(cleared)),[{userId:member.user_id,teamId:TEAM,clientId:draft.client_id,draftId:draft.id}]);
});
