// Display-only labels. Stored changes and their technical paths are never rewritten.
const labels={title:'Título do levantamento',client:'Identificação da empresa',answers:'Informações do levantamento',
 legal_name:'Razão social',trade_name:'Nome fantasia',cnpj:'CNPJ',cnae:'CNAE principal',contact_name:'Responsável da empresa',contact_phone:'Telefone',contact_email:'E-mail',
 address:'Endereço',street:'Logradouro',number:'Número',complement:'Complemento',district:'Bairro',city:'Município',state:'UF',postal_code:'CEP',
 visitDate:'Data da visita',visit_date:'Data da visita',employees:'Número de funcionários',dimensionOptions:'Opções de dimensionamento',preponderantRisk:'Grau de risco preponderante',health:'Atividade de saúde',
 selectedSectors:'Setores',jobsBySector:'Cargos por setor',selectedRiskMode:'Organização dos riscos',gheList:'Grupos homogêneos de exposição',selectedRisksByTarget:'Riscos selecionados',riskSourcesBySelection:'Detalhamento dos riscos',epiBySelection:'Equipamentos de proteção individual',
 name:'Nome',quantity:'Quantidade de funcionários',activities:'Atividades do cargo',foodHandling:'Manipulação de alimentos',workstations:'Postos de trabalho',note:'Observação',photoPath:'Foto do posto',photoPaths:'Fotos do posto',
 id:'Identificador',linkedJobs:'Cargos vinculados',sectorName:'Setor vinculado',jobName:'Cargo vinculado',source:'Fonte / situação de exposição',frequency:'Frequência da exposição',duration:'Tempo / circunstância da exposição',damage:'Possíveis danos / consequências',measures:'Medidas existentes',improve:'Melhorias propostas',measure:'Necessidade de medir / avaliar',controls:'Controles de prevenção',damageSelections:'Danos selecionados',damageOther:'Outros danos',damageOtherEnabled:'Outros danos informados',applicable:'EPI aplicável',items:'Equipamentos informados',
 currentCompany:'Identificação no relatório',razao_social:'Razão social no relatório',nome_fantasia:'Nome fantasia no relatório',cnae_fiscal:'CNAE no relatório',cnae_fiscal_descricao:'Descrição do CNAE',logradouro:'Logradouro no relatório',descricao_tipo_de_logradouro:'Tipo de logradouro',numero:'Número no relatório',complemento:'Complemento no relatório',bairro:'Bairro no relatório',municipio:'Município no relatório',uf:'UF no relatório',cep:'CEP no relatório',ddd_telefone_1:'Telefone no relatório',email:'E-mail no relatório'};
const arrayRoots=new Set(['selectedSectors','jobsBySector','gheList','selectedRisksByTarget','riskSourcesBySelection','epiBySelection']);
const index=value=>/^\d+$/.test(String(value));
const normalize=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function snapshot(value){if(value?.assessment)value=value.assessment;if(value?.final_snapshot)return {...value.final_snapshot,title:value.title??value.final_snapshot.title};return value?.answers||value?.client?value:{answers:value||{}};}
function parts(path){if(Array.isArray(path))return path.map(String);const raw=String(path??'');return raw.startsWith('/')?raw.slice(1).split('/').map(key=>key.replace(/~1/g,'/').replace(/~0/g,'~')):raw.split('.').filter(Boolean);}
function at(value,path){return path.reduce((node,key)=>node&&Object.hasOwn(node,key)?node[key]:undefined,value);}
function display(value,isDate){
 if(value===null||value===undefined)return 'Não informado';
 if(value==='')return 'Em branco';
 if(isDate&&typeof value==='string'){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(match){const [,year,month,day]=match,y=Number(year),m=Number(month),d=Number(day),days=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];if(y>0&&m>=1&&m<=12&&d>=1&&d<=days[m-1])return `${day}/${month}/${year}`;}
 }
 if(typeof value==='object')return JSON.stringify(value,null,2);
 if(typeof value==='boolean')return value?'Sim':'Não';
 return String(value);
}
function targetContext(raw,answers){
 const key=String(raw??'');if(!key)return '';
 const target=key.replace(/^(source|epi-data|epi)__/,''),sections=[];
 for(const [sector,jobs] of answers.jobsBySector||[])for(const job of jobs||[]){const id=['job',sector,job.name].map(normalize).join('__');if(target===id||target.startsWith(id+'__')){sections.push('Setor: '+sector,'Cargo: '+job.name);const risk=target.slice(id.length+2);if(risk)sections.push('Risco: '+risk.toUpperCase());return sections.join(' · ');}}
 for(const ghe of answers.gheList||[]){if(target===ghe.id||target.startsWith(ghe.id+'__')){sections.push('GHE: '+ghe.name);const risk=target.slice(ghe.id.length+2);if(risk)sections.push('Risco: '+risk.toUpperCase());return sections.join(' · ');}}
 return 'Alvo: '+key;
}
export function describeRectificationChange(diff,{before,after}={}){
 const path=Array.isArray(diff.path)?diff.path.join('.'):String(diff.path??''),keys=parts(diff.path),old=snapshot(before),current=snapshot(after),last=keys.at(-1),named=[...keys].reverse().find(key=>!index(key));
 let label=Object.hasOwn(labels,named)?labels[named]:('Campo: '+String(named||'informação').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ')),context='';
 const rootIndex=keys.findIndex(key=>arrayRoots.has(key)),root=keys[rootIndex],position=keys[rootIndex+1];
 const answers=current.answers||old.answers||{};
 const read=tail=>at(current,tail)??at(old,tail);
 if(root&&index(position)){
  const base=keys.slice(0,rootIndex+2),entry=read(base);
  if(root==='jobsBySector'){
   const sector=entry?.[0];const jobIndex=keys[rootIndex+3],job=index(jobIndex)?read([...base,'1',jobIndex]):null;
   context=[sector?'Setor: '+sector:'Setor '+(Number(position)+1),job?.name?'Cargo: '+job.name:''].filter(Boolean).join(' · ');
   if(named==='name')label=keys.includes('workstations')?'Nome do posto':'Nome do cargo';
   const stationIndex=keys.indexOf('workstations');if(stationIndex>=0&&index(keys[stationIndex+1])){const station=read(keys.slice(0,stationIndex+2));context+=' · Posto: '+(station?.name||Number(keys[stationIndex+1])+1);}
  }else if(root==='gheList'){context='GHE: '+(entry?.name||Number(position)+1);if(named==='name')label='Nome do GHE';}
  else if(root==='selectedSectors'){context='Setor '+(Number(position)+1);label='Setor';}
  else context=targetContext(entry?.[0],answers)||'Item '+(Number(position)+1);
 }
 if(named==='controls'&&index(last))label=['Proteção coletiva','Procedimentos e organização','Proteção individual'][Number(last)]||'Controle de prevenção '+(Number(last)+1);
 if(index(last)&&!root&&named!=='controls')context='Item '+(Number(last)+1);
 const isDate=named==='visitDate'||named==='visit_date';
 let beforeText=display(diff.before,isDate),afterText=display(diff.after,isDate);
 if(named==='selectedRiskMode'){const modes={job:'Por cargo',ghe:'Por grupo homogêneo de exposição (GHE)'};beforeText=Object.hasOwn(modes,diff.before)?modes[diff.before]:beforeText;afterText=Object.hasOwn(modes,diff.after)?modes[diff.after]:afterText;}
 return {label,context,before:beforeText,after:afterText,path};
}
