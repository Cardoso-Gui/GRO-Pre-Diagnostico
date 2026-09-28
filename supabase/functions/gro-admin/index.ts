import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const origins = new Set(['https://cardoso-gui.github.io', 'http://localhost:4173', 'http://127.0.0.1:4173']);
Deno.serve(async (req) => {
 const origin = req.headers.get('origin') || '';
 const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
  'Access-Control-Allow-Origin': origins.has(origin) ? origin : '',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply = (status:number, message:string, data?:unknown) => new Response(JSON.stringify({message,data}),{status,headers});
 if (origin && !origins.has(origin)) return reply(403,'Origem não autorizada.');
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
 if(req.method!=='POST') return reply(405,'Método não permitido.');
 try {
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token) return reply(401,'Entre novamente para continuar.');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if(authError || !auth.user) return reply(401,'Entre novamente para continuar.');
  const {data:actor,error:actorError}=await db.from('team_members').select('user_id,role,active,team_id,is_super_admin,teams(active)').eq('user_id',auth.user.id).single();
  if(actorError || !actor?.active || actor.role!=='admin' || (!actor.is_super_admin && !(actor.teams as any)?.active)) return reply(403,'Você não tem permissão para administrar usuários.');
  const raw=await req.text(); if(raw.length>12000) return reply(400,'Formulário muito grande.');
  const {action,data}=JSON.parse(raw);
  if(!data || !['create_user','update_user','create_team','update_team'].includes(action)) return reply(400,'Operação inválida.');
  const clean:Record<string,unknown>={};
  if(action.endsWith('_team')) {
   if(!actor.is_super_admin) return reply(403,'Somente o administrador geral pode alterar equipes.');
   if(typeof data.name!=='string' || !data.name.trim() || data.name.trim().length>120) return reply(400,'Informe o nome da equipe.');
   clean.name=data.name.trim(); clean.id=data.id; clean.active=data.active===true;
  } else {
   if(typeof data.display_name!=='string' || !data.display_name.trim() || data.display_name.trim().length>160) return reply(400,'Informe o nome completo.');
   const username=String(data.username||'').trim().toLowerCase();
   if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return reply(400,'Use de 3 a 40 letras, números, pontos, hífens ou sublinhados no usuário.');
   if(!actor.is_super_admin && data.team_id!==actor.team_id) return reply(403,'Equipe não autorizada.');
   const {data:team}=await db.from('teams').select('id').eq('id',data.team_id).eq('active',true).maybeSingle();
   if(!team) return reply(400,'Escolha uma equipe ativa.');
   const email=String(data.contact_email||'').trim();
   if(email.length>254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return reply(400,'Confira o e-mail de contato.');
   if(!['admin','editor'].includes(data.role)) return reply(400,'Perfil inválido.');
   Object.assign(clean,{display_name:data.display_name.trim(),username,contact_email:email,team_id:data.team_id,role:data.role,active:data.active===true,user_id:data.user_id});
   if(action==='create_user') {
    if(typeof data.password!=='string' || data.password.length<6 || data.password.length>128) return reply(400,'A senha deve ter entre 6 e 128 caracteres.');
    const {data:existing}=await db.from('team_members').select('user_id').eq('username',username).maybeSingle();
    if(existing) return reply(409,'Esse nome de usuário já está em uso.');
    // Internal Auth address: contact email is optional; login always uses username.
    const {data:created,error}=await db.auth.admin.createUser({email:`${crypto.randomUUID()}@users.gro.invalid`,password:data.password,email_confirm:true});
    if(error || !created.user) return reply(400,'Não foi possível criar a conta. Confira a senha e tente novamente.');
    clean.user_id=created.user.id;
    const saved=await db.rpc('manage_gro_admin',{p_actor:actor.user_id,p_action:action,p_data:clean});
    if(saved.error) {
     // Never remove an account if the request may have committed successfully.
     const check=await db.from('team_members').select('user_id').eq('user_id',created.user.id).maybeSingle();
     if(check.data) return reply(200,'Usuário criado.',check.data);
     if(!check.error) await db.auth.admin.deleteUser(created.user.id);
     return reply(400,saved.error.code==='23505'?'Esse nome de usuário já está em uso.':'Não foi possível cadastrar o usuário. Atualize a lista antes de tentar novamente.');
    }
    return reply(200,'Usuário criado.',saved.data);
   }
  }
  const result=await db.rpc('manage_gro_admin',{p_actor:actor.user_id,p_action:action,p_data:clean});
  if(result.error) {
   const message=result.error.code==='23505'?'Esse nome de usuário já está em uso.':result.error.code==='P0001'?result.error.message:'Não foi possível salvar. Confira os dados e sua permissão.';
   return reply(result.error.code==='42501'?403:400,message);
  }
  return reply(200,'Alterações salvas.',result.data);
 } catch {return reply(503,'Não foi possível concluir agora. Confira a conexão e atualize a lista antes de tentar novamente.');}
});
