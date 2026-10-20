import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../visit-date.js';
const source=fs.readFileSync(new URL('../script.js',import.meta.url),'utf8');
function fixture(){
 const detail={source:'Máquina',frequency:'Diária',duration:'2h',damage:'Dano',measures:'Nenhuma',measure:'Não'};
 const epi={applicable:'Não',items:[]};
 const ctx=vm.createContext({visitDateInput:{value:'',validity:{badInput:false}},GRO_VISIT_DATE:globalThis.GRO_VISIT_DATE,currentCompany:{},employeeCountInput:{value:'1'},selectedSectorNames:new Set(['A']),jobsBySector:new Map([['A',[{name:'Cargo',quantity:1,activities:'Atividade'}]]]),selectedRiskMode:'job',gheList:[],getRiskTargets:()=>[{id:'a',title:'Cargo'}],getSelectedRiskCodes:()=>new Set(['x']),dimensionFields:{cipaSummary:{textContent:'Sem comissão'},sesmtSummary:{textContent:'Sem equipe'}},getRiskSelections:()=>[{targetId:'a',targetTitle:'Cargo',risk:{code:'x',name:'Risco'}}],getRiskSourceData:()=>detail,getEpiData:()=>epi});
 vm.runInContext(source.slice(source.indexOf('function getReportMissingFields('),source.indexOf('function validateReport()')),ctx);
 return {ctx,detail,epi,check:()=>ctx.getReportMissingFields()};
}
test('dados completos e resposta Não permitem gerar',()=>assert.equal(fixture().check().length,0));
test('pendência de EPI aponta para etapa 6, sem abrir o detalhamento',()=>{const f=fixture();f.epi.applicable='';const missing=f.ctx.getReportMissingFields(true);assert.equal(missing[0].section,'EPIs');assert.equal(missing[0].destination,'#wizard-epi');assert.equal(missing[0].riskTarget,'');});
test('medição em branco bloqueia; Sim não exige valor quantitativo',()=>{const f=fixture();f.detail.measure='';assert.ok(f.check().some(x=>x.includes('medir/avaliar')));f.detail.measure='Sim';assert.equal(f.check().length,0)});
test('EPI Sim exige equipamento e fonte em branco bloqueia',()=>{const f=fixture();f.epi.applicable='Sim';f.detail.source=' ';assert.equal(f.check().length,2)});
test('ausência oficial dispensa detalhamento',()=>{const f=fixture();f.ctx.getRiskSelections=()=>[{risk:{code:'09.01.001'}}];assert.equal(f.check().length,0)});
test('cargo sem vínculo GHE e distribuição divergente bloqueiam',()=>{const f=fixture();f.ctx.selectedRiskMode='ghe';f.ctx.employeeCountInput.value='2';assert.equal(f.check().length,2)});

test('detalhar riscos permite total divergente, mas gerar relatório bloqueia',()=>{
 const f=fixture();f.ctx.employeeCountInput.value='2';
 assert.ok(f.check().some(x=>x.includes('quantidade distribuída')));
 assert.equal(f.ctx.getReportMissingFields(true,{checkEmployeeDistribution:false}).length,0);
 f.ctx.currentCompany=null;
 assert.ok(f.ctx.getReportMissingFields(true,{checkEmployeeDistribution:false}).some(x=>x.text==='Selecione a empresa.'));
});
test('criar GHE bloqueia nomes repetidos e não altera vínculos existentes',()=>{
 for(const name of ['Produção',' produção ','PRODUCAO','Novo GHE','  ']){
 let submit,errors;const existing={id:'original',name:'Produção',linkedJobs:[{sectorName:'A',jobName:'Operador'}]};
 const ctx=vm.createContext({gheForm:{addEventListener:(_,fn)=>submit=fn},gheNameInput:{value:name},gheList:[existing],
 normalizeSectorName:x=>x.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu,''),
 GRO_VALIDATE:{show:items=>{errors=items;return !items.length;}},renderRiskSelection:()=>{},createTargetId:()=> 'new'});
 vm.runInContext(source.slice(source.indexOf('gheForm.addEventListener("submit"'),source.indexOf('generateReportButton.addEventListener')),ctx);
 submit({preventDefault(){}});
 assert.equal(ctx.gheList.length,name==='Novo GHE'?2:1);
 assert.equal(errors.length,name==='Novo GHE'?0:1);
 assert.equal(existing.linkedJobs.length,1);
 if(name==='Novo GHE')assert.equal(ctx.gheList[1].linkedJobs.length,0);
 }
});

test('data da visita é opcional; somente data preenchida inválida ou incompleta bloqueia',()=>{
 const f=fixture();assert.equal(f.check().length,0);
 f.ctx.visitDateInput.value='2026-02-30';assert.ok(f.ctx.getReportMissingFields(true).some(item=>item.destination==='#visit-date'));
 f.ctx.visitDateInput.value='2026-09-29';assert.equal(f.check().length,0);
 f.ctx.visitDateInput.value='';f.ctx.visitDateInput.validity.badInput=true;assert.ok(f.check().some(item=>item.includes('data de visita válida')));
});
