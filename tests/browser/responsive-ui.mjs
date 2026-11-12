// Layout and screen controls only: all records are synthetic. No authentication,
// API calls, customers or production services are used in this suite.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const out=path.join(repo,'test-results/risk-detail-navigation/responsive-ui');await fs.mkdir(out,{recursive:true});
const origin='http://127.0.0.1:43224';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const context=await browser.newContext();let errors=[],blocked=[];
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());if(url.origin!==origin){blocked.push(url.href);return route.abort();}
 const file=path.join(repo,url.pathname);if(!file.startsWith(repo+path.sep))return route.abort();
 try{
  let body=await fs.readFile(file);
  if(file.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>/src="\.\/(?:shared-header|gro-ui|screen-ux)\.js/.test(tag)?tag:''));
  return route.fulfill({body,contentType:/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});
 }catch{return route.fulfill({status:404,body:'Not found'});}
});
const results=[];
try{
 for(const screen of ['inicio','clients','client','levantamento','risk-detail','reports','team','admin','occurrences']){
  const page=await context.newPage();page.on('pageerror',e=>errors.push(screen+': '+e.message));
  await page.goto(origin+'/'+screen+'.html');
  await page.evaluate(async screen=>{
   document.querySelector('#session-check')?.setAttribute('hidden','');
   for(const id of ['home','clients-page','team-page','admin-page','protected-workspace']){const el=document.getElementById(id);if(el)el.hidden=false;}
   const {updateHeader}=await import('/app-header.js');updateHeader({display_name:'Pessoa de demonstração',role:'admin'});
   if(screen==='inicio'){document.querySelector('#greeting-name').textContent='Demonstração';document.querySelector('#today').textContent='12 de novembro de 2026';}
   if(screen==='client'){document.querySelector('#loading').hidden=true;document.querySelector('#client-form').hidden=false;document.querySelector('#content').hidden=false;}
   if(screen==='levantamento'){
    document.querySelector('#questionnaire').hidden=false;document.querySelector('#company-card').hidden=false;
    const {initAssessmentWizard}=await import('/assessment-wizard.js');initAssessmentWizard().loaded({id:'fixture',title:'Levantamento de demonstração',isNew:true});
   }
   if(screen==='risk-detail'){
    document.querySelector('#editor').hidden=false;document.querySelector('#message').hidden=true;
    document.querySelector('#target-title').textContent='Grupo de manutenção e conservação de ambientes';document.querySelector('#progress-label').textContent='1 de 3 riscos preenchidos';
    document.querySelector('#risk-nav').innerHTML='<section><h3>Físicos</h3><button data-risk-index="0" data-complete="false" aria-current="true">Ruído de máquinas de manutenção<small>Pendente</small></button><button data-risk-index="1" data-complete="true">Vibração<small>Preenchido</small></button></section>';
    document.querySelector('#mobile-risk-select').innerHTML='<option>Ruído de máquinas de manutenção — Pendente</option>';
    const article=document.createElement('article');article.append(document.querySelector('#detail-template').content.cloneNode(true));article.querySelector('h2').textContent='Ruído de máquinas de manutenção';document.querySelector('#cards').append(article);
   }
   if(screen==='team'||screen==='admin'){
    const list=document.querySelector(screen==='team'?'#member-list':'#users-list');const cls=screen==='team'?'directory':'access';
    list.innerHTML=`<section class="${cls}-group"><div class="${cls}-group-heading"><h2>Equipe de demonstração</h2></div><table class="${cls}-table"><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil de acesso</th><th>Status</th></tr></thead><tbody><tr><td><div class="${cls}-person"><strong>Nome sintético para conferir quebras de linha</strong></div></td><td>pessoa.demonstracao</td><td>Administrador</td><td>Ativo</td></tr></tbody></table></section>`;
   }
  },screen);
  for(const width of [320,768,1024,1440]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const state=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2}).slice(0,10).map(e=>e.tagName+'.'+e.className)}));
   results.push({screen,width,...state});
   assert.ok(state.scroll<=width+2,`${screen} ${width}px horizontal overflow: ${JSON.stringify(state)}`);
   if(width===320||width===1440)await page.screenshot({path:path.join(out,`${screen}-${width}.png`),fullPage:true});
  }
  if(screen==='risk-detail'){
   const noOverlap=await page.evaluate(()=>document.querySelector('.bottom').getBoundingClientRect().top>=document.querySelector('#cards').getBoundingClientRect().bottom);
   assert.equal(noOverlap,true,'risk actions must not cover form fields');
   await page.setViewportSize({width:1440,height:1000});await page.locator('.risk-pending-filter input').check();assert.equal(await page.locator('#risk-nav button:visible').count(),1);
  }
  if(screen==='team'){
   await page.locator('#member-search').fill('Demonstração');await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();assert.equal(await page.locator('#member-search').inputValue(),'');
  }
  if(screen==='admin'){
   await page.evaluate(()=>document.querySelector('#user-dialog').showModal());
   await page.setViewportSize({width:320,height:1000});
   const overflow=await page.locator('#user-dialog').evaluate(el=>el.scrollWidth>el.clientWidth+2);assert.equal(overflow,false,'access dialog fits 320px');
   await page.screenshot({path:path.join(out,'admin-dialog-320.png'),fullPage:true});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
}finally{
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify({results,errors,blocked},null,2));await browser.close();
}
console.log('Responsive UI: 9 screens at 320, 768, 1024 and 1440px passed.');
