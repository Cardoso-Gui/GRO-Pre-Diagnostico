(() => {
 const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 const changed=()=>document.querySelector('#questionnaire')?.dispatchEvent(new Event('input',{bubbles:true}));
 let pending=0;
 globalThis.GRO_POSTS={busy:()=>pending>0,render(job){
  const box=make('section');box.className='workstation-editor';box.append(make('h4','Postos de trabalho'));
  const list=make('div');box.append(list);
  const draw=()=>{list.replaceChildren();for(const post of job.workstations||[]){
   const card=make('div');card.className='workstation-card';
   const label=make('label','Nome do posto de trabalho');label.className='post-name-field';const required=make('span','Obrigatório');required.className='post-name-required';const name=make('input');name.setAttribute('aria-required','true');name.value=post.name||'';name.maxLength=120;name.placeholder='Ex.: Bancada de montagem';name.oninput=()=>{post.name=name.value;changed();};label.append(required,name);
   const noteLabel=make('label','Observação (opcional)');const note=make('textarea');note.value=post.note||'';note.maxLength=1000;note.rows=2;note.oninput=()=>{post.note=note.value;changed();};noteLabel.append(note);
   post.photoPaths=Array.isArray(post.photoPaths)?post.photoPaths:(post.photoPath?[post.photoPath]:[]);
   const images=make('div');images.className='post-photo-list';
   const status=make('p');status.setAttribute('role','status');
   const inputLabel=make('div');inputLabel.className='post-photo-area';
   const input=make('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;input.multiple=true;
   const cameraInput=make('input');cameraInput.type='file';cameraInput.accept=input.accept;cameraInput.setAttribute('capture','environment');cameraInput.hidden=true;
   const picker=make('button');picker.type='button';picker.className='post-photo-picker';picker.setAttribute('aria-label','Escolher foto do posto');
   const icon=make('span');icon.className='post-photo-icon';icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 5 9.5 3h5L16 5h3a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/></svg>';
   const prompt=make('strong','Abrir câmera');const hint=make('span','Tirar uma foto pelo celular');hint.className='post-photo-hint';
   picker.setAttribute('aria-label','Abrir câmera');picker.append(icon,prompt,hint);picker.onclick=()=>cameraInput.click();
   const gallery=make('button');gallery.type='button';gallery.className='post-photo-picker';
   const galleryIcon=make('span');galleryIcon.className='post-photo-icon';galleryIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>';
   const galleryHint=make('span','Escolher uma foto salva');galleryHint.className='post-photo-hint';gallery.append(galleryIcon,make('strong','Abrir galeria'),galleryHint,make('small','JPG, PNG ou WebP · até 20 MB'));gallery.onclick=()=>input.click();
   const actions=make('div');actions.className='post-photo-actions';

   const count=make('span');actions.append(count);inputLabel.append(images,picker,gallery,input,cameraInput,actions);
   const remove=make('button','Remover posto');remove.type='button';remove.onclick=()=>{if(pending)return;job.workstations=job.workstations.filter(p=>p!==post);changed();draw();};
   let uploading=false;
   const sync=()=>{post.photoPath=post.photoPaths[0]||'';count.textContent=`${post.photoPaths.length} de 3 fotos`;picker.disabled=gallery.disabled=uploading||post.photoPaths.length>=3;input.disabled=cameraInput.disabled=remove.disabled=uploading;for(const button of images.querySelectorAll('button'))button.disabled=uploading;};
   const show=(path,url)=>{
    const item=make('div');item.className='post-photo-item';const image=make('img');image.alt=post.name||'Foto do posto de trabalho';
    const clear=make('button','Excluir foto');clear.type='button';clear.className='post-photo-clear';
    clear.onclick=()=>{if(uploading)return;post.photoPaths=post.photoPaths.filter(p=>p!==path);if(image.src.startsWith('blob:'))URL.revokeObjectURL(image.src);item.remove();sync();changed();status.textContent='Foto removida. Salve o rascunho para guardar a alteração.';};
    item.append(image,clear);images.append(item);
    if(url)image.src=url;else globalThis.GRO_CLOUD.photoUrl(path).then(value=>{if(image.isConnected)image.src=value;else URL.revokeObjectURL(value);}).catch(()=>{image.alt='Foto indisponível';status.textContent='Não foi possível carregar uma foto. Reabra o rascunho para tentar novamente.';});
   };
   for(const path of post.photoPaths)show(path);sync();
   input.onchange=cameraInput.onchange=async event=>{
    const source=event.target,files=Array.from(source.files||[]);if(!files.length||uploading)return;
    if(files.length+post.photoPaths.length>3){status.textContent='Cada posto permite até 3 fotos. Escolha menos arquivos ou exclua uma foto.';source.value='';return;}
    pending++;uploading=true;sync();inputLabel.setAttribute('aria-busy','true');status.textContent='Enviando fotos…';
    try{for(const file of files){const result=await globalThis.GRO_CLOUD.uploadPhoto(file);post.photoPaths.push(result.path);show(result.path,result.url);sync();changed();}status.textContent='Fotos enviadas. Salve o rascunho para guardar este posto.';}
    catch(e){status.textContent=e.message+' As fotos já enviadas foram mantidas.';}
    finally{pending--;uploading=false;sync();inputLabel.setAttribute('aria-busy','false');source.value='';}
   };
   card.append(label,inputLabel,noteLabel,status,remove);list.append(card);
  }};
  const add=make('button','＋ Adicionar posto de trabalho');add.type='button';add.onclick=()=>{if(pending)return;job.workstations||=[];job.workstations.push({name:'',note:''});draw();changed();};box.append(add);draw();return box;
 }};
})();
