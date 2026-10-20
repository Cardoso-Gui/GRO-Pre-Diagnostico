import {affectedReportSections,overlayReportDocument} from './report-document-overlay.js?v=20261020-rectify1';
// Reuse the real questionnaire generator in an isolated, transient same-origin DOM.
// No authentication, uploads, draft writes or report_document from callers are used.
const files=['cnae-descriptions.js','cnae-risk-map.js','esocial-risk-table.js','occupational-risk-table.js','training-rules.js','nr-report-rules.js','dimension-data.js','report-opening.js','report-cipa.js','report-sesmt.js','visit-date.js','script.js'];
export async function loadQuestionnaireRuntime(target=document){
 for(const file of files)await new Promise((resolve,reject)=>{
  const script=target.createElement('script');script.src=new URL(file+'?v='+(file==='script.js'?'20261020-notices1':file==='report-sesmt.js'?'20261020-sesmt1':file==='report-cipa.js'?'20261020-cipa1':file==='report-opening.js'?'20261020-objective1':'20261020-rectify1'),import.meta.url).href;
  script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar o gerador de relatório. Tente novamente.'));target.body.append(script);
 });
}
export async function generateEffectiveDocument(answers,{originalDocument,changes}={}){
 if(originalDocument&&changes&&!affectedReportSections(changes).size)return overlayReportDocument(originalDocument,null,changes);
 const response=await fetch(new URL('./levantamento.html',import.meta.url),{cache:'no-store'});
 if(!response.ok)throw Error('Não foi possível carregar o gerador do relatório retificado.');
 const template=new DOMParser().parseFromString(await response.text(),'text/html');
 template.querySelectorAll('script,link').forEach(node=>node.remove());
 const frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.title='Gerador interno de relatório';
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('O gerador demorou a responder. Recarregue o relatório.')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.srcdoc='<!doctype html>'+template.documentElement.outerHTML;document.body.append(frame);});
  frame.contentWindow.GRO_CLOUD={rectification:true};
  await loadQuestionnaireRuntime(frame.contentDocument);
  frame.contentWindow.GRO_FORM.restore(structuredClone(answers));
  const generated=frame.contentWindow.GRO_FORM.document().report_document;
  return originalDocument?overlayReportDocument(originalDocument,generated,changes||[]):generated;
 }finally{frame.remove();}
}
