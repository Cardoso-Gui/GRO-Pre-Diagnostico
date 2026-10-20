import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {JSDOM} from 'jsdom';

// Run on an allowed host (the GitHub Actions job installs official Chromium).
// The fixture is never pointed at the deployed app or a customer report.
const repo=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const out=path.resolve(process.env.REPORT_PDF_OUTPUT||path.join(repo,'test-results/report-pdf'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const failures=[];
const contentType=file=>file.endsWith('.css')?'text/css':/\.m?js$/.test(file)?'text/javascript':'text/html';
const normalize=text=>text.replace(/\s+/g,' ').trim();
function inspectPdf(file){
 const list=execFileSync('pdfimages',['-list',file],{encoding:'utf8'});
 const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
 const bbox=execFileSync('pdftotext',['-bbox-layout',file,'-'],{encoding:'utf8'});
 const doc=new JSDOM(bbox,{contentType:'text/xml'}).window.document;
 const pages=[...doc.querySelectorAll('page')];
 const images=list.split('\n').filter(line=>/^\s*\d+\s+\d+\s+image\s/.test(line)).map(line=>{const p=line.trim().split(/\s+/);return {page:Number(p[0]),width:Number(p[3]),height:Number(p[4])};});
 return {images,text,pageCount:pages.length,pages:pages.map(page=>({width:Number(page.getAttribute('width')),height:Number(page.getAttribute('height')),words:[...page.querySelectorAll('word')].map(word=>({text:word.textContent,xMin:Number(word.getAttribute('xMin')),xMax:Number(word.getAttribute('xMax')),yMin:Number(word.getAttribute('yMin')),yMax:Number(word.getAttribute('yMax'))}))}))};
}
function validate(result){
 const {scenario,diagnostics:diag,pdf}=result,snap=diag.prints[0];
 assert.equal(diag.errors.length,0,`browser errors: ${diag.errors.join('; ')}`);
 assert.equal(diag.blocked.length,0,`unexpected network: ${diag.blocked.join('; ')}`);
 assert.ok(snap?.pageCount>0,'real beforeprint must call paginateReport');
 assert.equal(diag.beforeCount,2,'both PDF exports must trigger beforeprint');
 assert.equal(diag.afterCount,2,'both PDF exports must restore the viewer');
 assert.equal(diag.restored,true,'original interactive nodes restored after printing');
 assert.equal(diag.answersUnchanged,true,'saved answers unchanged');
 assert.equal(diag.originalNodesRestored,true,'exact original nodes and images restored');
 assert.equal(diag.detailsRestored,true,'original disclosure state restored');
 assert.equal(pdf.pageCount,snap.pageCount,'one physical PDF page per calculated sheet; no blank overflow pages');
 const cards=snap.sheets.flatMap(sheet=>sheet.cards);
 assert.equal(cards.length,diag.expected.length,'every ordinary risk appears exactly once');
 for(const record of diag.expected){
  const matches=cards.filter(card=>card.id===record.id);assert.equal(matches.length,1,`${record.id}: unique record`);
  assert.equal(matches[0].group,record.group,`${record.id}: group label retained`);
  const categoryKeys={'Físicos':'physical','Químicos':'chemical','Biológicos':'biological','Ergonômicos':'ergonomic','Acidentes':'accident'};
  assert.equal(matches[0].category,categoryKeys[record.type],`${record.id}: risk category retained`);
  for(const token of [record.source,record.damage,record.measure])assert.equal((pdf.text.match(new RegExp(`\\b${token}\\b`,'g'))||[]).length,1,`${token}: PDF content exactly once`);
 }
 for(const sheet of snap.sheets){
  assert.ok(sheet.body.bottom<=sheet.rect.bottom+1,`page ${sheet.page}: body clipped`);
  assert.ok(new Set(sheet.cards.map(card=>card.group)).size<=1,`page ${sheet.page}: different sector/cargo groups must remain separate`);
  for(const [i,card] of sheet.cards.entries()){
   assert.ok(card.rect.bottom<=sheet.rect.bottom+1,`${card.id}: card cut off`);
   assert.ok(card.rect.x>=sheet.rect.x-1&&card.rect.right<=sheet.rect.right+1,`${card.id}: horizontal cutoff`);
   for(const field of card.fields)assert.ok(field.rect.bottom<=card.rect.bottom+1,`${card.id}: field escapes card`);
   for(const other of sheet.cards.slice(i+1)){
    const width=Math.min(card.rect.right,other.rect.right)-Math.max(card.rect.x,other.rect.x),height=Math.min(card.rect.bottom,other.rect.bottom)-Math.max(card.rect.y,other.rect.y);
    assert.ok(width<=1||height<=1,`${card.id} overlaps ${other.id}`);
   }
  }
 }
 for(const page of pdf.pages)for(const word of page.words)assert.ok(word.xMin>=0&&word.yMin>=0&&word.xMax<=page.width+.5&&word.yMax<=page.height+.5,`PDF word outside page: ${word.text}`);
 if(scenario==='full'){
  assert.equal(diag.expected.length,19,'full fixture retains all nineteen risks');
  assert.equal(snap.sheets[0].cover.length,6,'both opening paragraphs, visit, objective, summary and dimensions fit the first page');
  for(const sheet of snap.sheets){
   for(const [i,entry] of sheet.cover.entries()){
    assert.ok(entry.rect.bottom<=sheet.rect.bottom+1,'cover entry does not overflow the page');
    assert.ok(entry.rect.x>=sheet.rect.x-1&&entry.rect.right<=sheet.rect.right+1,'cover entry is not cut off horizontally');
    for(const next of sheet.cover.slice(i+1))assert.ok(entry.rect.bottom<=next.rect.y+1,'cover prose and data do not overlap');
   }
  }
  const visit=snap.sheets[0].cover.find(entry=>entry.className==='report-introduction');
  assert.ok(normalize(pdf.text).includes(normalize(visit.text)),'all visit prose is present in extracted PDF');
  if(result.label==='current'){
   assert.ok(visit.text.startsWith('A visita à empresa Empresa fictícia de teste (Unidade sintética), inscrita no CNPJ sob o nº 12.345.678/0001-99 e situada em Rua Sintética, 100, Bloco de Teste, Bairro Fictício, Cidade Sintética/SP, CEP: 01000-000, foi realizada em 01/01/2026, por Responsável fictício pela visita. '));
   assert.ok(visit.text.endsWith('O levantamento teve como foco conhecer as atividades desenvolvidas nos setores abrangidos pela visita e registrar as condições de trabalho, os riscos identificados e as medidas de prevenção informadas. Para contextualizar esses registros, foram consideradas as observações realizadas no local e as informações fornecidas pela empresa, dentro do escopo da visita.'));
  }
  assert.equal(diag.originals.length,6);assert.ok(diag.originals.every(img=>img.complete&&img.naturalWidth>0&&img.sourceKind==='blob'),'six decoded blob originals');
  const printedImages=snap.sheets.flatMap(sheet=>sheet.images);
  assert.equal(printedImages.length,6,'six print images');
  assert.ok(printedImages.every(img=>img.sameOriginal&&img.complete&&img.naturalWidth>0),'beforeprint reuses all decoded original image nodes synchronously');
  assert.equal(pdf.images.length,6,'pdfimages must find six embedded raster photos, not empty frames');
  for(const size of diag.photoSizes)assert.equal(pdf.images.filter(img=>img.width===size.width&&img.height===size.height).length,1,`embedded photo ${size.width}x${size.height} exactly once`);
 }else{
  assert.equal(snap.sheets.filter(sheet=>sheet.cards.length).length,1,'five small categories from one group should share a sheet');
 }
 // Export again without navigation, proving afterprint restores usable sources.
 assert.deepEqual(result.repeat.images,pdf.images,'second PDF retains all six photos');
 assert.equal(normalize(result.repeat.text),normalize(pdf.text),'repeated export preserves content and pagination');
}
async function run(label,root,scenario){
 const context=await browser.newContext({viewport:{width:1400,height:1000},locale:'pt-BR',timezoneId:'UTC',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],blocked=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='https://gro-synthetic.invalid'){blocked.push(url.origin);await route.abort();return;}
  const relative=decodeURIComponent(url.pathname).replace(/^\//,''),base=relative.startsWith('tests/browser/')?repo:root;
  const file=path.resolve(base,relative);
  if(!file.startsWith(base+path.sep)){blocked.push('invalid fixture path');await route.abort();return;}
  try{await route.fulfill({status:200,contentType:contentType(file),body:await fs.readFile(file)});}catch(error){errors.push(`${relative}: ${error.message}`);await route.fulfill({status:404,body:'Missing synthetic test resource'});}
 });
 const stem=`${label}-${scenario}`;
 try{
  await page.goto(`https://gro-synthetic.invalid/tests/browser/report-print-fixture.html?scenario=${scenario}&version=${label}`);
  await page.waitForFunction(()=>window.synthetic?.ready===true);
  const file=path.join(out,`${stem}.pdf`);
  // No artificial delay or manual beforeprint: exercise Chromium's PDF path.
  await page.pdf({path:file,format:'A4',printBackground:true,preferCSSPageSize:true});
  const repeatFile=path.join(out,`${stem}-repeat.pdf`);
  await page.pdf({path:repeatFile,format:'A4',printBackground:true,preferCSSPageSize:true});
  const diagnostics=await page.evaluate(()=>{
   const s=window.synthetic;return {expected:s.expected,photoSizes:s.photoSizes,originals:s.originals,prints:s.prints,beforeCount:s.beforeCount,afterCount:s.afterCount,...s.snapshot()};
  });
  Object.assign(diagnostics,{errors,blocked});
  const result={label,scenario,diagnostics,pdf:inspectPdf(file),repeat:inspectPdf(repeatFile)};
  await fs.writeFile(path.join(out,`${stem}-diagnostics.json`),JSON.stringify(result,null,2));
  // These renders contain only the synthetic fixture and support visual review.
  execFileSync('pdftoppm',['-scale-to','1100','-png',file,path.join(out,`${stem}-page`)],{stdio:'pipe'});
  try{validate(result);result.validation='passed';}catch(error){result.validation=error.message;if(label==='current')failures.push(`${stem}: ${error.message}`);}
  results.push(result);console.log(`${stem}: ${result.pdf.pageCount} PDF pages; ${result.pdf.images.length} embedded images; ${result.validation}`);
 }catch(error){
  const failure={label,scenario,error:error.stack||String(error),validation:error.message};
  await fs.writeFile(path.join(out,`${stem}-error.json`),JSON.stringify({failure,errors,blocked},null,2));
  results.push(failure);if(label==='current')failures.push(`${stem}: ${error.message}`);
  console.error(`${stem}: ${error.message}`);
 }finally{await context.close();}
}
try{
 if(process.env.REPORT_BASELINE_ROOT)for(const scenario of ['full','packing'])await run('baseline',path.resolve(process.env.REPORT_BASELINE_ROOT),scenario);
 for(const scenario of ['full','packing'])await run('current',repo,scenario);
}finally{await browser.close();}
const summary=results.map(result=>({label:result.label,scenario:result.scenario,pdfPages:result.pdf?.pageCount,embeddedImages:result.pdf?.images.length,imagesReadyDuringBeforePrint:result.diagnostics?.prints[0]?.sheets.flatMap(sheet=>sheet.images).filter(img=>img.complete&&img.naturalWidth>0).length,validation:result.validation}));
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
assert.equal(failures.length,0,failures.join('\n'));
