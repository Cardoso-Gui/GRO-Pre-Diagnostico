// Curated suggestions by exact catalog code. No automatic selections or diagnosis.
// Sources consulted 2026-10-19:
// https://www.cdc.gov/niosh/media/pdfs/2026/09/2026-118.pdf (noise)
// https://www.cdc.gov/niosh/heat-stress/about/illnesses.html (heat)
// https://www.cdc.gov/niosh/docs/2022-132/2022-132.pdf (cold)
// https://www.cdc.gov/niosh/ergonomics/index.html (musculoskeletal)
// https://www.cdc.gov/mmwr/volumes/67/wr/mm6701a1.htm (standing)
// https://www.osha.gov/laws-regs/regulations/standardnumber/1915/1915SubpartIAppA (cuts)
// https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.133/ (particles)
// https://www.osha.gov/vtools/construction/ (falls)
const musculoskeletal=['Dores musculoesqueléticas','Distensões musculares','Lesões de tendões e articulações'];
const falls=['Contusões','Entorses','Fraturas'];
const cuts=['Cortes e lacerações','Perfurações','Escoriações'];
const choices={
 '02.01.001':['Perda auditiva induzida por ruído (PAIR)','Zumbido'],
 '02.01.014':['Exaustão pelo calor','Cãibras pelo calor','Desmaio relacionado ao calor','Golpe de calor'],
 'FIS.001':['Hipotermia','Lesões por congelamento'],
 'ERG.001':musculoskeletal,'ERG.002':['Dores musculoesqueléticas'],'ERG.003':['Dores musculoesqueléticas'],'ERG.004':musculoskeletal,'ERG.005':musculoskeletal,'ERG.006':musculoskeletal,'ERG.008':musculoskeletal,
 'ACI.001':falls,'ACI.002':falls,'ACI.011':falls,
 'ACI.004':cuts,'ACI.012':cuts,'ACI.006':['Lesões oculares','Lesões na face','Cortes e escoriações']
};
export function damageSuggestions(code){return [...(choices[code]||[])];}
export function damageDraft(data={}){
 if(!Array.isArray(data.damageSelections))return {selected:[],other:String(data.damage||''),otherEnabled:Boolean(data.damage)};
 return {selected:[...data.damageSelections],other:String(data.damageOther||''),otherEnabled:Boolean(data.damageOtherEnabled)};
}
export function damageText(draft){
 if(draft.otherEnabled&&!draft.other.trim())return '';
 return [...draft.selected,...(draft.otherEnabled?[draft.other.trim()]:[])].join('; ');
}
