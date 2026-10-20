// Presentation only: values are resolved by the report reader, never re-saved.
export function createReportVisitIntroduction({identity,cnpj,fullAddress,visitDate,responsible}){
 const identification=[];
 if(cnpj)identification.push('inscrita no CNPJ sob o nº '+cnpj);
 if(fullAddress&&fullAddress!=='Endereço não informado')identification.push('situada em '+fullAddress);
 const details=identification.length?', '+identification.join(' e ')+',':'';
 const hasDate=Boolean(visitDate&&visitDate!=='Não informada');
 const visitResponsible=responsible==='Responsável não disponível'?'':responsible;
 const visit=`A visita à empresa ${identity}${details} foi realizada${hasDate?' em '+visitDate:''}${visitResponsible?', por '+visitResponsible:''}.${hasDate?'':' A data da visita não foi informada.'}`;
 const context='O levantamento teve como foco conhecer as atividades desenvolvidas nos setores abrangidos pela visita e registrar as condições de trabalho, os riscos identificados e as medidas de prevenção informadas. Para contextualizar esses registros, foram consideradas as observações realizadas no local e as informações fornecidas pela empresa, dentro do escopo da visita.';
 const introduction=document.createElement('p');introduction.className='report-introduction';
 // Keep the existing cover styling and two visual paragraphs; dynamic values
 // are text nodes, never HTML. The separator also keeps text extraction legible.
 introduction.append(document.createTextNode(visit+' '),document.createElement('br'),document.createElement('br'),document.createTextNode(context));
 return introduction;
}
