export function mapCompany(data, cnpj) {
  if (!data || String(data.cnpj).replace(/[.\/\s-]/g, '').toUpperCase() !== cnpj || typeof data.razao_social !== 'string' || !data.razao_social.trim()) throw new Error('A consulta retornou dados incompletos. Preencha manualmente ou tente novamente.');
  const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  return { legal_name: text(data.razao_social), trade_name: text(data.nome_fantasia), cnae: (text(data.cnae_fiscal) ? text(data.cnae_fiscal).padStart(7, '0') : ''),
    street: [text(data.descricao_tipo_de_logradouro), text(data.logradouro)].filter(Boolean).join(' '), number: text(data.numero), complement: text(data.complemento), district: text(data.bairro), city: text(data.municipio), state: text(data.uf).toUpperCase(), postal_code: text(data.cep).replace(/\D/g, ''), contact_phone: text(data.ddd_telefone_1), contact_email: text(data.email) };
}
export async function lookupCompany(value, fetcher = fetch) {
  const cnpj = value.replace(/[.\/\s-]/g, '').toUpperCase();
  if (!/^\d{14}$/.test(cnpj)) throw new Error('Informe o CNPJ completo para consultar: 14 números.');
  let response;
  try { response = await fetcher(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {signal: AbortSignal.timeout(15000), credentials:'omit', referrerPolicy:'no-referrer'}); }
  catch { throw new Error('Não foi possível consultar agora. Tente novamente ou preencha os dados manualmente.'); }
  if (!response.ok) throw new Error(response.status === 404 ? 'CNPJ não encontrado. Confira o número ou preencha manualmente.' : response.status === 429 ? 'Muitas consultas no momento. Aguarde um pouco ou preencha manualmente.' : 'Serviço de consulta indisponível. Você pode preencher manualmente.');
  let data; try { data = await response.json(); } catch { throw new Error('Resposta inválida da consulta. Você pode preencher manualmente.'); }
  return mapCompany(data, cnpj);
}


