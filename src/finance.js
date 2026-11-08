/**
 * Divide um recebimento em centavos para evitar erros de ponto flutuante.
 * Isto é uma ESTIMATIVA, não uma autorização de repasse.
 */
export function divideRecebimento(valor, percentualProfissional=40) {
  const numeric=Number(valor),percent=Number(percentualProfissional);
  if(!Number.isFinite(numeric)||numeric<0||!Number.isFinite(percent)||percent<0||percent>100) {
    throw new RangeError('Valor ou percentual inválido');
  }
  const totalCentavos=Math.round(numeric*100);
  const percentualEmPontos=Math.round(percent*100);
  const profissionalCentavos=Math.round(totalCentavos*percentualEmPontos/10000);
  const clinicaCentavos=totalCentavos-profissionalCentavos;
  return { clinica:clinicaCentavos/100, profissional:profissionalCentavos/100 };
}
