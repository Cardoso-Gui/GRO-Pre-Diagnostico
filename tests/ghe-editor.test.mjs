import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../script.js',import.meta.url),'utf8');
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.checked=false;}
  append(...items){this.children.push(...items);}
  appendChild(item){this.append(item);}
  replaceChildren(){this.children=[];}
  setAttribute(){}
  focus(){}
  showModal(){this.open=true;}
  close(){this.open=false;}
  all(){return this.children.flatMap(child=>[child,...child.all()]);}
  querySelectorAll(selector){return this.all().filter(el=>el.tag==='input'&&(!selector.includes('[data-job]')||el.dataset.job)&&(!selector.includes(':checked')||el.checked));}
  querySelector(selector){return this.querySelectorAll(selector)[0];}
}
function fixture(accepted=true){
 const ghe={id:'g1',name:'Operacional',linkedJobs:[{sectorName:'A',jobName:'Cargo 1'}]};
 const ctx=vm.createContext({document:{createElement:tag=>new Element(tag)},selectedSectorNames:new Set(['A','B']),
 getAvailableJobsForGhe:()=>[{sectorName:'A',jobName:'Cargo 1'},{sectorName:'A',jobName:'Cargo 2'},{sectorName:'B',jobName:'Cargo 3'}],
 GRO_VALIDATE:{show:items=>!items.length},gheList:[ghe,{id:'g2'}],selectedRisksByTarget:new Map([['g1',new Set(['r'])],['g2',new Set(['r'])]]),
 riskSourcesBySelection:new Map([['source__g1__r',{text:'preservar'}],['source__g2__r',{}]]),
 epiBySelection:new Map([['epi-data__g1__r',{}],['epi-data__g2__r',{}]]),
 createTargetId:(...parts)=>parts.join('__'),confirm:()=>accepted,renderRiskSelection:()=>{},renderEpiSection:()=>{},updateReportAvailability:()=>{}});
 vm.runInContext(source.slice(source.indexOf('function createGheActions('),source.indexOf('function buildRiskGroupOptions(')),ctx);
 const root=ctx.createGheActions(ghe);root.children[0].children[0].onclick();
 return {ctx,ghe,root,panel:root.children[1]};
}
test('setor seleciona todos; cargo seleciona somente ele e deixa setor parcial',()=>{
 const {panel}=fixture();const options=panel.children[1];const a=options.children[0];
 const [parent,first,second]=a.querySelectorAll('input');
 assert.equal(first.checked,true);assert.equal(parent.indeterminate,true);
 parent.checked=true;parent.onchange();assert.equal(second.checked,true);assert.equal(parent.indeterminate,false);
 parent.checked=false;parent.onchange();assert.equal(first.checked,false);assert.equal(second.checked,false);
 second.checked=true;second.onchange();assert.equal(first.checked,false);assert.equal(parent.checked,false);assert.equal(parent.indeterminate,true);
 assert.equal(options.children[1].querySelector('input').checked,false);
});
test('salvar aplica apenas cargos marcados e preserva riscos; cancelar não altera vínculos',()=>{
 for(const save of [false,true]){
 const {panel,ghe,ctx}=fixture();const second=panel.children[1].children[0].querySelectorAll('input')[2];second.checked=true;second.onchange();
 panel.children[2].children[save?1:0].onclick();
 assert.equal(ghe.linkedJobs.length,save?2:1);assert.equal(panel.open,false);
 assert.equal(ctx.selectedRisksByTarget.get('g1').size,1);assert.equal(ctx.riskSourcesBySelection.get('source__g1__r').text,'preservar');
 }
});
test('excluir só remove GHE confirmado e suas respostas',()=>{
 for(const accepted of [false,true]){
 const {ctx}=fixture(accepted);ctx.deleteGhe('g1');
 assert.equal(ctx.gheList.length,accepted?1:2);
 assert.equal(ctx.selectedRisksByTarget.has('g1'),!accepted);
 assert.equal(ctx.riskSourcesBySelection.has('source__g1__r'),!accepted);
 assert.equal(ctx.epiBySelection.has('epi-data__g1__r'),!accepted);
 assert.equal(ctx.riskSourcesBySelection.has('source__g2__r'),true);
 assert.equal(ctx.selectedSectorNames.size,2);
 }
});
test('remover setor limpa cargos e vínculos, preserva outro setor e permite cancelar',async()=>{
 for(const accepted of [false,true]){
 const checkbox={checked:true};
 const ctx=vm.createContext({confirmSectorRemoval:async()=>accepted,selectedSectorNames:new Set(['A','B']),collapsedJobSectors:new Set(['A','B']),
 jobsBySector:new Map([['A',[{name:'Cargo'}]],['B',[{name:'Outro'}]]]),
 gheList:[{id:'g1',linkedJobs:[{sectorName:'A',jobName:'Cargo'},{sectorName:'B',jobName:'Outro'}]}],
 selectedRisksByTarget:new Map([['job__A__Cargo',new Set(['r'])],['g1',new Set(['r'])]]),
 riskSourcesBySelection:new Map([['source__job__A__Cargo__r',{}],['source__g1__r',{}]]),
 epiBySelection:new Map([['epi-data__job__A__Cargo__r',{}]]),
 createTargetId:(...parts)=>parts.join('__'),normalizeSectorName:x=>x,findSectorCheckbox:()=>checkbox,
 updateSelectedSectors:()=>{},renderEpiSection:()=>{},updateReportAvailability:()=>{}});
 vm.runInContext(source.slice(source.indexOf('async function removeSector('),source.indexOf('function renderJobList(')),ctx);
 await ctx.removeSector('A');
 assert.equal(ctx.jobsBySector.has('A'),!accepted);
 assert.equal(ctx.selectedSectorNames.has('A'),!accepted);
 assert.equal(ctx.collapsedJobSectors.has('A'),!accepted);
 assert.equal(ctx.collapsedJobSectors.has('B'),true);
 assert.equal(checkbox.checked,!accepted);
 assert.equal(ctx.gheList[0].linkedJobs.length,accepted?1:2);
 assert.equal(ctx.riskSourcesBySelection.has('source__job__A__Cargo__r'),!accepted);
 assert.equal(ctx.jobsBySector.has('B'),true);
 assert.equal(ctx.riskSourcesBySelection.has('source__g1__r'),true);
 }
});
test('excluir cargo remove só seu vínculo e riscos próprios',()=>{
 const ctx=vm.createContext({jobsBySector:new Map([['A',[{name:'Um'},{name:'Dois'}]]]),
 selectedRisksByTarget:new Map([['job__A__Um',new Set(['r'])],['g1',new Set(['r'])]]),
 riskSourcesBySelection:new Map([['source__job__A__Um__r',{}],['source__g1__r',{}]]),
 epiBySelection:new Map([['epi-data__job__A__Um__r',{}]]),
 gheList:[{linkedJobs:[{sectorName:'A',jobName:'Um'},{sectorName:'A',jobName:'Dois'},{sectorName:'B',jobName:'Um'}]}],
 createTargetId:(...parts)=>parts.join('__'),renderRiskModeSection:()=>{}});
 vm.runInContext(source.slice(source.indexOf('function removeJobFromSector('),source.indexOf('function getJobSuggestions(')),ctx);
 ctx.removeJobFromSector('A','Um');
 assert.equal(ctx.jobsBySector.get('A').length,1);
 assert.equal(ctx.gheList[0].linkedJobs.length,2);
 assert.equal(ctx.selectedRisksByTarget.has('job__A__Um'),false);
 assert.equal(ctx.riskSourcesBySelection.has('source__job__A__Um__r'),false);
 assert.equal(ctx.epiBySelection.size,0);
 assert.equal(ctx.riskSourcesBySelection.has('source__g1__r'),true);
});
