# Administração de usuários e equipes

`admin.html` permite criar e editar usuários (nome, login, contato, perfil, equipe e acesso ativo) e equipes. Senha é definida apenas na criação, nunca devolvida pela API. A edição não altera senha.

- `gui.cardoso` é administrador geral. Esse privilégio não pode ser atribuído pela tela ou pelos dados enviados ao endpoint.
- Administradores de equipe gerenciam apenas sua equipe; colaboradores não administram usuários.
- Usuários pertencem a uma equipe. Clientes pertencem a uma equipe imutável; levantamentos e relatórios seguem a equipe do cliente.
- Administrador geral escolhe a equipe ao criar um cliente. Outros usuários usam sua própria equipe.
- Desativação preserva o histórico e bloqueia as consultas imediatamente por RLS. Login também verifica equipe ativa.
- Transferência de usuário exige concluir seus rascunhos; clientes e relatórios antigos permanecem na equipe original.
- Criação de usuários usa `gro-admin`, valida JWT via `auth.getUser` e confirma perfil atual no banco. A chave privilegiada só existe no servidor. O RPC `manage_gro_admin` é SECURITY INVOKER, acessível somente a service_role, e revalida/ bloqueia o registro do administrador antes da alteração.
- O endereço interno de Auth é aleatório; o usuário entra pelo login escolhido. E-mail de contato é opcional e não recebe mensagens automáticas.

## Verificação

`test-team-isolation.sql` executa fixtures com rollback: isolamento de leitura e escrita, autopromoção, acesso global, bloqueio de equipe inativa e escopo administrativo. Testes de endpoint em `tests/admin-endpoint.test.mjs` validam autenticação, escopo, proteção da senha e compensação de falha na criação. Salvamento da conta existente, sem alterar seus dados, conferido pela interface real.

Backend aplicado em 28/09/2026. Frontend publicado no Pages junto com a tela Minha equipe.

Aviso pré-existente do Supabase: proteção contra senhas vazadas desativada. Veja https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Tabelas privadas login_attempts/report_revision_counters têm RLS sem políticas de acesso público intencionalmente.
