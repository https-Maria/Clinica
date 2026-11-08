# Clínica AnaCris — Gestão administrativa

Projeto simples de gestão administrativa e financeira para clínica, em desenvolvimento.

**Status:** código de módulos enviado; banco criado; publicação, primeiro usuário e testes de ponta a ponta pendentes. **Não inserir dados reais de pacientes ainda.**

## Acessos

- [Repositório GitHub](https://github.com/https-Maria/Clinica)
- [Projeto Supabase](https://supabase.com/dashboard/project/iuchcggvcbtakeeyujwb)
- [Endereço previsto do GitHub Pages](https://https-maria.github.io/Clinica/) — dependente do deploy bem-sucedido.

## Tecnologia

- Vite + JavaScript + CSS (sem framework pesado)
- PostgreSQL / Supabase Auth / RLS
- GitHub Actions para compilar e publicar no GitHub Pages
- Módulos separados em `src/main.js`, `src/modules.js` e `src/finance.js`

## Recursos implementados no código

| Área | Funções disponíveis | Limite atual |
|---|---|---|
| Login | E-mail e senha pelo Supabase Auth; só usuário autorizado | Não há usuários cadastrados |
| Pacientes | Criar, consultar, buscar, editar, inativar/reativar, CSV | Teste real pendente |
| Profissionais | CRUD lógico, especialidade, conselho, chave PIX, percentual | Teste real pendente |
| Serviços | Cadastro e exportação CSV | Teste real pendente |
| Contratos | Modalidade de cobrança, vigência, valor, paciente, profissional, exceção no repasse | Não gera cobranças sozinho |
| Agenda interna | Agendamentos, presença, falta, cancelamento | Sem sincronização automática com Google |
| Contas a receber | Criar cobrança, vencimento e situação calculada | Não gera parcelas automaticamente |
| Recebimentos | Pagamentos parciais; trava de excesso no banco | Estorno ainda não implementado |
| Despesas | Cadastrar valores fixos/variáveis, vencimento e pagamento | Recorrência registrada, sem geração automática |
| Repasses | Lançamento manual pendente/pago; histórico protegido | **Não** é liquidação automática |
| Relatórios | Pacientes ativos, altas, atendimentos semanais, CSV, impressão/PDF e estimativa de participação | Sem XLSX nativo e sem relatório semanal completo |

**Importante:** o percentual padrão é 60% clínica / 40% profissional, com exceção por contrato ou profissional. A estimativa não deve ser interpretada como valor aprovado para repasse.

## Primeiro login (ainda pendente)

1. No [Supabase → Authentication → Users](https://supabase.com/dashboard/project/iuchcggvcbtakeeyujwb/auth/users), crie/invite um usuário com **e-mail real** e defina a senha de forma privada, no próprio Supabase. Não poste sua senha em chats nem a inclua no Git.
2. Copie o UUID desse usuário. No Supabase SQL Editor execute:
   ```sql
   insert into public.clinic_members (user_id, role, active)
   values ('UUID_DO_USUARIO', 'admin', true)
   on conflict (user_id) do update set role='admin',active=true;
   ```
3. Faça login no sistema e confirme que um usuário **não autorizado** continua sem acesso aos registros.
4. Configure a URL de redirecionamento do Auth de acordo com o endereço publicado.

Não temos ação segura de criação de usuários Supabase Auth disponível na conexão atual; o usuário inicial precisa ser criado pelo Dashboard.

## GitHub Pages

1. Vá a [Settings → Pages](https://github.com/https-Maria/Clinica/settings/pages).
2. Selecione **Build and deployment → Source: GitHub Actions**.
3. Confira a execução em [Actions](https://github.com/https-Maria/Clinica/actions). O workflow executa checagem de sintaxe, testes de cálculo e build.
4. A base do Vite está configurada como `/Clinica/`.
5. Se o navegador continuar em branco, abra DevTools → Console/Network e verifique o erro da execução do workflow.

## Execução local

```bash
npm install
npm run check
npm test
npm run dev
```

Crie `.env` com os valores de `.env.example`. **Somente a publishable key** pode ficar no frontend — nunca coloque `service_role`, secret key, senha ou token OAuth no código.

## Segurança e dados

As 10 tabelas estão com RLS; o Supabase não apontou alertas de segurança na última verificação. Isso não substitui testes com contas reais, monitoramento e plano de backup/restauração. Recebimentos ficam imutáveis; a rotina segura de estorno ainda precisa ser implementada antes do uso financeiro real.

Os arquivos das planilhas originais não devem ser publicados no repositório público.

## Documentos

- [Requisitos](docs/01-requisitos.md)
- [Regras de negócio](docs/02-regras-de-negocio.md)
- [Modelo de dados](docs/03-modelo-de-dados.md)
- [Implantação e testes](docs/04-implantacao-e-testes.md)
- [Fontes e importação](docs/05-fontes-e-importacao.md)

## Próximos passos

Validar deploy, login e CRUD; implementar estornos auditados e testes end-to-end; conectar Google Agenda via autorização adequada; automatizar contas recorrentes; criar exportações XLSX/PDF aprimoradas e relatórios completos.

## Atualização de 08/11/2026 — novos controles

Foram acrescentados ao código e ao banco: máscaras e tipo de PIX, ficha de serviços expandida, lixeira administrativa de pacientes, vigência personalizada, classificação de despesas, lembretes privados, resumo de vencimentos, auditoria de alterações e entradas no aplicativo. A sessão realizada vinculada a um contrato por sessão passa a gerar a cobrança automaticamente, uma única vez.

A integração com **Google Agenda** ainda exige OAuth/autorização dos calendários. Os testes no banco passaram, mas a publicação do site e os fluxos de ponta a ponta ainda devem ser confirmados.

[Detalhamento das melhorias, pendências e diferenças entre serviços e contratos](docs/06-melhorias.md).

## Google Agenda (integração preparada)

Foi adicionado o módulo **Google Agenda** com fluxo OAuth de leitura, mapeamento de calendários por profissional e importação de eventos selecionados. A configuração do Client ID e a autorização da conta Google são obrigatórias antes de usar. **Ainda não é uma sincronização automática ou bidirecional.**

[Passo a passo do OAuth no Google Cloud e funcionamento da integração](docs/07-integracao-google-agenda.md).
