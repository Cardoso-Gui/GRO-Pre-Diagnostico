import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM,VirtualConsole} from 'jsdom';
import {fixture} from './helpers/rectification-fixture.mjs';
import {applyBusinessChanges} from '../report-rectification.js';
import {overlayReportDocument} from '../report-document-overlay.js';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const files=['cnae-descriptions.js','cnae-risk-map.js','esocial-risk-table.js','occupational-risk-table.js','training-rules.js','nr-report-rules.js','dimension-data.js','report-opening.js','visit-date.js','script.js'];
function buildDoc(t,answers){const dom=new JSDOM(read('levantamento.html'),{url:'https://synthetic.example.test/levantamento.html',runScripts:'outside-only'});t.after(()=>dom.window.close());const context=dom.getInternalVMContext();context.GRO_CLOUD={rectification:true};for(const file of files)vm.runInContext(read(file),context);context.GRO_FORM.restore(structuredClone(answers));return JSON.parse(JSON.stringify(context.GRO_FORM.document().report_document));}
async function report(t,{original=false,fail=false}={}){
 const base=fixture(),source=base.assessment.final_snapshot.answers;const originalDoc=buildDoc(t,source);base.assessment.final_snapshot.answers.report_document=originalDoc;
 const detail=structuredClone(source.riskSourcesBySelection);detail[0][1].improve='Melhoria retificada <img src=x onerror=alert(1)>';
 const patch={answers:{visitDate:'2024-02-29',riskSourcesBySelection:detail},client:{trade_name:'Nome corrigido'}};
 const assessment=applyBusinessChanges(base.assessment,patch),generated=buildDoc(t,assessment.final_snapshot.answers);
 const history=[{sequence:1,actor_name:'Administrador sintético',created_at:'2026-01-02T00:00:00Z',reason:'Motivo sintético',changes:[{path:'/answers/visitDate',before:null,after:'2024-02-29'},{path:'/client/trade_name',before:'Teste',after:'Nome corrigido'},{path:'/answers/riskSourcesBySelection',before:source.riskSourcesBySelection,after:detail}]}];
 const state={assessment:original?base.assessment:assessment,sequence:1,history,can_rectify:true,original_report_document:originalDoc};
 const dom=new JSDOM(read('report.html'),{url:'https://synthetic.example.test/report.html?id='+assessment.id+(original?'&original=1':''),runScripts:'outside-only',virtualConsole:new VirtualConsole()});t.after(()=>dom.window.close());const win=dom.window,context=dom.getInternalVMContext();context.structuredClone=structuredClone;
 win.HTMLElement.prototype.scrollIntoView=()=>{};win.HTMLDialogElement.prototype.close=function(){this.open=false;};win.print=()=>{};
 const stubs={
  'auth-client.js':{authClient:{rpc:async(name,args)=>{assert.equal(name,'read_assessment_report');assert.equal(args.p_original,original);return fail?{error:{code:'network'}}:{data:structuredClone(state)};},auth:{onAuthStateChange(){},signOut:async()=>{}}},getTeamMember:async()=>({member:{user_id:'user',display_name:'Sintético',role:'admin'}})},
  'app-header.js':{updateHeader(){}},'page-resume.js':{watchPageResume(){}},'workstation-photos.js':{hydrateReportPhotos:async()=>{}},
  'report-generator.js':{generateEffectiveDocument:async(answers,options)=>{assert.equal(answers.visitDate,'2024-02-29');return overlayReportDocument(options.originalDocument,generated,options.changes);}}
 };
 const cache=new Map();async function module(name){name=name.replace(/^\.\//,'').split('?')[0];if(cache.has(name))return cache.get(name);const result=stubs[name]?new vm.SyntheticModule(Object.keys(stubs[name]),function(){for(const [key,value]of Object.entries(stubs[name]))this.setExport(key,value);},{context,identifier:name}):new vm.SourceTextModule(read(name),{context,identifier:name});cache.set(name,result);await result.link(specifier=>module(specifier));return result;}
 await(await module('report.js')).evaluate();return win;
}

test('leitura efetiva, painel e conteúdo imprimível mostram os mesmos dados corrigidos',async t=>{
 const win=await report(t),content=win.document.querySelector('#report-content');assert.equal(content.hidden,false);assert.equal(win.document.querySelector('#report-print').disabled,false);assert.match(content.textContent,/Melhoria retificada/);assert.doesNotMatch(content.textContent,/Ajustar bancada/);assert.match(content.textContent,/29\/02\/2024/);assert.match(win.document.querySelector('#report-overview').textContent,/Nome corrigido/);assert.match(win.document.querySelector('#report-dates').textContent,/Revisão 00/);assert.equal(content.querySelector('img[src="x"]'),null);assert.ok([...win.document.querySelectorAll('.report-toolbar a')].some(a=>a.textContent==='Retificar'));assert.match(win.document.querySelector('.rectification-history').textContent,/Motivo sintético/);
});
test('original preservado abre original sem misturar a retificação',async t=>{
 const win=await report(t,{original:true}),content=win.document.querySelector('#report-content');assert.equal(content.hidden,false);assert.match(content.textContent,/Ajustar bancada/);assert.doesNotMatch(content.textContent,/Melhoria retificada/);assert.match(win.document.querySelector('#report-status').textContent,/Conteúdo original preservado/);assert.equal([...win.document.querySelectorAll('.report-toolbar a')].some(a=>a.textContent==='Retificar'),false);
});
test('erro ao verificar histórico mantém impressão e conteúdo bloqueados',async t=>{
 const win=await report(t,{fail:true});assert.equal(win.document.querySelector('#report-content').hidden,true);assert.equal(win.document.querySelector('#report-print').disabled,true);assert.match(win.document.querySelector('#report-status').textContent,/visualização foi interrompida/);
});
