import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('../client.js', import.meta.url), 'utf8');
async function fixture({existing = null, error = null, conflict = false, member = true} = {}) {
 const elements = new Map(), writes = [], filters = [];
 function el(id) {
  if (!elements.has(id)) elements.set(id,{value:'',hidden:false,disabled:false,textContent:'',handlers:{},validity:'',classList:{toggle(){}},append(){},focus(){},setCustomValidity(v){this.validity=v;},addEventListener(n,f){this.handlers[n]=f;}});
  return elements.get(id);
 }
 el('client-form').elements={namedItem:el}; el('client-form').reportValidity=()=>[...elements.values()].every(e=>!e.validity);
 let row = existing, operation = null;
 const client={auth:{onAuthStateChange(){}},from(){operation=null;return {select(){return this;},eq(k,v){filters.push([k,v]);return this;},insert(data){operation=data;writes.push({type:'insert',data});return this;},update(data){operation=data;writes.push({type:'update',data});return this;},async maybeSingle(){if (!operation) return {data:row}; if(error)return {error}; if(conflict)return {data:null}; row={id:'11111111-1111-4111-8111-111111111111',updated_at:'new',...operation};return {data:row};}};}};
 const redirects=[];
 const context=vm.createContext({URLSearchParams,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},document:{querySelector:s=>el(s.replace(/^#/,'')),createElement:()=>({}),addEventListener(){}},location:{search:existing?'?id=11111111-1111-4111-8111-111111111111':'',replace:u=>redirects.push(u)},history:{replaceState(){}},window:{addEventListener(){}},confirm:()=>true});
 const auth=new vm.SyntheticModule(['authClient','getTeamMember'],function(){this.setExport('authClient',client);this.setExport('getTeamMember',async()=>({member:member?{}:null}));},{context});
 const mod=new vm.SourceTextModule(source,{context});await mod.link(()=>auth);await mod.evaluate();
 return {el,writes,filters,redirects,async submit(){await el('client-form').handlers.submit({preventDefault(){}});}};
}
test('new client normalizes identifiers and saves explicit business fields',async()=>{const f=await fixture();f.el('legal_name').value=' Empresa ';f.el('cnpj').value='12.345.678/0001-90';f.el('cnae').value='1234-5/67';await f.submit();assert.equal(f.writes[0].data.cnpj,'12345678000190');assert.equal(f.writes[0].data.legal_name,'Empresa');assert.equal(f.writes[0].data.cnae,'1234567');assert.equal(f.el('fields').disabled,true);assert.match(f.el('feedback').textContent,/sucesso/);});
test('invalid fields stop database writes',async()=>{const f=await fixture();f.el('legal_name').value='  ';await f.submit();assert.equal(f.writes.length,0);f.el('legal_name').value='Empresa';f.el('cnpj').value='123';await f.submit();assert.equal(f.writes.length,0);});
test('duplicate CNPJ keeps entered data and enables retry',async()=>{const f=await fixture({error:{code:'23505'}});f.el('legal_name').value='Empresa';await f.submit();assert.equal(f.el('legal_name').value,'Empresa');assert.equal(f.el('save').disabled,false);assert.equal(f.el('fields').disabled,false);assert.match(f.el('feedback').textContent,/Já existe/);});
test('edit uses original version and preserves extra address keys',async()=>{const f=await fixture({existing:{legal_name:'Empresa',updated_at:'old',address:{legacy:'keep'}}});f.el('edit').handlers.click();f.el('legal_name').value='Editada';await f.submit();assert.ok(f.filters.some(([k,v])=>k==='updated_at'&&v==='old'));assert.equal(f.writes[0].data.address.legacy,'keep');});
test('concurrent update does not report success',async()=>{const f=await fixture({existing:{legal_name:'Empresa',updated_at:'old'},conflict:true});f.el('edit').handlers.click();await f.submit();assert.match(f.el('feedback').textContent,/outra pessoa/);assert.equal(f.el('fields').disabled,false);});
test('non-member cannot open client editor',async()=>{const f=await fixture({member:false});assert.equal(f.el('content').hidden,true);assert.equal(f.redirects.length,1);assert.equal(f.writes.length,0);});

