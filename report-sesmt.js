// Shared PDF presentation only. Never infer actual staffing or rewrite saved records.
(function(global){
 const legacy=Object.freeze(['Sem equipe mínima nesta faixa','Pelo Anexo II da NR-4 não há profissionais mínimos para essa faixa.']);
 const title='SESMT — Resultado do dimensionamento';
 const paragraphs=Object.freeze([
  'O Serviço Especializado em Segurança e em Medicina do Trabalho (SESMT) reúne profissionais que atuam na prevenção dos riscos ocupacionais e na proteção da saúde dos trabalhadores. Considerando o número de empregados e o grau de risco utilizados neste levantamento, o dimensionamento pelo Anexo II da NR-4 não indica um quantitativo mínimo de profissionais para compor esse serviço.',
  'Esse resultado deve ser analisado em conjunto com a estrutura da organização, seus estabelecimentos e as modalidades de atendimento previstas na NR-4. A ausência de equipe mínima no dimensionamento não afasta a responsabilidade da empresa de adotar medidas de prevenção e cumprir as demais exigências aplicáveis à segurança e à saúde no trabalho.'
 ]);
 const normalized=text=>text.replace(/\s+/g,' ').trim();
 const matches=(details,index,pair)=>normalized(details[index])===pair[0]&&index+1<details.length&&normalized(details[index+1])===pair[1];
 function present(details){
  const result=[];
  for(let i=0;i<details.length;i++){
   if(matches(details,i,legacy)){result.push(...paragraphs);i++;}
   else result.push(details[i]);
  }
  return result;
 }
 function apply(cover){
  if(!cover)return;
  for(const card of cover.querySelectorAll(':scope > .report-dimension-grid > .report-dimension-card')){
   const heading=[...card.children].find(node=>node.tagName==='H4');
   if(!heading||!['SESMT',title].includes(heading.textContent.trim()))continue;
   const nodes=[...card.children];
   for(let i=0;i<nodes.length-1;i++){
    if(nodes[i].tagName!=='P'||nodes[i+1].tagName!=='P')continue;
    const details=[nodes[i].textContent,nodes[i+1].textContent];
    if(matches(details,0,legacy)){
     present(details).forEach((text,index)=>{const p=document.createElement('p');p.textContent=text;nodes[i+index].replaceWith(p);});
     heading.textContent=title;cover.classList.add('report-cover-sesmt-result');i++;
    }else if(matches(details,0,paragraphs)){heading.textContent=title;cover.classList.add('report-cover-sesmt-result');}
   }
  }
 }
 global.GRO_REPORT_SESMT=Object.freeze({present,apply});
})(globalThis);
