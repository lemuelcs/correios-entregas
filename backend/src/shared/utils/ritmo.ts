import { prisma } from './prisma';

export interface RitmoCalculo {
  sphRolling: number;      // SPH of the last 60 minutes
  retornoProjetado: Date;  // projected return time
  paradasRestantes: number;
  horasRestantes: number;
  trend: 'ACIMA' | 'ABAIXO' | 'NORMAL'; // compared to SPH target of 15
}

/**
 * Calculates the current pace (ritmo) of a route in execution.
 *
 * Uses a rolling window of the last 60 minutes of snapshots to produce
 * a Stops-Per-Hour (SPH) metric, projects the return time, and classifies
 * the trend relative to the operational target (SPH ~15).
 */
export function calcularRitmo(
  totalParadas: number,
  paradasFeitas: number,
  iniciadoEm: Date,
  snapshots: Array<{ paradasFeitas: number; ocorridoEm: Date }>,
): RitmoCalculo {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // 1. Filter snapshots from last 60 minutes
  const recentSnapshots = snapshots
    .filter((s) => s.ocorridoEm >= oneHourAgo)
    .sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime());

  // 2. Calculate rolling SPH from snapshots
  let sph: number;

  if (recentSnapshots.length >= 2) {
    const first = recentSnapshots[0];
    const last = recentSnapshots[recentSnapshots.length - 1];
    const paradasNoPeriodo = last.paradasFeitas - first.paradasFeitas;
    const horasNoPeriodo =
      (last.ocorridoEm.getTime() - first.ocorridoEm.getTime()) / (1000 * 60 * 60);
    sph = horasNoPeriodo > 0 ? paradasNoPeriodo / horasNoPeriodo : 0;
  } else {
    // Fallback: overall average since route started
    const hoursElapsed =
      (now.getTime() - iniciadoEm.getTime()) / (1000 * 60 * 60);
    sph = hoursElapsed > 0 ? paradasFeitas / hoursElapsed : 0;
  }

  // 3. Remaining stops
  const paradasRestantes = Math.max(totalParadas - paradasFeitas, 0);

  // 4. Remaining hours
  const horasRestantes = sph > 0 ? paradasRestantes / sph : 0;

  // 5. Projected return = now + remaining hours + 30 min buffer (return to unit)
  const BUFFER_RETORNO_MS = 30 * 60 * 1000;
  const retornoProjetado = new Date(
    now.getTime() + horasRestantes * 3600000 + BUFFER_RETORNO_MS,
  );

  // 6. Trend classification
  let trend: RitmoCalculo['trend'];
  if (sph >= 18) {
    trend = 'ACIMA';
  } else if (sph >= 12) {
    trend = 'NORMAL';
  } else {
    trend = 'ABAIXO';
  }

  return {
    sphRolling: Math.round(sph * 100) / 100,
    retornoProjetado,
    paradasRestantes,
    horasRestantes: Math.round(horasRestantes * 100) / 100,
    trend,
  };
}

/**
 * Persists a RitmoSnapshot record so the rolling-window calculation
 * has historical data points to work with.
 */
export async function criarRitmoSnapshot(
  rotaId: string,
  paradasFeitas: number,
  objetosEntregues: number,
  sphAtual: number,
  retornoProjetado: Date,
): Promise<void> {
  await prisma.ritmoSnapshot.create({
    data: {
      rotaId,
      paradasFeitas,
      objetosEntregues,
      sphAtual,
      retornoProjetado,
    },
  });
}
