// Printing must keep the hydrated, decoded image nodes. A clone has the same
// src attribute, but its asynchronous image request may not be ready when a
// synchronous beforeprint handler finishes.
export function reusePrintImages(images,content){
 const copies=[...content.querySelectorAll('img')],moved=[];
 const restore=()=>{for(const {image,placeholder} of moved)placeholder.replaceWith(image);moved.length=0;};
 if(copies.length!==images.length)throw new Error('A impressão não preservou todas as imagens do relatório.');
 try{
  for(let index=0;index<images.length;index++){
   const image=images[index],copy=copies[index];
   if(image.getAttribute('src')!==copy.getAttribute('src'))throw new Error('A ordem das imagens mudou durante a impressão.');
   const placeholder=document.createComment('report-photo');
   image.replaceWith(placeholder);moved.push({image,placeholder});copy.replaceWith(image);
  }
 }catch(error){restore();throw error;}
 return restore;
}
