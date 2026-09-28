export const photoBucket='workstation-photos';
export function validPhotoPath(path,clientId){return typeof path==='string'&&path.startsWith(clientId+'/')&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(path);}
export async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha uma foto JPG, PNG ou WebP.');
 if(file.size>20*1024*1024)throw Error('A foto deve ter no máximo 20 MB.');
 const bitmap=await createImageBitmap(file);try{
 const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));if(!blob||blob.size>3*1024*1024)throw Error('Não foi possível preparar a foto. Escolha uma imagem menor.');return blob;
 }finally{bitmap.close();}
}
export async function photoUrl(client,path,clientId){
 if(!validPhotoPath(path,clientId))throw Error('Foto inválida para este cliente.');
 const {data,error}=await client.storage.from(photoBucket).download(path);if(error)throw Error('Não foi possível carregar a foto. Confira a conexão e tente novamente.');return URL.createObjectURL(data);
}
export async function uploadPhoto(client,file,clientId,userId){
 const blob=await preparePhoto(file),path=`${clientId}/${userId}/${crypto.randomUUID()}.jpg`;
 const {error}=await client.storage.from(photoBucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw Error('Não foi possível enviar a foto. Confira a conexão e selecione a imagem novamente.');return {path,url:URL.createObjectURL(blob)};
}
export async function hydrateReportPhotos(content,client,clientId){
 const images=[...content.querySelectorAll('img[data-photo-path]')];
 await Promise.all(images.map(async img=>{const url=await photoUrl(client,img.dataset.photoPath,clientId);img.src=url;try{await img.decode();}catch{throw Error('Uma foto não carregou. Tente novamente antes de imprimir.');}}));
}
