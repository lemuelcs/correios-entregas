import { useNavigate } from 'react-router';
import { KpiCard } from '@/shared/ui/KpiCard';
import { Badge } from '@/shared/ui/Badge';
import { ESTADO_BADGE, INSTANCE_BADGE, TIPO_BADGE } from '@/types/comunicacao.types';
import type { ChartDataPoint } from '@/types/comunicacao.types';
import { CHART_DATA, INSTANCE_STATUS, ULTIMAS_CONVERSAS } from '../../comunicacao.data';

// ── Mini LineChart SVG ──────────────────────────────────────────────────────

function LineChart({ data }: { data: ChartDataPoint[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.recebidas, d.enviadas)));
  const W = 560;
  const H = 100;
  const pad = 8;

  function toY(val: number) {
    return H - pad - (val / maxVal) * (H - pad * 2);
  }
  function toX(i: number) {
    return pad + (i / (data.length - 1)) * (W - pad * 2);
  }

  const pathRecebidas = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.recebidas)}`).join(' ');
  const pathEnviadas = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.enviadas)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line
          key={p}
          x1={pad}
          y1={pad + p * (H - pad * 2)}
          x2={W - pad}
          y2={pad + p * (H - pad * 2)}
          stroke="#F3F4F6"
          strokeWidth="1"
        />
      ))}
      <path d={pathEnviadas} fill="none" stroke="#003399" strokeWidth="2" strokeLinejoin="round" />
      <path d={pathRecebidas} fill="none" stroke="#FFD600" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ComunicacaoDashboardPage() {
  const navigate = useNavigate();
  const inst = INSTANCE_BADGE[INSTANCE_STATUS];

  return (
    <div className="space-y-6 p-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Conversas Ativas" value="23" accent="blue" delta="agora" deltaPositive />
        <KpiCard label="Resolucao Bot (24h)" value="76" unit="%" accent="green" delta="+4% vs ontem" deltaPositive />
        <KpiCard label="Custo LLM (mes)" value="R$ 84" accent="yellow" delta="meta: R$ 150/mes" deltaPositive />
        <KpiCard label="Sessoes Proxy Ativas" value="4" accent="blue" />
      </div>

      {/* Status instância + gráfico */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status Evolution */}
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-card">
          <h2 className="text-sm font-semibold text-gray-800">Instancia WhatsApp</h2>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <span className="text-2xl">💬</span>
            <div className="flex-1">
              <p className="font-mono text-xs font-semibold text-gray-700">cdd_bsb_01</p>
              <p className="text-[10px] text-gray-500">+55 61 3003-0100</p>
            </div>
            <Badge variant={inst.variant as any} dot>
              {inst.label}
            </Badge>
          </div>
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Ultima mensagem recebida</span>
              <span className="font-medium text-gray-700">ha 2 min</span>
            </div>
            <div className="flex justify-between">
              <span>Mensagens hoje</span>
              <span className="font-medium text-gray-700">347</span>
            </div>
            <div className="flex justify-between">
              <span>Fila n8n</span>
              <span className="font-medium text-green-600">0 pendentes</span>
            </div>
          </div>
          <div className="flex gap-2 border-t border-gray-100 pt-2">
            <button
              onClick={() => navigate('/gestao/comunicacao/configuracao')}
              className="flex-1 rounded-lg border border-[#003399] py-2 text-xs font-semibold text-[#003399] transition-colors hover:bg-[#E6EBF7]"
              type="button"
            >
              Configurar
            </button>
            <button
              onClick={() => navigate('/gestao/comunicacao/conversas')}
              className="flex-1 rounded-lg bg-[#003399] py-2 text-xs font-semibold text-white transition-colors hover:bg-[#002266]"
              type="button"
            >
              Conversas
            </button>
          </div>
        </div>

        {/* Gráfico 30 dias */}
        <div className="rounded-xl bg-white p-4 shadow-card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Mensagens — Ultimos 30 dias</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 rounded bg-[#003399]" />
                Enviadas
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 rounded border border-dashed border-[#E6C000] bg-[#FFD600]" />
                Recebidas
              </span>
            </div>
          </div>
          <LineChart data={CHART_DATA} />
          <div className="mt-1 flex justify-between px-1 text-[10px] text-gray-400">
            <span>Dia 1</span>
            <span>Dia 15</span>
            <span>Hoje</span>
          </div>
        </div>
      </div>

      {/* Tabela últimas conversas */}
      <div className="rounded-xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Ultimas 10 Conversas</h2>
          <button
            onClick={() => navigate('/gestao/comunicacao/conversas')}
            className="text-xs font-medium text-[#003399] hover:underline"
            type="button"
          >
            Ver todas →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 text-left font-semibold">Participante</th>
                <th className="px-4 py-2.5 text-left font-semibold">Tipo</th>
                <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                <th className="px-4 py-2.5 text-left font-semibold">Ultima Mensagem</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ha</th>
                <th className="px-4 py-2.5 text-center font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ULTIMAS_CONVERSAS.map((c, i) => {
                const tipo = TIPO_BADGE[c.tipo];
                const estado = ESTADO_BADGE[c.estado];
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{c.participante}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={tipo.variant as any} size="sm">
                        {tipo.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={estado.variant as any} size="sm" dot>
                        {estado.label}
                      </Badge>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-xs text-gray-600">{c.ultimaMsg}</td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-gray-400">{c.ha}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => navigate('/gestao/comunicacao/conversas')}
                        className="text-xs font-medium text-[#003399] hover:underline"
                        type="button"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
