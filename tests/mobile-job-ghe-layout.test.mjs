import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

function mobileRules(file,media){
 const css=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const dom=new JSDOM(`<style>${css}</style>`);
 const rules=[...dom.window.document.styleSheets[0].cssRules].filter(rule=>rule.conditionText?.replaceAll(' ','')===media).flatMap(rule=>[...rule.cssRules]);
 return {dom,rules};
}
test('mobile Add cargo resets tablet span to avoid implicit second grid column',()=>{
 const {dom,rules}=mobileRules('workspace.css','(max-width:600px)');
 const rule=rules.find(rule=>rule.selectorText==='.job-card .job-form>label,.job-card .job-form>button');
 assert.ok(rule);assert.equal(rule.style.getPropertyValue('grid-column'),'1/-1');
 assert.equal(rule.style.getPropertyValue('min-width'),'0');
 const textarea=rules.find(rule=>rule.selectorText==='.job-card .job-form textarea');
 assert.equal(textarea.style.getPropertyValue('min-height'),'120px');dom.window.close();
});
test('mobile GHE action stack is scoped to management cards with secondary delete',()=>{
 const {dom,rules}=mobileRules('assessment-wizard.css','(max-width:760px)');
 const actions=rules.find(rule=>rule.selectorText==='.wizard-page #ghe-management-list .ghe-card-actions');
 assert.equal(actions.style.getPropertyValue('grid-template-columns'),'minmax(0,1fr)');
 const secondary=rules.find(rule=>rule.selectorText==='.wizard-page #ghe-management-list .ghe-card-actions>.ghe-delete');
 assert.equal(secondary.style.getPropertyValue('width'),'auto');assert.equal(secondary.style.getPropertyValue('min-height'),'44px');dom.window.close();
});
