import test from 'node:test';
import assert from 'node:assert/strict';
import {reportVisitDate} from '../report-viewer.js';
test('data da visita deve ser explícita e válida, nunca inferida da conclusão ou título',()=>{
 assert.equal(reportVisitDate({visitDate:'2026-10-05'}),'05/10/2026');
 assert.equal(reportVisitDate({visit_date:'2024-02-29'}),'29/02/2024');
 for(const answers of [{},{completed_at:'2026-10-19',title:'Levantamento — 05/10/2026'},{visitDate:'2026-02-30'},{visitDate:'2026-13-01'},{visitDate:'05/10/2026'}])assert.equal(reportVisitDate(answers),'Não informada');
});
