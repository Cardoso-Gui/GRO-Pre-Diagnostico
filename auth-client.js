// This publishable key is intended for browsers. Data access is enforced by RLS.
import {createLoginStorage} from './login-storage.js?v=20260928-remember1';
export const loginStorage=createLoginStorage(localStorage,sessionStorage);
export const SUPABASE_URL = 'https://vjtzragdciexixjzeann.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_t83rmhnupa9UqFUnjME0SQ_8F2wyMN0';
export const authClient = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: loginStorage.storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(20000) }) }
});

export async function getTeamMember() {
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return { member: null, error, reason: error && (!error.status || error.status >= 500) ? 'network' : 'session' };
  const result = await authClient.from('team_members').select('user_id,display_name,role,active,team_id,is_super_admin,teams(active,grants_global_access)').eq('user_id', user.id).eq('active', true).maybeSingle();
  if(result.data?.teams?.active && result.data.teams.grants_global_access){result.data.is_super_admin=true;result.data.role='admin';}
  return { member: result.data, error: result.error, reason: result.error ? 'network' : 'membership' };
}

export async function signInWithUsername(username, password, keepConnected = false) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gro-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (!response.ok) return { error: { code: data.code, status: response.status } };
  loginStorage.setPersistent(keepConnected);
  return authClient.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
}
