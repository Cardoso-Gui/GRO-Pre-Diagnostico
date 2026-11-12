const fieldLabels={title:'Título',status:'Situação do levantamento',responsible_id:'Responsável pelo preenchimento',visit_responsible_id:'Responsável pela visita',
 'answers.currentCompany':'Dados da empresa','answers.employees':'Quantidade de funcionários','answers.visitDate':'Data da visita','answers.selectedSectors':'Setores selecionados','answers.jobsBySector':'Cargos, atividades e postos de trabalho','answers.gheList':'Grupos de exposição (GHEs)','answers.selectedRiskMode':'Organização dos riscos','answers.selectedRisksByTarget':'Riscos selecionados','answers.riskSourcesBySelection':'Detalhamento dos riscos','answers.epiBySelection':'Equipamentos de proteção','answers.report_document':'Documento do relatório','answers.draftInputs':'Campos em preenchimento'};
export function activityFields(fields=[]){return [...new Set(fields.map(field=>fieldLabels[field]||'Outros campos do levantamento'))];}
export function mountAssessmentActivity({client,getContext,anchor,doc=document}){
 const make=(tag,text,cls)=>{const el=doc.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 const host=make('details','','assessment-activity'),heading=make('summary','Histórico de alterações');
 const note=make('p','Registra quem salvou, quando e quais campos ou seções mudaram. O histórico começa na ativação deste recurso; alterações anteriores não são reconstruídas.','activity-note');
 const controls=make('div','','activity-controls'),refresh=make('button','Atualizar histórico','secondary-button'),more=make('button','Carregar mais','secondary-button');refresh.type=more.type='button';more.hidden=true;
 const status=make('p','','activity-status');status.setAttribute('role','status');
 const list=make('ol','','activity-list');list.setAttribute('aria-label','Alterações salvas, mais recentes primeiro');controls.append(refresh,more);host.append(heading,note,status,list,controls);anchor.before(host);
 let cursor=null,loading=false,loaded=false,generation=0,disposed=false;
 async function load(reset=true){
  if(loading||disposed)return;const context=getContext();if(!context?.id)return;
  if(!context.saved){status.textContent='Salve o rascunho para começar a registrar o histórico.';list.replaceChildren();more.hidden=true;return;}
  loading=true;refresh.disabled=more.disabled=true;const ticket=++generation;host.setAttribute('aria-busy','true');
  if(reset){cursor=null;list.replaceChildren();}status.textContent='Carregando histórico…';
  try{
   const {data,error}=await client.rpc('read_assessment_activity',{p_assessment_id:context.id,p_before_id:cursor,p_limit:21});
   if(disposed||ticket!==generation)return;if(error||!Array.isArray(data))throw Error('unavailable');
   for(const item of data.slice(0,20)){
    const row=make('li','','activity-event'),action={created:'Levantamento criado',updated:'Alterações salvas',completed:'Levantamento concluído',rectified:'Relatório retificado'}[item.action]||'Alteração registrada';
    const date=new Date(item.occurred_at),time=make('time',Number.isNaN(date.getTime())?'Data indisponível':date.toLocaleString('pt-BR'));
    if(!Number.isNaN(date.getTime()))time.dateTime=date.toISOString();
    row.append(make('strong',action),make('p',(item.actor_name||'Sistema')+' · '+(item.revision===null?'Versão não informada':'Versão do registro '+item.revision)),time);
    const fields=activityFields(Array.isArray(item.changed_fields)?item.changed_fields:[]);if(fields.length)row.append(make('p','Campos ou seções: '+fields.join(' · ')));list.append(row);
   }
   const last=data.slice(0,20).at(-1);cursor=last?.event_id||cursor;more.hidden=data.length<=20;loaded=true;
   status.textContent=list.children.length?'Somente alterações confirmadas no servidor. Salvamentos sem mudanças não criam eventos.':'Nenhuma alteração registrada desde a ativação do histórico.';
  }catch{
   if(disposed||ticket!==generation)return;list.replaceChildren();cursor=null;more.hidden=true;loaded=false;status.textContent='Não foi possível consultar o histórico. Confira a conexão e seu acesso e tente novamente.';
  }finally{if(!disposed&&ticket===generation){loading=false;refresh.disabled=more.disabled=false;host.setAttribute('aria-busy','false');}}
 }
 host.addEventListener('toggle',()=>{if(host.open&&!loaded)load();});refresh.addEventListener('click',()=>load());more.addEventListener('click',()=>load(false));
 return {host,refresh:()=>load(),dispose(){disposed=true;generation++;host.remove();}};
}
