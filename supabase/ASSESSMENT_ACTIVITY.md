# Histórico de alterações dos levantamentos

A migração `assessment_activity_history` é aditiva. Os triggers registram criação,
mudanças efetivas, conclusão e novas retificações. Autor, nome e horário são
derivados no servidor. A tabela guarda apenas os nomes dos campos/seções
alterados, nunca os valores das respostas, fotos ou documentos completos.
Não há reconstrução retroativa de eventos. O histórico detalhado de retificações
existente continua disponível no relatório, com suas diferenças e motivos.

O RPC `read_assessment_activity` usa `SECURITY INVOKER`, paginação por ID e até
50 eventos por chamada. A política da tabela privada exige sessão ativa e a
visibilidade atual do levantamento pelas políticas já existentes. Transferência
do cliente, revogação, equipe inativa e sessão inválida são respeitadas.

Não há permissão de inserção, atualização ou exclusão para clientes da aplicação.
Funções de trigger privadas, com `search_path` vazio e execução revogada,
gravam os eventos. Triggers adicionais impedem reescrita, exclusão e truncamento.
As políticas e os guards originais dos levantamentos não são substituídos.

A tabela não tem FK para o levantamento: excluir um rascunho autorizado continua
possível, mas não apaga o histórico. Sem o registro principal, esses eventos não
são mais consultáveis pelo aplicativo. Uma política futura de retenção precisa
considerar esses eventos; o recurso não introduz expurgo automático.

Testes usam PostgreSQL isolado com dados sintéticos e verificam RLS, transferências,
sessão revogada, imutabilidade, paginação, autoria, ausência de valores e no-op.
A tela só consulta ao abrir o painel e trata falha de consulta sem bloquear a edição.
