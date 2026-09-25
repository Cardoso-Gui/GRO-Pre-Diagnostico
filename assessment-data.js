export function companyFromClient(client) {
 const a=client.address || {};
 return {cnpj:client.cnpj || '',razao_social:client.legal_name,nome_fantasia:client.trade_name || '',cnae_fiscal:client.cnae || '',logradouro:a.street || '',numero:a.number || '',complemento:a.complement || '',bairro:a.district || '',municipio:a.city || '',uf:a.state || '',cep:a.postal_code || '',ddd_telefone_1:client.contact_phone || '',email:client.contact_email || '',descricao_situacao_cadastral:'Cadastro da equipe'};
}
export async function saveAssessment(client, row, answers) {
 const {data,error}=await client.from('assessments').update({answers}).eq('id',row.id).eq('revision',row.revision).eq('status','draft').select('id,revision,updated_at').maybeSingle();
 if(error) throw new Error('Não foi possível confirmar o salvamento. Mantenha esta página aberta e tente novamente.');
 if(!data) throw new Error('Este rascunho foi alterado por outra pessoa ou ficou indisponível. Suas respostas continuam nesta tela. Abra o levantamento em outra aba para comparar antes de recarregar.');
 return {...row,...data,answers};
}

