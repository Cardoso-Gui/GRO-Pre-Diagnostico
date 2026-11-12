import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderReviewStage} from '../review-stage.js';
test('technical review is distinct from mandatory data and does not add a completion gate',()=>{
 const dom=new JSDOM('<div id="review-stage-content"></div><button id="generate-report-button"></button><p id="review-generation-hint"></p>');const previous={document:globalThis.document,GRO_FORM:globalThis.GRO_FORM,GRO_CLOUD:globalThis.GRO_CLOUD,GRO_WIZARD:globalThis.GRO_WIZARD};
 try{
  globalThis.document=dom.window.document;globalThis.GRO_CLOUD={};globalThis.GRO_WIZARD={go(){}};
  globalThis.GRO_FORM={review:()=>({answers:{currentCompany:{razao_social:'Synthetic review'},selectedSectors:[],riskSourcesBySelection:[['source__a__r',{measure:'Sim'}]]},targets:[{id:'a',title:'Synthetic group'}],selections:[{targetId:'a',targetTitle:'Synthetic group',risk:{code:'r',name:'Synthetic risk'}}],missing:[]})};
  renderReviewStage();assert.equal(document.querySelector('#generate-report-button').disabled,false);assert.match(document.querySelector('.review-readiness').textContent,/Conferência técnica/);assert.match(document.querySelector('.review-readiness').textContent,/não representa uma aprovação técnica/);assert.equal(document.querySelector('.review-readiness button').textContent,'Synthetic group / Synthetic risk');
  globalThis.GRO_FORM={review:()=>({answers:{currentCompany:{razao_social:'Synthetic pending'},selectedSectors:[]},targets:[],selections:[],missing:[{section:'Dimensionamento',destination:'#employee-count',text:'Informe funcionários.'}]})};renderReviewStage();assert.equal(document.querySelector('#generate-report-button').disabled,true);
  globalThis.GRO_CLOUD={rectification:true};globalThis.GRO_FORM={review:()=>({answers:{currentCompany:{razao_social:'Synthetic rectification'},selectedSectors:[]},targets:[],selections:[],missing:[{section:'Dimensionamento',destination:'#employee-count',text:'Pendência anterior.'}]})};renderReviewStage();assert.equal(document.querySelector('#generate-report-button').disabled,false);assert.match(document.querySelector('#review-generation-hint').textContent,/Pendências anteriores/);
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});
