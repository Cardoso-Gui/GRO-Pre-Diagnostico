// Small deterministic DOM/layout double for pagination logic, not visual QA.
// No browser, network, client data, or production records are involved.
class TextNode {
 constructor(value=''){this.nodeType=3;this.textContent=value;this.parentElement=null;}
 cloneNode(){return new TextNode(this.textContent);}
 remove(){const parent=this.parentElement;if(parent)parent.childNodes.splice(parent.childNodes.indexOf(this),1);this.parentElement=null;}
}
export class Element {
 constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.parentElement=null;this.className='';this.dataset={};this.attrs={};}
 get children(){return this.childNodes.filter(node=>node.nodeType===1);}
 get textContent(){return this.childNodes.map(node=>node.textContent).join('');}
 set textContent(value){this.replaceChildren(...(String(value)?[new TextNode(String(value))]:[]));}
 get classList(){const self=this;return {contains:name=>self.className.split(/\s+/).includes(name),add(...names){self.className=[...new Set([...self.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove(...names){self.className=self.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle(name,force){const enabled=force??!this.contains(name);enabled?this.add(name):this.remove(name);return enabled;}};}
 append(...nodes){for(let node of nodes){if(typeof node==='string')node=new TextNode(node);node.remove();node.parentElement=this;this.childNodes.push(node);}}
 appendChild(node){this.append(node);return node;}
 replaceChildren(...nodes){for(const child of [...this.childNodes])child.remove();this.append(...nodes);}
 remove(){const parent=this.parentElement;if(parent)parent.childNodes.splice(parent.childNodes.indexOf(this),1);this.parentElement=null;}
 replaceWith(node){const parent=this.parentElement;if(!parent)return;const index=parent.childNodes.indexOf(this);node.remove();parent.childNodes[index]=node;node.parentElement=parent;this.parentElement=null;}
 after(node){const parent=this.parentElement;if(!parent)return;const index=parent.childNodes.indexOf(this);node.remove();parent.childNodes.splice(index+1,0,node);node.parentElement=parent;}
 setAttribute(name,value){if(name==='class')this.className=String(value);else if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);else this.attrs[name]=String(value);}
 removeAttribute(name){if(name==='id')delete this.attrs.id;else if(name.startsWith('data-'))delete this.dataset[dataKey(name)];else delete this.attrs[name];}
 cloneNode(deep=false){const clone=new Element(this.tagName);clone.className=this.className;clone.dataset={...this.dataset};clone.attrs={...this.attrs};if(deep)clone.append(...this.childNodes.map(node=>node.cloneNode(true)));return clone;}
 matches(selector){return selector.split(',').some(part=>matchesChain(this,part.trim()));}
 querySelectorAll(selector){const result=[];const visit=node=>{for(const child of node.children){if(selector.split(',').some(part=>matchesChain(child,part.trim(),this)))result.push(child);visit(child);}};visit(this);return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 getBoundingClientRect(){const height=heightOf(this);return {top:0,height,bottom:height+(this.classList.contains('report-sheet-body')?heightOf(this.parentElement.children[0]):0),width:this.closest('.print-risk-column')?330:680};}
}
const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
function simple(node,selector,scope){
 if(!node)return false;if(selector===':scope')return node===scope;
 const tag=selector.match(/^[a-z][\w-]*/i)?.[0];if(tag&&node.tagName!==tag.toUpperCase())return false;
 for(const name of selector.matchAll(/\.([\w-]+)/g))if(!node.classList.contains(name[1]))return false;
 for(const match of selector.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/g)){
  const value=match[1].startsWith('data-')?node.dataset[dataKey(match[1])]:node.attrs[match[1]];
  if(value===undefined||(match[2]!==undefined&&value!==match[2]))return false;
 }
 return true;
}
function matchesChain(node,selector,scope){
 const parts=selector.replace(/\s*>\s*/g,' > ').split(/\s+/);let index=parts.length-1;
 if(!simple(node,parts[index--],scope))return false;
 while(index>=0){if(parts[index]==='>'){node=node.parentElement;index--;if(!simple(node,parts[index--],scope))return false;}else{const target=parts[index--];node=node.parentElement;while(node&&!simple(node,target,scope))node=node.parentElement;if(!node)return false;}}
 return true;
}
function heightOf(node){
 if(node.nodeType===3)return node.textContent.trim()?Math.ceil(node.textContent.length/(node.parentElement?.closest('.print-risk-column')?38:95))*14:0;
 if(node.dataset.testHidden)return 0;
 if(node.classList.contains('report-sheet'))return 900;
 if(node.classList.contains('report-sheet-context'))return node.textContent?32:0;
 if(node.dataset.testHeight)return Number(node.dataset.testHeight);
 if(node.classList.contains('print-risk-columns'))return Math.max(0,...node.children.map(heightOf))+8;
 if(node.tagName==='THEAD'&&node.closest('.compact-risk-fields'))return 0;
 if(node.tagName==='TR'&&!node.closest('.print-risk-card'))return Math.max(0,...node.children.map(heightOf))+8;
 if(node.tagName==='H2'||node.tagName==='H3'||node.tagName==='H4'||node.tagName==='SUMMARY')return node.textContent?30:0;
 const padding=node.classList.contains('viewer-risk')?14:node.tagName==='TR'?4:node.tagName==='TD'?3:0;
 return node.childNodes.reduce((sum,child)=>sum+heightOf(child),0)+padding;
}
export function installDOM(t){
 const previous={document:globalThis.document,Node:globalThis.Node,getComputedStyle:globalThis.getComputedStyle};
 globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>new TextNode(text)};
 globalThis.Node=Element;
 globalThis.getComputedStyle=element=>({display:element.dataset.testHidden?'none':'block'});
 t.after(()=>Object.assign(globalThis,previous));
}
export function el(tag,text='',className='',...children){const result=new Element(tag);result.className=className;result.textContent=text;result.append(...children);return result;}
