// Business-only correction contract. The database independently validates every key.
export const ANSWER_FIELDS=['visitDate','employees','dimensionOptions','selectedSectors','jobsBySector','selectedRiskMode','gheList','selectedRisksByTarget','riskSourcesBySelection','epiBySelection'];
export const CLIENT_FIELDS=['legal_name','trade_name','cnpj','cnae','contact_name','contact_phone','contact_email'];
export const ADDRESS_FIELDS=['street','number','complement','district','city','state','postal_code'];
const clone=value=>structuredClone(value);
export function equalValue(a,b){
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equalValue(a[key],b[key]));
}
// Replay only user edits onto the untouched source. The questionnaire may
// normalize legacy fields while rendering; that is not a requested correction.
export function preserveUnedited(original,baseline,current){
 if(equalValue(baseline,current))return clone(original);
 if(original===undefined)return clone(current);
 if(!baseline||!current||typeof baseline!=='object'||typeof current!=='object'||Array.isArray(baseline)!==Array.isArray(current))return clone(current);
 if(Array.isArray(current)){
  const identity=value=>Array.isArray(value)&&typeof value[0]==='string'?'pair:'+value[0]:value&&typeof value==='object'?(value.id?'id:'+value.id:value.name?'name:'+value.name:null):null;
  return current.map((value,index)=>{
   let oldIndex=baseline.findIndex(item=>equalValue(item,value));
   if(oldIndex<0&&identity(value))oldIndex=baseline.findIndex(item=>identity(item)===identity(value));
   if(oldIndex<0&&baseline.length===current.length)oldIndex=index;
   if(oldIndex<0)return clone(value);
   const oldValue=baseline[oldIndex];
   let sourceIndex=Array.isArray(original)?original.findIndex(item=>equalValue(item,oldValue)):-1;
   if(sourceIndex<0&&identity(oldValue))sourceIndex=original.findIndex(item=>identity(item)===identity(oldValue));
   if(sourceIndex<0&&original.length===baseline.length)sourceIndex=oldIndex;
   return preserveUnedited(sourceIndex<0?undefined:original[sourceIndex],oldValue,value);
  }).filter(value=>value!==undefined);
 }
 const result={};for(const key of Object.keys(current)){
  const value=preserveUnedited(original?.[key],baseline[key],current[key]);if(value!==undefined)result[key]=value;
 }
 // Preserve source-only fields not represented by the form at all.
 for(const key of Object.keys(original||{}))if(!Object.hasOwn(baseline,key)&&!Object.hasOwn(current,key))result[key]=clone(original[key]);
 return result;
}
export function correctionChanges(original,baseline,current,client,title){
 const changes={},answers={};
 for(const key of ANSWER_FIELDS)if(!equalValue(baseline[key],current[key]))answers[key]=preserveUnedited(original.final_snapshot.answers[key],baseline[key],current[key]);
 if(Object.keys(answers).length)changes.answers=answers;
 const clientChanges={};for(const key of CLIENT_FIELDS)if(!equalValue(original.final_snapshot.client?.[key],client[key]))clientChanges[key]=clone(client[key]);
 const addressChanges={};for(const key of ADDRESS_FIELDS)if(!equalValue(original.final_snapshot.client?.address?.[key],client.address?.[key]))addressChanges[key]=client.address?.[key]??'';
 if(Object.keys(addressChanges).length)clientChanges.address=addressChanges;
 if(Object.keys(clientChanges).length)changes.client=clientChanges;
 if(title!==original.title)changes.title=title;
 return changes;
}
export function applyBusinessChanges(assessment,changes){
 const result=clone(assessment),snapshot=result.final_snapshot;
 if(changes.title!==undefined){result.title=changes.title;snapshot.title=changes.title;}
 if(changes.answers)snapshot.answers={...snapshot.answers,...clone(changes.answers)};
 if(changes.client){
  snapshot.client={...snapshot.client,...clone(changes.client),...(changes.client.address?{address:{...snapshot.client.address,...clone(changes.client.address)}}:{})};
  const c=snapshot.client,a=c.address||{},map={cnpj:'cnpj',legal_name:'razao_social',trade_name:'nome_fantasia',cnae:'cnae_fiscal',contact_name:'contact_name',contact_phone:'ddd_telefone_1',contact_email:'email'};
  const company={...snapshot.answers.currentCompany};
  for(const [key,target] of Object.entries(map))if(Object.hasOwn(changes.client,key))company[target]=c[key]||'';
  if(Object.hasOwn(changes.client,'cnae'))company.cnae_fiscal_descricao='';
  if(Object.hasOwn(changes.client.address||{},'street'))company.descricao_tipo_de_logradouro='';
  if(Object.hasOwn(changes.client,'address'))for(const [key,target] of Object.entries({street:'logradouro',number:'numero',complement:'complemento',district:'bairro',city:'municipio',state:'uf',postal_code:'cep'}))if(Object.hasOwn(changes.client.address,key))company[target]=a[key]||'';
  snapshot.answers.currentCompany=company;
  if(Object.hasOwn(changes.client,'cnpj'))snapshot.answers.cnpj=c.cnpj||'';
 }
 delete snapshot.answers.report_document;
 return result;
}
export function changedValues(before,after,path=[]){
 if(equalValue(before,after))return [];
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
  const keys=[...new Set([...Object.keys(before),...Object.keys(after)])];return keys.flatMap(key=>changedValues(before[key],after[key],[...path,key]));
 }
 return [{path:path.join('.'),before:before??null,after:after??null}];
}
export async function readAssessmentReport(client,id,{original=false}={}){
 const {data,error}=await client.rpc('read_assessment_report',{p_assessment_id:id,p_original:original});
 if(error||!data?.assessment)throw Error('Não foi possível verificar a versão e o histórico deste relatório. A visualização foi interrompida para não mostrar uma versão desatualizada. Tente recarregar.');
 if(data.sequence>0&&(data.original_report_document?.version!==1||!Array.isArray(data.original_report_document.children)))throw Error('O documento original da retificação não está disponível. A visualização foi interrompida.');
 if(!Number.isSafeInteger(data.sequence)||data.sequence<0)throw Error('Sequência de retificação inválida. Recarregue o relatório.');
 return data;
}
export async function saveRectification(client,{id,sequence,requestId,reason,changes}){
 if(!reason?.trim())throw Error('Informe o motivo da retificação.');
 if(!Object.keys(changes||{}).length)throw Error('Altere pelo menos uma informação antes de revisar.');
 const {data,error}=await client.rpc('rectify_assessment',{p_assessment_id:id,p_expected_sequence:sequence,p_request_id:requestId,p_reason:reason.trim(),p_changes:changes});
 if(error){
  if(error.code==='40001')throw Error('Outra retificação foi salva enquanto esta tela estava aberta. Suas alterações continuam aqui. Abra o relatório em outra aba para comparar; não sobrescreva a versão mais recente.');
  if(error.code==='42501')throw Error('Seu acesso para retificar não está mais disponível. As alterações não foram salvas.');
  if(error.code==='22023'||error.code==='23514')throw Error(error.message||'Confira as informações e o motivo antes de salvar.');
  throw Error('Não foi possível confirmar a retificação. Mantenha esta tela aberta. Tente confirmar novamente com os mesmos dados ou confira o histórico antes de começar outra alteração.');
 }
 if(!data?.assessment||!Number.isSafeInteger(data.sequence))throw Error('O servidor não confirmou a retificação. Confira o histórico antes de continuar.');
 return data;
}

export function renameBusinessReferences(answers,{kind,name,newName,sector}){
 const result=clone(answers),clean=String(newName||'').trim(),normalize=value=>String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),key=(...parts)=>parts.map(normalize).join('__'),remap=new Map();
 if(!clean||clean.length>100)throw Error('Informe um nome entre 1 e 100 caracteres.');
 const ensureUnique=names=>{if(names.some(value=>value!==name&&normalize(value)===normalize(clean)))throw Error('Já existe outro item com esse nome.');};
 if(kind==='sector'){
  ensureUnique([...new Set([...(result.selectedSectors||[]),...(result.jobsBySector||[]).map(([label])=>label)])]);if(!(result.selectedSectors||[]).includes(name))throw Error('Setor não encontrado.');
  result.selectedSectors=result.selectedSectors.map(value=>value===name?clean:value);
  result.jobsBySector=(result.jobsBySector||[]).map(([label,jobs])=>{if(label!==name)return [label,jobs];for(const job of jobs)remap.set(key('job',name,job.name),key('job',clean,job.name));return [clean,jobs];});
  for(const ghe of result.gheList||[])for(const link of ghe.linkedJobs||[])if(link.sectorName===name)link.sectorName=clean;
 }else if(kind==='job'){
  const jobs=(result.jobsBySector||[]).find(([label])=>label===sector)?.[1];if(!jobs)throw Error('Cargo não encontrado.');ensureUnique(jobs.map(job=>job.name));const job=jobs.find(job=>job.name===name);if(!job)throw Error('Cargo não encontrado.');job.name=clean;remap.set(key('job',sector,name),key('job',sector,clean));
  for(const ghe of result.gheList||[])for(const link of ghe.linkedJobs||[])if(link.sectorName===sector&&link.jobName===name)link.jobName=clean;
 }else if(kind==='ghe'){
  ensureUnique((result.gheList||[]).map(ghe=>ghe.name));const ghe=(result.gheList||[]).find(ghe=>ghe.id===sector);if(!ghe)throw Error('GHE não encontrado.');ghe.name=clean; // Stable GHE identity retains every selection and audit reference.
 }else throw Error('Tipo de alteração não permitido.');
 result.selectedRisksByTarget=(result.selectedRisksByTarget||[]).map(([target,codes])=>[remap.get(target)||target,codes]);
 for(const [field,prefix] of [['riskSourcesBySelection','source'],['epiBySelection','epi-data']])result[field]=(result[field]||[]).map(([id,value])=>{for(const [before,after] of remap){const start=prefix+'__'+before+'__';if(id.startsWith(start))return [prefix+'__'+after+'__'+id.slice(start.length),value];}return [id,value];});
 return result;
}

export async function overlayReportSummaries(client,rows){
 if(!rows.length)return rows;
 const {data,error}=await client.rpc('read_assessment_report_summaries',{p_assessment_ids:rows.map(row=>row.id)});
 if(error||!Array.isArray(data))throw Error('Não foi possível verificar as retificações da lista.');
 const summaries=new Map(data.map(item=>[item.id,item]));
 return rows.map(row=>{const summary=summaries.get(row.id);if(!summary||!Number.isSafeInteger(summary.sequence))throw Error('Uma versão do relatório ficou indisponível. Recarregue a lista.');return {...row,title:summary.title,rectification_sequence:summary.sequence,can_rectify:summary.can_rectify};});
}
