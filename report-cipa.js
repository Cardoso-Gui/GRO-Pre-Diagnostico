// Shared PDF presentation only. Never recalculate dimensioning or rewrite saved records.
(function(global){
 const legacy='Sem comissão nesta faixa - Sem atendimento pelo SESMT, nomear um representante entre os empregados. MEI é dispensado dessa nomeação (NR-5, 5.4.13).';
 const title='CIPA — Resultado do dimensionamento';
 const paragraphs=Object.freeze([
  'Com base no número de empregados e no grau de risco informados, o dimensionamento pelo Quadro I da NR-5 não indica a constituição de comissão.',
  'Caso o estabelecimento não seja atendido pelo SESMT, a organização deve nomear um empregado como seu representante para auxiliar nas ações de prevenção em segurança e saúde no trabalho. A nomeação e a forma de atuação do representante devem ser formalizadas anualmente pela organização (NR-5, item 5.4.14). O MEI está dispensado dessa nomeação, conforme os itens 5.4.13 e 5.4.13.2 da NR-5.'
 ]);
 const normalized=text=>text.replace(/\s+/g,' ').trim();
 function present(details){
  return details.flatMap(text=>normalized(text)===legacy?[...paragraphs]:[text]);
 }
 function apply(cover){
  if(!cover)return;
  for(const card of cover.querySelectorAll(':scope > .report-dimension-grid > .report-dimension-card')){
   const heading=[...card.children].find(node=>node.tagName==='H4');
   if(!heading||!['CIPA',title].includes(heading.textContent.trim()))continue;
   for(const node of [...card.children]){
    if(node.tagName!=='P'||normalized(node.textContent)!==legacy)continue;
    const updated=present([node.textContent]).map(text=>{const p=document.createElement('p');p.textContent=text;return p;});
    node.replaceWith(updated[0]);updated[0].after(updated[1]);
   }
   const direct=[...card.children].filter(node=>node.tagName==='P');
   if(direct.some((node,i)=>normalized(node.textContent)===paragraphs[0]&&direct[i+1]&&normalized(direct[i+1].textContent)===paragraphs[1]))heading.textContent=title;
  }
 }
 global.GRO_REPORT_CIPA=Object.freeze({present,apply});
})(globalThis);
