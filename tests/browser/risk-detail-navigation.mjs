import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const out=path.join(repo,'test-results/risk-detail-navigation');await fs.mkdir(out,{recursive:true});
const origin='http://127.0.0.1:43223';
const id='11111111-1111-4111-8111-111111111111';
const member={user_id:'user-a',team_id:'team-a',role:'admin',display_name:'Teste Local',active:true,teams:{active:true}};
const base={id,revision:1,status:'draft',client_id:'client-a',responsible_id:'user-a',visit_responsible_id:null,title:'Levantamento de teste isolado',answers:{cnpj:'12345678000199',currentCompany:{razao_social:'Empresa fictícia de teste',cnpj:'12345678000199'},visitDate:'2026-10-21',selectedRiskMode:'ghe',selectedSectors:['Administrativo'],jobsBySector:[['Administrativo',[{name:'Auxiliar',quantity:1,activities:'Teste'}]]],gheList:[{id:'ghe__a',name:'Administrativo',linkedJobs:[{sectorName:'Administrativo',jobName:'Auxiliar'}]}],selectedRisksByTarget:[['ghe__a',['ERG.002']]],riskSourcesBySelection:[]}};
base.answers.employees='3';
base.answers.selectedSectors=['Limpeza','Limpeza automotiva','Manutenção'];
base.answers.jobsBySector=[
 ['Limpeza',[{name:'limpeza',quantity:1,activities:'Atividade sintética'}]],
 ['Limpeza automotiva',[{name:'limpeza',quantity:1,activities:'Atividade sintética'}]],
 ['Manutenção',[{name:'Limpeza técnica',quantity:1,activities:'Atividade sintética'}]],
];
base.answers.gheList=[{id:'ghe__a',name:'Limpeza automotiva',linkedJobs:[{sectorName:'Manutenção',jobName:'Limpeza técnica'}]}];
base.answers.riskSourcesBySelection=[['source__ghe__a__erg.002',{note:'Observação já preenchida'}]];
base.answers.epiBySelection=[['epi-data__ghe__a__erg.002',{applicable:'Não',items:[]}]];
let row=structuredClone(base),writes=[],errors=[],blocked=[];
const baselineScript=process.env.GRO_BASELINE_SCRIPT?await fs.readFile(process.env.GRO_BASELINE_SCRIPT,'utf8'):null;
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
 if(url.pathname==='/script.js'&&baselineScript)return route.fulfill({contentType:'text/javascript',body:baselineScript});
 if(url.pathname==='/assessment-data.js')return route.fulfill({contentType:'text/javascript',body:assessmentMock});
 const file=path.join(repo,url.pathname);if(!file.startsWith(repo+path.sep))return route.abort();
 try{return route.fulfill({body:await fs.readFile(file),contentType:/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});}catch{return route.fulfill({status:404,body:'Not found'});}
});

const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss());
try{
 await page.goto(`${origin}/levantamento.html?id=${id}`);
 await page.locator('#questionnaire').waitFor({state:'visible'});
 await page.locator('#wizard-step-select').selectOption('4');
 const open=page.locator('.target-risk-details').first();
 assert.equal(await open.isEnabled(),true);
 if(baselineScript){
  await open.click();
  await page.locator('.gro-validation-dialog').waitFor({state:'visible'});
  const warning=await page.locator('.gro-validation-dialog').textContent();
  assert.ok(warning.includes('Limpeza / limpeza: vincule o cargo a um GHE.'));
  assert.ok(warning.includes('Limpeza automotiva / limpeza: vincule o cargo a um GHE.'));
  assert.match(page.url(),/levantamento\.html/);
  await page.screenshot({path:path.join(out,'baseline-blocked.png'),fullPage:true});
  console.log(JSON.stringify({baselineReproduced:true,errors,blocked},null,2));
 }else{
  // A real save failure must still keep the draft open and recoverable.
  await page.locator('#wizard-step-select').selectOption('0');
  await page.evaluate(()=>window.__fixtureReject=true);
  await page.locator('#visit-date').fill('2026-11-05');
  await page.locator('#wizard-step-select').selectOption('4');
  await open.click();
  await page.waitForFunction(()=>document.querySelector('#wizard-save-status').textContent.includes('Falha de conexão simulada'));
  assert.match(page.url(),/levantamento\.html/);
  assert.equal(await page.locator('.gro-validation-dialog[open]').count(),0);
  assert.equal(await page.locator('#open-risk-details').isEnabled(),true);
  await page.evaluate(()=>window.__fixtureReject=false);
  await open.click();
  await page.waitForURL(/risk-detail\.html/);
  await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).searchParams.get('target'),'ghe__a');
  assert.equal(await page.locator('#target-title').textContent(),'Limpeza automotiva');
  assert.equal(await page.locator('[data-field=note]').inputValue(),'Observação já preenchida');
  await page.locator('[data-field=source]').fill('Exposição preenchida com outros cargos pendentes');
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Salvo no servidor.');
  assert.equal(row.answers.riskSourcesBySelection[0][1].source,'Exposição preenchida com outros cargos pendentes');
  assert.deepEqual(row.answers.jobsBySector,base.answers.jobsBySector);
  assert.deepEqual(row.answers.gheList,base.answers.gheList);
  assert.deepEqual(row.answers.epiBySelection,base.answers.epiBySelection);
  await page.screenshot({path:path.join(out,'details-open-mobile.png'),fullPage:true});
  await page.locator('#back').click();
  await page.waitForURL(/levantamento\.html/);
  await page.locator('#questionnaire').waitFor({state:'visible'});
  await page.locator('#wizard-step-select').selectOption('6');
  assert.equal(await page.locator('#generate-report-button').isDisabled(),true);
  const review=await page.locator('#review-stage-content').textContent();
  assert.ok(review.includes('Limpeza / limpeza: vincule o cargo a um GHE.'));
  assert.ok(review.includes('Limpeza automotiva / limpeza: vincule o cargo a um GHE.'));
  // The underlying finalization handler remains gated, not just its disabled UI.
  await page.evaluate(async()=>{window.__completionAttempts=0;window.GRO_CLOUD.complete=async()=>{window.__completionAttempts++;};await renderFinalReport();});
  assert.equal(await page.evaluate(()=>window.__completionAttempts),0);
  await page.locator('.gro-validation-dialog').waitFor({state:'visible'});
  await page.screenshot({path:path.join(out,'finalization-still-blocked.png'),fullPage:true});
  await page.locator('.gro-validation-dialog').getByRole('button',{name:'OK, preencher'}).click();
  // Revisiting the selected risk must retain saved input without duplicate/blank rows.
  await page.locator('#wizard-step-select').selectOption('4');
  await page.locator('.target-risk-details').first().click();
  await page.waitForURL(/risk-detail\.html/);
  await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-field=source]').inputValue(),'Exposição preenchida com outros cargos pendentes');
  assert.equal(row.answers.riskSourcesBySelection.length,1);
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  console.log(JSON.stringify({passed:true,writes:writes.length,errors,blocked,output:out},null,2));
 }
}finally{await fs.writeFile(path.join(out,baselineScript?'baseline-diagnostics.json':'diagnostics.json'),JSON.stringify({writes,errors,blocked},null,2));await browser.close();}
