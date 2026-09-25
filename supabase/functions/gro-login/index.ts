import { createClient } from "npm:@supabase/supabase-js@2.117.2";
const allowedOrigins=new Set(["https://cardoso-gui.github.io","http://127.0.0.1:4173","http://localhost:4173"]);
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
 if(allowedOrigins.has(origin)) {
  headers["Access-Control-Allow-Origin"]=origin;
  headers["Access-Control-Allow-Headers"]="authorization,x-client-info,apikey,content-type";
  headers["Access-Control-Allow-Methods"]="POST,OPTIONS";
 }
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowedOrigins.has(origin)) return reply({code:"forbidden"},403);
 if(req.method==="OPTIONS") return new Response(null,{status:204,headers});
 if(req.method!=="POST") return reply({code:"method_not_allowed"},405);
 try {
  if(Number(req.headers.get("content-length")||0)>4096) return reply({code:"invalid_credentials"},400);
  const raw=await req.text(); if(raw.length>4096) return reply({code:"invalid_credentials"},400);
  const {username:input,password}=JSON.parse(raw);
  const username=typeof input==="string"?input.trim().toLowerCase():"";
  if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)||typeof password!=="string"||!password||password.length>1024) return reply({code:"invalid_credentials"},400);
  // Privileged client only looks up an authorized member and its Auth identifier.
  // No account creation, membership mutation or privilege changes are exposed.
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(username));
  const key=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
  const {data:allowed,error:limitError}=await admin.rpc("consume_login_attempt",{p_key:key});
  if(limitError) return reply({code:"unavailable"},503);
  if(!allowed) return reply({code:"rate_limit"},429);
  const {data:member,error:memberError}=await admin.from("team_members").select("user_id").eq("username",username).eq("active",true).maybeSingle();
  if(memberError) return reply({code:"unavailable"},503);
  if(!member) return reply({code:"invalid_credentials"},400);
  const {data:lookup,error:lookupError}=await admin.auth.admin.getUserById(member.user_id);
  if(lookupError||!lookup.user?.email) return reply({code:"invalid_credentials"},400);
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.signInWithPassword({email:lookup.user.email,password});
  if(error||!data.session) return reply({code:error?.status===429?"rate_limit":"invalid_credentials"},error?.status===429?429:400);
  return reply({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
 } catch { return reply({code:"unavailable"},503); }
});
