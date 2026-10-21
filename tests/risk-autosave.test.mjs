import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../risk-detail.js',import.meta.url),'utf8');
const persistSource=source.slice(source.indexOf('async function persistSnapshot('),source.indexOf('async function load('));
function makeContext(access){
 const events=[];
 const ctx=vm.createContext({
  member:{user_id:'user-a',team_id:'team-a'},row:{id:'draft-a',responsible_id:'user-a',revision:1},accessEnded:false,
  authClient:{},getTeamMember:async()=>access,
  endAccess:message=>events.push(['access',message]),
  saveAssessment:async(client,row,answers)=>{events.push(['save',answers]);return {...row,revision:2,answers};}
 });
 vm.runInContext(persistSource,ctx);
 return {ctx,events};
}
test('detail autosave persists incomplete inputs without advancing validation',async()=>{
 const {ctx,events}=makeContext({member:{user_id:'user-a',team_id:'team-a',role:'collaborator'}});
 const snapshot={answers:{riskSourcesBySelection:[['risk',{source:'partial'}]]}};
 const saved=await ctx.persistSnapshot(snapshot);
 assert.equal(saved.revision,2);assert.deepEqual(events,[['save',snapshot.answers]]);
});
for(const [name,member] of [
 ['account change',{user_id:'other',team_id:'team-a',role:'admin'}],
 ['team change',{user_id:'user-a',team_id:'other',role:'admin'}],
 ['session end',null]
])test(`detail autosave rejects ${name} before writes`,async()=>{
 const {ctx,events}=makeContext({member});
 await assert.rejects(ctx.persistSnapshot({answers:{}}),e=>e.code==='DRAFT_ACCESS');
 assert.equal(events.filter(([kind])=>kind==='save').length,0);
 assert.equal(events[0][0],'access');
});
test('detail autosave preserves current form on network verification error',async()=>{
 const {ctx,events}=makeContext({member:null,reason:'network'});
 await assert.rejects(ctx.persistSnapshot({answers:{}}),/Aguardando conexão/);
 assert.deepEqual(events,[]);
});
test('detail autosave rejects changed operator permission before writes',async()=>{
 const {ctx,events}=makeContext({member:{user_id:'user-a',team_id:'team-a',role:'collaborator'}});
 ctx.row.responsible_id='other';
 await assert.rejects(ctx.persistSnapshot({answers:{}}),e=>e.code==='DRAFT_ACCESS');
 assert.equal(events.filter(([kind])=>kind==='save').length,0);
});
test('manual detail save awaits controller flush and never advances over newer edits',async()=>{
 const code=source.slice(source.indexOf('async function persistDetails('),source.indexOf('function endAccess('));
 for(const dirty of [false,true]){
  let flushed=0;
  const button={};const ctx=vm.createContext({saving:false,row:{},accessEnded:false,autosave:{flush:async()=>{flushed++;return {id:'draft'};}},$:()=>button,dirty:()=>dirty});
  vm.runInContext(code,ctx);
  assert.equal(await ctx.persistDetails(),!dirty);assert.equal(flushed,1);assert.equal(ctx.saving,false);
 }
});
test('detail fields, damage selections and control changes notify autosave',()=>{
 assert.match(source,/const update=\(\)=>\{data\[field\.dataset\.field\]=field\.value;details\.set\(key,data\);changed\(\);\};field\.addEventListener\('input',update\);field\.addEventListener\('change',update\)/);
 assert.match(source,/mountDamageEditor\(article,risk,data,\(\)=>\{details\.set\(key,data\);changed\(\)/);
 assert.match(source,/field\.onchange=[\s\S]*?details\.set\(key,data\);changed\(\)/);
 assert.match(source,/page:'details'/);
 assert.match(source,/showDraftRecovery\(autosave/);
});
