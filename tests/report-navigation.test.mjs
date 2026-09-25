import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../workspace.js',import.meta.url),'utf8');
test('conclusão encerra estado de salvamento antes de navegar; falha preserva edição',async()=>{
 for(const fail of [false,true]){
 let navigated=false;const button={disabled:false};
 const ctx=vm.createContext({saving:false,dirty:true,row:{client_id:'client'},cleanState:'',JSON,encodeURIComponent,$:s=>s==='#questionnaire'?{querySelectorAll:()=>[]}:button,access:async()=>{},authClient:{},completeAssessment:async()=>{if(fail)throw Error('erro');return {status:'completed',client_id:'client'}},fingerprint:()=>'',say:()=>{},location:{assign:()=>{assert.equal(ctx.saving,false);assert.equal(ctx.dirty,false);navigated=true;}}});
 const body=source.slice(source.indexOf('complete:async answers=>{')+'complete:'.length,source.indexOf('},reload:()=>{'))+'}';
 vm.runInContext('complete='+body,ctx);await ctx.complete({});assert.equal(navigated,!fail);if(fail)assert.equal(ctx.dirty,true);
 }
});
