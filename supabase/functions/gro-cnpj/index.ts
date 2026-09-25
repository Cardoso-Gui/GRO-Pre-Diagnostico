const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response('ok',{headers:cors});
 if (req.method !== 'POST') return reply({error:'method'},405);
 try {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({error:'unauthorized'},401);
  const base = Deno.env.get('SUPABASE_URL')!;
  const headers = {Authorization:authorization,apikey:Deno.env.get('SUPABASE_ANON_KEY')!};
  const userResponse = await fetch(`${base}/auth/v1/user`,{headers,signal:AbortSignal.timeout(5000)});
  if (!userResponse.ok) return reply({error:'unauthorized'},401);
  const user = await userResponse.json();
  if (!user.id) return reply({error:'unauthorized'},401);
  const membership = await fetch(`${base}/rest/v1/team_members?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`,{headers,signal:AbortSignal.timeout(5000)});
  if (!membership.ok || !(await membership.json()).length) return reply({error:'forbidden'},403);
  let body; try { body = await req.json(); } catch { return reply({error:'invalid'},400); }
  const cnpj = typeof body.cnpj === 'string' ? body.cnpj.replace(/[.\/\s-]/g,'').toUpperCase() : '';
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)) return reply({error:'invalid'},400);
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,{signal:AbortSignal.timeout(10000)});
  if (!response.ok) return reply({error:'provider'},[400,404,429].includes(response.status)?response.status:502);
  const data = await response.json();
  const keys = ['cnpj','razao_social','nome_fantasia','cnae_fiscal','descricao_tipo_de_logradouro','logradouro','numero','complemento','bairro','municipio','uf','cep','ddd_telefone_1','email'];
  return reply(Object.fromEntries(keys.map(key=>[key,data[key] ?? null])));
 } catch { return reply({error:'unavailable'},502); }
});

