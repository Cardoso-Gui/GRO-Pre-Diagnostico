export function normalizeUsername(value) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return null;
  return username;
}

export function friendlyAuthError(error, online = true) {
  if (error?.code === 'invalid_credentials') return 'Usuário ou senha incorretos. Confira os dados e tente novamente.';
  if (error?.code === 'email_not_confirmed') return 'Sua conta ainda não está liberada. Fale com o administrador.';
  if (error?.status === 429 || error?.code?.includes('rate_limit')) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  if (['AbortError', 'TimeoutError', 'AuthRetryableFetchError'].includes(error?.name) || !online) return 'Não foi possível conectar. Confira sua internet e tente novamente.';
  return 'Não foi possível concluir agora. Tente novamente em instantes.';
}

