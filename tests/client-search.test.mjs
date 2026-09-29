import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('client search matches accents and formatted CNPJ without changing selected client',()=>{
 const elements=[];const document={createElement(tag){const el={tag,children:[],value:'',append(...n){this.children.push(...n);},setAttribute(){},addEventListener(_,fn){this.input=fn;}};elements.push(el);return el;},querySelector:()=>null};
 const select={disabled:false,value:'b',options:[{value:'',textContent:'Selecione'},{value:'a',textContent:'São José — 12.345.678/0001-90',dataset:{}},{value:'b',textContent:'Empresa ADM',dataset:{search:'Razão social alternativa'}}],before(){}};
 const ctx={document,MutationObserver:class{observe(){}}};vm.runInNewContext(fs.readFileSync(new URL('../client-search.js',import.meta.url),'utf8').replace('export function','function')+';globalThis.api=addClientSearch;',ctx);ctx.api(select);const input=elements.find(e=>e.tag==='input');
 for(const query of ['sao jose','12345678000190']){input.value=query;input.input();assert.equal(select.options[1].hidden,false);assert.equal(select.options[2].hidden,true);assert.equal(select.value,'b');}
 input.value='alternativa';input.input();assert.equal(select.options[2].hidden,false);
 input.value='inexistente';input.input();assert.ok(select.options.slice(1).every(o=>o.hidden));
 input.value='';input.input();assert.ok(select.options.every(o=>!o.hidden));
});
