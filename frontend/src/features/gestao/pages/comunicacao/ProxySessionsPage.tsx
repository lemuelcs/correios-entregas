import { useState, useEffect } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { KpiCard } from '@/shared/ui/KpiCard';
import type { ProxySession } from '@/types/comunicacao.types';
import { SESSOES_MOCK } from '../../comunicacao.data';

function formatDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function ProxySessionsPage() {
  const [sessoes, setSessoes] = useState<ProxySession[]>(SESSOES_MOCK);
  const [encerrando, setEncerrando] = useState<string | null>(null);

  // Simula atualização SSE
  useEffect(() => {
    const interval = setInterval(() => {
      setSessoes((prev) =>
        prev.map((s) => (s.status === 'ACTIVE' ? { ...s, duracaoMin: s.duracaoMin + 1 } : s)),
      );
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  function encerrar(id: string) {
    setEncerrando(id);
    setTimeout(() => {
      setSessoes((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'ENDED' as const, endReason: 'MANAGER_ENDED' as const } : s)));
      setEncerrando(null);
    }, 1000);
  }

  const ativas = sessoes.filter((s) => s.status === 'ACTIVE');
  const encerradas = sessoes.filter((s) => s.status !== 'ACTIVE');

  return (
    <div className="space-y-6 p-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Sessoes Ativas" value={String(ativas.length)} accent="blue" />
        <KpiCard label="Prox. ao limite" value={String(ativas.filter((s) => s.nearLimit).length)} accent="amber" />
        <KpiCard label="Msgs hoje (total)" value="156" accent="blue" />
        <KpiCard label="Encerradas hoje" value={String(encerradas.length)} accent="blue" />
      </div>

      {/* Aviso SSE */}
      <div className="flex items-center gap-2 rounded-lg bg-[#E6EBF7] px-4 py-2 text-xs text-gray-500">
        <span className="pulse-dot h-2 w-2 rounded-full bg-green-500" />
        Atualizacao em tempo real via SSE — evento <code className="rounded bg-white px-1 font-mono">proxy_session_update</code>
      </div>

      {/* Tabela sessões ativas */}
      <div className="rounded-xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Sessoes Ativas ({ativas.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 text-left font-semibold">Carteiro</th>
                <th className="px-4 py-2.5 text-left font-semibold">Objeto</th>
                <th className="px-4 py-2.5 text-right font-semibold">Inicio</th>
                <th className="px-4 py-2.5 text-right font-semibold">Duracao</th>
                <th className="px-4 py-2.5 text-left font-semibold">Msgs</th>
                <th className="px-4 py-2.5 text-left font-semibold">Expira em</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-center font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ativas.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.nearLimit ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{s.carteiro}</td>
                  <td className="px-4 py-3">
                    {s.objeto ? (
                      <span className="font-mono text-xs text-[#003399]">{s.objeto}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">{s.inicio}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">{formatDuracao(s.duracaoMin)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${s.msgs / s.maxMsgs >= 0.9 ? 'bg-amber-500' : 'bg-[#003399]'}`}
                          style={{ width: `${(s.msgs / s.maxMsgs) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {s.msgs}/{s.maxMsgs}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${s.nearLimit ? 'text-amber-600' : 'text-gray-600'}`}>{s.expiresIn}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="success" dot size="sm">
                      ACTIVE
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => encerrar(s.id)}
                      disabled={encerrando === s.id}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      type="button"
                    >
                      {encerrando === s.id ? '...' : 'Encerrar'}
                    </button>
                  </td>
                </tr>
              ))}
              {ativas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                    Nenhuma sessao proxy ativa no momento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sessões encerradas recentes */}
      {encerradas.length > 0 && (
        <div className="rounded-xl bg-white shadow-card">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Encerradas Recentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {encerradas.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">{s.carteiro}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    {s.objeto ? `Objeto: ${s.objeto} · ` : ''}
                    {formatDuracao(s.duracaoMin)} · {s.msgs} msgs
                  </p>
                </div>
                <Badge variant="neutral" size="sm">
                  {s.endReason === 'MAX_MESSAGES'
                    ? 'Limite msgs'
                    : s.endReason === 'MANAGER_ENDED'
                      ? 'Gestor encerrou'
                      : s.endReason === 'TIMEOUT'
                        ? 'Timeout'
                        : 'ENDED'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagrama de estados */}
      <div className="rounded-xl bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Estados possiveis de uma sessao Proxy</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="rounded-lg bg-gray-200 px-2 py-1 text-gray-600">INEXISTENTE</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-lg bg-green-100 px-2 py-1 font-bold text-green-700">ACTIVE</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-lg bg-gray-100 px-2 py-1 text-gray-500">ENDED</span>
        </div>
        <p className="mt-2 text-[10px] text-gray-400">
          Motivos de encerramento: TIMEOUT (4h) · MAX_MESSAGES (50) · DRIVER_ENDED (carteiro digitou ENCERRAR) · MANAGER_ENDED (gestor via
          painel)
        </p>
      </div>
    </div>
  );
}
