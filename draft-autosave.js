// Recovery is local to this browser/account, not a second authoritative database.
// Every server write still goes through saveAssessment's optimistic revision check.
const PREFIX='gro-draft-recovery:v1:';
const TTL=7*24*60*60*1000;
const clone=value=>JSON.parse(JSON.stringify(value));
const encode=scope=>[scope.userId,scope.teamId,scope.clientId,scope.draftId,scope.page].map(encodeURIComponent).join(':');
const equalScope=(a,b)=>['userId','teamId','clientId','draftId','page'].every(key=>b[key]===undefined||a?.[key]===b[key]);
function browserStorage(){try{return globalThis.localStorage;}catch{return null;}}
export function findDraftRecovery(scope,{storage=browserStorage(),now=Date.now()}={}){
 const entries=[],expired=[];if(!storage)return entries;
 try{for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(PREFIX))continue;
  try{const entry=JSON.parse(storage.getItem(key));if(entry.version!==1||!equalScope(entry.scope,scope)||!entry.snapshot||!Number.isFinite(entry.savedAt))continue;if(now-entry.savedAt>TTL){expired.push(key);continue;}entries.push({...entry,key});}catch{}
 }expired.forEach(key=>storage.removeItem(key));}catch{}
 return entries.sort((a,b)=>b.savedAt-a.savedAt);
}
export function clearDraftRecovery(scope,{storage=browserStorage()}={}){
 if(!storage)return;
 const keys=[];try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(PREFIX))continue;try{const entry=JSON.parse(storage.getItem(key));if(equalScope(entry.scope,scope))keys.push(key);}catch{}}keys.forEach(key=>storage.removeItem(key));}catch{}
}
export function createDraftAutosave({scope,getSnapshot,getRevision,persist,onStatus=()=>{},onSaved=()=>{},getMetadata=()=>null,canSave=()=>true,isOnline=()=>globalThis.navigator?.onLine!==false,storage=browserStorage(),delay=1000,events=globalThis.window,timers=globalThis,writerId=globalThis.crypto?.randomUUID?.()||String(Math.random()),now=Date.now}){
 if(['userId','teamId','clientId','draftId','page'].some(key=>!scope[key]))throw Error('Identificação incompleta do rascunho.');
 const disposalListeners=new Set();
 let recoveredKeys=[];
 const key=PREFIX+encode(scope)+':'+writerId;
 let baseline='',observed='',timer=null,running=null,paused=false,disposed=false,blocked=false,localOK=true,lastResult=null,checkpoints=[];
 const serialized=()=>JSON.stringify(getSnapshot());
 const dirty=()=>serialized()!==baseline;
 const status=(state,message)=>onStatus({state,message});
 const cancel=()=>{if(timer!==null){timers.clearTimeout(timer);timer=null;}};
 function checkpoint(){
  try{if(!storage)throw Error('storage');const entry={version:1,scope,revision:getRevision()??null,snapshot:clone(getSnapshot()),metadata:getMetadata(),savedAt:now()};storage.setItem(key,JSON.stringify(entry));localOK=true;}catch{localOK=false;}
 }
 function removeOwn(){try{storage?.removeItem(key);}catch{}}
 function pending(){status(isOnline()?'pending':'offline',localOK?(isOnline()?'Alterações guardadas neste aparelho. Aguardando salvamento…':'Aguardando conexão. Alterações guardadas neste aparelho; ainda não salvas no servidor.'):'Não foi possível guardar neste aparelho. Mantenha esta página aberta e salve com conexão.');}
 function schedule(){cancel();if(!paused&&!disposed&&!blocked&&dirty())timer=timers.setTimeout(()=>{timer=null;void flush({force:false});},delay);}
 function changed(){
  if(disposed||paused)return;
  const next=serialized();if(next===observed)return;observed=next;
  if(!dirty()){if(running)checkpoint();else removeOwn();return;}
  checkpoint();if(!blocked&&!running)pending();schedule();
 }
 async function flush({force=true}={}){
  cancel();if(disposed||paused||blocked)return null;
  // Calls arriving during a request share its drain, never a second concurrent save.
  if(running)return running;
  if(!force&&!dirty())return lastResult;
  if(!isOnline()){checkpoint();pending();return null;}
  if(!canSave()){checkpoint();status('waiting','Aguardando o envio das fotos ou a operação atual terminar.');schedule();return null;}
  running=Promise.resolve().then(async()=>{
   let first=true;
   try{
    while(!disposed&&!paused&&!blocked&&(dirty()||(first&&force))){
     first=false;if(!isOnline()){checkpoint();pending();return null;}if(!canSave()){checkpoint();status('waiting','Aguardando o envio das fotos ou a operação atual terminar.');schedule();return null;}
     const snapshot=clone(getSnapshot()),version=JSON.stringify(snapshot);checkpoint();status('saving','Salvando…');
     let result;
     try{result=await persist(snapshot);if(!result)throw Error('Não foi possível confirmar o salvamento.');}
     catch(error){
      if(disposed)return null;
      checkpoint();blocked=error?.code==='DRAFT_CONFLICT'||error?.code==='DRAFT_ACCESS';
      status(blocked?'blocked':isOnline()?'error':'offline',(error?.message||'Não foi possível confirmar o salvamento.')+(localOK?' Alterações guardadas neste aparelho.':' A cópia local falhou; mantenha esta página aberta.'));
      return null;
     }
     if(disposed)return null;
     baseline=version;lastResult=result;observed=serialized();
     if(dirty())checkpoint();else {removeOwn();recoveredKeys.forEach(key=>{try{storage?.removeItem(key);}catch{}});recoveredKeys=[];}
     onSaved(snapshot,result);
     if(disposed||paused)return null;
     if(!dirty())status('saved','Salvo no servidor.');
    }
    return lastResult;
   }finally{running=null;}
  });
  return running;
 }
 function initialize(){baseline=serialized();observed=baseline;checkpoints=findDraftRecovery(scope,{storage,now:now()});return checkpoints;}
 const online=()=>{if(dirty()&&!paused&&!disposed&&!blocked)void flush({force:false});};
 const pagehide=()=>{if((dirty()||running)&&!disposed&&!paused)checkpoint();};
 events?.addEventListener('online',online);events?.addEventListener('pagehide',pagehide);
 return {initialize,changed,flush,dirty,isSaving:()=>!!running,isBlocked:()=>blocked,pause(){paused=true;cancel();},resume(){if(disposed)return;paused=false;changed();schedule();},discard(){cancel();removeOwn();baseline=serialized();observed=baseline;},dispose(){disposed=true;cancel();for(const callback of disposalListeners)callback();disposalListeners.clear();events?.removeEventListener('online',online);events?.removeEventListener('pagehide',pagehide);},isDisposed:()=>disposed,onDispose(callback){disposalListeners.add(callback);return ()=>disposalListeners.delete(callback);},getCheckpoints:()=>checkpoints,recovered(entry){recoveredKeys.push(entry.key);},removeCheckpoint(entry){try{storage?.removeItem(entry.key);}catch{}},getScope:()=>scope};
}

// Recovery is offered only after the authenticated server draft was loaded. A
// stale revision is never merged or sent automatically; it can be exported.
export async function showDraftRecovery(controller,{restore,revision,root=globalThis.document}={}){
 const entries=controller.getCheckpoints();if(!entries.length)return;
 let recovered=false;
 controller.pause();
 for(const entry of entries){
  if(controller.isDisposed?.())break;
  const compatible=(entry.revision??null)===(revision??null);
  await new Promise(resolve=>{
   const dialog=root.createElement('dialog');dialog.className='draft-recovery-dialog';dialog.setAttribute('aria-label','Recuperação do rascunho');
   const title=root.createElement('h2');title.textContent='Preenchimento guardado neste aparelho';
   const message=root.createElement('p');message.textContent=compatible?'Há alterações locais que ainda não foram confirmadas no servidor. Deseja recuperá-las?':'A versão no servidor mudou. Para evitar sobrescrever outra edição, esta cópia não será aplicada automaticamente. Você pode baixá-la para comparar.';
   const note=root.createElement('p');note.textContent='Cópia de '+new Date(entry.savedAt).toLocaleString('pt-BR')+'. Em aparelho compartilhado, saia da conta ao terminar.';
   const actions=root.createElement('div');actions.className='draft-recovery-actions';
   const finish=()=>dialog.close();
   if(compatible){const recover=root.createElement('button');recover.type='button';recover.textContent='Recuperar alterações';recover.onclick=()=>{if(controller.isDisposed?.())return;restore(clone(entry.snapshot));controller.recovered(entry);recovered=true;finish();};actions.append(recover);}
   const download=root.createElement('button');download.type='button';download.textContent='Baixar cópia para comparar';download.onclick=()=>{if(controller.isDisposed?.())return;const url=URL.createObjectURL(new Blob([JSON.stringify({savedAt:entry.savedAt,revision:entry.revision,...entry.snapshot},null,2)],{type:'application/json'}));const a=root.createElement('a');a.href=url;a.download='recuperacao-rascunho.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};actions.append(download);
   const keep=root.createElement('button');keep.type='button';keep.textContent='Continuar com a versão do servidor';keep.onclick=finish;actions.append(keep);
   const remove=root.createElement('button');remove.type='button';remove.textContent='Descartar esta cópia local';remove.onclick=()=>{if(controller.isDisposed?.())return;if(globalThis.confirm('Descartar somente esta cópia local não sincronizada?')){controller.removeCheckpoint(entry);finish();}};actions.append(remove);
   dialog.append(title,message,note,actions);root.body.append(dialog);const unsubscribe=controller.onDispose?.(()=>{dialog.close();dialog.remove();resolve();});dialog.addEventListener('close',()=>{unsubscribe?.();dialog.remove();resolve();},{once:true});dialog.showModal();
  });
  if(recovered)break;
 }
 controller.resume();
}
