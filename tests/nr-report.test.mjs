import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../nr-report-rules.js', import.meta.url), 'utf8');
function matches(nr, risks, cnae = '') {
  const ctx = vm.createContext({ getCurrentCnaeText: () => ({digits:cnae,description:'Plataforma e escada'}), risks, nr });
  vm.runInContext(rules + '\n' + script.slice(script.indexOf('function getGenericRuleMatches('), script.indexOf('function createReportBlock(')) + '\nresult=getGenericRuleMatches(NR_REPORT_RULES.find(r=>r.nr===nr),risks)', ctx);
  return Array.from(ctx.result);
}
test('NR35 não aparece por palavras no cargo ou CNAE, nem queda de mesmo nível', () => {
  assert.deepEqual(matches('NR-35',[{risk:{code:'ACI.001',name:'Queda de mesmo nível',group:'Acidentes'},targetTitle:'Plataforma em altura'}], '4120400'), []);
});
test('NR35 tem critério somente com risco de queda de altura selecionado', () => {
  assert.deepEqual(matches('NR-35',[{risk:{code:'ACI.002',name:'Queda de altura',group:'Acidentes'}}]), ['Queda de altura']);
});
test('controle sanitário não inclui NR09 como agente biológico ocupacional', () => {
  assert.deepEqual(matches('NR-09',[{risk:{code:'SAN.001',name:'Contaminação dos alimentos',group:'Biológicos'}}]), []);
});
test('preserva critérios de risco e de atividade econômica', () => {
  assert.deepEqual(matches('NR-09',[{risk:{code:'02.01.001',name:'Ruído',group:'Físicos'}}]), ['Físicos']);
  assert.deepEqual(matches('NR-32',[], '8630502'), ['CNAE da empresa']);
});
