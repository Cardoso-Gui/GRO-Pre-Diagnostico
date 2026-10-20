# Identidade profissional e responsável pela visita

## Estado e escopo

Backend ativado em 20/10/2026 após autorização específica, revisão independente e CI aprovado. Nenhuma função profissional ou registro foi atribuído a usuários reais; nenhum levantamento real foi modificado para testar a mudança.
A migração foi criada com `supabase migration new professional_identity` (CLI 2.121.0) e aplicada uma única vez. O nome `20261020100630_professional_identity.sql` foi alinhado à versão efetivamente registrada pelo Supabase, sem alterar seu conteúdo nem reaplicar o SQL. SHA-256: `1db678b54d7c8fd95b7c77f45e3dd5d13f3f50f51269651a82a8d79063e3245c`.

`gro-admin` foi publicada como versão 6, preservando `verify_jwt=false`, sua autenticação explícita existente e a lista de origens. A leitura posterior confirmou o código exato revisado. A publicação estática está coordenada pela PR #50.

A ativação da migração e a publicação da Edge Function dependem de autorização específica. Publicar apenas os arquivos estáticos antes da migração não basta: o cliente passa a consultar os novos campos. Não aplicar scripts de fixtures em um projeto conectado.

## Modelo

- `team_members.role`, `is_super_admin`, `teams.grants_global_access` e todas as políticas RLS existentes conservam exatamente suas funções de autorização.
- Novos campos opcionais, inicialmente nulos: `professional_role`, `professional_registration` e `professional_registration_uf`.
- Valores de função: `safety_technician`, `safety_engineer`, `safety_assistant`; nulo significa não informado. Não há classificação automática de usuários existentes.
- Número de registro: texto aparado com até 80 caracteres, sem caracteres de controle. UF: uma das 27 siglas brasileiras, maiúscula, ou nula.
- Perfis incompletos podem continuar preenchendo rascunhos. Não se afirma que um cadastro foi verificado nos órgãos profissionais: estes campos são declarados pelo administrador, e o sistema não consulta MTE/CREA nem verifica habilitação ou situação perante o conselho.
- `assessments.responsible_id` permanece o operador/proprietário que determina as permissões. O novo `visit_responsible_id` é uma FK opcional independente, com exclusão restrita para preservar referências. Preferir desativação de contas, conforme o fluxo já existente.

## Regras impostas no banco

A interface não é a barreira de segurança. O trigger valida novamente:

1. Operador atual ativo e autorização existente para o levantamento/cliente, sem usar a função profissional como permissão.
2. Profissional selecionado ativo, em equipe ativa, técnico ou engenheiro, com registro preenchido; engenheiro também precisa de UF.
3. Um operador comum só seleciona profissionais da própria equipe, que também precisa ser a equipe atual do cliente. Um operador global pode selecionar da equipe do cliente ou de uma equipe ativa `grants_global_access`. Não é permitida escolha de uma terceira equipe apenas por haver acesso global.
4. Uma nova escolha de responsável no rascunho já precisa ser elegível. Um responsável anteriormente selecionado que perdeu elegibilidade pode permanecer em um rascunho enquanto o preenchimento é salvo; toda conclusão exige revalidação, e substituí-lo exige uma escolha elegível. Remover a escolha e salvar um rascunho é permitido.
5. O auxiliar, inclusive com perfil Administrador, nunca se torna responsável técnico apenas por sua permissão administrativa. Pode operar/concluir o formulário em nome de um técnico/engenheiro elegível selecionado, conforme a autorização de escrita existente.

O helper privado `assessment_professional_snapshot` usa `SECURITY DEFINER` somente para bloquear registros sem conceder UPDATE no diretório. Ele verifica identidade/escopo explicitamente, tem `search_path=''` e não é acessível a `PUBLIC`, `anon` ou `service_role`. Membros (incluindo ator e profissional), cliente e equipes relevantes ficam bloqueados com `FOR SHARE` até o commit. O trigger permanece `SECURITY INVOKER` e a escrita continua sujeita à RLS existente. Não se altera a política de validade/revogação de sessões já usada pelos levantamentos.

## Snapshot e legado

Toda nova conclusão cria no servidor `final_snapshot.responsible_professional`:

```
{
  "user_id": "UUID do profissional",
  "display_name": "Nome no momento da conclusão",
  "professional_role": "safety_technician ou safety_engineer",
  "registration_type": "MTE ou CREA",
  "registration_number": "Número informado",
  "registration_uf": "UF para engenheiro; null para técnico"
}
```

O tipo de registro é derivado da função, nunca aceito do navegador. Nome, profissão, número e UF são congelados. Mudança de nome, transferência, alteração do registro ou desativação posterior não reescreve o relatório concluído.

`read_assessment_report` usa o nome desse objeto quando ele existe. Para relatórios legados sem o objeto, mantém somente o fallback de nome anterior; nunca inventa registro usando os dados atuais do cadastro. A migração não atualiza snapshots nem relatórios históricos. A allowlist de retificação não foi ampliada e não aceita alterações de identidade, operador ou responsável técnico.

## Compatibilidade da administração

A Edge Function `gro-admin` valida tipos, função, tamanho/conteúdo de registro e UF antes de criar a conta Auth. O SQL também impõe tipos e constraints independentemente do cliente.

No `manage_gro_admin`, campos profissionais omitidos em `update_user` conservam os valores atuais, permitindo clientes antigos. Nulo ou string em branco limpa apenas o campo explicitamente enviado. Na criação, campos omitidos permanecem nulos. Nenhuma função profissional concede `admin` ou `is_super_admin`. A ACL preexistente do RPC continua restrita a `service_role`.

## Pré-verificação somente leitura

Metadados de catálogo foram verificados em 20/10/2026. Não foram lidos nem alterados dados pessoais para esta verificação:

- `assessments`: `authenticated` já possui INSERT, SELECT, UPDATE e DELETE no nível da tabela; todas as ACLs de coluna são nulas. A nova coluna herda esse acesso, sempre filtrado pela RLS. Não é necessário acrescentar GRANT.
- `team_members`: `authenticated` possui apenas SELECT; `service_role` conserva a administração.
- `manage_gro_admin(uuid,text,jsonb)`: EXECUTE apenas para proprietário e `service_role`; `SECURITY INVOKER`.
- `private.guard_assessment()`: EXECUTE apenas para proprietário; `SECURITY INVOKER`.
- Nenhuma ACL de tabela/coluna nem política existente é modificada nesta migração. Os testes comparam antes/depois.

Antes da ativação, repetir a verificação de catálogo e confirmar que as definições atuais correspondem às bases `user-contact-phone.sql`, `transferred-draft-responsible.sql` e à migração de retificação já revisada. Se existirem mudanças posteriores, reconciliar antes de aplicar. Em outro ambiente com grants somente por coluna, parar e revisar a permissão mínima para os novos campos em vez de conceder acesso geral silenciosamente.

## Ordem de ativação, somente após autorização

1. Revisar e aprovar a migração e a atualização de `gro-admin`. A migração adiciona um helper privilegiado privado e uma nova regra de conclusão, portanto a autorização de publicar a interface não substitui esta autorização.
2. Executar `npm ci`, `npm test` e `npm run test:concurrency` em ambiente isolado. O workflow `.github/workflows/rectification-security.yml` executa ambas as suítes reais de concorrência e não tem credenciais de produção.
3. Registrar definições e ACLs atuais; verificar pendências/migrações instaladas. Aplicar apenas a migração de identidade profissional, sem reaplicar manualmente os scripts históricos.
4. Publicar `gro-admin` revisada; confirmar campos omitidos e leitura das novas colunas. Não atribuir profissão ou registro a uma pessoa sem instrução/dado fornecido pelo usuário.
5. Publicar os arquivos estáticos coordenados. Administradores cadastram os dados profissionais conhecidos; o bloqueio de conclusão sem responsável informado é intencional.
6. Conferir em uma base de homologação com dados sintéticos: auxiliar salva rascunho, auxiliar não é selecionável, técnico/engenheiro elegível conclui, relatório mantém nome/registro após alterar o cadastro, relatório legado não recebe registro retroativo.
7. Conferir advisors de segurança/performance do Supabase e os grants/RLS após a ativação. As verificações após ativação devem ser comparadas à linha de base, sem corrigir configurações não relacionadas silenciosamente.

## Testes e limitação local

- `tests/professional-database.test.mjs`: PostgreSQL embutido PGlite, somente dados sintéticos, cobrindo cadastro, ACL/RLS, elegibilidade, ausência de dados, inatividade, escopo, falsificação do payload, rascunhos obsoletos, snapshots, legado e retificação.
- `tests/admin-endpoint.test.mjs`: validação independente de payload, não promoção, campos omitidos e limpeza explícita, sem contas externas.
- `supabase/tests/professional-identity-concurrency.mjs`: PostgreSQL real multissessão em diretório temporário e socket Unix local. Cobre congelamento durante edição concorrente e revalidação após desativar membro, retirar registro/UF, alterar profissional para auxiliar, transferir profissional/cliente, desativar equipe e revogar permissão administrativa/acesso global. Não aceita URL de banco e não estabelece conexão externa.

A execução local multissessão neste executor foi bloqueada pela criação de socket Unix; a tentativa de execução elevada falhou na preparação do sandbox, antes de executar o teste. Nenhuma asserção de concorrência passou localmente. O runner está integrado em `npm run test:concurrency` e no CI. A execução GitHub Actions `39356933801` confirmou os 317 testes e os 11 cenários profissionais reais, além da concorrência da retificação, no código aprovado; exigir resultado verde no head final antes da publicação.

## Reversão

Após uso, não apagar colunas, o helper ou snapshots para “voltar” o sistema: isso perderia a identidade e enfraqueceria a regra de responsabilidade. Não existe downmigration destrutiva.

Estratégia operacional fail-closed, a aplicar apenas com autorização de alteração do backend:

1. Interromper a publicação. Se for necessário reverter a interface enquanto a falha é corrigida, preparar uma pequena migração revisada que substitua somente `private.guard_assessment()` e acrescente no início do corpo: `if NEW.status='completed' then raise exception 'Conclusões temporariamente suspensas. Salve o rascunho.' using errcode='23514'; end if;`. Manter o restante do guard atual, seu SECURITY INVOKER e ACL. Isso bloqueia também tentativas por chamadas diretas, sem depender da interface.
2. Confirmar em dados sintéticos que leitura de relatórios e INSERT/UPDATE de rascunhos ainda funcionam, enquanto toda transição para concluído é rejeitada. Depois, se necessário, usar a interface anterior apenas para leitura e rascunhos. Não restaurar o antigo guard que permitia concluir sem identidade profissional.
3. Preservar todas as colunas, seleções, snapshots e trilhas de retificação. Corrigir a implementação, executar os testes completos/concorrência e, com autorização, restaurar exatamente o guard revisado de identidade profissional antes de reabilitar a conclusão na interface.

Sem uma suspensão aprovada do backend, não afirmar que remover um botão interrompe conclusões: clientes já abertos podem continuar enviando requisições. Esta estratégia é uma instrução de recuperação, não foi aplicada neste trabalho.
