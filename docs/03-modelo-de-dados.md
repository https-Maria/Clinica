# Modelo de dados

## Banco criado — Supabase
- `public.clinic_members`: `user_id`, função, ativo.
- `public.patients`: id UUID, nome, data de nascimento, contatos, responsável, endereço, datas de início/fim, notas e ativo.
- `public.professionals`: id UUID, nome, contatos, conselho, especialidade, chave PIX, porcentagem de repasse e ativo.

RLS habilitado nas três tabelas. `anon` não recebe permissões de leitura. Usuários autenticados sem associação ativa em `clinic_members` não podem consultar ou alterar os cadastros. Não há DELETE pelo cliente.

## Futuro — não criado
- `services` para tipos como Pilates, fisioterapia, atendimento domiciliar e laserterapia.
- `calendar_links` e `appointments` para eventos externos e sessões.
- `contracts` para paciente, profissional, preço e vigência.
- `receivables` e `payments` para cobranças e recebimentos.
- `expenses` para despesas fixas e variáveis.
- `payouts` para apuração e pagamento dos repasses.

## Requisitos estruturais
PK UUID, FKs, validações, campos financeiros NUMERIC, rastreamento de alterações e transações consistentes. O banco é a fonte oficial para informações financeiras.
