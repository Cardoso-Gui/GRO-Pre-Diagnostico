import {authClient,getTeamMember} from './auth-client.js';
import {updateHeader} from './app-header.js?v=20260925-header2';
import {organizeReport} from './report-layout.js?v=20260925-layout3';
import {addReuseButton} from './reuse-report.js';
const message=document.querySelector('#report-status'),content=document.querySelector('#report-content'),print=document.querySelector('#report-print');
const tags=new Set(['section','div','article','h2','h3','h4','p','span','strong','small','ul','li']);
function renderNode(node,depth=0){
 if(depth>30||!node||typeof node!=='object')throw Error('Formato de relatório inválido.');
 if(typeof node.text==='string')return document.createTextNode(node.text);
 if(!tags.has(node.tag)||!Array.isArray(node.children))throw Error('Formato de relatório inválido.');
 const el=document.createElement(node.tag);
 el.className=String(node.className||'').split(/\s+/).filter(c=>/^(report-[a-z-]+|nr-status|is-warning|is-neutral|is-ok)$/.test(c)).join(' ');
 node.children.forEach(child=>el.append(renderNode(child,depth+1)));return el;
}
async function load(){
 content.hidden=true;print.disabled=true;message.textContent='Carregando relatório…';
 try{
 const access=await getTeamMember();if(!access.member){if(access.reason==='network')throw Error('Não foi possível verificar seu acesso. Tente novamente.');location.replace('./index.html?reason=expired');return;}
 updateHeader(access.member);
 const id=new URLSearchParams(location.search).get('id');if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('Endereço de relatório inválido.');
 const {data,error}=await authClient.from('assessments').select('title,report_revision,final_snapshot,completed_at,team_members!assessments_responsible_id_fkey(display_name)').eq('id',id).eq('status','completed').maybeSingle();
 if(error||!data)throw Error('Relatório indisponível. Volte à lista ou tente novamente.');
 const doc=data.final_snapshot?.answers?.report_document;
 if(doc?.version!==1||!Array.isArray(doc.children))throw Error('Este relatório não possui uma versão de visualização compatível.');
 const fragment=document.createDocumentFragment();doc.children.forEach(node=>fragment.append(renderNode(node)));
 content.replaceChildren(fragment);content.querySelectorAll(".report-mini-card").forEach(card=>card.classList.toggle("report-long",card.textContent.length>1400));document.title=data.title+' · GRO';document.querySelector('#report-title').textContent=data.title;
 content.querySelectorAll('.report-summary-item').forEach(item=>{
   if(item.querySelector('span')?.textContent.trim()!=='CNPJ')return;
   const value=item.querySelector('strong');if(!value)return;
   const digits=value.textContent.replace(/\D/g,'');
   if(digits.length===14)value.textContent=digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
 });
 const date=new Date(data.completed_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const responsible=data.team_members?.display_name?.trim();
 const company=data.final_snapshot?.client;
 const companyName=company?.trade_name?.trim()||company?.legal_name||content.querySelector('.report-cover h3')?.textContent||'empresa';
 const companyBlock=Array.from(content.querySelectorAll('.report-block')).find(block=>block.querySelector('h3')?.textContent==='Dados da empresa');
 const companyLines=Array.from(companyBlock?.querySelectorAll('li')||[]);
 const lineValue=prefix=>companyLines.find(line=>line.textContent.startsWith(prefix))?.textContent.slice(prefix.length).trim();
 const cnpjDigits=String(company?.cnpj||data.final_snapshot?.answers?.cnpj||'').replace(/\D/g,'');
 const cnpj=cnpjDigits.length===14?cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):cnpjDigits;
 const address=company?.address||{};
 const street=[address.street,address.number,address.complement].filter(Boolean).join(', ');
 const cep=String(address.postal_code||'').replace(/^(\d{5})(\d{3})$/,'$1-$2');
 const fullAddress=[street,address.district,[address.city,address.state].filter(Boolean).join('/'),cep?'CEP: '+cep:''].filter(Boolean).join(', ')||lineValue('Endereço:');
 const legalName=company?.legal_name?.trim();
 const identity=legalName&&legalName!==companyName?`${legalName} (${companyName})`:companyName;
 const cnae=lineValue('CNAE principal:')||String(company?.cnae||'').replace(/^(\d{4})(\d)(\d{2})$/,'$1-$2/$3');
 content.querySelectorAll('.report-summary-item').forEach(item=>{
   if(item.querySelector('span')?.textContent.trim()==='CNPJ'){
     item.querySelector('span').textContent='CNAE principal';item.querySelector('strong').textContent=cnae||'Não informado';
   }
 });
 companyLines.forEach(line=>{if(/^(Razão social:|Nome fantasia:|CNPJ:|Endereço:|CNAE principal:)/.test(line.textContent))line.remove();});
 if(companyBlock)companyBlock.remove();
 const summaryGrid=content.querySelector('.report-summary-grid');
 if(summaryGrid){
   const items=Array.from(summaryGrid.querySelectorAll('.report-summary-item'));
   const findItem=label=>items.find(item=>item.querySelector('span')?.textContent.trim()===label);
   const cnaeCard=findItem('CNAE principal'),riskCard=findItem('Grau de risco'),staffCard=findItem('Funcionários'),organizationCard=findItem('Organização');
   if(riskCard&&staffCard){
     staffCard.querySelector('span')?.classList.add('report-second-label');
     riskCard.append(...Array.from(staffCard.childNodes));
   }
   const revisionCard=document.createElement('div');revisionCard.className='report-summary-item';
   for(const [label,value] of [['Revisão',Number.isInteger(data.report_revision)?'Rev '+String(data.report_revision).padStart(2,'0'):'Não informada'],['Data da visita',date]]){
     const caption=document.createElement('span');caption.textContent=label;if(label==='Data da visita')caption.className='report-second-label';
     const strong=document.createElement('strong');strong.textContent=value;revisionCard.append(caption,strong);
   }
   const riskBlock=Array.from(content.querySelectorAll('.report-block')).find(block=>block.querySelector('h3')?.textContent.trim()==='Riscos identificados');
   if(riskBlock&&organizationCard){const organization=document.createElement('p');organization.textContent='Organização: '+organizationCard.querySelector('strong').textContent;riskBlock.querySelector('h3').after(organization);}
   summaryGrid.replaceChildren(...[cnaeCard,riskCard,revisionCard].filter(Boolean));
 }
 const sizingBlock=Array.from(content.querySelectorAll('.report-block')).find(block=>block.querySelector('h3')?.textContent.trim()==='Dimensionamento CIPA/SESMT');
 const sectorsBlock=Array.from(content.querySelectorAll('.report-block')).find(block=>block.querySelector('h3')?.textContent.trim()==='Setores e cargos');
 if(sectorsBlock)sectorsBlock.classList.add('report-sectors');
 const introduction=document.createElement('p');introduction.className='report-introduction';
 introduction.textContent=`Em visita realizada em ${date}${responsible?', por '+responsible:''}, à empresa ${identity}${cnpj?', inscrita no CNPJ sob o nº '+cnpj:''}${fullAddress?', localizada em '+fullAddress:''}, foram levantadas informações sobre os setores, as atividades e as condições de trabalho. Este relatório apresenta os riscos identificados, as medidas de prevenção informadas e as necessidades de avaliação complementar, conforme as condições observadas na ocasião.`;
 const cover=content.querySelector('.report-cover');
 if(cover&&sizingBlock){
   const grid=document.createElement('div');grid.className='report-dimension-grid';
   const lines=Array.from(sizingBlock.querySelectorAll('li')).map(item=>item.textContent.trim());
   for(const label of ['CIPA','SESMT']){
     const card=document.createElement('section');card.className='report-dimension-card';
     const title=document.createElement('h4');title.textContent=label;card.append(title);
     const details=lines.filter(line=>line.startsWith(label+':')).map(line=>line.slice(label.length+1).trim());
     for(const detail of details.length?details:['Não informado']){const p=document.createElement('p');p.textContent=detail;card.append(p);}
     grid.append(card);
   }
   cover.append(grid);sizingBlock.remove();
 }
 if(cover){const summary=cover.querySelector('.report-summary-grid');if(summary)summary.before(introduction);else cover.append(introduction);}
 const objective=document.createElement('p');objective.className='report-objective';objective.textContent='O levantamento tem como objetivo apoiar a identificação dos perigos e o planejamento das ações de prevenção, considerando as atividades desenvolvidas e as informações fornecidas pela empresa.';
 introduction.after(objective);
 const closing=document.createElement('section');closing.className='report-closing';
 const heading=document.createElement('h3');heading.textContent='Considerações finais';
 const paragraph=document.createElement('p');paragraph.textContent='Este levantamento registra as condições observadas na data da visita e as informações fornecidas pela empresa. As necessidades de avaliação complementar e as melhorias apontadas deverão ser analisadas pelos responsáveis técnicos, para definição das medidas e dos prazos de implementação.';
 const attribution=document.createElement('div');attribution.className='report-attribution';
 const name=document.createElement('strong');name.textContent=responsible||'Responsável não disponível';
 const role=document.createElement('span');role.textContent='Responsável pelo levantamento';
 const completed=document.createElement('span');completed.textContent='Concluído em '+date;
 attribution.append(completed);
 const signatures=document.createElement('div');signatures.className='report-signatures';
 const companyResponsible=company?.contact_name?.trim()||data.final_snapshot?.answers?.currentCompany?.contact_name?.trim()||'';
 for(const [person,label] of [[companyResponsible,'Responsável da empresa'],[responsible||'','Responsável pela visita']]){
   const field=document.createElement('div');field.className='report-signature';
   const line=document.createElement('div');line.className='report-signature-line';line.setAttribute('aria-label','Espaço para assinatura');
   const personName=document.createElement('strong');personName.textContent=person||'Nome: __________________________________';
   const caption=document.createElement('span');caption.textContent=label;
   field.append(line,personName,caption);signatures.append(field);
 }
 closing.append(heading,paragraph,attribution,signatures);content.append(closing);
 organizeReport(content,data.final_snapshot?.answers||{});
 message.textContent='Concluído em '+new Date(data.completed_at).toLocaleString('pt-BR')+'. Versão preservada no histórico.';
 content.hidden=false;print.disabled=false;
 document.querySelector('.report-toolbar .reuse-report')?.remove();
 addReuseButton(document.querySelector('.report-toolbar'),id,authClient,getTeamMember,text=>{message.textContent=text;});
 if(new URLSearchParams(location.search).get('print')==='1'){history.replaceState(null,'','./report.html?id='+encodeURIComponent(id));await document.fonts.ready;window.print();}
 }catch(error){message.textContent=error.message;}
}
print.onclick=()=>window.print();document.querySelector('#report-retry').onclick=load;
document.querySelector('#sign-out').onclick=async()=>{content.hidden=true;await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
authClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){content.replaceChildren();content.hidden=true;print.disabled=true;location.replace('./index.html');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){content.hidden=true;print.disabled=true;}else load();});
await load();
