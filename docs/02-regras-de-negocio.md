# Regras de negócio

## Cadastros
- Identificador único por paciente e profissional.
- Uma ficha única por paciente, mesmo com vários serviços/profissionais.
- Campos obrigatórios mínimos no primeiro cadastro; completar ficha posteriormente.
- Não apagar registros com histórico; inativar e preservar vínculos.

## Agenda Google (fase futura)
- Profissionais utilizam Google Agenda; eventos normalmente têm só nome do paciente.
- Títulos ambíguos não podem criar pacientes automaticamente.
- Um evento externo deve ser confirmado/vinculado ao paciente e serviço.
- Evento não gera sozinho cobrança nem repasse.
- Evitar duplicações guardando ID do calendário e ID do evento externo.

## Financeiro (fase futura)
- Cobrança pode ser por mensalidade, pacote, sessão, trimestre ou semestre, variando por contrato.
- Divisão padrão do recebimento: 60% clínica e 40% profissional.
- Exceções: contrato > regra individual do profissional > regra padrão (proposta).
- A regra do momento de liberação de repasse ainda será confirmada com a clínica.
- Pagamento parcial, faltas, cancelamentos, reposições, descontos e estornos precisam de regras explícitas.
- Separar valor previsto, recebido, devido e efetivamente pago.

## Relatórios
- Semanal por fisioterapeuta: atendimentos realizados, cancelamentos, faltas comunicadas, interrupções e fechamento.
- Mensal: pacientes ativos/altas, contas, cobranças e repasses.
- Dados exportados apenas por pessoas autorizadas, conforme finalidade.
