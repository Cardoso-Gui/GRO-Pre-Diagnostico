import test from 'node:test';
import assert from 'node:assert/strict';
import {riskDetailStatus} from '../risk-detail-status.js';
const complete={source:'Máquina',frequency:'Diária',duration:'2h',damage:'Danos',measures:'Proteções',measure:'Sim'};
test('status depende de todos os campos obrigatórios, sem exigir melhoria opcional',()=>{assert.equal(riskDetailStatus(),'Pendente');assert.equal(riskDetailStatus({source:' '}),'Pendente');assert.equal(riskDetailStatus({source:'Máquina'}),'Em preenchimento');assert.equal(riskDetailStatus(complete),'Preenchido');for(const key of Object.keys(complete))assert.equal(riskDetailStatus({...complete,[key]:''}),'Em preenchimento');});
test('detalhamento independe dos EPIs, preenchidos na etapa 6',()=>{assert.equal(riskDetailStatus({...complete,controls:[false,false,true]}),'Preenchido');assert.equal(riskDetailStatus(complete,{applicable:'Sim',items:[]}),'Preenchido');assert.equal(riskDetailStatus({controls:[false,false,true]}),'Pendente');});
