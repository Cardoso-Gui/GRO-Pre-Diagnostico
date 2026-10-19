import test from 'node:test';
import assert from 'node:assert/strict';
import {damageSuggestions,damageDraft,damageText} from '../risk-damage-options.js';
test('sugestões específicas não pré-selecionam nem aplicam lista genérica',()=>{assert.ok(damageSuggestions('02.01.001').includes('Zumbido'));assert.equal(damageSuggestions('unknown').length,0);assert.deepEqual(damageDraft({}).selected,[]);});
test('preserva texto legado integralmente em Outros sem inferir seleções',()=>{const text='PAIR; observação anterior\nMais uma linha';const d=damageDraft({damage:text});assert.equal(d.other,text);assert.equal(d.otherEnabled,true);assert.deepEqual(d.selected,[]);assert.equal(damageText(d),text);});
test('seleção múltipla e Outros geram campo compatível com relatório',()=>{const d={selected:['Contusões','Fraturas'],other:'Descrição adicional',otherEnabled:true};assert.equal(damageText(d),'Contusões; Fraturas; Descrição adicional');d.other=' ';assert.equal(damageText(d),'');d.otherEnabled=false;assert.equal(damageText(d),'Contusões; Fraturas');});
test('restaura opções persistidas mesmo se catálogo mudar',()=>{assert.deepEqual(damageDraft({damageSelections:['Opção antiga'],damageOther:'Nota',damageOtherEnabled:false}),{selected:['Opção antiga'],other:'Nota',otherEnabled:false});});
