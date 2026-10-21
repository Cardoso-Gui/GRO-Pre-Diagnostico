import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const validator = source.slice(source.indexOf('function getReportMissingFields('), source.indexOf('function validateReport()'));
const handler = source.split('\n').find(line => line.includes('button.onclick=async()=>') && line.includes('risk-detail.html'));
function fixture({cipa = 'Cálculo pendente', sesmt = 'Cálculo pendente', employees = '1'} = {}) {
  const calls = {save: 0, navigation: [], errors: []};
  const ctx = vm.createContext({
    visitDateInput: {value: ''}, GRO_VISIT_DATE: {invalidField: () => false},
    currentCompany: {}, employeeCountInput: {value: employees}, selectedSectorNames: new Set(['A']),
    jobsBySector: new Map([['A', [{name: 'Cargo', quantity: 1, activities: 'Atividade'}]]]),
    selectedRiskMode: 'ghe', gheList: [{id: 'ghe-a', name: 'GHE A', linkedJobs: [{sectorName: 'A', jobName: 'Cargo'}]}],
    getRiskTargets: () => [{id: 'ghe-a', title: 'GHE A'}], getSelectedRiskCodes: () => new Set(['ERG.002']),
    dimensionFields: {cipaSummary: {textContent: cipa}, sesmtSummary: {textContent: sesmt}},
    getRiskSelections: () => [{targetId: 'ghe-a', targetTitle: 'GHE A', risk: {code: 'ERG.002', name: 'Sentado'}}],
    getRiskSourceData: () => ({source: 'Mesa', frequency: 'Diária', duration: '2h', damage: 'Dano', measures: 'Pausas', measure: 'Não'}),
    getEpiData: () => ({applicable: 'Não', items: []}),
    button: {dataset: {target: 'ghe-a', risk: ''}, disabled: false},
    GRO_VALIDATE: {show: items => {calls.errors = items; return !items.length;}},
    GRO_CLOUD: {save: async () => {calls.save++; return {id: 'draft-fixture'};}},
    getDraft: () => ({fixture: true}), document: {querySelector: () => ({})},
    location: {assign: url => calls.navigation.push(url)}, encodeURIComponent,
  });
  vm.runInContext(validator, ctx);
  vm.runInContext(handler, ctx);
  return {ctx, calls};
}
for (const state of [
  {cipa: 'Cálculo pendente', sesmt: 'Sem equipe'},
  {cipa: 'Revisão técnica necessária', sesmt: 'Sem equipe'},
  {cipa: 'Sem comissão', sesmt: 'Cálculo pendente'},
]) {
  test(`detalhamento permite dimensionamento pendente (${state.cipa}; ${state.sesmt}), mas validação final mantém bloqueio`, async () => {
    const {ctx, calls} = fixture(state);
    assert.ok(ctx.getReportMissingFields().includes('Calcule ou revise o dimensionamento.'));
    await ctx.button.onclick();
    assert.equal(calls.errors.length, 0);
    assert.equal(calls.save, 1);
    assert.match(calls.navigation[0], /risk-detail\.html\?id=draft-fixture&target=ghe-a&risk=$/);
    assert.equal(ctx.button.disabled, false);
    assert.ok(ctx.getReportMissingFields().includes('Calcule ou revise o dimensionamento.'));
  });
}
for (const employees of ['', '0', '-1', '1.5', 'texto']) {
  test(`detalhamento continua bloqueando quantidade de funcionários inválida: ${JSON.stringify(employees)}`, async () => {
    const {ctx, calls} = fixture({employees});
    await ctx.button.onclick();
    assert.ok(calls.errors.some(item => item.text === 'Informe o número de funcionários.'));
    assert.equal(calls.save, 0);
    assert.equal(calls.navigation.length, 0);
  });
}
test('dispensa de cálculo não dispensa empresa e vínculos obrigatórios', async () => {
  const {ctx, calls} = fixture();
  ctx.currentCompany = null;
  ctx.gheList[0].linkedJobs = [];
  await ctx.button.onclick();
  assert.ok(calls.errors.some(item => item.text === 'Selecione a empresa.'));
  assert.ok(calls.errors.some(item => item.text.includes('vincule')));
  assert.equal(calls.save, 0);
});
test('dimensionamento calculado continua válido na validação final', () => {
  const {ctx} = fixture({cipa: 'Sem comissão nesta faixa', sesmt: 'Sem equipe'});
  assert.equal(ctx.getReportMissingFields().length, 0);
});
