(() => {
 const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 const changed=()=>document.querySelector('#questionnaire')?.dispatchEvent(new Event('input',{bubbles:true}));
 let pending=0;
 globalThis.GRO_POSTS={busy:()=>pending>0,render(job){
  const box=make('section');box.className='workstation-editor';box.append(make('h4','Postos de trabalho'));
  const list=make('div');box.append(list);
  const draw=()=>{list.replaceChildren();for(const post of job.workstations||[]){
   const card=make('div');card.className='workstation-card';
   const label=make('label','Nome do posto');const name=make('input');name.value=post.name||'';name.maxLength=120;name.placeholder='Ex.: Bancada de montagem';name.oninput=()=>{post.name=name.value;changed();};label.append(name);
   const noteLabel=make('label','Observação (opcional)');const note=make('textarea');note.value=post.note||'';note.maxLength=1000;note.rows=2;note.oninput=()=>{post.note=note.value;changed();};noteLabel.append(note);
   const image=make('img');image.alt=post.name||'Foto do posto de trabalho';image.hidden=true;
   const status=make('p');status.setAttribute('role','status');
   const inputLabel=make('div');inputLabel.className='post-photo-area';
   const input=make('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;
   const cameraInput=make('input');cameraInput.type='file';cameraInput.accept=input.accept;cameraInput.setAttribute('capture','environment');cameraInput.hidden=true;
   const picker=make('button');picker.type='button';picker.className='post-photo-picker';picker.setAttribute('aria-label','Escolher foto do posto');
   const icon=make('span');icon.className='post-photo-icon';icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 5 9.5 3h5L16 5h3a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/></svg>';
   const prompt=make('strong','Abrir câmera');const hint=make('span','Tirar uma foto pelo celular');hint.className='post-photo-hint';
   picker.setAttribute('aria-label','Abrir câmera');picker.append(icon,prompt,hint);picker.onclick=()=>cameraInput.click();
   const gallery=make('button');gallery.type='button';gallery.className='post-photo-picker';
   const galleryIcon=make('span');galleryIcon.className='post-photo-icon';galleryIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>';
   const galleryHint=make('span','Escolher uma foto salva');galleryHint.className='post-photo-hint';gallery.append(galleryIcon,make('strong','Abrir galeria'),galleryHint,make('small','JPG, PNG ou WebP · até 20 MB'));gallery.onclick=()=>input.click();
   const actions=make('div');actions.className='post-photo-actions';

   const clear=make('button','Excluir foto');clear.type='button';clear.className='post-photo-clear';clear.disabled=!post.photoPath;
   clear.onclick=()=>{if(input.disabled)return;if(image.src.startsWith('blob:'))URL.revokeObjectURL(image.src);image.removeAttribute('src');image.hidden=true;delete post.photoPath;clear.disabled=true;status.textContent='Foto removida deste posto. Salve o rascunho para guardar a alteração.';changed();};
   actions.append(clear);inputLabel.append(image,picker,gallery,input,cameraInput,actions);
   const remove=make('button','Remover posto');remove.type='button';remove.onclick=()=>{if(input.disabled)return;job.workstations=job.workstations.filter(p=>p!==post);changed();draw();};
   const display=url=>{if(image.src.startsWith('blob:'))URL.revokeObjectURL(image.src);image.src=url;image.hidden=false;};
   if(post.photoPath){status.textContent='Carregando foto…';globalThis.GRO_CLOUD.photoUrl(post.photoPath).then(url=>{if(image.isConnected){display(url);status.textContent='';}else URL.revokeObjectURL(url);}).catch(e=>status.textContent=e.message);}
   input.onchange=cameraInput.onchange=async event=>{const source=event.target;const file=source.files?.[0];if(!file)return;pending++;input.disabled=cameraInput.disabled=remove.disabled=picker.disabled=gallery.disabled=clear.disabled=true;inputLabel.setAttribute('aria-busy','true');status.textContent='Enviando foto…';changed();try{const result=await globalThis.GRO_CLOUD.uploadPhoto(file);post.photoPath=result.path;display(result.url);status.textContent='Foto enviada. Salve o rascunho para guardar este posto.';changed();}catch(e){status.textContent=e.message;}finally{pending--;input.disabled=cameraInput.disabled=remove.disabled=picker.disabled=gallery.disabled=false;clear.disabled=!post.photoPath;inputLabel.setAttribute('aria-busy','false');source.value='';}};
   card.append(label,inputLabel,noteLabel,status,remove);list.append(card);
  }};
  const add=make('button','＋ Adicionar posto de trabalho');add.type='button';add.onclick=()=>{job.workstations||=[];job.workstations.push({name:'',note:''});draw();changed();};box.append(add);draw();return box;
 }};
})();
