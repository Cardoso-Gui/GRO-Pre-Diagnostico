// Synthetic UI only: all requests are intercepted; no production credentials/records.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),out=path.join(repo,'test-results/draft-autosave');await fs.mkdir(out,{recursive:true});
const origin='http://127.0.0.1:43219',TEAM='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d';
const member={user_id:'user-a',team_id:TEAM,role:'admin',display_name:'Equipe 1 teste',active:true,teams:{active:true}};
const draft={id:'11111111-1111-4111-8111-111111111111',client_id:'client-a',status:'draft',revision:4,title:'Rascunho sintético',responsible_id:'user-a',updated_at:'2026-10-21T12:00:00Z'};
const rows=[draft,{...draft,id:'22222222-2222-4222-8222-222222222222',status:'completed',title:'Concluído sintético'}];
const mock=`export const SUPABASE_URL='${origin}';export const SUPABASE_KEY='fixture';export const loginStorage={};
export async function getTeamMember(){return {member:window.fixtureMember||${JSON.stringify(member)}};}
export const authClient={auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({})},from(table){let deletion=false,filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},range(){return q},delete(){deletion=true;return q},async maybeSingle(){if(deletion){window.deleteCalls=(window.deleteCalls||0)+1;window.deleteFilters=filters;return {data:{id:'${draft.id}'}}}return {data:null}},then(resolve){return Promise.resolve({data:table==='clients'?[{id:'client-a',legal_name:'Empresa sintética',archived:false}]:table==='assessments'?(window.deleteCalls?${JSON.stringify(rows.slice(1))}:${JSON.stringify(rows)}):[],error:null}).then(resolve)}};return q}};`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const context=await browser.newContext({viewport:{width:390,height:844}});let blocked=[],errors=[];
await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin){blocked.push(url.href);return route.abort()}const name=decodeURIComponent(url.pathname).slice(1);if(name==='auth-client.js')return route.fulfill({body:mock,contentType:'text/javascript'});const file=path.resolve(repo,name);if(!file.startsWith(repo+path.sep))return route.abort();try{return route.fulfill({body:await fs.readFile(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html'})}catch{return route.fulfill({status:404,body:'Not found'})}});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
async function open(){await page.goto(origin+'/levantamento.html');await page.locator('#client-select').selectOption('client-a');await page.locator('#draft-list article').first().waitFor();}
try{
 await open();assert.equal(await page.locator('.delete-draft').count(),1);assert.equal(await page.getByText('Continuar rascunho',{exact:true}).count(),1);
 await page.locator('.delete-draft').click();await page.locator('#delete-dialog').waitFor({state:'visible'});await page.screenshot({path:path.join(out,'draft-delete-confirm-team1-mobile.png'),fullPage:true});
 await page.locator('#cancel-delete').click();assert.equal(await page.evaluate(()=>window.deleteCalls||0),0);
 await page.locator('.delete-draft').click();await page.evaluate(m=>window.fixtureMember={...m,team_id:'other'},member);await page.locator('#confirm-delete').click();await page.waitForFunction(()=>document.querySelector('#delete-status').textContent.includes('acesso mudou'));assert.equal(await page.evaluate(()=>window.deleteCalls||0),0);
 await open();await page.locator('.delete-draft').click();await page.locator('#confirm-delete').click();await page.waitForFunction(()=>window.deleteCalls===1);await page.locator('#delete-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.delete-draft').count(),0);assert.deepEqual(await page.evaluate(()=>window.deleteFilters),[['id',draft.id],['revision',4],['status','draft']]);
 await page.addInitScript(m=>{window.fixtureMember={...m,team_id:'other',role:'admin',is_super_admin:true}},member);await open();assert.equal(await page.locator('.delete-draft').count(),0);assert.equal(await page.getByText('Continuar rascunho',{exact:true}).count(),1);await page.screenshot({path:path.join(out,'draft-history-other-team-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log('Draft deletion browser passed: Team1 confirmation, cancel, changed identity denial, other-team admin hidden, edit preserved.');
}finally{await browser.close()}
