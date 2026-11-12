import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {assessmentIndex,normalizeSearch,mountAssessmentTools} from '../assessment-tools.js';
import {reviewPending} from '../review-model.js';
test('search indexes current sectors and cargos, disambiguates repeated jobs, and normalizes accents',()=>{
 const answers={selectedSectors:['Manutenção','Limpeza'],jobsBySector:[['Manutenção',[{name:'Auxiliar'}]],['Limpeza',[{name:'Auxiliar'}]],['Removido',[{name:'Antigo'}]]],gheList:[{id:'g1',name:'Operação'}]};
 const before=JSON.stringify(answers),index=assessmentIndex(answers);assert.equal(index.length,5);assert.equal(index.filter(x=>x.name==='Auxiliar').length,2);assert.ok(index.some(x=>normalizeSearch(x.name)==='manutencao'));assert.ok(!index.some(x=>x.name==='Antigo'));assert.equal(JSON.stringify(answers),before);
});
test('shared pending model includes visit responsibility without mutating validation results',()=>{
 const raw={missing:[{section:'Dimensionamento',destination:'#employee-count',text:'Informe o total.'}]};const first=reviewPending(raw,{valid:false});const second=reviewPending(raw,{valid:false});assert.equal(first.length,2);assert.equal(second.length,2);assert.equal(raw.missing.length,1);assert.equal(reviewPending(raw,{valid:true}).length,1);
});
test('search expands only the selected sector and preserves existing form values',()=>{
 const dom=new JSDOM('<div class="wizard-layout"></div><article class="job-card"><div class="sector-card-header"><h3>Manutenção</h3><button class="sector-collapse-button" aria-expanded="false"></button></div><div class="job-edit-row"><div class="job-card-header"><strong>Auxiliar</strong></div><textarea>Texto existente</textarea></div></article>');
 const d=dom.window.document;dom.window.HTMLElement.prototype.scrollIntoView=function(){};let step,expanded=0;
 d.querySelector('button').addEventListener('click',()=>expanded++);
 const previous=globalThis.GRO_FORM;globalThis.GRO_FORM={review:()=>({answers:{selectedSectors:['Manutenção'],jobsBySector:[['Manutenção',[{name:'Auxiliar'}]]]},missing:[]})};
 try{const tools=mountAssessmentTools({doc:d,go:i=>step=i});tools.loaded();const field=d.querySelector('#assessment-find');field.value='auxiliar';field.dispatchEvent(new dom.window.Event('input'));d.querySelector('.assessment-find-results button').click();assert.equal(step,2);assert.equal(expanded,1);assert.equal(d.querySelector('textarea').value,'Texto existente');d.querySelector('.assessment-pending-body>button').click();assert.match(d.querySelector('.assessment-pending-count').textContent,/preenchidos/);}finally{globalThis.GRO_FORM=previous;dom.window.close();}
});
