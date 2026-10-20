import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {REPORT_NOTICES,normalizeReportNotices} from '../report-notices.js';
import {organizeReport} from '../report-layout.js';
import {compactPrintReport} from '../report-print-compact.js';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function dom(t){const d=new JSDOM('<main id="content"></main>');t.after(()=>d.window.close());const previous={document:globalThis.document,Node:globalThis.Node};Object.assign(globalThis,{document:d.window.document,Node:d.window.Node});t.after(()=>Object.assign(globalThis,previous));return d.window.document.querySelector('main');}
function node(tag,text='',className=''){const el=document.createElement(tag);el.textContent=text;el.className=className;return el;}
function block(content,title){const block=node('section','','report-block');block.append(node('h3',title));const list=node('div','','report-card-list');block.append(list);content.append(block);return {block,list};}
function card(list,title,caption,lines){const card=node('article','','report-mini-card');card.append(node('strong',title),node('span',caption),...lines.map(text=>node('small',text)));list.append(card);return card;}
function legacy(content){
 const risks=block(content,'Riscos identificados'),combined=block(content,'EPIs e treinamentos sugeridos'),pending=block(content,'Pendências para validação técnica');
 const risk=card(risks.list,'Nenhum risco informado','',['Selecione riscos para consolidar esta seção.']);
 const epi=card(combined.list,'EPIs','EPIs informados no levantamento',['Risco fictício: EPI aplicável, mas não informado']);
 const training=card(combined.list,'Treinamentos','Sem sugestão pré-cadastrada',['Validar necessidade com o responsável técnico.']);
 const ul=node('ul');ul.append(node('li','Nenhuma medição/avaliação marcada como necessária neste levantamento.'));pending.block.append(ul);
 return {risks,combined,pending,risk,epi,training};
}
test('avisos legados completos recebem somente os textos aprovados, sem alterar dados e com repetição estável',t=>{
 const content=dom(t),nodes=legacy(content),answers={epiBySelection:[],custom:'preservado'},saved=JSON.stringify(answers),snapshot=content.cloneNode(true),before=snapshot.outerHTML;
 normalizeReportNotices(content,answers);assert.equal(nodes.risk.querySelector('small').textContent,REPORT_NOTICES.risks);assert.equal(nodes.epi.querySelector('small').textContent,'Risco fictício: '+REPORT_NOTICES.epi);assert.equal(nodes.training.querySelector('span').textContent,REPORT_NOTICES.training);assert.equal(nodes.training.querySelector('small').textContent,REPORT_NOTICES.trainingValidation);assert.equal(nodes.pending.block.querySelector('li').textContent,REPORT_NOTICES.measurements);
 const once=content.outerHTML;normalizeReportNotices(content,answers);assert.equal(content.outerHTML,once);assert.equal(JSON.stringify(answers),saved);assert.equal(snapshot.outerHTML,before);assert.doesNotThrow(()=>normalizeReportNotices(null));
});
test('campos e textos personalizados, variantes não aprovadas e estruturas incompletas permanecem intactos',t=>{
 const content=dom(t),{combined}=legacy(content),custom=[];
 custom.push(card(combined.list,'EPIs','Nenhum EPI aplicável informado',['Validar necessidade de EPI com o responsável técnico. Complemento preservado']));
 custom.push(card(combined.list,'Treinamento: Texto customizado','Sem sugestão pré-cadastrada',['Validar necessidade com o responsável técnico.']));
 custom.push(card(combined.list,'Treinamentos','Sem sugestão pré-cadastrada',['Validar necessidade com o responsável técnico.','Complemento preservado']));
 custom.push(card(combined.list,'EPIs','EPIs informados no levantamento',['Risco: EPI aplicável, mas não informado. Complemento','Risco: Luva <img src=x onerror=alert(1)>']));
 const outside=block(content,'Seção customizada');custom.push(card(outside.list,'Treinamentos','Sem sugestão pré-cadastrada',['Validar necessidade com o responsável técnico.']));
 const saved=custom.map(el=>el.outerHTML);normalizeReportNotices(content);assert.deepEqual(custom.map(el=>el.outerHTML),saved);assert.equal(content.querySelector('img'),null);
});
test('item EPI preenchido com o literal antigo não é tratado como ausência',t=>{
 const content=dom(t),{epi}=legacy(content),answers={epiBySelection:[['chave',{applicable:'Sim',items:['EPI aplicável, mas não informado']}]]},before=epi.outerHTML;
 normalizeReportNotices(content,answers);assert.equal(epi.outerHTML,before);
 epi.querySelector('small').textContent='Ruído: Luva especial: EPI aplicável, mas não informado';answers.epiBySelection[0][1].items=['Luva especial: EPI aplicável, mas não informado'];const custom=epi.outerHTML;normalizeReportNotices(content,answers);assert.equal(epi.outerHTML,custom);
});
test('organização mostra avisos vazios aprovados sem mudar as introduções principais',t=>{
 const content=dom(t);block(content,'Fontes geradoras');block(content,'EPIs e treinamentos sugeridos');organizeReport(content,{});
 assert.ok(content.textContent.includes(REPORT_NOTICES.improvements));assert.ok(content.textContent.includes(REPORT_NOTICES.measurements));assert.ok(content.textContent.includes(REPORT_NOTICES.training+' '+REPORT_NOTICES.trainingValidation));assert.ok(content.textContent.includes(REPORT_NOTICES.trainingIntroduction));
});
test('impressão conserva n/a e campos preenchidos ao exibir avisos de melhorias e medições vazias',t=>{
 const content=dom(t),group=node('details','','viewer-group'),summary=node('summary');summary.append(node('strong','Cargo fictício'));group.append(summary);content.append(group);
 const risk=node('details','','viewer-risk'),heading=node('summary','','viewer-risk-heading');heading.append(node('strong','Risco fictício'),node('small','TEST'));risk.append(heading);const detail=node('article','','report-risk-detail');for(const [label,value]of [['Melhorias propostas','n/a'],['Precisa medir/avaliar','Não'],['Observação',REPORT_NOTICES.risks]]){const field=node('div','','report-detail-field');field.append(node('strong',label,'report-field-label'),node('p',value));detail.append(field);}risk.append(detail);group.append(risk);content.append(node('section','','report-recommendations'));
 compactPrintReport(content);const recommendations=content.querySelector('.compact-recommendations');assert.ok(recommendations.textContent.includes(REPORT_NOTICES.improvements+' Registros como “n/a” permanecem nas fichas dos riscos.'));assert.ok(recommendations.textContent.includes(REPORT_NOTICES.measurements));assert.ok(detail.textContent.includes('n/a'));assert.ok(detail.textContent.includes(REPORT_NOTICES.risks));
});
test('gerador novo emite os mesmos avisos sem alterar valores informados',t=>{
 dom(t);const context=vm.createContext({document,groupSelectionsByTarget:selections=>selections.length?[{title:'Cargo fictício',selections}]:[],createReportBlock:title=>{const el=node('section');el.append(node('h3',title));return el;},createReportMiniCard:(title,caption,lines)=>{const list=node('div');return card(list,title,caption,lines);},getRiskSourceData:()=>({measure:'Não'}),addReportItem:(list,text)=>list.append(node('li',text)),getTrainingSuggestions:()=>[],getEpiData:()=>({applicable:'Sim',items:[]})});
 const source=read('script.js');vm.runInContext(source.slice(source.indexOf('function createIdentifiedRiskReportBlock('),source.indexOf('function createNrReportBlock(')),context);
 assert.ok(context.createIdentifiedRiskReportBlock([]).textContent.includes(REPORT_NOTICES.risks));assert.ok(context.createTechnicalPendingReportBlock([]).textContent.includes(REPORT_NOTICES.measurements));const selections=[{targetId:'synthetic',risk:{code:'TEST',name:'Risco fictício'}}],before=JSON.stringify(selections);const epi=context.createEpiTrainingReportBlock(selections);assert.ok(epi.textContent.includes('Risco fictício: '+REPORT_NOTICES.epi));assert.ok(epi.textContent.includes(REPORT_NOTICES.training));assert.ok(epi.textContent.includes(REPORT_NOTICES.trainingValidation));assert.equal(JSON.stringify(selections),before);
});
test('cache atualizado alcança gerador, visualizador e impressão sem persistência na normalização',()=>{
 for(const file of ['workspace.js','report-generator.js'])assert.ok(read(file).includes("file==='script.js'?'20261020-notices1'"));
 for(const [file,dependency]of [['report.html','report.js'],['levantamento.html','workspace.js'],['rectify.html','rectification-workspace.js'],['report.js','report-layout.js'],['report.js','report-viewer.js'],['report.js','report-generator.js'],['rectification-workspace.js','report-generator.js'],['report-viewer.js','report-print-compact.js']])assert.ok(read(file).includes(dependency+'?v=20261020-notices1'),file+' cache dependency '+dependency);
 for(const file of ['report.js','report-layout.js','report-print-compact.js'])assert.ok(read(file).includes('report-notices.js?v=20261020-notices1'));
 assert.doesNotMatch(read('report-notices.js'),/innerHTML|\.rpc\(|authClient\.from\(|supabase\.from\(|fetch\(|localStorage|sessionStorage/);
 assert.ok(read('script.js').includes(REPORT_NOTICES.normsIntroduction));
 assert.ok(read('report.js').includes('paragraph.textContent=REPORT_NOTICES.closing')); 
});

test('demais avisos condicionais e introdução NR legados são exatos, locais e idempotentes',t=>{
 const content=dom(t),sectors=block(content,'Setores e cargos'),combined=block(content,'EPIs e treinamentos sugeridos'),norms=block(content,'NRs identificadas no levantamento');
 const sector=card(sectors.list,'Nenhum setor informado','',['Preencha os setores para consolidar esta seção.']),epi=card(combined.list,'EPIs','Nenhum EPI aplicável informado',['Validar necessidade de EPI com o responsável técnico.']),nr=card(norms.list,'Nenhuma NR aplicável identificada','',['Revise o levantamento ou valide com o responsável técnico.']);
 const old='Normas gerais e normas com critérios identificados nos dados informados. Confirme o enquadramento e os requisitos com o responsável técnico; a ausência nesta lista não representa dispensa.',intro=node('p',old),custom=node('p',old+' Complemento específico preservado.');norms.block.append(intro,custom);const customBefore=custom.outerHTML;
 normalizeReportNotices(content);assert.equal(sector.querySelector('small').textContent,REPORT_NOTICES.sectors);assert.equal(epi.querySelector('span').textContent,REPORT_NOTICES.noEpi);assert.equal(epi.querySelector('small').textContent,REPORT_NOTICES.epiValidation);assert.equal(nr.querySelector('strong').textContent,REPORT_NOTICES.noNorms);assert.equal(nr.querySelector('small').textContent,REPORT_NOTICES.normsValidation);assert.equal(intro.textContent,REPORT_NOTICES.normsIntroduction);assert.equal(custom.outerHTML,customBefore);const once=content.outerHTML;normalizeReportNotices(content);assert.equal(content.outerHTML,once);
});
test('indicação sem fonte recebe somente o aviso e preserva a recomendação preenchida',t=>{
 const content=dom(t),details=block(content,'Fontes geradoras');details.list.append(node('h4','Cargo fictício'));card(details.list,'Risco fictício','TEST',['Fonte/situação: ','Precisa medir/avaliar: Sim','Melhorias propostas: Proposta específica <img src=x>']);organizeReport(content,{});assert.ok(content.textContent.includes(REPORT_NOTICES.measurementIndicated));assert.ok(content.textContent.includes('Proposta específica <img src=x>'));assert.equal(content.querySelector('img'),null);assert.equal(content.textContent.includes(REPORT_NOTICES.measurements),false);
});

test('os três parágrafos principais correspondem exatamente à aprovação',()=>{
 assert.equal(REPORT_NOTICES.trainingIntroduction,'Esta seção reúne sugestões de treinamento relacionadas às atividades e aos dados registrados no levantamento, organizadas por cargo ou grupo homogêneo de exposição (GHE). As indicações auxiliam na identificação de possíveis necessidades de capacitação e devem ser avaliadas pelos responsáveis técnicos, considerando as funções exercidas, as condições de trabalho e os requisitos aplicáveis.');
 assert.equal(REPORT_NOTICES.normsIntroduction,'Esta seção apresenta as Normas Regulamentadoras (NRs) gerais e aquelas associadas aos critérios identificados nos dados do levantamento. A relação serve como referência inicial para a análise dos responsáveis técnicos, que devem confirmar o enquadramento da empresa e os requisitos aplicáveis às suas atividades. A ausência de uma norma nesta lista não significa que ela seja inaplicável ou que a empresa esteja dispensada de cumpri-la.');
 assert.equal(REPORT_NOTICES.closing,'As melhorias propostas e as indicações de medição ou avaliação complementar apresentadas neste relatório devem ser analisadas pelos responsáveis técnicos, considerando as atividades e as condições registradas no levantamento. A partir dessa análise, devem ser definidas as medidas de prevenção pertinentes, as prioridades, os responsáveis pela execução e os prazos de implementação, com acompanhamento das ações adotadas.');
});
test('variantes personalizadas dos demais avisos não são normalizadas',t=>{
 const content=dom(t),custom=[];
 for(const [section,title,caption,line]of [['Setores e cargos','Nenhum setor informado','','Preencha os setores para consolidar esta seção.'],['EPIs e treinamentos sugeridos','EPIs','Nenhum EPI aplicável informado','Validar necessidade de EPI com o responsável técnico.'],['NRs identificadas no levantamento','Nenhuma NR aplicável identificada','','Revise o levantamento ou valide com o responsável técnico.']]){
  const {list}=block(content,section);custom.push(card(list,title,caption,[line+' Complemento específico.']));custom.push(card(list,title+' customizado',caption,[line]));
 }
 const before=content.outerHTML;normalizeReportNotices(content);assert.equal(content.outerHTML,before);
});
