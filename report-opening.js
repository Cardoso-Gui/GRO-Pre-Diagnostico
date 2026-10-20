// Shared by the classic questionnaire script and the module-based report viewer.
// Update the rendered cover only; never rewrite the saved assessment snapshot.
(function(global){
 const paragraphs=Object.freeze([
  'Este relatório apresenta os resultados do levantamento preliminar das atividades e das condições de trabalho da empresa. Reúne informações sobre os setores abrangidos pelo levantamento, os riscos ocupacionais identificados e as medidas de prevenção informadas, com o objetivo de apoiar a definição de prioridades e orientar a análise de eventuais necessidades de avaliação complementar.',
  'Seu conteúdo se limita ao escopo do levantamento e às informações registradas na ocasião. Por seu caráter preliminar, não substitui o PGR, o PCMSO, o LTCAT, os laudos técnicos ou as avaliações específicas aplicáveis, nem dispensa a análise dos profissionais responsáveis.'
 ]);
 const legacyOpening='Este relatório consolida as informações coletadas no questionário. Ele não substitui PGR, PCMSO, LTCAT, laudos técnicos, avaliações quantitativas ou validação dos responsáveis técnicos.';
 const normalized=text=>text.replace(/\s+/g,' ').trim();
 function apply(cover){
  if(!cover)return;
  const previous=[...cover.children].filter(node=>node.classList.contains('report-opening'));
  // Replace only the known legacy opening, leaving unrelated prose untouched.
  if(!previous.length){
   const legacy=[...cover.children].find(node=>node.tagName==='P'&&normalized(node.textContent)===legacyOpening);
   if(legacy)previous.push(legacy);
  }
  const updated=paragraphs.map(text=>{const paragraph=document.createElement('p');paragraph.className='report-opening';paragraph.textContent=text;return paragraph;});
  if(previous.length)previous[0].replaceWith(updated[0]);
  else{const title=cover.querySelector(':scope > h3');if(title)title.after(updated[0]);else cover.append(updated[0]);}
  updated[0].after(updated[1]);
  for(const paragraph of previous.slice(1))paragraph.remove();
 }
 global.GRO_REPORT_OPENING=Object.freeze({apply});
})(globalThis);
