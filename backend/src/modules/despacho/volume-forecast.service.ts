import { prisma } from '../../shared/utils/prisma';

interface HistoricoItem {
  data: string;
  total: number;
}

interface Previsao {
  amanha: number;
  proximos7dias: number[];
  mediaHistorica: number;
  tendencia: 'CRESCENTE' | 'ESTAVEL' | 'DECRESCENTE';
}

interface AcuraciaPrevisaoResult {
  mediaErro: number;
  acuracia: number; // percentage 0-100
  historicoComparativo: Array<{ data: string; previsto: number; real: number }>;
}

class VolumeForecastService {
  /**
   * Returns aggregated daily volume totals for the last N days.
   * Each entry sums all VolumePrevisao.quantidadeChegou across all faixas for that day.
   */
  async getHistorico(
    unidadeId: string,
    dias: number = 30,
  ): Promise<HistoricoItem[]> {
    const since = new Date();
    since.setDate(since.getDate() - dias);
    since.setHours(0, 0, 0, 0);

    const records = await prisma.volumePrevisao.findMany({
      where: {
        unidadeId,
        data: { gte: since },
      },
      orderBy: { data: 'asc' },
    });

    // Aggregate by date
    const byDate = new Map<string, number>();
    for (const r of records) {
      const key =
        r.data instanceof Date
          ? r.data.toISOString().slice(0, 10)
          : String(r.data).slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + r.quantidadeChegou);
    }

    return Array.from(byDate.entries()).map(([data, total]) => ({
      data,
      total,
    }));
  }

  /**
   * Produces a simple moving average (SMA-7) forecast.
   *
   * - `amanha`: SMA of the last 7 days
   * - `proximos7dias`: one SMA prediction per day, each using the previous
   *    window (including already-predicted values)
   * - `tendencia`: compares last-7-day average with the previous-7-day average
   */
  async prever(unidadeId: string): Promise<Previsao> {
    const historico = await this.getHistorico(unidadeId, 30);
    const totals = historico.map((h) => h.total);

    // Guarantee at least some data to work with
    if (totals.length === 0) {
      return {
        amanha: 0,
        proximos7dias: Array(7).fill(0),
        mediaHistorica: 0,
        tendencia: 'ESTAVEL',
      };
    }

    const mediaHistorica =
      totals.reduce((a, b) => a + b, 0) / totals.length;

    // SMA-7 window
    const windowSize = Math.min(7, totals.length);
    const last7 = totals.slice(-windowSize);
    const sma7 = last7.reduce((a, b) => a + b, 0) / last7.length;

    const amanha = Math.round(sma7);

    // Rolling forecast for next 7 days
    const forecast: number[] = [];
    const buffer = [...totals];
    for (let i = 0; i < 7; i++) {
      const w = buffer.slice(-windowSize);
      const predicted = Math.round(w.reduce((a, b) => a + b, 0) / w.length);
      forecast.push(predicted);
      buffer.push(predicted);
    }

    // Trend: compare last 7 days avg vs previous 7 days avg
    let tendencia: Previsao['tendencia'] = 'ESTAVEL';
    if (totals.length >= 14) {
      const prev7 = totals.slice(-14, -7);
      const curr7 = totals.slice(-7);
      const avgPrev = prev7.reduce((a, b) => a + b, 0) / prev7.length;
      const avgCurr = curr7.reduce((a, b) => a + b, 0) / curr7.length;
      const change = ((avgCurr - avgPrev) / avgPrev) * 100;

      if (change > 5) {
        tendencia = 'CRESCENTE';
      } else if (change < -5) {
        tendencia = 'DECRESCENTE';
      }
    }

    return {
      amanha,
      proximos7dias: forecast,
      mediaHistorica: Math.round(mediaHistorica),
      tendencia,
    };
  }

  /**
   * Compares the forecast (quantidadeEstimada) against actual volumes
   * (quantidadeChegou) for the last N days, computing accuracy metrics.
   */
  async acuraciaPrevisao(
    unidadeId: string,
    dias: number = 7,
  ): Promise<AcuraciaPrevisaoResult> {
    const since = new Date();
    since.setDate(since.getDate() - dias);
    since.setHours(0, 0, 0, 0);

    const records = await prisma.volumePrevisao.findMany({
      where: {
        unidadeId,
        data: { gte: since },
      },
      orderBy: { data: 'asc' },
    });

    // Aggregate by date: sum both estimada and chegou
    const byDate = new Map<
      string,
      { previsto: number; real: number }
    >();
    for (const r of records) {
      const key =
        r.data instanceof Date
          ? r.data.toISOString().slice(0, 10)
          : String(r.data).slice(0, 10);
      const entry = byDate.get(key) ?? { previsto: 0, real: 0 };
      entry.previsto += r.quantidadeEstimada;
      entry.real += r.quantidadeChegou;
      byDate.set(key, entry);
    }

    const historicoComparativo = Array.from(byDate.entries()).map(
      ([data, { previsto, real }]) => ({ data, previsto, real }),
    );

    if (historicoComparativo.length === 0) {
      return { mediaErro: 0, acuracia: 100, historicoComparativo: [] };
    }

    // Mean Absolute Percentage Error (MAPE)
    let totalErrorPct = 0;
    for (const { previsto, real } of historicoComparativo) {
      if (real > 0) {
        totalErrorPct += Math.abs(previsto - real) / real;
      }
    }
    const mediaErro =
      Math.round((totalErrorPct / historicoComparativo.length) * 10000) / 100;
    const acuracia = Math.round((100 - mediaErro) * 100) / 100;

    return {
      mediaErro,
      acuracia: Math.max(acuracia, 0),
      historicoComparativo,
    };
  }
}

export const volumeForecastService = new VolumeForecastService();
