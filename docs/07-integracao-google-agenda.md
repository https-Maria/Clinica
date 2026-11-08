# Google Agenda — agendar, remarcar, desmarcar e importar

## Situação

**Código implementado:** o módulo pode listar calendários, mapear agendas, importar eventos selecionados, **criar compromissos no Google, remarcar e desmarcar eventos**. Os botões de edição só aparecem para calendários com `accessRole=writer` ou `owner` da conta Google conectada.

**Conexão real ainda não ativada:** a clínica precisa criar um Google OAuth Client ID de aplicativo web e autorizar a conta com acesso às agendas. Os comandos de gravação ainda não foram testados com uma conta Google da clínica; não os considere homologados para agendamentos reais.

## Como configurar

1. Abra [Google Cloud](https://console.cloud.google.com/), selecione um projeto próprio para a clínica e ative **Google Calendar API**.
2. Configure a **Google Auth Platform**: tela de consentimento, público, dados de contato e usuários de teste, se necessário.
3. Em **Clients**, crie um aplicativo OAuth do tipo **Web application**.
4. Em *Authorized JavaScript origins*, registre `https://https-maria.github.io` (sem a barra ou caminho `/Clinica`). Para desenvolvimento local: `http://localhost:5173`.
5. Copie o **Client ID** (termina em `.apps.googleusercontent.com`). Não coloque client secret no repositório.
6. Acesse `Clinica → Google Agenda` com o login de administradora e salve o ID.
7. Clique em **Conectar Google** e autorize os escopos exibidos, utilizando a conta Google que recebeu compartilhamento das agendas.
8. Mapeie cada calendário para seu profissional e, opcionalmente, serviço.
9. Faça primeiro um teste com um compromisso fictício em uma agenda de teste.

A autorização usa `calendar.readonly` para listar os calendários e `calendar.events` para ver e modificar eventos, com o Google Identity Services (modelo de token). O token é mantido apenas em memória da página; expira e precisa de nova autorização. O Google pode exigir revisão/verificação do aplicativo, conforme as configurações de consentimento e escopos utilizados.

Referências oficiais: [OAuth escopos Google Calendar](https://developers.google.com/workspace/calendar/api/auth), [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [API Events](https://developers.google.com/workspace/calendar/api/v3/reference).

## Uso na interface

- **Ver eventos**: exibe compromissos de um período selecionado. Permite selecionar quais eventos importar para a agenda interna.
- **+ Agendar no Google**: informe nome, início, fim e, opcionalmente, paciente cadastrado. A operação cria um evento no Google e tenta registrá-lo no Supabase como `agendado`.
- **Remarcar**: abre título, início e fim do evento já existente e grava a mudança no Google. Se o evento estava vinculado a um agendamento ainda pendente no sistema, tenta atualizar também a data e horário locais.
- **Desmarcar**: exige confirmação e exclui o evento do Google. Se havia um agendamento local pendente, marca-o como `cancelado` sem apagar o registro.
- **Eventos recorrentes**: edição e desmarcação de instâncias recorrentes não estão disponíveis nessa versão, para evitar alteração inesperada de séries.

Para editar o Google Calendar, a conta deve ter permissão **writer** ou **owner** naquela agenda. A integração **não** autoriza automaticamente usuários a escrever no Google: eles precisam entrar no Google, dar consentimento e ter os acessos compartilhados pelo proprietário.

## Segurança e limite financeiro

O sistema consulta o vínculo antes de permitir remarcar ou desmarcar. Eventos associados a consultas já realizadas, inativas ou com cobrança vinculada ficam bloqueados para edição pelo Google. Para corrigir casos assim, é necessário revisar primeiro o histórico interno.

A ação de criar/remarcar/desmarcar no Google é iniciada explicitamente por um usuário. **Ainda não existe sincronização bidirecional contínua.** Alterações feitas fora do sistema, diretamente no Google Calendar, não são automaticamente refletidas no Supabase.

Como Google e Supabase são serviços distintos, pode ocorrer um sucesso no Google e uma falha no registro local. Nessa situação o sistema avisa para conferir o calendário e conciliar os dados antes de repetir a operação. Não há garantia de transação distribuída entre os dois.

## Uso com pacientes

Os títulos dos eventos podem conter nomes de pacientes, portanto são dados pessoais; acesso e compartilhamento devem ser restritos. A seleção de paciente no formulário é opcional. Confirme sempre a identidade de um paciente antes de associá-lo a um evento com nome abreviado.

**A presença é confirmada separadamente no sistema.** Agendar no Google não confirma atendimento, não recebe dinheiro e não gera faturamento sozinho. A cobrança por sessão continua vinculada ao atendimento marcado como realizado no módulo interno e ao contrato correspondente.
