export function clientOptionLabel(client) {
 const name = client.trade_name?.trim() || client.legal_name;
 const cnpj = (client.cnpj || '').replace(/\D/g, '');
 const formatted = cnpj.length === 14 ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : client.cnpj;
 return formatted ? `${name} — ${formatted}` : name;
}
export function companyFromClient(client) {
 const a=client.address || {};
 return {cnpj:client.cnpj || '',razao_social:client.legal_name,nome_fantasia:client.trade_name || '',cnae_fiscal:client.cnae || '',logradouro:a.street || '',numero:a.number || '',complemento:a.complement || '',bairro:a.district || '',municipio:a.city || '',uf:a.state || '',cep:a.postal_code || '',contact_name:client.contact_name || '',ddd_telefone_1:client.contact_phone || '',email:client.contact_email || '',descricao_situacao_cadastral:'Cadastro da equipe'};
}
export async function saveAssessment(client, row, answers) {
 if(row.unsaved){
  const payload={id:row.id,client_id:row.client_id,title:row.title,responsible_id:row.responsible_id,status:'draft',answers};
  let {data,error}=await client.from('assessments').insert(payload).select('id,revision,updated_at').maybeSingle();
  if(error?.code==='23505'){
   const existing=await client.from('assessments').select('*').eq('id',row.id).maybeSingle();
   if(!existing.error&&existing.data?.status==='draft'&&existing.data.responsible_id===row.responsible_id&&existing.data.client_id===row.client_id){
    throw new Error('Este registro já foi recebido pelo sistema. Abra o histórico em outra aba para conferir a versão salva antes de continuar.');
   }
  }
  if(error||!data)throw new Error('Não foi possível confirmar o salvamento. Mantenha esta página aberta e tente novamente.');
  return {...row,...data,answers,unsaved:false};
 }

 const {data,error}=await client.from('assessments').update({answers}).eq('id',row.id).eq('revision',row.revision).eq('status','draft').select('id,revision,updated_at').maybeSingle();
 if(error) throw new Error('Não foi possível confirmar o salvamento. Mantenha esta página aberta e tente novamente.');
 if(!data) throw new Error('Este rascunho foi alterado por outra pessoa ou ficou indisponível. Suas respostas continuam nesta tela. Abra o levantamento em outra aba para comparar antes de recarregar.');
 return {...row,...data,answers};
}
export async function deleteDraft(client, draft) {
 const {data,error}=await client.from('assessments').delete().eq('id',draft.id).eq('revision',draft.revision).eq('status','draft').select('id').maybeSingle();
 if(error)throw new Error('Não foi possível confirmar a exclusão. Atualize o histórico antes de tentar novamente.');
 if(!data)throw new Error('O rascunho foi alterado, já foi excluído ou seu acesso mudou. Atualize o histórico antes de tentar novamente.');
 return data;
}
export async function completeAssessment(client, row, answers) {
 const saved = row.unsaved ? await saveAssessment(client,row,answers) : row;
 const {data,error}=await client.from('assessments').update({answers,status:'completed'}).eq('id',saved.id).eq('revision',saved.revision).eq('status','draft').select('id,status,revision,completed_at').maybeSingle();
 if(error||!data)throw Error('Não foi possível confirmar a conclusão. Suas respostas continuam aqui. Confira o histórico antes de tentar novamente.');
 return {...saved,...data,answers};
}

