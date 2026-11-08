# Integração Google Agenda — fase de importação segura

**Status:** interface de autorização, mapeamento e importação implementada e versionada; a conexão ainda depende de criar e configurar um OAuth Client ID no Google Cloud e de autorizar a conta Google que enxerga as agendas da clínica. A integração NÃO está ativa sem essas ações.

## O que a versão inicial faz

1. Um usuário previamente autorizado entra no sistema Clínica AnaCris.
2. Um administrador informa um **Google OAuth Client ID do tipo Web application** em `Google Agenda` — somente o Client ID público é gravado no Supabase, nunca um client secret.
3. A pessoa clica em **Conectar Google**, escolhe a conta e concede autorização de **leitura** para o calendário.
4. O sistema lê as agendas que essa conta consegue consultar, inclusive agendas compartilhadas.
5. O administrador associa cada agenda ao profissional certo e, opcionalmente, ao serviço. A associação fica no Supabase para outros usuários autorizados.
6. Em **Ver eventos**, um usuário escolhe período de até 92 dias, confere os nomes e horários, marca os eventos desejados e pode escolher o paciente cadastrado.
7. Ao confirmar **Importar eventos selecionados**, os agendamentos são gravados como `agendado`, com o ID da agenda e o ID do evento Google. Ninguém é marcado como atendido por causa do Google. O banco impede duplicação do mesmo evento.
8. Sessões importadas podem ser editadas e confirmadas **no sistema**. Somente quando estão vinculadas a um contrato do tipo `por_sessao` e são marcadas como `realizado` o banco emite a cobrança correspondente.

A aplicação **não altera**, cancela ou cria eventos no Google. A primeira versão é **leitura e importação sob demanda**, não uma sincronização contínua nem bidirecional. Eventos alterados/cancelados depois da importação precisam ser conferidos; a versão atual não os atualiza automaticamente.

## Como configurar no Google Cloud

1. Entre em [Google Cloud Console](https://console.cloud.google.com/). Crie ou escolha um projeto Google Cloud separado para a clínica.
2. Em **APIs e serviços → Biblioteca**, ative a **Google Calendar API**.
3. Em **Google Auth Platform → Branding / Audience / Data Access**, configure o consentimento OAuth; se o aplicativo estiver em modo de teste e for **Externo**, adicione as contas Google que vão autorizar a agenda como *test users*. Configurações e verificações de aplicativos que solicitam escopos sensíveis podem exigir etapas extras conforme a política do Google.
4. Em **Google Auth Platform → Clients → Create client**, escolha **Web application**.
5. Adicione em **Authorized JavaScript origins** a origem `https://https-maria.github.io`. Para testar localmente, acrescente `http://localhost:5173`. **Não** inclua `/Clinica` no campo de origem.
6. Copie apenas o **Client ID** com final `.apps.googleusercontent.com`. **Não compartilhe client secret** nem token de acesso.
7. Abra a interface da clínica, faça login de administrador, entre no menu **Google Agenda** e cole o Client ID em **Configuração inicial do Google**.
8. Clique em **Conectar Google** e selecione a conta que tem acesso às agendas mostradas anteriormente. Se uma agenda estiver faltando, o proprietário deve compartilhá-la com essa conta no próprio Google Calendar.
9. Vincule cada agenda ao profissional/serviço e teste com um evento não sensível primeiro.

Guia oficial: [Google Calendar JavaScript Quickstart](https://developers.google.com/workspace/calendar/api/quickstart/js), [Google Identity Services — Token Model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

## Privacidade e segurança

- Escopo OAuth: somente `https://www.googleapis.com/auth/calendar.readonly`.
- Token do Google mantido apenas em memória durante a sessão da página, sem armazenamento em Supabase ou GitHub.
- Só usuários autenticados e autorizados pela clínica podem acessar o módulo e suas tabelas.
- Associação calendário → profissional exige `admin`.
- Importação de eventos depende de ação explícita de usuário autorizado.
- Títulos dos eventos podem conter nomes de pacientes, portanto os registros importados são dados pessoais; não exponha em planilhas, imagens ou código públicos.
- Eventos de dia inteiro são ignorados pela primeira versão.
- Se o token expirar, clique em **Conectar Google** novamente.

## Próximas melhorias previstas

- Conferência de alterações/cancelamentos após primeira importação.
- Sinalização de divergências entre calendário externo e presença registrada, sem sobrescrever histórico clínico/financeiro.
- Fluxo de sincronização periódica segura **somente** se a clínica aprovar o modelo, a proteção de credenciais e a infraestrutura.
