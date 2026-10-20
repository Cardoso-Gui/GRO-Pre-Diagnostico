import {changedValues} from './report-rectification.js?v=20261020-rectify1';
// Regenerate only sections that depend on corrected data. Unknown legacy sections
// and unrelated frozen nodes remain byte-for-byte equivalent JSON values.
const COVER='@cover',COMPANY='Dados da empresa',SIZING='Dimensionamento CIPA/SESMT',JOBS='Setores e cargos',RISKS='Riscos identificados',DETAILS='Fontes geradoras',EPIS='EPIs e treinamentos sugeridos',NRS='NRs identificadas no levantamento',PENDING='Pendências para validação técnica';
const text=node=>node?.text??(node?.children||[]).map(text).join('');
const sectionKey=node=>{if(String(node?.className||'').split(/\s+/).includes('report-cover'))return COVER;const title=text((node?.children||[]).find(child=>child.tag==='h3')).trim();return title==='Detalhamento dos riscos'?DETAILS:title;};
const pathParts=change=>Array.isArray(change.path)?change.path:String(change.path||'').startsWith('/')?change.path.slice(1).split('/').map(part=>part.replace(/~1/g,'/').replace(/~0/g,'~')):String(change.path||'').split('.');
export function affectedReportSections(changes=[]){
 const result=new Set(),add=(...items)=>items.forEach(item=>result.add(item));
 const expanded=changes.flatMap(change=>{if(change.before&&change.after&&typeof change.before==='object'&&typeof change.after==='object')return changedValues(change.before,change.after,pathParts(change));return [change];});
 for(const change of expanded){const path=pathParts(change),[root,key,subkey]=path;
  if(root==='client'||(root==='answers'&&key==='currentCompany')){
   add(COVER,COMPANY);if(key==='cnae'||subkey==='cnae_fiscal')add(SIZING,EPIS,NRS);continue;
  }
  if(root!=='answers')continue;
  if(['employees','dimensionOptions'].includes(key))add(COVER,SIZING,NRS);
  if(key==='jobsBySector'&&path.includes('workstations')){add(JOBS);continue;}
  if(key==='jobsBySector'&&path.at(-1)==='quantity'){add(JOBS);continue;}
  if(key==='jobsBySector'&&path.at(-1)==='foodHandling'){add(JOBS,EPIS,NRS);continue;}
  if(['selectedSectors','jobsBySector','selectedRiskMode','gheList'].includes(key))add(COVER,JOBS,RISKS,DETAILS,EPIS,NRS,PENDING);
  if(key==='selectedRisksByTarget')add(RISKS,DETAILS,EPIS,NRS,PENDING);
  if(key==='riskSourcesBySelection')add(DETAILS,EPIS,NRS,PENDING);
  if(key==='epiBySelection')add(DETAILS,EPIS,NRS);
 }
 return result;
}
export function overlayReportDocument(original,generated,changes){
 if(original?.version!==1||!Array.isArray(original.children))throw Error('O documento original não é compatível com uma retificação segura.');
 const affected=affectedReportSections(changes);if(!affected.size)return structuredClone(original);
 if(generated?.version!==1||!Array.isArray(generated.children))throw Error('Não foi possível validar os trechos corrigidos.');
 const replacements=new Map(generated.children.map(node=>[sectionKey(node),node]));
 for(const key of affected)if(!replacements.has(key))throw Error('O gerador não produziu uma seção necessária da retificação.');
 const used=new Set(),children=original.children.map(node=>{const key=sectionKey(node);if(!affected.has(key))return structuredClone(node);if(used.has(key))throw Error('O original contém seções duplicadas. Revise o documento antes de retificar este conteúdo.');used.add(key);return structuredClone(replacements.get(key));});
 for(const node of generated.children){const key=sectionKey(node);if(affected.has(key)&&!used.has(key)){children.push(structuredClone(node));used.add(key);}}
 return {...structuredClone(original),children};
}
