export function riskDetailStatus(data = {}, epi = {}) {
 const required = ['source', 'frequency', 'duration', 'damage', 'measures', 'measure'];
 const usesEpi = Boolean(data.controls?.[2]) || epi.applicable === 'Sim';
 const complete = required.every(key => String(data[key] || '').trim()) && (!usesEpi || (epi.items || []).some(item => String(item).trim()));
 if (complete) return 'Preenchido';
 return Object.entries(data).some(([key, value]) => key === 'controls' ? value?.some(Boolean) : typeof value === 'string' && value.trim()) || (epi.items || []).some(item => String(item).trim()) ? 'Em preenchimento' : 'Pendente';
}
