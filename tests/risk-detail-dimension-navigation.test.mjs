import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const validator = source.slice(source.indexOf('function getReportMissingFields('), source.indexOf('function validateReport()'));
const section = source.slice(source.indexOf("button.id='open-risk-details'"));
const handler = section.slice(section.indexOf('button.onclick='), section.indexOf('riskSourceGrid.append(note,button);'));
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
  test(`detalhamento permite completar depois a quantidade de funcionários: ${JSON.stringify(employees)}`, async () => {
    const {ctx, calls} = fixture({employees});
    await ctx.button.onclick();
    assert.equal(calls.errors.length, 0);
    assert.equal(calls.save, 1);
    assert.equal(calls.navigation.length, 1);
    assert.ok(ctx.getReportMissingFields().includes('Informe o número de funcionários.'));
  });
}
test('detalhamento permite rascunho com empresa e vínculos pendentes sem liberar o relatório', async () => {
  const {ctx, calls} = fixture();
  ctx.currentCompany = null;
  ctx.gheList[0].linkedJobs = [];
  await ctx.button.onclick();
  assert.equal(calls.errors.length, 0);
  assert.equal(calls.save, 1);
  assert.equal(calls.navigation.length, 1);
  const missing = ctx.getReportMissingFields();
  assert.ok(missing.includes('Selecione a empresa.'));
  assert.ok(missing.some(item => item.includes('vincule')));
});
test('dimensionamento calculado continua válido na validação final', () => {
  const {ctx} = fixture({cipa: 'Sem comissão nesta faixa', sesmt: 'Sem equipe'});
  assert.equal(ctx.getReportMissingFields().length, 0);
});

test('cargos sem vínculo não impedem detalhar um GHE já selecionado', async () => {
  const {ctx, calls} = fixture();
  ctx.jobsBySector.get('A').push({name: 'Cargo sem GHE', quantity: 1, activities: ''});
  ctx.selectedSectorNames.add('Setor incompleto');
  ctx.gheList.push({id: 'ghe-b', name: 'Outro GHE', linkedJobs: []});
  ctx.getRiskTargets = () => [{id: 'ghe-a', title: 'GHE A'}, {id: 'ghe-b', title: 'Outro GHE'}];
  ctx.getSelectedRiskCodes = id => new Set(id === 'ghe-a' ? ['ERG.002'] : []);
  const before = Array.from(ctx.getReportMissingFields());
  assert.ok(before.some(text => text.includes('Cargo sem GHE: vincule')));
  assert.ok(before.some(text => text.includes('Cargo sem GHE: descreva')));
  assert.ok(before.some(text => text.includes('Setor incompleto: adicione')));
  assert.ok(before.some(text => text.includes('Outro GHE: vincule')));
  assert.ok(before.some(text => text.includes('Outro GHE: selecione')));
  await ctx.button.onclick();
  assert.equal(calls.errors.length, 0);
  assert.equal(calls.save, 1);
  assert.match(calls.navigation[0], /&target=ghe-a&risk=$/);
  assert.deepEqual(Array.from(ctx.getReportMissingFields()), before);
});

test('atalho de revisão preserva risco e cargo solicitados mesmo com outras pendências', async () => {
  const {ctx, calls} = fixture();
  ctx.selectedRiskMode = 'job';
  ctx.button.dataset = {target: 'job__A & B', risk: 'ERG.002'};
  await ctx.button.onclick();
  assert.match(calls.navigation[0], /&target=job__A%20%26%20B&risk=ERG.002$/);
});

test('sem acesso ao salvamento não tenta navegar', async () => {
  const {ctx, calls} = fixture();
  ctx.GRO_CLOUD = null;
  await ctx.button.onclick();
  assert.equal(calls.save, 0);
  assert.equal(calls.navigation.length, 0);
  assert.equal(ctx.button.disabled, false);
});

for (const saved of [null, false]) {
  test(`salvamento não confirmado (${saved}) mantém a página e permite tentar novamente`, async () => {
    const {ctx, calls} = fixture();
    ctx.GRO_CLOUD.save = async () => {calls.save++; return saved;};
    await ctx.button.onclick();
    assert.equal(calls.save, 1);
    assert.equal(calls.navigation.length, 0);
    assert.equal(ctx.button.disabled, false);
    ctx.GRO_CLOUD.save = async () => ({id: 'retry'});
    await ctx.button.onclick();
    assert.match(calls.navigation[0], /id=retry/);
  });
}

test('erro inesperado de salvamento não navega e libera nova tentativa', async () => {
  const {ctx, calls} = fixture();
  ctx.GRO_CLOUD.save = async () => {throw Error('Falha simulada');};
  await assert.rejects(ctx.button.onclick(), /Falha simulada/);
  assert.equal(calls.navigation.length, 0);
  assert.equal(ctx.button.disabled, false);
});

test('cliques repetidos aguardam um único salvamento e mantêm o destino original', async () => {
  const {ctx, calls} = fixture();
  let resolveSave;
  ctx.GRO_CLOUD.save = () => {calls.save++; return new Promise(resolve => {resolveSave = resolve;});};
  const first = ctx.button.onclick();
  assert.equal(ctx.button.disabled, true);
  ctx.button.dataset.target = 'ghe-b';
  ctx.button.dataset.risk = 'FIS.002';
  await ctx.button.onclick();
  assert.equal(calls.save, 1);
  assert.equal(calls.navigation.length, 0);
  resolveSave({id: 'saved'});
  await first;
  assert.equal(calls.navigation.length, 1);
  assert.match(calls.navigation[0], /&target=ghe-a&risk=$/);
  assert.equal(ctx.button.disabled, false);
});
