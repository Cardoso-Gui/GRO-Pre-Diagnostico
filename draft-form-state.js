// Keep partially filled Add forms in a draft without treating them as registered
// sectors/jobs/GHEs or including them in a finalized report.
export function captureDraftInputs(root=document){
 const fields={};for(const id of ['custom-sector-input','ghe-name-input']){const el=root.querySelector('#'+id);if(el?.value)fields[id]=el.value;}
 const jobs=[];
 for(const card of root.querySelectorAll('.job-card')){
  const sector=card.querySelector('h3')?.textContent,form=card.querySelector('.job-form');if(!sector||!form)continue;
  const values=Object.fromEntries(['jobName','quantity','activities'].map(key=>[key,form.elements.namedItem(key)?.value||'']));
  if(Object.values(values).some(Boolean))jobs.push({sector,values});
 }
 return {fields,jobs};
}
export function restoreDraftInputs(saved,root=document){
 if(!saved||typeof saved!=='object')return;
 for(const id of ['custom-sector-input','ghe-name-input']){const el=root.querySelector('#'+id),value=saved.fields?.[id];if(el&&typeof value==='string')el.value=value.slice(0,el.maxLength>0?el.maxLength:120);}
 for(const entry of Array.isArray(saved.jobs)?saved.jobs:[]){
  const card=[...root.querySelectorAll('.job-card')].find(card=>card.querySelector('h3')?.textContent===entry.sector),form=card?.querySelector('.job-form');if(!form)continue;
  for(const key of ['jobName','quantity','activities']){const el=form.elements.namedItem(key),value=entry.values?.[key];if(el&&typeof value==='string')el.value=value.slice(0,el.maxLength>0?el.maxLength:30);}
  form.hidden=false;
 }
}
