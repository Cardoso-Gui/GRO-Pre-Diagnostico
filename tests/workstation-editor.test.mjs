import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.src='';this.isConnected=true;this.disabled=false;}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(){this.children=[];}
 setAttribute(){}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
 querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.querySelectorAll(tag)]);}
}
function fixture(post,failAt=0){
 let uploads=0;const context={document:{createElement:tag=>new Element(tag),querySelector:()=>null},Event:class{},URL:{revokeObjectURL(){}},GRO_CLOUD:{photoUrl:async p=>'blob:'+p,uploadPhoto:async()=>{uploads++;if(uploads===failAt)throw Error('Falha');return {path:'new'+uploads,url:'blob:new'+uploads};}}};
 vm.runInNewContext(fs.readFileSync(new URL('../workstation-editor.js',import.meta.url),'utf8'),context);
 const job={workstations:[post]},root=context.GRO_POSTS.render(job),input=root.querySelectorAll('input').find(e=>e.type==='file'&&e.multiple);
 return {post,root,context,upload:async count=>{input.files=Array.from({length:count},()=>({}));await input.onchange({target:input});},uploads:()=>uploads};
}
test('legacy photo retained, maximum three, deletion frees one slot',async()=>{
 const f=fixture({name:'Posto',photoPath:'legacy'});await f.upload(2);
 assert.deepEqual(Array.from(f.post.photoPaths),['legacy','new1','new2']);
 await f.upload(1);assert.equal(f.uploads(),2);
 f.root.querySelectorAll('button').find(b=>b.textContent==='Excluir foto').onclick();
 assert.equal(f.post.photoPath,'new1');await f.upload(1);assert.equal(f.post.photoPaths.length,3);
 assert.equal(f.context.GRO_POSTS.busy(),false);
});
test('partial upload retains successful photos and releases busy state',async()=>{
 const f=fixture({name:'Posto'},2);await f.upload(3);
 assert.deepEqual(Array.from(f.post.photoPaths),['new1']);assert.equal(f.post.photoPath,'new1');assert.equal(f.context.GRO_POSTS.busy(),false);
});
