# Requisitos — Clínica AnaCris

## Objetivo
Sistema administrativo de clínica **básico, confiável, intuitivo e modular**, com armazenamento centralizado no Supabase e relatórios exportáveis. Usuários com pouca experiência em tecnologia devem conseguir realizar tarefas rotineiras com poucos passos.

## MVP inicial
- Login de usuários previamente autorizados; sem cadastro público.
- Pacientes: cadastrar, buscar, consultar, editar, inativar e reativar.
- Profissionais: cadastrar, buscar, consultar, editar, inativar e reativar; conselho, especialidade, PIX e percentual de repasse.
- Dashboard simples e CSV compatível com Excel.
- Banco de dados com RLS, validações e registros sem exclusão física.

## Módulos seguintes (ainda não implementados)
1. Agenda: integrar Google Agenda por profissional, importar compromissos e confirmar vínculos de pacientes.
2. Sessões: comparecimento, falta, cancelamento, atendimento por profissional e serviço.
3. Contratos: vigências mensal/trimestral/semestral, cobrança por sessão/pacote/mensalidade.
4. Financeiro: contas fixas e variáveis, vencimentos, cobranças, pagamentos parciais, inadimplência.
5. Repasses: padrão 60% clínica/40% profissional e exceções por profissional/contrato.
6. Relatórios: pacientes ativos semanais, altas do mês, fechamento semanal, repasses, contas e PDF/XLSX.

## Fora do escopo inicial
Prontuário médico, emissão fiscal, BI avançado e aplicativo nativo. Dados pessoais não devem ser publicados no GitHub.
