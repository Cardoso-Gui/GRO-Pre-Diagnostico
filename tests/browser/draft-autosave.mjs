import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const out=path.join(repo,'test-results/draft-autosave');await fs.mkdir(out,{recursive:true});
const origin='http://127.0.0.1:43219';
const id='11111111-1111-4111-8111-111111111111';
const member={user_id:'user-a',team_id:'team-a',role:'admin',display_name:'Teste Local',active:true,teams:{active:true}};
const base={id,revision:1,status:'draft',client_id:'client-a',responsible_id:'user-a',visit_responsible_id:null,title:'Levantamento de teste isolado',answers:{cnpj:'12345678000199',currentCompany:{razao_social:'Empresa fictícia de teste',cnpj:'12345678000199'},visitDate:'2026-10-21',selectedRiskMode:'ghe',selectedSectors:['Administrativo'],jobsBySector:[['Administrativo',[{name:'Auxiliar',quantity:1,activities:'Teste'}]]],gheList:[{id:'ghe__a',name:'Administrativo',linkedJobs:[{sectorName:'Administrativo',jobName:'Auxiliar'}]}],selectedRisksByTarget:[['ghe__a',['ERG.002']]],riskSourcesBySelection:[]}};
let row=structuredClone(base),writes=[],errors=[],blocked=[];
const authMock=`export const SUPABASE_URL='${origin}';export const SUPABASE_KEY='fixture';export const loginStorage={};
export async function getTeamMember(){return {member:${JSON.stringify(member)}};}
export const authClient={auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async signOut(){return {}; }},from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},range(){return q},maybeSingle(){return table==='assessments'?fetch('${origin}/fixture-row').then(r=>r.json()).then(data=>({data,error:null})):Promise.resolve({data:table==='clients'?{team_id:'team-a'}:null,error:null})},then(resolve){return Promise.resolve({data:table==='teams'?[{id:'team-a',active:true}]:[],error:null}).then(resolve)}};return q;}};`;
const realAssessment=await fs.readFile(path.join(repo,'assessment-data.js'),'utf8');
const a=realAssessment.indexOf('export async function saveAssessment('),b=realAssessment.indexOf('export async function deleteDraft(',a);
const assessmentMock=realAssessment.slice(0,a)+`export async function saveAssessment(client,row,answers){if(window.__fixtureReject)throw Error('Falha de conexão simulada');const r=await fetch('${origin}/fixture-save',{method:'POST',body:JSON.stringify({row,answers})});const result=await r.json();if(!r.ok)throw Object.assign(Error('Conflito simulado'),{code:'DRAFT_CONFLICT'});return result;}\n`+realAssessment.slice(b);
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin!==origin){blocked.push(url.href);return route.abort();}
 if(url.pathname==='/fixture-row')return route.fulfill({json:row});
 if(url.pathname==='/fixture-save'){
  const body=JSON.parse(route.request().postData());
  if(body.row.revision!==row.revision)return route.fulfill({status:409,json:{}});
  row={...body.row,answers:body.answers,revision:row.revision+1,unsaved:false};writes.push(structuredClone(row));return route.fulfill({json:row});
 }
 if(url.pathname==='/auth-client.js')return route.fulfill({contentType:'text/javascript',body:authMock});
 if(url.pathname==='/assessment-data.js')return route.fulfill({contentType:'text/javascript',body:assessmentMock});
 const file=path.join(repo,url.pathname);if(!file.startsWith(repo+path.sep))return route.abort();
 try{return route.fulfill({body:await fs.readFile(file),contentType:/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});}catch{return route.fulfill({status:404,body:'Not found'});}
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss());
const recoveryCount=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('gro-draft-recovery:')).length);
try{
 await page.goto(`${origin}/risk-detail.html?id=${id}`);
 await page.locator('#editor').waitFor({state:'visible'});
 await page.locator('[data-field=source]').fill('Texto digitado no celular');
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Salvo no servidor.');
 assert.equal(row.answers.riskSourcesBySelection[0][1].source,'Texto digitado no celular');assert.equal(writes.length,1);
 await page.screenshot({path:path.join(out,'risk-saved-mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'risk mobile no horizontal overflow');
 await context.setOffline(true);
 await page.locator('[data-field=source]').fill('Texto protegido sem internet');
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('Aguardando conexão'));
 assert.equal(await recoveryCount(),1);assert.equal(writes.length,1);
 await page.screenshot({path:path.join(out,'risk-offline-mobile.png'),fullPage:true});
 await context.setOffline(false);
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Salvo no servidor.');
 assert.equal(row.answers.riskSourcesBySelection[0][1].source,'Texto protegido sem internet');assert.equal(await recoveryCount(),0);
 // Simulate an unreachable save while allowing a subsequent authenticated reload.
 await page.evaluate(()=>window.__fixtureReject=true);
 await page.locator('[data-field=source]').fill('Texto para recuperar depois de recarregar');
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('Falha de conexão simulada'));
 assert.equal(await recoveryCount(),1);
 await page.reload();await page.locator('.draft-recovery-dialog').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Recuperar alterações',exact:true}).click();
 await page.locator('#editor').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Salvo no servidor.');
 assert.equal(await page.locator('[data-field=source]').inputValue(),'Texto para recuperar depois de recarregar');assert.equal(row.answers.riskSourcesBySelection[0][1].source,'Texto para recuperar depois de recarregar');
 await page.screenshot({path:path.join(out,'risk-recovered-mobile.png'),fullPage:true});
 const riskWrites=writes.length;
 await page.goto(`${origin}/levantamento.html?id=${id}`);
 await page.locator('#questionnaire').waitFor({state:'visible'});
 await page.locator('#visit-date').fill('2026-10-20');
 await page.waitForFunction(()=>document.querySelector('#wizard-save-status').textContent==='Salvo no servidor.');
 assert.equal(row.answers.visitDate,'2026-10-20');assert.ok(writes.length>riskWrites);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'wizard mobile no horizontal overflow');
 await page.screenshot({path:path.join(out,'wizard-saved-mobile.png'),fullPage:true});
 const count=writes.length;await context.setOffline(true);await page.locator('#visit-date').fill('2026-10-19');
 await page.waitForFunction(()=>document.querySelector('#wizard-save-status').textContent.includes('Aguardando conexão'));assert.equal(writes.length,count);assert.ok(await recoveryCount()>0);
 await page.screenshot({path:path.join(out,'wizard-offline-mobile.png'),fullPage:true});
 await context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#wizard-save-status').textContent==='Salvo no servidor.');assert.equal(row.answers.visitDate,'2026-10-19');
 // Actual Add cargo form: protect against implicit CSS grid columns at phone widths.
 await page.locator('#wizard-step-select').selectOption('2');
 const jobCard=page.locator('.job-card').first();
 await jobCard.locator('.add-job').click();
 const jobForm=jobCard.locator('.job-form');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  const layout=await jobForm.evaluate(form=>{
   const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom};};
   return {form:rect(form),fields:[...form.querySelectorAll('input,textarea,button')].map(rect),columns:getComputedStyle(form).gridTemplateColumns,textareaMin:getComputedStyle(form.querySelector('textarea')).minHeight};
  });
  assert.equal(layout.columns.trim().split(/\s+/).length,1,'one actual column, no implicit track at '+width);
  for(const field of layout.fields)assert.ok(Math.abs(field.width-layout.form.width)<2,'full-width cargo control at '+width);
  for(let i=1;i<layout.fields.length;i++)assert.ok(layout.fields[i].y>=layout.fields[i-1].bottom,'cargo controls stack at '+width);
  assert.equal(layout.textareaMin,'120px');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'cargo no mobile overflow at '+width);
  await jobCard.screenshot({path:path.join(out,`add-cargo-mobile-${width}.png`)});
 }
 // Desktop keeps the original two-column name/count presentation.
 await page.setViewportSize({width:1280,height:900});
 const desktop=await jobForm.evaluate(form=>({columns:getComputedStyle(form).gridTemplateColumns,nameY:form.elements.jobName.getBoundingClientRect().y,countY:form.elements.quantity.getBoundingClientRect().y}));
 assert.equal(desktop.columns.trim().split(/\s+/).length,2);assert.ok(Math.abs(desktop.nameY-desktop.countY)<2);
 await page.setViewportSize({width:390,height:844});
 await page.locator('#wizard-step-select').selectOption('3');
 const gheCard=page.locator('#ghe-management-list>.risk-card').first();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  const layout=await gheCard.evaluate(card=>{
   const actions=card.querySelector('.ghe-card-actions'),primary=actions.querySelector('button:not(.ghe-delete)'),secondary=actions.querySelector('.ghe-delete');
   return {width:actions.getBoundingClientRect().width,primary:primary.getBoundingClientRect().toJSON(),secondary:secondary.getBoundingClientRect().toJSON(),columns:getComputedStyle(actions).gridTemplateColumns};
  });
  assert.equal(layout.columns.trim().split(/\s+/).length,1);assert.ok(Math.abs(layout.primary.width-layout.width)<2,'GHE primary full width');
  assert.ok(layout.secondary.y>=layout.primary.bottom,'GHE delete on separate row');assert.ok(layout.secondary.height>=44,'GHE delete touch target');
  assert.ok(layout.secondary.width<layout.primary.width,'GHE delete remains secondary');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'GHE no mobile overflow at '+width);
  await gheCard.screenshot({path:path.join(out,`ghe-organized-mobile-${width}.png`)});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 console.log(JSON.stringify({passed:true,writes:writes.length,errors,blocked,output:out},null,2));
}finally{await fs.writeFile(path.join(out,'diagnostics.json'),JSON.stringify({writes,errors,blocked},null,2));await browser.close();}
