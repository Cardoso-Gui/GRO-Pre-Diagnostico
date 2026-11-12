// Transient presentation state, scoped to the signed-in account and team.
// Access and data queries remain owned by each page.
export function rememberList({doc=document,member,page,fields,submitForm,changeFields=[],clearButtons=[],storage,now=()=>Date.now()}){
 const win=doc.defaultView;const empty={save(){},dispose(){}};
 if(!member?.user_id||!member?.team_id)return empty;
 try{storage??=win.sessionStorage;}catch{return empty;}
 const userPrefix='gro-list-v1:'+encodeURIComponent(member.user_id)+':';
 const key=userPrefix+encodeURIComponent(member.team_id)+':'+page;
 const controls=fields.map(id=>doc.getElementById(id)).filter(Boolean),listeners=[];
 for(const field of controls){field.value=field.tagName==='SELECT'?([...field.options].find(option=>option.defaultSelected)||field.options[0])?.value||'':field.defaultValue;}
 try{
  const saved=JSON.parse(storage.getItem(key)||'null');
  if(saved&&Number.isFinite(saved.at)&&now()-saved.at>=0&&now()-saved.at<8*60*60*1000){
   for(const field of controls){const value=saved.values?.[field.id];if(typeof value!=='string'||value.length>240)continue;if(field.tagName==='SELECT'&&![...field.options].some(option=>option.value===value&&!option.disabled))continue;field.value=value;}
  }else storage.removeItem(key);
 }catch{try{storage.removeItem(key);}catch{}}
 doc.dispatchEvent(new win.Event('gro:list-restored'));
 const save=()=>{try{storage.setItem(key,JSON.stringify({at:now(),values:Object.fromEntries(controls.map(field=>[field.id,field.value.slice(0,240)]))}));}catch{}};
 const on=(target,event,fn)=>{if(target){target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));}};
 if(submitForm){on(doc.querySelector(submitForm),'submit',save);for(const id of changeFields)on(doc.getElementById(id),'change',save);}
 else for(const field of controls){on(field,'input',save);on(field,'change',save);}
 for(const id of clearButtons)on(doc.getElementById(id),'click',()=>win.queueMicrotask(save));
 on(doc.querySelector('#sign-out'),'click',()=>{try{for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k?.startsWith(userPrefix))storage.removeItem(k);}}catch{}});
 return {save,dispose(){listeners.forEach(remove=>remove());}};
}
