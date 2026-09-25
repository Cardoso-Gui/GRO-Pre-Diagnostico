import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../script.js',import.meta.url),'utf8');
function fixture(){
 const detail={source:'Máquina',frequency:'Diária',duration:'2h',damage:'Dano',measures:'Nenhuma',measure:'Não'};
 const epi={applicable:'Não',items:[]};
 const ctx=vm.createContext({currentCompany:{},employeeCountInput:{value:'1'},selectedSectorNames:new Set(['A']),jobsBySector:new Map([['A',[{name:'Cargo',quantity:1,activities:'Atividade'}]]]),selectedRiskMode:'job',gheList:[],getRiskTargets:()=>[{id:'a',title:'Cargo'}],getSelectedRiskCodes:()=>new Set(['x']),dimensionFields:{cipaSummary:{textContent:'Sem comissão'},sesmtSummary:{textContent:'Sem equipe'}},getRiskSelections:()=>[{targetId:'a',targetTitle:'Cargo',risk:{code:'x',name:'Risco'}}],getRiskSourceData:()=>detail,getEpiData:()=>epi});
 vm.runInContext(source.slice(source.indexOf('function getReportMissingFields('),source.indexOf('function validateReport()')),ctx);
 return {ctx,detail,epi,check:()=>ctx.getReportMissingFields()};
}
test('dados completos e resposta Não permitem gerar',()=>assert.equal(fixture().check().length,0));
test('medição em branco bloqueia; Sim não exige valor quantitativo',()=>{const f=fixture();f.detail.measure='';assert.ok(f.check().some(x=>x.includes('medir/avaliar')));f.detail.measure='Sim';assert.equal(f.check().length,0)});
test('EPI Sim exige equipamento e fonte em branco bloqueia',()=>{const f=fixture();f.epi.applicable='Sim';f.detail.source=' ';assert.equal(f.check().length,2)});
test('ausência oficial dispensa detalhamento',()=>{const f=fixture();f.ctx.getRiskSelections=()=>[{risk:{code:'09.01.001'}}];assert.equal(f.check().length,0)});
test('cargo sem vínculo GHE e distribuição divergente bloqueiam',()=>{const f=fixture();f.ctx.selectedRiskMode='ghe';f.ctx.employeeCountInput.value='2';assert.equal(f.check().length,2)});
