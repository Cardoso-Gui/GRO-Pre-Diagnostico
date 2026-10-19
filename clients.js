import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20261019-access1';
const $=selector=>document.querySelector(selector);
const page=$('#clients-page'),check=$('#session-check'),list=$('#records-list'),status=$('#records-status'),more=$('#more-records'),retry=$('#retry-records'),search=$('#client-search');
let filters={name:'',cnpj:''},offset=0,generation=0,checking=false,sort='asc',total=0;
const pageSize=20;
function element(tag,className,text){const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;}
function link(label,href,className){const a=element('a',className,label);a.href=href;return a;}
function appendRecord(row){
 const article=element('article','record'),info=element('div','company-info'),icon=element('span','company-icon');
 icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 32 32"><path d="M6 27V8l14-3v22M20 13h6v14M3 27h26M11 12h3m-3 5h3m-3 5h3m9-4h1m-1 4h1"/></svg>';
 const content=element('div','company-copy'),heading=element('h2','');
 const url='./client.html?id='+encodeURIComponent(row.id);
 heading.append(link(row.legal_name,url,'company-name'));
 const cnpj=String(row.cnpj||'');const formatted=cnpj.length===14?cnpj.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\w{2})$/,'$1.$2.$3/$4-$5'):cnpj;
 content.append(heading,element('p','company-cnpj',formatted?'CNPJ '+formatted:'CNPJ não informado'));
 if(row.trade_name&&row.trade_name!==row.legal_name)content.append(element('p','trade-name',row.trade_name));
 info.append(icon,content);
 const city=element('p','company-city',[row.address?.city,row.address?.state].filter(Boolean).join(' / ')||'Cidade não informada');
 const count=Number(row.assessments?.[0]?.count||0),button=element('button','assessment-count',count?`${count} levantamento${count===1?'':'s'}`:'Nenhum levantamento');button.type='button';button.setAttribute('aria-label',`Ver levantamentos de ${row.legal_name}`);button.onclick=()=>openAssessments(row);
 const actions=element('div','company-actions');const details=element('details','client-options'),summary=element('summary','','⋮');summary.setAttribute('aria-label','Mais opções para '+row.legal_name);summary.title='Mais opções';
 const menu=element('div','client-options-panel');menu.append(link('Editar cadastro',url+'&edit=1',''),link('Ocorrências','./occurrences.html?client='+encodeURIComponent(row.id),''));details.append(summary,menu);details.addEventListener('toggle',()=>{if(details.open)document.querySelectorAll('.client-options[open]').forEach(other=>{if(other!==details)other.open=false;});});
 actions.append(link('Ver cliente →',url,'view-client'),details);article.append(info,city,button,actions);list.append(article);
}
function quotedPattern(value){const pattern='%'+value.replace(/[\\%_]/g,'\\$&')+'%';return '"'+pattern.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
async function loadRecords(reset=false){
 const ticket=++generation;if(reset){offset=0;list.replaceChildren();$('#client-count').textContent='';$('#records-summary').textContent='';}
 status.textContent='Carregando…';more.hidden=true;retry.hidden=true;list.setAttribute('aria-busy','true');
 try{
 let query=authClient.from('clients').select('id,legal_name,trade_name,cnpj,address,assessments(count)',{count:'exact'}).eq('archived',false).order('legal_name',{ascending:sort==='asc'}).order('id');
 if(filters.name){const pattern=quotedPattern(filters.name);let expression=`legal_name.ilike.${pattern},trade_name.ilike.${pattern}`;if(filters.cnpj)expression+=`,cnpj.ilike.${quotedPattern(filters.cnpj)}`;query=query.or(expression);}
 const {data,error,count}=await query.range(offset,offset+pageSize);if(ticket!==generation||page.hidden)return;if(error)throw error;
 const rows=data.slice(0,pageSize);rows.forEach(appendRecord);offset+=rows.length;total=count??offset;
 more.hidden=data.length<=pageSize;$('#client-count').textContent=`${total} cliente${total===1?'':'s'} ${filters.name?'encontrado'+(total===1?'':'s'):'cadastrado'+(total===1?'':'s')}`;
 $('#records-summary').textContent=offset?`Mostrando ${offset} de ${total} clientes`:'';
 status.textContent=offset?'':filters.name?'Nenhum cliente encontrado. Tente outro nome ou CNPJ.':'Ainda não há clientes cadastrados. Use “Novo cliente” para começar.';
 }catch{if(ticket!==generation||page.hidden)return;status.textContent='Não foi possível carregar os clientes. Tente novamente.';retry.hidden=false;}
 finally{if(ticket===generation)list.setAttribute('aria-busy','false');}
}
search.addEventListener('submit',event=>{event.preventDefault();const name=$('#search-name').value.trim();filters={name,cnpj:name.replace(/[^a-z0-9]/gi,'').toUpperCase()};$('#clear-search').hidden=!name;loadRecords(true);});
$('#clear-search').onclick=()=>{$('#search-name').value='';filters={name:'',cnpj:''};$('#clear-search').hidden=true;loadRecords(true);$('#search-name').focus();};
$('#client-sort').onchange=event=>{sort=event.target.value;loadRecords(true);};
document.addEventListener('click',event=>{document.querySelectorAll('.client-options[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.client-options[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});});
const dialog=$('#assessments-dialog');let assessmentClient=null,assessmentOffset=0,assessmentGeneration=0;
function openAssessments(row){assessmentClient=row;$('#assessments-client').textContent=row.legal_name;dialog.showModal();loadAssessments(true);}
async function loadAssessments(reset=false){
 const ticket=++assessmentGeneration,memberGeneration=generation,clientId=assessmentClient.id;
 if(reset){assessmentOffset=0;$('#assessments-list').replaceChildren();}$('#assessments-status').textContent='Carregando levantamentos…';$('#assessments-more').hidden=true;$('#assessments-retry').hidden=true;
 try{const {data,error}=await authClient.from('assessments').select('id,title,status,updated_at').eq('client_id',clientId).order('updated_at',{ascending:false}).order('id').range(assessmentOffset,assessmentOffset+20);
 if(ticket!==assessmentGeneration||memberGeneration!==generation||page.hidden||!dialog.open)return;if(error)throw error;
 for(const row of data.slice(0,20)){const article=element('article','assessment-row');const info=element('div','');info.append(element('h3','',row.title||'Levantamento'),element('p','',row.status==='completed'?'Concluído':'Em andamento'));article.append(info,link(row.status==='completed'?'Ver relatório →':'Continuar →',(row.status==='completed'?'./report.html?id=':'./levantamento.html?id=')+encodeURIComponent(row.id),'view-client'));$('#assessments-list').append(article);}
 assessmentOffset+=Math.min(data.length,20);$('#assessments-more').hidden=data.length<=20;$('#assessments-status').textContent=assessmentOffset?'':'Este cliente ainda não possui levantamentos.';
 }catch{if(ticket!==assessmentGeneration||!dialog.open||page.hidden)return;$('#assessments-status').textContent='Não foi possível carregar os levantamentos.';$('#assessments-retry').hidden=false;}
}
$('#close-assessments').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{assessmentGeneration++;});$('#assessments-more').onclick=()=>loadAssessments();$('#assessments-retry').onclick=()=>loadAssessments();
async function initialize(){if(checking)return;checking=true;page.hidden=true;generation++;check.hidden=false;try{const access=await getTeamMember();if(!access.member){if(access.reason==='network')throw Error();location.replace('./index.html?reason=expired');return;}updateHeader(access.member);document.querySelector('#profile-short-name').textContent=(access.member.display_name||'Equipe').trim().split(/\s+/)[0];check.hidden=true;page.hidden=false;await loadRecords(true);}catch{check.querySelector('p').textContent='Não foi possível carregar seus clientes. Tente novamente.';document.querySelector('#retry-session').hidden=false;}finally{checking=false;}}
more.onclick=()=>loadRecords();retry.onclick=()=>loadRecords();document.querySelector('#retry-session').onclick=initialize;
document.querySelector('#sign-out').onclick=async()=>{page.hidden=true;generation++;await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
authClient.auth.onAuthStateChange(e=>{if(e==='SIGNED_OUT'){page.hidden=true;generation++;location.replace('./index.html?reason=expired');}});
window.addEventListener('pageshow',e=>{if(e.persisted)initialize();});
await initialize();


const homeMenuToggle = document.querySelector('#home-menu-toggle');
const homeNavigation = document.querySelector('#home-navigation');
homeMenuToggle.addEventListener('click', () => {
 const expanded = homeMenuToggle.getAttribute('aria-expanded') !== 'true';
 homeMenuToggle.setAttribute('aria-expanded', String(expanded));
 homeNavigation.classList.toggle('is-open', expanded);
});
homeNavigation.addEventListener('keydown', event => {
 if (event.key === 'Escape') {
  homeNavigation.classList.remove('is-open');
  homeMenuToggle.setAttribute('aria-expanded', 'false');
  homeMenuToggle.focus();
 }
});

const profileToggle = document.querySelector('#profile-toggle');
const profilePanel = document.querySelector('#profile-panel');
function closeProfile() {
 profilePanel.hidden = true;
 profileToggle.setAttribute('aria-expanded', 'false');
}
function closeHomeNavigation() {
 homeNavigation.classList.remove('is-open');
 homeMenuToggle.setAttribute('aria-expanded', 'false');
}
profileToggle.addEventListener('click', () => {
 const opening = profilePanel.hidden;
 closeHomeNavigation();
 profilePanel.hidden = !opening;
 profileToggle.setAttribute('aria-expanded', String(opening));
});
homeMenuToggle.addEventListener('click', closeProfile);
document.addEventListener('click', event => {
 if (!event.target.closest('.user-menu')) closeProfile();
 if (!homeNavigation.contains(event.target) && !homeMenuToggle.contains(event.target)) closeHomeNavigation();
});
document.addEventListener('keydown', event => {
 if (event.key === 'Escape' && !profilePanel.hidden) {closeProfile();profileToggle.focus();}
});
