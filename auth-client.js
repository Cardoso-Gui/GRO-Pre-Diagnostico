// This publishable key is intended for browsers. Data access is enforced by RLS.
export const SUPABASE_URL = 'https://vjtzragdciexixjzeann.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_t83rmhnupa9UqFUnjME0SQ_8F2wyMN0';
export const authClient = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(20000) }) }
});

export async function getTeamMember() {
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return { member: null, error, reason: error && (!error.status || error.status >= 500) ? 'network' : 'session' };
  const result = await authClient.from('team_members').select('user_id,display_name,role,active').eq('user_id', user.id).eq('active', true).maybeSingle();
  return { member: result.data, error: result.error, reason: result.error ? 'network' : 'membership' };
}

export async function signInWithUsername(username, password) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gro-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (!response.ok) return { error: { code: data.code, status: response.status } };
  return authClient.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
}
