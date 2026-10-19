import {authClient,getTeamMember} from './auth-client.js?v=20260928-global1';
import {updateHeader} from './app-header.js?v=20260928-occ1';
import {addReuseButton} from './reuse-report.js?v=20260928-admin1';
const $=s=>document.querySelector(s),list=$('#report-list'),status=$('#list-status'),more=$('#list-more');
const clients=[],authors=[],PAGE=20;
let sequence=0,rows=[],isAdmin=false,filters={},hasMore=false,ready=false,linkedClient='';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function node(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function matches(c,query){const digits=query.replace(/\D/g,'');return normalize([c.trade_name,c.legal_name,c.cnpj].join(' ')).includes(query)||(/^[-.\/\d\s]+$/.test(query)&&digits&&String(c.cnpj||'').replace(/\D/g,'').includes(digits));}
function readFilters(){
 const days=$('#report-period').value;
 return {ids:linkedClient?[linkedClient]:$('#report-search').value.trim()?clients.filter(c=>matches(c,normalize($('#report-search').value.trim()))).map(c=>c.id):null,
 since:days==='all'?null:new Date(Date.now()-Number(days)*86400000).toISOString(),author:$('#report-author').value,ascending:$('#report-order').value==='asc'};
}
async function queryPage(ids,start,end){
 let query=authClient.from('assessments').select('id,client_id,responsible_id,title,revision,completed_at,team_members!assessments_responsible_id_fkey(display_name)').eq('status','completed');
 if(ids)query=query.in('client_id',ids);
 if(filters.since)query=query.gte('completed_at',filters.since);
 if(filters.author)query=query.eq('responsible_id',filters.author);
 const {data,error}=await query.order('completed_at',{ascending:filters.ascending}).order('id').range(start,end);
 if(error)throw error;return data;
}
async function fetchPage(start,ticket){
 const ids=filters.ids;if(ids?.length===0)return [];
 if(!ids||ids.length<=100)return queryPage(ids,start,start+PAGE);
 // Merge a prefix from each bounded ID query so broad company searches paginate globally.
 const found=[];
 for(let i=0;i<ids.length;i+=100){
  for(let from=0;from<=start+PAGE;from+=200){
   if(ticket!==sequence)return [];
   const part=await queryPage(ids.slice(i,i+100),from,Math.min(from+199,start+PAGE));found.push(...part);
   if(part.length<Math.min(200,start+PAGE-from+1))break;
  }
 }
 found.sort((a,b)=>((a.completed_at<b.completed_at?-1:a.completed_at>b.completed_at?1:0)*(filters.ascending?1:-1))||a.id.localeCompare(b.id));
 return found.slice(start,start+PAGE+1);
}
function render(){
 const expanded=new Map([...list.querySelectorAll('.report-company')].map(el=>[el.dataset.client,el.open]));
 list.replaceChildren();
 const groups=new Map();
 for(const row of rows){if(!groups.has(row.client_id))groups.set(row.client_id,[]);groups.get(row.client_id).push(row);}
 for(const [id,reports] of groups){
  const client=clients.find(c=>c.id===id),name=client?.trade_name?.trim()||client?.legal_name||'Empresa indisponível';
  const group=node('details','','report-company');group.dataset.client=id;group.open=expanded.has(id)?expanded.get(id):true;
  const summary=node('summary',''),heading=node('span','','company-heading');
  heading.append(node('strong',name),node('small',client?.cnpj?'CNPJ '+String(client.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):'CNPJ não informado'));
  const icon=node('span',name.slice(0,2).toUpperCase(),'company-icon');icon.setAttribute('aria-hidden','true');
  summary.append(icon,heading,node('span',reports.length+' '+(reports.length===1?'relatório':'relatórios')+(hasMore?' nesta lista':''),'company-count'));group.append(summary);
  const columns=node('div','','report-columns');columns.setAttribute('aria-hidden','true');
  for(const text of ['Levantamento','Concluído em','Responsável',''])columns.append(node('span',text));group.append(columns);
  for(const row of reports){
   const card=node('article','','report-record'),title=node('div','','record-title');
   title.append(node('h3',row.title||'Levantamento'),node('span','Concluído','record-state'));
   const date=node('div',''),author=node('div','');
   date.append(node('span','Concluído em','record-label'),node('p',new Date(row.completed_at).toLocaleDateString('pt-BR')));
   author.append(node('span','Responsável','record-label'),node('p',row.team_members?.display_name||'Equipe'));
   const actions=node('div','','report-actions'),view=node('a','Ver relatório →','report-view');view.href='./report.html?id='+encodeURIComponent(row.id);
   const options=node('details',''),toggle=node('summary','Mais ações');options.append(toggle);
   const pdf=node('a','Imprimir / salvar PDF');pdf.href=view.href+'&print=1';options.append(pdf);
   addReuseButton(options,row.id,authClient,getTeamMember,text=>{status.textContent=text;});
   if(isAdmin){const remove=node('button','Excluir relatório','delete-report');remove.type='button';remove.onclick=()=>askDelete(row,remove);options.append(remove);}
   actions.append(view,options);card.append(title,date,author,actions);group.append(card);
  }
  list.append(group);
 }
 status.textContent=rows.length?rows.length+' '+(rows.length===1?'relatório':'relatórios')+' em '+groups.size+' '+(groups.size===1?'empresa':'empresas')+(hasMore?' nesta lista. Carregue mais para continuar.':'.'):'Nenhum relatório encontrado com estes filtros.';
 if(!rows.length){const empty=node('div','','reports-empty');empty.append(node('h3','Nenhum relatório por aqui'),node('p','Experimente ampliar o período ou limpar os filtros para ver outros resultados.'));list.append(empty);}
}
async function load(reset=true){
 const ticket=++sequence;
 if(reset){filters=readFilters();rows=[];hasMore=false;list.replaceChildren();}
 more.disabled=true;more.hidden=true;list.setAttribute('aria-busy','true');status.textContent='Carregando relatórios…';
 try{
  const data=await fetchPage(rows.length,ticket);if(ticket!==sequence)return;
  hasMore=data.length>PAGE;rows.push(...data.slice(0,PAGE));render();more.hidden=!hasMore;
 }catch{if(ticket===sequence){status.textContent='Não foi possível carregar os relatórios. Clique em Pesquisar para tentar novamente.';more.hidden=reset||!hasMore;}}
 finally{if(ticket===sequence){more.disabled=false;list.setAttribute('aria-busy','false');}}
}
async function readAll(table,fields,order,key){
 const data=[];
 for(let start=0;;start+=200){const page=await authClient.from(table).select(fields).order(order).order(key).range(start,start+199);if(page.error)throw page.error;data.push(...page.data);if(page.data.length<200)return data;}
}
async function initialize(){
 try{
  const access=await getTeamMember();if(!access.member){if(access.reason==='network')throw Error();location.replace('./index.html?reason=expired');return;}
  updateHeader(access.member);isAdmin=access.member.role==='admin';
  const [companies,people]=await Promise.all([readAll('clients','id,legal_name,trade_name,cnpj','legal_name','id'),readAll('team_members','user_id,display_name','display_name','user_id')]);
  clients.push(...companies);authors.push(...people);
  for(const person of authors){const option=node('option',person.display_name||'Integrante');option.value=person.user_id;$('#report-author').append(option);}
  const requested=new URLSearchParams(location.search).get('client'),client=clients.find(c=>c.id===requested);
  if(requested){linkedClient=client?.id||requested;$('#report-search').value=client?.trade_name||client?.legal_name||'Empresa indisponível';$('#report-period').value='all';}
  ready=true;document.querySelectorAll('.reports-filters [disabled],#report-order').forEach(el=>el.disabled=false);await load();
 }catch{status.textContent='Não foi possível carregar a lista. Recarregue a página para tentar novamente.';list.setAttribute('aria-busy','false');}
}
$('#report-search').addEventListener('input',()=>{linkedClient='';history.replaceState(null,'','./reports.html');});
$('#report-search-form').onsubmit=e=>{e.preventDefault();if(ready)load();};
$('#clear-filters').onclick=()=>{linkedClient='';$('#report-search-form').reset();$('#report-order').value='desc';history.replaceState(null,'','./reports.html');load();};
$('#report-order').onchange=()=>load();
more.onclick=()=>load(false);
$('#sign-out').onclick=async()=>{await authClient.auth.signOut({scope:'local'});location.replace('./index.html');};
authClient.auth.onAuthStateChange(e=>{if(e==='SIGNED_OUT'){sequence++;list.replaceChildren();location.replace('./index.html');}});
async function askDelete(row,button){
 if(!confirm('Excluir permanentemente o relatório “'+row.title+'”? Esta ação não pode ser desfeita.'))return;
 button.disabled=true;
 try{
 const access=await getTeamMember();if(access.member?.role!=='admin')throw Error('Somente administradores podem excluir relatórios.');
 const {data,error}=await authClient.from('assessments').delete().eq('id',row.id).eq('revision',row.revision).eq('status','completed').select('id').maybeSingle();
 if(error||!data)throw Error('Não foi possível confirmar a exclusão. Atualize a lista e confira o relatório.');
 await load();
 }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
}

await initialize();
