import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes((await fs.readFile(new URL('../supabase/functions/gro-admin/index.ts',import.meta.url),'utf8')).replace(/^import .*;\s*/,''));
function fixture({role='admin',global=false,active=true,globalTeam=false,authError=false,rpcError=null,committed=false,target=null,passwordError=null}={}){
 let handler;const calls={created:[],deleted:[],rpc:[],passwords:[]};
 const actor={user_id:'actor',role,active:true,team_id:'team-a',is_super_admin:global,teams:{active,grants_global_access:globalTeam}};
 const db={auth:{getUser:async()=>({data:{user:authError?null:{id:'actor'}},error:authError}),admin:{updateUserById:async(id,data)=>{calls.passwords.push({id,data});return {error:passwordError};},createUser:async data=>{calls.created.push(data);return {data:{user:{id:'new-user'}}};},deleteUser:async id=>{calls.deleted.push(id);return {};}}},
 from(table){let column,value;return {select(){return this;},eq(k,v){column=k;value=v;return this;},single:async()=>({data:actor}),maybeSingle:async()=>({data:table==='teams'?{id:'team-a'}:column==='user_id'?(target||(committed?{user_id:'new-user'}:null)):null})};},
 rpc:async(name,payload)=>{calls.rpc.push(payload);return {data:rpcError?null:{user_id:'new-user'},error:rpcError};}};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:f=>handler=f},Request,Response,crypto});
 return {calls,request:(data,token='valid')=>handler(new Request('https://example.test',{method:'POST',headers:{origin:'http://127.0.0.1:4173',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)}))};
}
const user={action:'create_user',data:{display_name:'Teste',username:'teste.user',team_id:'team-a',role:'editor',password:'only-a-test-password'}};
test('admin endpoint denies missing/invalid auth and editors before mutations',async()=>{for(const opts of [{role:'editor'},{authError:true},{active:false}]){const f=fixture(opts);assert.ok([401,403].includes((await f.request(user)).status));assert.equal(f.calls.created.length,0);}assert.equal((await fixture().request(user,'')).status,401);});
test('team admin cannot create teams or cross-team accounts',async()=>{const f=fixture();assert.equal((await f.request({action:'create_team',data:{name:'Team B'}})).status,403);assert.equal((await f.request({...user,data:{...user.data,team_id:'team-b'}})).status,403);assert.equal(f.calls.created.length,0);});
test('account creation does not expose password to membership storage or output',async()=>{const f=fixture();const response=await f.request(user);assert.equal(response.status,200);assert.equal(f.calls.created.length,1);assert.equal('password' in f.calls.rpc[0].p_data,false);assert.equal('is_super_admin' in f.calls.rpc[0].p_data,false);assert.equal((await response.text()).includes(user.data.password),false);});
test('failed membership removes only uncommitted newly created auth account',async()=>{let f=fixture({rpcError:{code:'23505'}});assert.equal((await f.request(user)).status,400);assert.deepEqual(f.calls.deleted,['new-user']);f=fixture({rpcError:{code:'network'},committed:true});assert.equal((await f.request(user)).status,200);assert.deepEqual(f.calls.deleted,[]);});

test('password accepts six characters and rejects five',async()=>{for(const [password,status] of [['abc123',200],['abc12',400]]){const f=fixture();assert.equal((await f.request({...user,data:{...user.data,password}})).status,status);assert.equal(f.calls.created.length,status===200?1:0);}});

test('active admin-team collaborator can manage teams; inactive team cannot',async()=>{const f=fixture({role:'editor',globalTeam:true});assert.equal((await f.request({action:'create_team',data:{name:'Test'}})).status,200);const blocked=fixture({role:'editor',globalTeam:true,active:false});assert.equal((await blocked.request({action:'create_team',data:{name:'Test'}})).status,403);});

const reset={action:'reset_password',data:{user_id:'target',password:'test-only-password'}};
test('password reset enforces team boundary and protected root',async()=>{
 for(const opts of [{role:'editor'},{target:{user_id:'target',team_id:'team-b'}},{target:{user_id:'target',team_id:'team-a',is_super_admin:true}},{global:true,target:{user_id:'target',team_id:'team-b',is_super_admin:true}},{target:null}]){const f=fixture(opts);assert.equal((await f.request(reset)).status,403);assert.equal(f.calls.passwords.length,0);}
});
test('password reset works only on authorized user and never returns the password',async()=>{
 for(const opts of [{target:{user_id:'target',team_id:'team-a'}},{global:true,target:{user_id:'target',team_id:'team-b'}}]){const f=fixture(opts);const res=await f.request(reset);assert.equal(res.status,200);assert.equal(f.calls.passwords[0].id,'target');assert.equal(f.calls.rpc.length,0);assert.equal((await res.text()).includes(reset.data.password),false);}
});
test('password reset rejects invalid length and reports auth failure',async()=>{const f=fixture({target:{user_id:'target',team_id:'team-a'}});assert.equal((await f.request({...reset,data:{...reset.data,password:'123'}})).status,400);assert.equal(f.calls.passwords.length,0);const failed=fixture({target:{user_id:'target',team_id:'team-a'},passwordError:{message:'failed'}});assert.equal((await failed.request(reset)).status,400);});

test('contact phone is normalized and malformed numbers are rejected before creation',async()=>{
 const f=fixture();assert.equal((await f.request({...user,data:{...user.data,contact_phone:'(17) 99999-1234'}})).status,200);assert.equal(f.calls.rpc[0].p_data.contact_phone,'17999991234');
 for(const phone of ['123','abc11999999999','119999999999']){const bad=fixture();assert.equal((await bad.request({...user,data:{...user.data,contact_phone:phone}})).status,400);assert.equal(bad.calls.created.length,0);}
 const empty=fixture();assert.equal((await empty.request({...user,data:{...user.data,contact_phone:''}})).status,200);assert.equal(empty.calls.rpc[0].p_data.contact_phone,'');
});

test('professional identity is validated independently from permission and normalized',async()=>{
 const f=fixture();const response=await f.request({...user,data:{...user.data,professional_role:'safety_engineer',professional_registration:'  12345-D  ',professional_registration_uf:' sp ',is_super_admin:true,registration_type:'MTE'}});
 assert.equal(response.status,200);const saved=f.calls.rpc[0].p_data;
 assert.equal(saved.role,'editor');assert.equal(saved.professional_role,'safety_engineer');assert.equal(saved.professional_registration,'12345-D');assert.equal(saved.professional_registration_uf,'SP');
 assert.equal('is_super_admin' in saved,false);assert.equal('registration_type' in saved,false);
});
test('professional endpoint rejects spoofed types, roles, UF and oversized/control registrations before Auth mutation',async()=>{
 for(const fields of [{professional_role:'admin'},{professional_role:1},{professional_registration:123},{professional_registration:{}},{professional_registration:'a'.repeat(81)},{professional_registration:'12\n345'},{professional_registration_uf:'XX'},{professional_registration_uf:true}]){
  const f=fixture();assert.equal((await f.request({...user,data:{...user.data,...fields}})).status,400,JSON.stringify(fields));assert.equal(f.calls.created.length,0);assert.equal(f.calls.rpc.length,0);
 }
});
test('omitted professional fields stay omitted for old clients; explicit blanks/nulls are cleared',async()=>{
 const f=fixture();assert.equal((await f.request({...user,action:'update_user',data:{...user.data,user_id:'target',active:true}})).status,200);
 for(const key of ['professional_role','professional_registration','professional_registration_uf']) assert.equal(Object.hasOwn(f.calls.rpc[0].p_data,key),false);
 const clear=fixture();assert.equal((await clear.request({...user,action:'update_user',data:{...user.data,user_id:'target',active:true,professional_role:null,professional_registration:'  ',professional_registration_uf:''}})).status,200);
 for(const key of ['professional_role','professional_registration','professional_registration_uf']) assert.equal(clear.calls.rpc[0].p_data[key],null);
});
test('auxiliary and unknown identities are accepted as incomplete profiles without granting administrative access',async()=>{
 for(const professional_role of ['safety_assistant',null]){
  const f=fixture();assert.equal((await f.request({...user,data:{...user.data,professional_role}})).status,200);assert.equal(f.calls.rpc[0].p_data.role,'editor');
 }
 const f=fixture({role:'editor'});assert.equal((await f.request({...user,data:{...user.data,professional_role:'safety_engineer',professional_registration:'123',professional_registration_uf:'SP'}})).status,403);assert.equal(f.calls.created.length,0);
});
