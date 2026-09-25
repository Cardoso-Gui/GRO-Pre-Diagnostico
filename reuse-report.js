import {companyFromClient,saveAssessment} from './assessment-data.js';

export function reusedAnswers(snapshot,client){
 const answers={cnpj:client.cnpj,currentCompany:companyFromClient(client)};
 for(const key of ['employees','dimensionOptions','selectedSectors','jobsBySector','selectedRiskMode','gheList','selectedRisksByTarget','riskSourcesBySelection','epiBySelection']){
  if(snapshot?.[key]!==undefined)answers[key]=structuredClone(snapshot[key]);
 }
 return answers;
}

export function addReuseButton(container,sourceId,authClient,getTeamMember,notify){
 const button=document.createElement('button');button.type='button';button.className='reuse-report';button.textContent='Reutilizar levantamento';
 let busy=false,creationId;
 button.onclick=async()=>{
  if(busy)return;
  if(!confirm('Criar um novo rascunho com os dados deste levantamento? Revise as informações antes de concluir. O relatório original será preservado.'))return;
  busy=true;button.disabled=true;notify('Preparando novo rascunho…');creationId ||= crypto.randomUUID();
  try{
   const access=await getTeamMember();if(!access.member)throw Error('Sua sessão expirou. Entre novamente.');
   const source=await authClient.from('assessments').select('client_id,title,final_snapshot').eq('id',sourceId).eq('status','completed').maybeSingle();
   if(source.error||!source.data?.final_snapshot?.answers)throw Error('Relatório indisponível para reutilização.');
   const client=await authClient.from('clients').select('*').eq('id',source.data.client_id).eq('archived',false).maybeSingle();
   if(client.error||!client.data)throw Error('Cliente indisponível ou arquivado.');
   const row={id:creationId,client_id:client.data.id,responsible_id:access.member.user_id,title:('Revisão — '+source.data.title).slice(0,200),unsaved:true};
   const saved=await saveAssessment(authClient,row,reusedAnswers(source.data.final_snapshot.answers,client.data));
   location.assign('./levantamento.html?id='+encodeURIComponent(saved.id));
  }catch(error){notify(error.message);busy=false;button.disabled=false;}
 };
 container.append(button);
}
