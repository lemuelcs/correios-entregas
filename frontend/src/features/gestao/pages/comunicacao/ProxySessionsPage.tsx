import { useEffect, useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { KpiCard } from '@/shared/ui/KpiCard';
import { useComunicacaoStore } from '@/stores/comunicacao.store';

function formatDuracao(createdAt: string): string {
  const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatExpiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const min = Math.floor(diff / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ProxySessionsPage() {
  const { sessoes, fetchSessoes, encerrarSessao, loading } = useComunicacaoStore();
  const [encerrando, setEncerrando] = useState<string | null>(null);

  useEffect(() => {
    fetchSessoes();
    const interval = setInterval(fetchSessoes, 10_000);
    return () => clearInterval(interval);
  }, []);

  async function encerrar(id: string) {
    setEncerrando(id);
    await encerrarSessao(id);
    setEncerrando(null);
  }

  const ativas = sessoes.filter((s) => s.status === 'ACTIVE');
  const encerradas = sessoes.filter((s) => s.status !== 'ACTIVE');
  const nearLimit = ativas.filter((s) => {
    const diff = new Date(s.expiresAt).getTime() - Date.now();
    return diff < 60 * 60_000; // menos de 1h
  });

  return (
    <div className="space-y-6 p-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Sessoes Ativas" value={String(ativas.length)} accent="blue" />
        <KpiCard label="Prox. ao limite" value={String(nearLimit.length)} accent="amber" />
        <KpiCard label="Msgs total (ativas)" value={String(ativas.reduce((a, s) => a + s.messageCount, 0))} accent="blue" />
        <KpiCard label="Encerradas" value={String(encerradas.length)} accent="blue" />
      </div>

      {/* Aviso SSE */}
      <div className="flex items-center gap-2 rounded-lg bg-[#E6EBF7] px-4 py-2 text-xs text-gray-500">
        <span className="pulse-dot h-2 w-2 rounded-full bg-green-500" />
        Atualiza automaticamente a cada 10 segundos
      </div>

      {/* Tabela sessoes ativas */}
      <div className="rounded-xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Sessoes Ativas ({ativas.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 text-left font-semibold">Carteiro</th>
                <th className="px-4 py-2.5 text-right font-semibold">Inicio</th>
                <th className="px-4 py-2.5 text-right font-semibold">Duracao</th>
                <th className="px-4 py-2.5 text-left font-semibold">Msgs</th>
                <th className="px-4 py-2.5 text-left font-semibold">Expira em</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-center font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ativas.map((s) => {
                const expiresIn = formatExpiresIn(s.expiresAt);
                const isNearLimit = (new Date(s.expiresAt).getTime() - Date.now()) < 60 * 60_000;
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 ${isNearLimit ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800">
                      <span className="font-mono">{s.carteiroPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                      {s.carteiroId && <span className="ml-1 text-[10px] text-gray-400">({s.carteiroId.slice(0, 8)})</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">{formatTime(s.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">{formatDuracao(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">{s.messageCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${isNearLimit ? 'text-amber-600' : 'text-gray-600'}`}>
                        {expiresIn}
                      </span>
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
                );
              })}
              {ativas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    {loading ? 'Carregando...' : 'Nenhuma sessao proxy ativa no momento'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sessoes encerradas recentes */}
      {encerradas.length > 0 && (
        <div className="rounded-xl bg-white shadow-card">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Encerradas Recentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {encerradas.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">
                    {s.carteiroPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    {formatDuracao(s.createdAt)} · {s.messageCount} msgs
                  </p>
                </div>
                <Badge variant="neutral" size="sm">
                  {s.endReason === 'MAX_MESSAGES'
                    ? 'Limite msgs'
                    : s.endReason === 'GESTOR_ENDED'
                      ? 'Gestor encerrou'
                      : s.endReason === 'TIMEOUT'
                        ? 'Timeout'
                        : s.endReason ?? 'ENDED'}
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
          Motivos de encerramento: TIMEOUT (4h) · MAX_MESSAGES (50) · DRIVER_ENDED (carteiro digitou ENCERRAR) · GESTOR_ENDED (gestor via
          painel)
        </p>
      </div>
    </div>
  );
}
