# Clínica AnaCris — Gestão administrativa

MVP básico, modular e confiável para administração clínica. **Status: estrutura inicial / não liberado para dados reais antes da validação.**

## Escopo da primeira versão

- Login por e-mail/senha via Supabase Auth (usuários criados pelo administrador)
- Cadastro e edição de pacientes e profissionais
- Inativação e reativação, preservando histórico (sem exclusão física)
- Busca por nome e exportação CSV compatível com Excel
- Painel simples com quantidades cadastradas
- Layout responsivo

**Ainda não implementados:** Google Agenda, atendimento, presença, contratos, contas, repasses e relatórios semanais. Documentados em `docs/`.

## Arquitetura

- Frontend: Vite + JavaScript + CSS, hospedado no GitHub Pages.
- Backend: Supabase PostgreSQL + Auth + Row Level Security.
- Banco como fonte oficial dos registros; a agenda do Google será integração futura.
- O código no Pages é público para os visitantes, mas nenhuma tabela deve aceitar acesso público.

## Executar localmente

1. `npm install`
2. Copie `.env.example` para `.env` (o arquivo `.env` não deve ser enviado ao Git).
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores do projeto Supabase **clinica-anacris**.
4. Execute `npm run dev`.
5. Abra o endereço exibido pelo Vite.

**Nunca colocar service_role, secret key, senhas, planilhas reais ou tokens OAuth em `.env` do frontend/repositório.** A chave `publishable` é pública, portanto a segurança depende das políticas RLS.

## Banco de dados — aplicado em 08/11/2026

As tabelas `clinic_members`, `patients` e `professionals`, índices e suas políticas RLS foram criadas no projeto `clinica-anacris` (`iuchcggvcbtakeeyujwb`). **Não execute novamente o SQL da migração no mesmo projeto.**

O primeiro usuário autorizado ainda precisa ser provisionado:

1. Supabase > Authentication > Users: crie o primeiro usuário (não habilitar cadastro público).
2. Copie o UUID do usuário criado e execute no SQL Editor:
   `insert into public.clinic_members(user_id, role) values ('UUID_DO_USUARIO', 'admin');`
3. Verifique com um usuário autorizado e outro não autorizado que só o primeiro acessa os registros.
4. Confirme políticas RLS, backup e recuperação antes de inserir pacientes reais.

## Publicar no GitHub Pages

O fluxo inicial usa `npm install` no GitHub Actions; antes da primeira versão de produção, gerar e versionar `package-lock.json` e voltar ao `npm ci`. A compilação não pôde ser validada neste ambiente por indisponibilidade de acesso ao registro npm.

1. Crie um repositório chamado `clinica-anacris` no GitHub (preferencialmente privado enquanto desenvolve).
2. Envie os arquivos deste projeto para a branch `main`.
3. GitHub > Settings > Pages > Source: **GitHub Actions**.
4. GitHub > Settings > Secrets and variables > Actions > Variables: adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Em Actions, confira o workflow `Publicar GitHub Pages`.
6. Em Supabase > Authentication > URL Configuration, configure a URL de publicação autorizada.

**Atenção:** GitHub Pages tem restrições por plano/visibilidade; confira se Pages está disponível para o tipo do seu repositório. Não publique planilhas com dados de pacientes.

## Documentos

- [`docs/01-requisitos.md`](docs/01-requisitos.md) — requisitos e recorte do MVP
- [`docs/02-regras-de-negocio.md`](docs/02-regras-de-negocio.md) — regras operacionais e financeiras
- [`docs/03-modelo-de-dados.md`](docs/03-modelo-de-dados.md) — entidades e próximos módulos
- [`docs/04-implantacao-e-testes.md`](docs/04-implantacao-e-testes.md) — validações e aceite
- [`docs/05-fontes-e-importacao.md`](docs/05-fontes-e-importacao.md) — mapeamento dos controles existentes

## Privacidade

Dados clínicos e de identificação são sensíveis. Restringir usuários, não publicar planilhas reais no Git, aplicar minimização e auditar acessos. Esta versão não é prontuário eletrônico.