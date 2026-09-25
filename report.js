import {authClient,getTeamMember} from './auth-client.js';
import {updateHeader} from './app-header.js?v=20260925-header2';
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
 const {data,error}=await authClient.from('assessments').select('title,final_snapshot,completed_at,team_members!assessments_responsible_id_fkey(display_name)').eq('id',id).eq('status','completed').maybeSingle();
 if(error||!data)throw Error('Relatório indisponível. Volte à lista ou tente novamente.');
 const doc=data.final_snapshot?.answers?.report_document;
 if(doc?.version!==1||!Array.isArray(doc.children))throw Error('Este relatório não possui uma versão de visualização compatível.');
 const fragment=document.createDocumentFragment();doc.children.forEach(node=>fragment.append(renderNode(node)));
 content.replaceChildren(fragment);content.querySelectorAll(".report-mini-card").forEach(card=>card.classList.toggle("report-long",card.textContent.length>1400));document.title=data.title+' · GRO';document.querySelector('#report-title').textContent=data.title;
 const date=new Date(data.completed_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const responsible=data.team_members?.display_name?.trim();
 const company=data.final_snapshot?.client;
 const companyName=company?.trade_name?.trim()||company?.legal_name||content.querySelector('.report-cover h3')?.textContent||'empresa';
 const introduction=document.createElement('p');introduction.className='report-introduction';
 introduction.textContent=`Em visita realizada em ${date}${responsible?', por '+responsible:''}, à empresa ${companyName}, foram levantadas informações sobre os setores, as atividades e as condições de trabalho. Este relatório apresenta os riscos identificados, as medidas de prevenção informadas e as necessidades de avaliação complementar, conforme as condições observadas na ocasião.`;
 const cover=content.querySelector('.report-cover');
 if(cover){const summary=cover.querySelector('.report-summary-grid');if(summary)summary.before(introduction);else cover.append(introduction);}
 const closing=document.createElement('section');closing.className='report-closing';
 const heading=document.createElement('h3');heading.textContent='Considerações finais';
 const paragraph=document.createElement('p');paragraph.textContent='Este levantamento registra as condições observadas na data da visita e as informações fornecidas pela empresa. As necessidades de avaliação complementar e as melhorias apontadas deverão ser analisadas pelos responsáveis técnicos, para definição das medidas e dos prazos de implementação.';
 const attribution=document.createElement('div');attribution.className='report-attribution';
 const name=document.createElement('strong');name.textContent=responsible||'Responsável não disponível';
 const role=document.createElement('span');role.textContent='Responsável pelo levantamento';
 const completed=document.createElement('span');completed.textContent='Concluído em '+date;
 attribution.append(name,role,completed);closing.append(heading,paragraph,attribution);content.append(closing);
 message.textContent='Concluído em '+new Date(data.completed_at).toLocaleString('pt-BR')+'. Versão preservada no histórico.';
 content.hidden=false;print.disabled=false;
 if(new URLSearchParams(location.search).get('print')==='1'){history.replaceState(null,'','./report.html?id='+encodeURIComponent(id));await document.fonts.ready;window.print();}
 }catch(error){message.textContent=error.message;}
}
print.onclick=()=>window.print();document.querySelector('#report-retry').onclick=load;
document.querySelector('#sign-out').onclick=async()=>{content.hidden=true;await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
authClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){content.replaceChildren();content.hidden=true;print.disabled=true;location.replace('./index.html');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){content.hidden=true;print.disabled=true;}else load();});
await load();
