const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const value=text=>text===null||text===undefined?'Não informado':typeof text==='object'?JSON.stringify(text):String(text);
export function mountRectificationHistory(state,id,{original=false}={}){
 const toolbar=document.querySelector('.report-toolbar'),status=document.querySelector('.viewer-status');
 const addLink=(text,href)=>{const link=make('a',text);link.href=href;link.dataset.rectificationControl='';toolbar.append(link);};
 if(state.can_rectify&&!original)addLink('Retificar','./rectify.html?id='+encodeURIComponent(id));
 if(state.sequence>0){
  addLink(original?'Ver relatório atualizado':'Ver original preservado','./report.html?id='+encodeURIComponent(id)+(original?'':'&original=1'));
  const box=make('details');box.className='rectification-history';box.dataset.rectificationControl='';box.append(make('summary','Histórico de retificações ('+state.sequence+')'));
  for(const entry of state.history||[]){
   const item=make('article');item.append(make('strong','Retificação '+entry.sequence+' · '+entry.actor_name),make('p',new Date(entry.created_at).toLocaleString('pt-BR')),make('p','Motivo: '+entry.reason));
   const differences=make('details');differences.append(make('summary','Ver todas as alterações'));
   for(const diff of entry.changes||[]){const line=make('div');line.append(make('strong',Array.isArray(diff.path)?diff.path.join('.'):diff.path),make('p','Antes: '+value(diff.before)),make('p','Depois: '+value(diff.after)));differences.append(line);}item.append(differences);box.append(item);
  }
  status.after(box);
 }
}
