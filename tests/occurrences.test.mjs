import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pageSize, companyQuery, fetchCompanies, filterCompanies, historyQuery, totalQuery, formatCnpj, countLabel, companyCount} from '../occurrences-data.js';

function recorder() {
 const calls = [];
 const query = {};
 for (const method of ['from', 'select', 'eq', 'order', 'or', 'range', 'gte', 'lte']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
 return {calls, query};
}
test('company query uses an embedded server aggregate, including companies with zero occurrences', () => {
 const {calls, query} = recorder();
 companyQuery(query);
 assert.deepEqual(calls, [
  ['from', 'clients'], ['select', 'id,legal_name,trade_name,cnpj,occurrences(count)'],
  ['eq', 'archived', false], ['order', 'legal_name'], ['order', 'id'], ['range', 0, 199]
 ]);
 assert.equal(companyCount({occurrences: [{count: 0}]}), 0);
 assert.equal(companyCount({occurrences: [{count: 1250}]}), 1250);
});
test('missing or invalid count never pretends a company has zero occurrences', () => {
 for (const company of [{}, {occurrences: []}, {occurrences: [{count: null}]}, {occurrences: [{count: -1}]}]) assert.equal(companyCount(company), null);
});
test('company search preserves accents, legal/trade names and formatted CNPJ matching', () => {
 const companies = [
  {id: 'a', legal_name: 'São José Indústria', trade_name: 'Ação e Proteção', cnpj: '12345678000190'},
  {id: 'b', legal_name: 'Beta Serviços', cnpj: 'AB123456000190'}
 ];
 for (const search of ['sao jose', 'SÃO JOSÉ', '  acao e protecao  ', '12.345.678/0001-90', '12345678000190']) assert.deepEqual(filterCompanies(companies, search).map(row => row.id), ['a']);
 assert.deepEqual(filterCompanies(companies, 'AB.123.456/0001-90').map(row => row.id), ['b']);
 assert.equal(filterCompanies(companies, 'inexistente').length, 0);
 assert.equal(filterCompanies(companies, '  ').length, 2);
 assert.equal(filterCompanies(companies, '%').length, 0);
});
test('all authorized companies are fetched across 200-row batches before filtering', async () => {
 const {calls, query} = recorder();
 let page = 0;
 query.then = resolve => resolve({data: Array.from({length: page++ === 0 ? 200 : 1}, (_, id) => ({id})), error: null});
 assert.equal((await fetchCompanies(query)).length, 201);
 assert.deepEqual(calls.filter(([method]) => method === 'range'), [['range', 0, 199], ['range', 200, 399]]);
});
test('a failed company batch cannot return partial counts or pretend no companies exist', async () => {
 const {query} = recorder();
 query.then = resolve => resolve({data: null, error: Error('offline')});
 await assert.rejects(fetchCompanies(query), /offline/);
});
test('history filters are applied on server before deterministic date pagination', () => {
 const {calls, query} = recorder();
 historyQuery(query, 'company-a', {kind: 'Incidente', from: '2026-10-01', to: '2026-10-19'}, 20);
 assert.deepEqual(calls.slice(2), [
  ['eq', 'client_id', 'company-a'], ['eq', 'kind', 'Incidente'], ['gte', 'occurred_on', '2026-10-01'], ['lte', 'occurred_on', '2026-10-19'],
  ['order', 'occurred_on', {ascending: false}], ['order', 'created_at', {ascending: false}], ['order', 'id'], ['range', 20, 40]
 ]);
 assert.deepEqual(calls[1][2], {count: 'exact'});
 assert.equal(pageSize, 20);
});
test('unfiltered history never adds kind or date restrictions', () => {
 const {calls, query} = recorder();
 historyQuery(query, 'company-b', {kind: '', from: '', to: ''});
 assert.deepEqual(calls.filter(([method]) => ['eq', 'gte', 'lte'].includes(method)), [['eq', 'client_id', 'company-b']]);
});
test('company total is independent of history filters and pagination and fetches no record content', () => {
 const {calls, query} = recorder();
 totalQuery(query, 'company-a');
 assert.deepEqual(calls, [['from', 'occurrences'], ['select', 'id', {count: 'exact', head: true}], ['eq', 'client_id', 'company-a']]);
});
test('CNPJ and counts use Brazilian formatting with explicit zeros and singular', () => {
 assert.equal(formatCnpj('12345678000190'), '12.345.678/0001-90');
 assert.equal(formatCnpj('AB123456000190'), 'AB.123.456/0001-90');
 assert.equal(formatCnpj(null), '');
 assert.equal(formatCnpj('unknown'), 'unknown');
 assert.equal(countLabel(0), '0 ocorrências');
 assert.equal(countLabel(1), '1 ocorrência');
 assert.equal(countLabel(28), '28 ocorrências');
});
test('occurrences keeps shared header assets, the existing insert scope, and no workflow controls', () => {
 const html = fs.readFileSync(new URL('../occurrences.html', import.meta.url), 'utf8');
 const js = fs.readFileSync(new URL('../occurrences.js', import.meta.url), 'utf8');
 assert.match(html, /shared-header\.css\?v=20261019-menu1/);
 assert.match(html, /shared-header\.js\?v=20261019-menu1/);
 assert.match(js, /from '\.\/app-header\.js\?v=20261019-access1'/);
 assert.match(html, /<dialog id="occ-dialog" aria-labelledby="form-heading"/);
 assert.doesNotMatch(js, /\.from\('occurrences'\)\.(delete|update|upsert)/);
 assert.doesNotMatch(js, /service_role|security.definer/i);
});
