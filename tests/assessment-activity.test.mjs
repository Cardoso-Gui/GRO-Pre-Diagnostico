import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountAssessmentActivity,activityFields} from '../assessment-activity.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('history is lazy, renders literal server data, paginates and clears stale rows on failure',async()=>{
 const dom=new JSDOM('<main></main>');const d=dom.window.document;let calls=[],fail=false;
 const client={rpc:async(name,args)=>{calls.push({name,args});return fail?{error:Error('offline')}:{data:[{event_id:'10',action:'updated',actor_name:'<img src=x onerror=alert(1)>',occurred_at:'2026-11-12T12:00:00Z',revision:2,changed_fields:['answers.visitDate']}]};}};
 const view=mountAssessmentActivity({client,doc:d,anchor:d.querySelector('main'),getContext:()=>({id:'synthetic',saved:true})});assert.equal(calls.length,0);
 await view.refresh();assert.equal(calls[0].name,'read_assessment_activity');assert.equal(d.querySelectorAll('img').length,0);assert.match(d.querySelector('.activity-event').textContent,/<img/);assert.match(d.querySelector('.activity-event').textContent,/Data da visita/);
 fail=true;await view.refresh();assert.equal(d.querySelectorAll('.activity-event').length,0);assert.match(d.querySelector('.activity-status').textContent,/Não foi possível/);view.dispose();assert.equal(d.querySelector('.assessment-activity'),null);dom.window.close();
});
test('unsaved drafts do not request nonexistent history; late responses cannot repopulate a disposed view',async()=>{
 const dom=new JSDOM('<main></main>');const d=dom.window.document;let saved=false,resolve;
 const view=mountAssessmentActivity({client:{rpc:()=>new Promise(done=>resolve=done)},doc:d,anchor:d.querySelector('main'),getContext:()=>({id:'synthetic',saved})});
 await view.refresh();assert.match(d.querySelector('.activity-status').textContent,/Salve o rascunho/);saved=true;const loading=view.refresh();view.dispose();resolve({data:[]});await loading;await tick();assert.equal(d.querySelector('.assessment-activity'),null);dom.window.close();
 assert.deepEqual(activityFields(['answers.visitDate','unknown','another']),['Data da visita','Outros campos do levantamento']);
});
