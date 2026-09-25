# GRO · Pré-diagnóstico

Site estático compatível com GitHub Pages. `index.html` oferece login com usuário e senha; `levantamento.html` verifica a sessão e a participação ativa na equipe antes de carregar o formulário existente.

## Autenticação

- Supabase JS 2.117.2 está incluído em `vendor/`, com licença; não há dependência de CDN em execução.
- Apenas a chave publicável está no cliente. Nunca incluir senha, chave secreta ou `service_role` no repositório.
- O usuário é normalizado para minúsculas e convertido em um identificador interno `usuario@users.gro.invalid`. Esse endereço não recebe e-mails.
- Criar contas pelo Admin API/painel do Supabase com esse identificador, senha definida pelo administrador e confirmação automática. Vincular o UUID em `public.team_members`, com `username`, `display_name`, `role` e `active=true`. Não criar contas por cadastro público.
- A senha não é comparada ou armazenada pelo código do site. O Supabase Auth valida a credencial; RLS protege os dados independentemente da interface.
- A sessão fica no armazenamento da aba. Sair limpa a sessão local; voltar à aba revalida o acesso.
- Recuperação de senha é administrada fora desta tela. O administrador redefine a credencial pelo Supabase Admin API; não usar recuperação por e-mail para os identificadores internos.

## Limite desta etapa

A tela de login está ligada ao projeto Supabase. O formulário antigo é preservado e continua com rascunhos locais, agora separados por usuário. Salvamento dos levantamentos no banco, cadastro de clientes e painel de administração serão etapas posteriores. Nenhuma regra técnica das tabelas antigas foi revalidada nesta mudança.

## Publicação

Publicar a raiz da branch no GitHub Pages. Todos os caminhos são relativos e funcionam em `/GRO-Pre-Diagnostico/`. Esta mudança deve ser revisada antes de substituir o site atual.

## Testes

Executar `npm test` com Node.js 22 ou superior. Os testes simulam respostas de autenticação; não criam contas nem enviam e-mails. A entrada bem-sucedida com conta real requer uma conta Auth vinculada a um membro ativo.
