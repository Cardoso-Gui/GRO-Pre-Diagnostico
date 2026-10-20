import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {reusePrintImages} from '../report-print-images.js';

function fixture(t){
 const dom=new JSDOM('<main><figure><img src="blob:synthetic-a" alt="Foto A"><img src="blob:synthetic-b" alt="Foto B"></figure></main>');
 const old=globalThis.document;globalThis.document=dom.window.document;
 t.after(()=>{globalThis.document=old;dom.window.close();});
 const original=document.querySelector('main'),images=[...original.querySelectorAll('img')];
 const printed=original.cloneNode(true);document.body.append(printed);
 return {original,images,printed};
}
test('print uses the exact decoded photo nodes and restores them on cancel/repeat',t=>{
 const {original,images,printed}=fixture(t);
 const originalHTML=original.innerHTML;
 for(let attempt=0;attempt<2;attempt++){
  printed.replaceChildren(...[...original.childNodes].map(node=>node.cloneNode(true)));
  const restore=reusePrintImages(images,printed);
  assert.deepEqual([...printed.querySelectorAll('img')],images);
  assert.equal(original.querySelectorAll('img').length,0);
  restore();restore();
  assert.deepEqual([...original.querySelectorAll('img')],images);
  assert.equal(original.innerHTML,originalHTML);
 }
});
test('missing print photo fails before moving any original',t=>{
 const {original,images,printed}=fixture(t);
 printed.querySelector('img').remove();
 assert.throws(()=>reusePrintImages(images,printed),/todas as imagens/);
 assert.deepEqual([...original.querySelectorAll('img')],images);
});
test('unexpected photo order rolls back any moves already made',t=>{
 const {original,images,printed}=fixture(t),before=original.innerHTML;
 printed.querySelectorAll('img')[1].src='blob:unexpected';
 assert.throws(()=>reusePrintImages(images,printed),/ordem das imagens/);
 assert.deepEqual([...original.querySelectorAll('img')],images);
 assert.equal(original.innerHTML,before);
});
