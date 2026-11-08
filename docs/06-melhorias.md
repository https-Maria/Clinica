# Aperfeiçoamentos solicitados — 08/11/2026

## Conceitos essenciais

**Serviço:** cadastro do que a clínica oferece: fisioterapia, Pilates, laserterapia, atendimento domiciliar etc. Tem nome, descrição, área, duração, modalidade e preço orientativo. Ele **não** determina sozinho quanto cobrar de cada paciente.

**Contrato:** acordo do paciente com um profissional, eventualmente para um serviço específico. Define preço efetivo, cobrança mensal/por sessão/pacote, vigência, datas, vencimento e exceção de percentual de repasse.

## Implementado no banco + código da interface

- Tipo de chave PIX de profissional: CPF, CNPJ, celular, e-mail ou chave aleatória.
- Máscaras para telefone e PIX no frontend; dados normalizados para salvar. Máscaras não validam dígitos verificadores de CPF/CNPJ.
- Lixeira de pacientes exclusiva ao administrador; exclui logicamente e permite restaurar, sem apagar histórico. Para funcionários, registros excluídos não ficam consultáveis.
- Serviços com especialidade, descrição, duração, modalidade, preço orientativo e observações.
- Vigência personalizada exige data inicial e final; a data final aparece quando a vigência é personalizada.
- Despesas com classificação fixa, variável ou sazonal, além do detalhamento (aluguel, energia, manutenção etc.).
- Meus lembretes: título, nota pessoal, prazo, prioridade, concluído/reaberto e arquivamento. Privados por proprietário com RLS.
- Painel com alertas de vencimentos e lembretes.
- Log de alterações (tabelas e campos alterados) para administradores.
- Entradas no aplicativo registradas ao receber o evento SIGNED_IN do Supabase Auth. Esses eventos registrados pelo navegador são **informativos**, não substituem os logs oficiais do Auth.
- **Cobrança por presença:** confirmar como realizada uma sessão vinculada a contrato do tipo `por_sessao` gera uma cobrança com identificador único, impedindo cobrança automática duplicada. Sessões sem contrato e planos do tipo mensal/pacote não geram cobrança por presença. Sessões já faturadas não podem ter dados financeiros essenciais alterados sem um processo de correção.
- Regras testadas no PostgreSQL com transação revertida; nenhum dado de teste foi retido.

## Integração Google Agenda — ainda NÃO conectada

O sistema já tem a agenda interna e campos para guardar eventos externos, mas para ler as agendas existentes da clínica será necessário autorização do proprietário/administrador dos calendários, configuração OAuth e mapeamento de calendário → profissional/serviço.

Princípios da integração:
1. Primeiro consultar eventos do Google Calendar, sem modificar as agendas existentes.
2. Eventos com nome ambíguo não cadastram paciente nem geram faturamento.
3. Associar evento a paciente por confirmação humana; controlar duplicatas pelo ID da agenda e do evento.
4. Google Calendar é fonte de horários; Supabase é fonte de contratos, presenças e finanças.
5. Somente sessão confirmada no sistema e vinculada a contrato por sessão poderá gerar cobrança.

## Pendente de confirmação

**Campo “condição” com máscara:** ainda não foi alterado porque “condição” pode significar a condição do paciente/tratamento ou o conselho/registro do profissional. O significado e o formato devem ser confirmados antes de tratar informações possivelmente clínicas.

## Aceite obrigatório

Antes de inserir dados reais: confirmar GitHub Actions verde, publicação GitHub Pages, login admin, perfil funcionário, CRUDs, PIX, lixeira, lembretes, cobrança de sessão, estorno financeiro, backup e recuperação. Ainda não há teste de ponta a ponta concluído no navegador.
