import test from 'node:test';
import assert from 'node:assert/strict';
import {companyFromClient,saveAssessment} from '../assessment-data.js';
function fixture(result){const calls=[];const q={update(value){calls.push(['answers',value]);return this;},eq(k,v){calls.push([k,v]);return this;},select(){return this;},async maybeSingle(){return result;}};return {client:{from:()=>q},calls};}
test('saving targets only the selected draft and its original revision',async()=>{const f=fixture({data:{id:'a',revision:3}});const result=await saveAssessment(f.client,{id:'a',revision:2},{employees:'20'});assert.equal(result.revision,3);assert.deepEqual(f.calls.slice(1),[['id','a'],['revision',2],['status','draft']]);});
test('stale revision never reports successful save',async()=>{const f=fixture({data:null});await assert.rejects(saveAssessment(f.client,{id:'a',revision:2},{}),/outra pessoa/);});
test('network error preserves original draft object',async()=>{const row={id:'a',revision:2,answers:{employees:'10'}};const f=fixture({error:{message:'network'}});await assert.rejects(saveAssessment(f.client,row,{employees:'20'}),/confirmar/);assert.equal(row.answers.employees,'10');assert.equal(row.revision,2);});
test('client company snapshot maps stored fields without external lookup',()=>{const company=companyFromClient({legal_name:'Empresa',cnpj:'123',cnae:'1234567',address:{street:'Rua',city:'Cidade'},contact_phone:'11999999999'});assert.equal(company.razao_social,'Empresa');assert.equal(company.municipio,'Cidade');assert.equal(company.ddd_telefone_1,'11999999999');});
test('deletion targets one draft at the expected revision',async()=>{const {deleteDraft}=await import('../assessment-data.js');const filters=[];const q={delete(){return this;},eq(k,v){filters.push([k,v]);return this;},select(){return this;},maybeSingle:async()=>({data:{id:'a'}})};await deleteDraft({from:()=>q},{id:'a',revision:3});assert.deepEqual(filters,[['id','a'],['revision',3],['status','draft']]);q.maybeSingle=async()=>({data:null});await assert.rejects(deleteDraft({from:()=>q},{id:'a',revision:3}),/alterado/);});
import fs from 'node:fs';
import vm from 'node:vm';
test('new assessment starts and discards without database writes',async()=>{
 const source=fs.readFileSync(new URL('../workspace.js',import.meta.url),'utf8');
 const begin=source.indexOf("$('#create-assessment').addEventListener");const end=source.indexOf('async function loadForm()',begin);
 const elements=new Map();let submit,leave;const $=selector=>{if(!elements.has(selector))elements.set(selector,{value:'Teste',addEventListener:(_,fn)=>{if(selector==='#create-assessment')submit=fn;else leave=fn;}});return elements.get(selector)};
 const ctx=vm.createContext({$,selected:{id:'client',cnpj:'123'},saving:false,creationId:null,crypto:{randomUUID:()=> 'new-id'},access:async()=>{},member:{user_id:'user'},companyFromClient:()=>({}),loadForm:async()=>{},say:()=>{},authClient:{from:()=>{throw Error('Unexpected database write')}},row:null,dirty:true,leaveDialog:{close(){}},location:{assign(){} }});
 vm.runInContext(source.slice(begin,end),ctx);await submit({preventDefault(){}});assert.equal(ctx.row.unsaved,true);
 const leaveStart=source.indexOf("$('#leave-without-saving').addEventListener");vm.runInContext(source.slice(leaveStart,source.indexOf('\n',leaveStart)),ctx);leave();assert.equal(ctx.dirty,false);
});
test('first explicit save inserts one draft, subsequent saves use its revision',async()=>{
 const calls=[];const q={insert(p){calls.push(p);return this},select(){return this},maybeSingle:async()=>({data:{id:'new-id',revision:1}})};
 const row={id:'new-id',client_id:'c',responsible_id:'u',title:'Novo',status:'draft',unsaved:true};
 const saved=await saveAssessment({from:()=>q},row,{employees:'12'});assert.equal(calls.length,1);assert.equal(calls[0].answers.employees,'12');assert.equal('unsaved' in calls[0],false);assert.equal(saved.unsaved,false);assert.equal(saved.revision,1);assert.equal(row.unsaved,true);
});
