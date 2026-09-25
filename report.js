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
 const {data,error}=await authClient.from('assessments').select('title,final_snapshot,completed_at').eq('id',id).eq('status','completed').maybeSingle();
 if(error||!data)throw Error('Relatório indisponível. Volte à lista ou tente novamente.');
 const doc=data.final_snapshot?.answers?.report_document;
 if(doc?.version!==1||!Array.isArray(doc.children))throw Error('Este relatório não possui uma versão de visualização compatível.');
 const fragment=document.createDocumentFragment();doc.children.forEach(node=>fragment.append(renderNode(node)));
 content.replaceChildren(fragment);document.title=data.title+' · GRO';document.querySelector('#report-title').textContent=data.title;
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
