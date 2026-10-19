export function riskDetailStatus(data = {}) {
 const required = ['source', 'frequency', 'duration', 'damage', 'measures', 'measure'];
 if(required.every(key => String(data[key] || '').trim()))return 'Preenchido';
 return Object.entries(data).some(([key,value])=>key==='controls'?value?.slice(0,2).some(Boolean):typeof value==='string'&&value.trim())?'Em preenchimento':'Pendente';
}
