// All queries use the authenticated client and existing RLS policies.
export const pageSize = 20;
export const companyColumns = 'id,legal_name,trade_name,cnpj,occurrences(count)';
export const occurrenceColumns = 'id,kind,occurred_on,description,photo_path,created_at,created_by,team_members(display_name)';

// Keep the original accent-insensitive search without adding a database function.
// Only authorized, non-archived company metadata and server-side counts are loaded.
export function companyQuery(client, offset = 0) {
 return client.from('clients').select(companyColumns).eq('archived', false).order('legal_name').order('id').range(offset, offset + 199);
}
export async function fetchCompanies(client) {
 const companies = [];
 for (let offset = 0; ; offset += 200) {
  const {data, error} = await companyQuery(client, offset);
  if (error) throw error;
  companies.push(...data);
  if (data.length < 200) return companies;
 }
}
export function filterCompanies(companies, search = '') {
 const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
 const query = normalize(search.trim()), cnpj = query.replace(/[^a-z0-9]/g, '');
 return companies.filter(company => !query || normalize(company.legal_name + ' ' + (company.trade_name || '')).includes(query) || (cnpj && normalize(company.cnpj).replace(/[^a-z0-9]/g, '').includes(cnpj)));
}
export function historyQuery(client, clientId, filters, offset = 0) {
 let query = client.from('occurrences').select(occurrenceColumns, {count: 'exact'}).eq('client_id', clientId);
 if (filters.kind) query = query.eq('kind', filters.kind);
 if (filters.from) query = query.gte('occurred_on', filters.from);
 if (filters.to) query = query.lte('occurred_on', filters.to);
 return query.order('occurred_on', {ascending: false}).order('created_at', {ascending: false}).order('id').range(offset, offset + pageSize);
}
export function totalQuery(client, clientId) {
 return client.from('occurrences').select('id', {count: 'exact', head: true}).eq('client_id', clientId);
}
export function formatCnpj(value) {
 const cnpj = String(value || '');
 return cnpj.length === 14 ? cnpj.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\w{2})$/, '$1.$2.$3/$4-$5') : cnpj;
}
export function countLabel(count) { return `${count} ocorrência${count === 1 ? '' : 's'}`; }
export function companyCount(company) {
 const count = company.occurrences?.[0]?.count;
 return Number.isInteger(count) && count >= 0 ? count : null;
}
