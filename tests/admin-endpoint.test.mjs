import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes((await fs.readFile(new URL('../supabase/functions/gro-admin/index.ts',import.meta.url),'utf8')).replace(/^import .*;\s*/,''));
function fixture({role='admin',global=false,active=true,authError=false,rpcError=null,committed=false}={}){
 let handler;const calls={created:[],deleted:[],rpc:[]};
 const actor={user_id:'actor',role,active:true,team_id:'team-a',is_super_admin:global,teams:{active}};
 const db={auth:{getUser:async()=>({data:{user:authError?null:{id:'actor'}},error:authError}),admin:{createUser:async data=>{calls.created.push(data);return {data:{user:{id:'new-user'}}};},deleteUser:async id=>{calls.deleted.push(id);return {};}}},
 from(table){let column,value;return {select(){return this;},eq(k,v){column=k;value=v;return this;},single:async()=>({data:actor}),maybeSingle:async()=>({data:table==='teams'?{id:'team-a'}:column==='user_id'&&committed?{user_id:'new-user'}:null})};},
 rpc:async(name,payload)=>{calls.rpc.push(payload);return {data:rpcError?null:{user_id:'new-user'},error:rpcError};}};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:f=>handler=f},Request,Response,crypto});
 return {calls,request:(data,token='valid')=>handler(new Request('https://example.test',{method:'POST',headers:{origin:'http://127.0.0.1:4173',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)}))};
}
const user={action:'create_user',data:{display_name:'Teste',username:'teste.user',team_id:'team-a',role:'editor',password:'only-a-test-password'}};
test('admin endpoint denies missing/invalid auth and editors before mutations',async()=>{for(const opts of [{role:'editor'},{authError:true},{active:false}]){const f=fixture(opts);assert.ok([401,403].includes((await f.request(user)).status));assert.equal(f.calls.created.length,0);}assert.equal((await fixture().request(user,'')).status,401);});
test('team admin cannot create teams or cross-team accounts',async()=>{const f=fixture();assert.equal((await f.request({action:'create_team',data:{name:'Team B'}})).status,403);assert.equal((await f.request({...user,data:{...user.data,team_id:'team-b'}})).status,403);assert.equal(f.calls.created.length,0);});
test('account creation does not expose password to membership storage or output',async()=>{const f=fixture();const response=await f.request(user);assert.equal(response.status,200);assert.equal(f.calls.created.length,1);assert.equal('password' in f.calls.rpc[0].p_data,false);assert.equal('is_super_admin' in f.calls.rpc[0].p_data,false);assert.equal((await response.text()).includes(user.data.password),false);});
test('failed membership removes only uncommitted newly created auth account',async()=>{let f=fixture({rpcError:{code:'23505'}});assert.equal((await f.request(user)).status,400);assert.deepEqual(f.calls.deleted,['new-user']);f=fixture({rpcError:{code:'network'},committed:true});assert.equal((await f.request(user)).status,200);assert.deepEqual(f.calls.deleted,[]);});
