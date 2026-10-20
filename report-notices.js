// Presentation-only defaults. Do not rewrite answers or stored report documents.
export const REPORT_NOTICES=Object.freeze({
 sectors:'Não foram registrados setores para compor esta seção.',
 noEpi:'Não há indicação de EPI aplicável registrada para este cargo/GHE.',
 epiValidation:'A necessidade de EPI deve ser avaliada pelos responsáveis técnicos.',
 noNorms:'Nenhuma NR identificada pelos critérios do levantamento.',
 normsValidation:'O enquadramento deve ser revisto pelos responsáveis técnicos.',
 measurementIndicated:'Foi registrada uma indicação de medição ou avaliação complementar.',
 registration:'Registro profissional não preservado.',
 trainingIntroduction:'Esta seção reúne sugestões de treinamento relacionadas às atividades e aos dados registrados no levantamento, organizadas por cargo ou grupo homogêneo de exposição (GHE). As indicações auxiliam na identificação de possíveis necessidades de capacitação e devem ser avaliadas pelos responsáveis técnicos, considerando as funções exercidas, as condições de trabalho e os requisitos aplicáveis.',
 normsIntroduction:'Esta seção apresenta as Normas Regulamentadoras (NRs) gerais e aquelas associadas aos critérios identificados nos dados do levantamento. A relação serve como referência inicial para a análise dos responsáveis técnicos, que devem confirmar o enquadramento da empresa e os requisitos aplicáveis às suas atividades. A ausência de uma norma nesta lista não significa que ela seja inaplicável ou que a empresa esteja dispensada de cumpri-la.',
 closing:'As melhorias propostas e as indicações de medição ou avaliação complementar apresentadas neste relatório devem ser analisadas pelos responsáveis técnicos, considerando as atividades e as condições registradas no levantamento. A partir dessa análise, devem ser definidas as medidas de prevenção pertinentes, as prioridades, os responsáveis pela execução e os prazos de implementação, com acompanhamento das ações adotadas.',
 risks:'Não foram registrados riscos para compor esta seção.',
 epi:'O uso de EPI foi indicado, mas o equipamento não foi especificado.',
 training:'Não foram geradas sugestões de treinamento a partir dos dados deste levantamento.',
 trainingValidation:'A necessidade de capacitação deve ser avaliada pelos responsáveis técnicos.',
 improvements:'Não foram registradas propostas de melhoria neste levantamento.',
 measurements:'Não houve indicação de medição ou avaliação complementar nos registros deste levantamento.',
 professional:'A função e o registro profissional não estão disponíveis nos dados preservados deste relatório.'
});
const text=node=>node?.textContent.trim()||'';
const direct=(node,tag)=>Array.from(node?.children||[]).filter(child=>child.tagName===tag);
// Match known default structures, not arbitrary text inside observations or fields.
export function normalizeReportNotices(content,answers={}){
 const blocks=Array.from(content?.children||[]).filter(node=>node.classList.contains('report-block'));
 const find=title=>blocks.find(block=>text(block.querySelector('h3'))===title);
 const cards=block=>Array.from(block?.querySelector(':scope > .report-card-list')?.children||[]).filter(node=>node.classList.contains('report-mini-card'));
 for(const card of cards(find('Setores e cargos'))){
  const lines=direct(card,'SMALL');
  if(text(direct(card,'STRONG')[0])==='Nenhum setor informado'&&direct(card,'SPAN').every(node=>!text(node))&&lines.length===1&&text(lines[0])==='Preencha os setores para consolidar esta seção.')lines[0].textContent=REPORT_NOTICES.sectors;
 }
 for(const card of cards(find('Riscos identificados'))){
  const lines=direct(card,'SMALL');
  if(text(direct(card,'STRONG')[0])==='Nenhum risco informado'&&direct(card,'SPAN').every(node=>!text(node))&&lines.length===1&&text(lines[0])==='Selecione riscos para consolidar esta seção.')lines[0].textContent=REPORT_NOTICES.risks;
 }
 // A literal custom EPI item can equal the old default; retain it when preserved.
 const customEpiValues=(Array.isArray(answers.epiBySelection)?answers.epiBySelection:[]).flatMap(entry=>Array.isArray(entry?.[1]?.items)&&entry[1].items.length?[entry[1].items.join(', ').trim()]:[]);
 for(const card of cards(find('EPIs e treinamentos sugeridos'))){
  const title=text(direct(card,'STRONG')[0]),caption=direct(card,'SPAN')[0],lines=direct(card,'SMALL');
  if(title==='EPIs'&&text(caption)==='EPIs informados no levantamento'){
   const suffix=': EPI aplicável, mas não informado';
   for(const line of lines){const value=text(line);if(value.endsWith(suffix)&&value.length>suffix.length&&!customEpiValues.some(custom=>value.endsWith(': '+custom)))line.textContent=value.slice(0,-suffix.length)+': '+REPORT_NOTICES.epi;}
  }
  if(title==='EPIs'&&text(caption)==='Nenhum EPI aplicável informado'&&lines.length===1&&text(lines[0])==='Validar necessidade de EPI com o responsável técnico.') {
   caption.textContent=REPORT_NOTICES.noEpi;lines[0].textContent=REPORT_NOTICES.epiValidation;
  }
  if(title==='Treinamentos'&&text(caption)==='Sem sugestão pré-cadastrada'&&lines.length===1&&text(lines[0])==='Validar necessidade com o responsável técnico.'){
   caption.textContent=REPORT_NOTICES.training;lines[0].textContent=REPORT_NOTICES.trainingValidation;
  }
 }
 const norms=find('NRs identificadas no levantamento');
 for(const paragraph of direct(norms,'P'))if(text(paragraph)==='Normas gerais e normas com critérios identificados nos dados informados. Confirme o enquadramento e os requisitos com o responsável técnico; a ausência nesta lista não representa dispensa.')paragraph.textContent=REPORT_NOTICES.normsIntroduction;
 for(const card of cards(norms)){
  const lines=direct(card,'SMALL');
  if(text(direct(card,'STRONG')[0])==='Nenhuma NR aplicável identificada'&&direct(card,'SPAN').every(node=>!text(node))&&lines.length===1&&text(lines[0])==='Revise o levantamento ou valide com o responsável técnico.') {
   direct(card,'STRONG')[0].textContent=REPORT_NOTICES.noNorms;lines[0].textContent=REPORT_NOTICES.normsValidation;
  }
 }
 const pending=find('Pendências para validação técnica');
 for(const list of direct(pending,'UL'))for(const line of direct(list,'LI'))if(text(line)==='Nenhuma medição/avaliação marcada como necessária neste levantamento.')line.textContent=REPORT_NOTICES.measurements;
}
