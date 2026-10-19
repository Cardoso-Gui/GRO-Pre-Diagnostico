import {detailKey} from './risk-detail-data.js';
export function reviewModel({answers,targets,selections,missing}){
 const sources=new Map(answers.riskSourcesBySelection||[]);
 const groups=targets.map(target=>{
  const all=selections.filter(s=>s.targetId===target.id),risks=all.filter(s=>s.risk.code!=='09.01.001');
  const pending=missing.filter(m=>m.targetId===target.id||m.riskTarget===target.id);
  const detailMissing=new Set(pending.filter(m=>m.section==='Detalhamento dos riscos').map(m=>m.riskCode));
  const epiPending=pending.filter(m=>m.section==='EPIs').length;
  return {...target,total:all.length,detailTotal:risks.length,detailsDone:risks.length-detailMissing.size,epiDone:risks.length-epiPending,detailPending:detailMissing.size,epiPending,pending};
 });
 const points=selections.filter(s=>sources.get(detailKey('source',s.targetId,s.risk.code))?.measure==='Sim');
 return {groups,points,missing};
}
