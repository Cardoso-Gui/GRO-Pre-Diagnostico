import {isEligibleProfessional,professionalRoleLabel,professionalRegistrationLabel} from './professional-identity.js?v=20261020-professional1';

// Existing RLS determines visibility. This list does not grant draft ownership,
// and the database independently validates eligibility on every conclusion.
export async function loadEligibleProfessionals(client,clientId){
 const company=await client.from('clients').select('team_id').eq('id',clientId).maybeSingle();
 if(company.error||!company.data?.team_id)throw Error('Não foi possível verificar a equipe da empresa.');
 const teams=await client.from('teams').select('id,active,grants_global_access').eq('active',true);
 if(teams.error)throw Error('Não foi possível consultar as equipes.');
 const allowed=(teams.data||[]).filter(team=>team.id===company.data.team_id||team.grants_global_access).map(team=>team.id);
 if(!allowed.length)return [];
 const members=[];
 for(let offset=0;;offset+=200){
  const result=await client.from('team_members').select('user_id,display_name,active,team_id,professional_role,professional_registration,professional_registration_uf')
   .eq('active',true).in('team_id',allowed).in('professional_role',['safety_technician','safety_engineer']).order('display_name').order('user_id').range(offset,offset+199);
  if(result.error)throw Error('Não foi possível consultar os profissionais.');
  members.push(...(result.data||[]).filter(isEligibleProfessional));
  if((result.data||[]).length<200)break;
 }
 return members;
}

export function createVisitResponsiblePicker({client,clientId,selectedId=null,root=document,onChange=()=>{}}){
 const select=root.querySelector('#visit-responsible'),status=root.querySelector('#visit-responsible-status'),retry=root.querySelector('#reload-visit-responsible');
 let current=selectedId||'',members=[],loading=false,locked=false;
 const option=(value,label,disabled=false)=>{const node=select.ownerDocument.createElement('option');node.value=value;node.textContent=label;node.disabled=disabled;return node;};
 function render(){
  select.replaceChildren(option('','Selecionar responsável pela visita'));
  for(const member of members)select.append(option(member.user_id,`${member.display_name} · ${professionalRoleLabel(member.professional_role)} · ${professionalRegistrationLabel(member)}`));
  if(current&&!members.some(member=>member.user_id===current))select.append(option(current,'Responsável anterior indisponível. Selecione outro antes de concluir.',true));
  select.value=current;select.disabled=loading||locked;retry.disabled=loading||locked;
 }
 select.addEventListener('change',()=>{current=select.value;select.removeAttribute('aria-invalid');onChange(current||null);});
 async function refresh(){
  if(loading)return;loading=true;render();status.textContent='Consultando profissionais disponíveis…';
  try{
   members=await loadEligibleProfessionals(client,clientId);
   status.textContent=current&&!members.some(member=>member.user_id===current)?'O responsável salvo não está disponível. Você pode continuar o rascunho, mas precisa selecionar outro para concluir.':members.length?'Selecione quem assumiu a responsabilidade pela visita. Quem preenche pode ser outra pessoa.':'Nenhum técnico ou engenheiro com cadastro completo está disponível nesta equipe. Peça ao administrador para cadastrar a função e o registro. Você pode salvar o rascunho.';
   retry.hidden=false;
  }catch{
   members=[];status.textContent='Não foi possível carregar os responsáveis. O preenchimento e o rascunho continuam disponíveis. Tente atualizar a lista antes de concluir.';retry.hidden=false;
  }finally{loading=false;render();}
 }
 retry.addEventListener('click',refresh);
 return {refresh,value:()=>current||null,summary(){const member=members.find(item=>item.user_id===current);return {id:current,valid:!!member&&!loading,label:member?`${member.display_name} · ${professionalRoleLabel(member.professional_role)} · ${professionalRegistrationLabel(member)}`:'Responsável pela visita não selecionado ou indisponível'};},lock(value){locked=value;render();},validate(){
  if(loading){status.textContent='Aguarde a consulta dos responsáveis terminar antes de concluir.';return false;}
  if(current&&members.some(member=>member.user_id===current))return true;
  select.setAttribute('aria-invalid','true');globalThis.GRO_WIZARD?.reveal(select);select.focus();
  status.textContent='Para concluir, selecione um Técnico de Segurança do Trabalho com registro MTE ou Engenheiro de Segurança do Trabalho com CREA/UF. Auxiliares podem preencher, mas não ser responsáveis.';
  return false;
 }};
}
