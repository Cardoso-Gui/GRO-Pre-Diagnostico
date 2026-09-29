import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('client search matches accents and formatted CNPJ without changing selected client',()=>{
 const elements=[];const document={createElement(tag){const el={tag,children:[],value:'',append(...n){this.children.push(...n);},setAttribute(){},addEventListener(_,fn){this.input=fn;}};elements.push(el);return el;},querySelector:()=>null};
 const select={disabled:false,value:'b',options:[{value:'',textContent:'Selecione'},{value:'a',textContent:'São José — 12.345.678/0001-90',dataset:{}},{value:'b',textContent:'Empresa ADM',dataset:{search:'Razão social alternativa'}}],before(){}};
 const ctx={document,MutationObserver:class{observe(){}}};vm.runInNewContext(fs.readFileSync(new URL('../client-search.js',import.meta.url),'utf8').replaceAll('export function','function')+';globalThis.api=addClientSearch;',ctx);ctx.api(select);const input=elements.find(e=>e.tag==='input');
 for(const query of ['sao jose','12345678000190']){input.value=query;input.input();assert.equal(select.options[1].hidden,false);assert.equal(select.options[2].hidden,true);assert.equal(select.value,'b');}
 input.value='alternativa';input.input();assert.equal(select.options[2].hidden,false);
 input.value='inexistente';input.input();assert.ok(select.options.slice(1).every(o=>o.hidden));
 input.value='';input.input();assert.ok(select.options.every(o=>!o.hidden));
});

test('button search selects only on submit and respects a cancelled client switch',()=>{
 const elements=[];let cancel=false,changes=0;
 const document={querySelector:()=>null,createElement(tag){const e={tag,children:[],value:'',append(...n){this.children.push(...n);},replaceChildren(){this.children=[];},setAttribute(){},addEventListener(_,fn){this.keydown=fn;}};elements.push(e);return e;}};
 const select={id:'clients',value:'b',disabled:false,options:[{value:'a',textContent:'São José — 12.345.678/0001-90',dataset:{search:'São José'}},{value:'b',textContent:'Empresa ADM',dataset:{}}],before(){},dispatchEvent(){changes++;if(cancel)this.value='b';}};
 const ctx={document,Event:class{},MutationObserver:class{observe(){}}};vm.runInNewContext(fs.readFileSync(new URL('../client-search.js',import.meta.url),'utf8').replaceAll('export function','function')+';globalThis.api=addClientPickerSearch;',ctx);ctx.api(select);
 const input=elements.find(e=>e.tag==='input'),button=elements.find(e=>e.tag==='button');input.value='12345678000190';assert.equal(changes,0);button.onclick();assert.equal(select.value,'a');
 cancel=true;input.value='sao jose';button.onclick();assert.equal(select.value,'b');assert.equal(input.value,'Empresa ADM');
 input.value='inexistente';button.onclick();assert.equal(changes,2);
 select.disabled=true;input.value='sao jose';button.onclick();assert.equal(changes,2);
});
