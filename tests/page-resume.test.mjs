import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {watchPageResume}=await import('data:text/javascript;base64,'+readFileSync(new URL('../page-resume.js',import.meta.url)).toString('base64'));
const member={user_id:'one',team_id:'a',role:'member',active:true};
function setup(getMember){const events={},doc={hidden:false,addEventListener:(n,f)=>events[n]=f},win={addEventListener:(n,f)=>events[n]=f};let changes=0;watchPageResume({getMember,currentMember:()=>member,onAccessChanged:()=>changes++,document:doc,window:win});return {events,doc,changes:()=>changes};}
test('tab return preserves page for unchanged access and ignores hidden tabs',async()=>{let calls=0;const s=setup(async()=>{calls++;return {member:{...member}}});s.doc.hidden=true;await s.events.visibilitychange();assert.equal(calls,0);s.doc.hidden=false;await s.events.visibilitychange();assert.equal(calls,1);assert.equal(s.changes(),0);});
test('network failure preserves work but revoked session and changed team invalidate access',async()=>{for(const result of [{reason:'network',error:Error()},{reason:'session',error:Error(),member:null},{member:{...member,team_id:'b'}}]){const s=setup(async()=>result);await s.events.visibilitychange();assert.equal(s.changes(),result.reason==='network'?0:1);}});
test('overlapping resume checks are coalesced',async()=>{let finish,calls=0;const s=setup(()=>{calls++;return new Promise(r=>finish=r)});const first=s.events.visibilitychange();await s.events.visibilitychange();assert.equal(calls,1);finish({member});await first;});
