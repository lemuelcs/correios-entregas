import { prisma } from '../../shared/utils/prisma';

interface SimulacaoInput {
  unidadeId: string;
  quantidadeObjetos?: number;
  estruturas: number;
  posicoesPorEstrutura: number;
  throughputHora: number;
  horaInicioTriagem?: string; // HH:mm, default "05:00"
  deadlineDespacho?: string;  // HH:mm, default "08:30"
}

interface EstruturaSummary {
  id: number;
  posicoes: number;
  objetosAtribuidos: number;
  utilizacao: number; // percentage 0-100
}

interface SimulacaoResult {
  quantidadeObjetos: number;
  totalPosicoes: number;
  posicoesSuficientes: boolean;
  posicoesFaltando: number;
  tempoEstimadoMinutos: number;
  operadoresNecessarios: number;
  operadoresPorEstrutura: number;
  horaInicioTriagem: string;
  horaFimEstimada: string;
  deadlineDespacho: string;
  dentroDoDeadline: boolean;
  throughputEfetivo: number;
  estruturas: EstruturaSummary[];
  alertas: string[];
}

/**
 * Parses an "HH:mm" string into total minutes from midnight.
 */
function parseHHmm(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Formats total minutes from midnight back to "HH:mm".
 */
function formatHHmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

class TriagemSimulator {
  async simular(input: SimulacaoInput): Promise<SimulacaoResult> {
    const {
      unidadeId,
      estruturas,
      posicoesPorEstrutura,
      throughputHora,
      horaInicioTriagem: horaInicioStr = '05:00',
      deadlineDespacho: deadlineStr = '08:30',
    } = input;

    const alertas: string[] = [];

    // 1. Determine object count -- use provided value or count from DB
    let quantidadeObjetos = input.quantidadeObjetos;
    if (quantidadeObjetos === undefined || quantidadeObjetos === null) {
      quantidadeObjetos = await prisma.objeto.count({
        where: {
          unidadeId,
          statusAtual: { in: ['RECEBIDO_UNIDADE', 'EM_CONFERENCIA'] },
        },
      });
    }

    // 2. Calculate total positions across all structures
    const totalPosicoes = estruturas * posicoesPorEstrutura;

    // 3. Check if positions are sufficient
    //    Each distinct route/district ideally maps to one position.
    //    In the simplified model, we check if the wall can hold the volume
    //    (each position can accumulate multiple objects, but too few positions
    //    means congestion and overflow).
    const distinctRoutes = await prisma.rota.count({
      where: {
        unidadeId,
        statusAtual: { in: ['CRIADA', 'DISPONIVEL'] },
      },
    });

    const positionsNeeded = Math.max(distinctRoutes, 1);
    const posicoesSuficientes = totalPosicoes >= positionsNeeded;
    const posicoesFaltando = posicoesSuficientes
      ? 0
      : positionsNeeded - totalPosicoes;

    if (!posicoesSuficientes) {
      alertas.push(
        `Faltam ${posicoesFaltando} posicoes para cobrir todas as ${positionsNeeded} rotas ativas.`,
      );
    }

    // 4. Calculate time: totalObjetos / throughputHora * 60 = minutes
    const tempoEstimadoMinutos =
      throughputHora > 0
        ? (quantidadeObjetos / throughputHora) * 60
        : Infinity;

    // 5. Calculate available hours and operators
    const inicioMin = parseHHmm(horaInicioStr);
    const deadlineMin = parseHHmm(deadlineStr);
    const availableMinutes =
      deadlineMin > inicioMin
        ? deadlineMin - inicioMin
        : 24 * 60 - inicioMin + deadlineMin; // wraps past midnight
    const availableHours = availableMinutes / 60;

    // Operators needed: how many parallel workers to finish within the available window
    // Each operator processes at throughputHora objects/hr
    const operadoresNecessarios =
      availableHours > 0 && throughputHora > 0
        ? Math.ceil(quantidadeObjetos / (throughputHora * availableHours))
        : 1;

    // Spread operators evenly across structures
    const operadoresPorEstrutura =
      estruturas > 0
        ? Math.ceil(operadoresNecessarios / estruturas)
        : operadoresNecessarios;

    // 6. Effective throughput with calculated operators
    const throughputEfetivo = operadoresNecessarios * throughputHora;

    // 7. Actual estimated finish time (using all operators in parallel)
    const tempoComOperadoresMin =
      throughputEfetivo > 0
        ? (quantidadeObjetos / throughputEfetivo) * 60
        : tempoEstimadoMinutos;

    const fimEstimadoMin = inicioMin + tempoComOperadoresMin;
    const horaFimEstimada = formatHHmm(fimEstimadoMin);

    // 8. Check if within deadline
    const dentroDoDeadline = fimEstimadoMin <= deadlineMin;

    if (!dentroDoDeadline) {
      const excedenteMin = Math.round(fimEstimadoMin - deadlineMin);
      alertas.push(
        `Triagem ultrapassa o deadline de despacho em ${excedenteMin} minutos. Considere adicionar mais operadores ou antecipar o inicio.`,
      );
    }

    // 9. Distribute objects evenly across structures
    const estruturasSummary: EstruturaSummary[] = [];
    const baseObjPerStruct = Math.floor(quantidadeObjetos / estruturas);
    let remaining = quantidadeObjetos - baseObjPerStruct * estruturas;

    for (let i = 1; i <= estruturas; i++) {
      const objetosAtribuidos = baseObjPerStruct + (remaining > 0 ? 1 : 0);
      if (remaining > 0) remaining--;

      const utilizacao =
        posicoesPorEstrutura > 0
          ? Math.round((objetosAtribuidos / posicoesPorEstrutura) * 100 * 100) / 100
          : 0;

      estruturasSummary.push({
        id: i,
        posicoes: posicoesPorEstrutura,
        objetosAtribuidos,
        utilizacao,
      });
    }

    // 10. Extra alerts
    if (quantidadeObjetos === 0) {
      alertas.push('Nenhum objeto pendente encontrado para triagem.');
    }

    if (operadoresNecessarios > estruturas * 2) {
      alertas.push(
        `Alto numero de operadores necessarios (${operadoresNecessarios}). Verifique se o throughput configurado esta adequado.`,
      );
    }

    return {
      quantidadeObjetos,
      totalPosicoes,
      posicoesSuficientes,
      posicoesFaltando,
      tempoEstimadoMinutos: Math.round(tempoEstimadoMinutos * 100) / 100,
      operadoresNecessarios,
      operadoresPorEstrutura,
      horaInicioTriagem: horaInicioStr,
      horaFimEstimada,
      deadlineDespacho: deadlineStr,
      dentroDoDeadline,
      throughputEfetivo,
      estruturas: estruturasSummary,
      alertas,
    };
  }
}

export const triagemSimulator = new TriagemSimulator();
