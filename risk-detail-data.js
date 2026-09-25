export const detailKey=(...parts)=>parts.map(p=>String(p).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')).join('__');
export function detailTargets(answers,catalog){
 const jobs=answers.jobsBySector||[],active=new Set(answers.selectedSectors||[]);
 const targets=answers.selectedRiskMode==='ghe'?(answers.gheList||[]).map(g=>({id:g.id,title:g.name,description:(g.linkedJobs||[]).map(j=>`${j.jobName} (${j.sectorName})`).join(', ')})):answers.selectedRiskMode==='job'?jobs.filter(([sector])=>active.has(sector)).flatMap(([sector,rows])=>rows.map(j=>({id:detailKey('job',sector,j.name),title:`${j.name} — ${sector}`,description:`${j.quantity} funcionário(s) · ${j.activities||''}`}))):[];
 const selections=new Map(answers.selectedRisksByTarget||[]);
 return targets.map(t=>({...t,risks:catalog.filter(r=>r.code!=='09.01.001'&&(selections.get(t.id)||[]).includes(r.code))}));
}
export function detailAnswers(answers,details,epis){return {...answers,riskSourcesBySelection:Array.from(details.entries()),...(epis ? {epiBySelection:Array.from(epis.entries())} : {})};}
