import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { KpiCard } from '@/shared/ui/KpiCard';
import { Badge } from '@/shared/ui/Badge';
import { ESTADO_BADGE, INSTANCE_BADGE, TIPO_BADGE } from '@/types/comunicacao.types';
import type { StatusInstancia } from '@/types/comunicacao.types';
import { useComunicacaoStore } from '@/stores/comunicacao.store';

// ── helpers ───────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function deriveInstanceBadgeKey(status: { connected: boolean } | null): StatusInstancia {
  if (!status) return 'INACTIVE';
  return status.connected ? 'ACTIVE' : 'INACTIVE';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ComunicacaoDashboardPage() {
  const navigate = useNavigate();
  const {
    conversas, fetchConversas,
    instanciaStatus, fetchInstanciaStatus,
    adminStats, fetchAdminStats,
    adminConfig, fetchAdminConfig,
    sessoes, fetchSessoes,
    loading,
  } = useComunicacaoStore();

  useEffect(() => {
    fetchConversas();
    fetchInstanciaStatus();
    fetchAdminStats();
    fetchAdminConfig();
    fetchSessoes();
  }, []);

  const instKey = deriveInstanceBadgeKey(instanciaStatus);
  const inst = INSTANCE_BADGE[instKey];
  const ativas = sessoes.filter((s) => s.status === 'ACTIVE');

  const ultimas10 = conversas.slice(0, 10);

  return (
    <div className="space-y-6 p-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Conversas Ativas"
          value={String(adminStats?.sessoesAtivas ?? conversas.length)}
          accent="blue"
          delta="agora"
          deltaPositive
        />
        <KpiCard
          label="Resolucao Bot"
          value={adminStats ? `${adminStats.taxaBot}%` : '—'}
          accent="green"
          delta={adminStats ? `${adminStats.sessoesBot} sessoes bot` : ''}
          deltaPositive
        />
        <KpiCard
          label="Custo LLM"
          value={adminStats ? `US$ ${adminStats.llmCostUsd.toFixed(2)}` : '—'}
          accent="yellow"
        />
        <KpiCard label="Sessoes Proxy Ativas" value={String(ativas.length)} accent="blue" />
      </div>

      {/* Status instancia */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-card">
          <h2 className="text-sm font-semibold text-gray-800">Instancia WhatsApp</h2>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <span className="text-2xl">💬</span>
            <div className="flex-1">
              <p className="font-mono text-xs font-semibold text-gray-700">
                {instanciaStatus?.instanceName ?? adminConfig?.instanceName ?? '—'}
              </p>
              <p className="text-[10px] text-gray-500">{adminConfig?.phoneNumber ?? ''}</p>
            </div>
            <Badge variant={inst.variant as any} dot>
              {inst.label}
            </Badge>
          </div>
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Msgs enviadas (periodo)</span>
              <span className="font-medium text-gray-700">{adminStats?.mensagensEnviadas ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Msgs recebidas (periodo)</span>
              <span className="font-medium text-gray-700">{adminStats?.mensagensRecebidas ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Falhas</span>
              <span className={`font-medium ${(adminStats?.falhas ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {adminStats?.falhas ?? 0}
              </span>
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

        {/* Stats summary */}
        <div className="rounded-xl bg-white p-4 shadow-card lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Resumo do periodo</h2>
          {adminStats ? (
            <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-3">
              {[
                { label: 'Enviadas', value: adminStats.mensagensEnviadas },
                { label: 'Recebidas', value: adminStats.mensagensRecebidas },
                { label: 'Entregues', value: adminStats.entregues },
                { label: 'Lidas', value: adminStats.lidas },
                { label: 'Falhas', value: adminStats.falhas },
                { label: 'Sessoes Bot', value: adminStats.sessoesBot },
                { label: 'Sessoes Dispatcher', value: adminStats.sessoesDispatcher },
                { label: 'Carteiros', value: adminStats.motoristaCount },
                { label: 'Destinatarios', value: adminStats.destinatarioCount },
                { label: 'Requisicoes LLM', value: adminStats.llmRequests },
                { label: 'Custo LLM (USD)', value: `$${adminStats.llmCostUsd.toFixed(4)}` },
                { label: 'Taxa Bot (%)', value: `${adminStats.taxaBot}%` },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-gray-500">{f.label}</p>
                  <p className="text-lg font-black text-gray-800">{f.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              {loading ? 'Carregando...' : 'Nenhum dado disponivel'}
            </p>
          )}
        </div>
      </div>

      {/* Tabela ultimas conversas */}
      <div className="rounded-xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Ultimas Conversas</h2>
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
              {ultimas10.map((c) => {
                const tipo = TIPO_BADGE[c.participantType] ?? TIPO_BADGE.UNKNOWN;
                const estado = ESTADO_BADGE[c.state] ?? ESTADO_BADGE.BOT_ACTIVE;
                const lastMsg = c.ultimasMensagens?.[0]?.content ?? '—';
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{c.phoneDisplay}</td>
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
                    <td className="max-w-xs truncate px-4 py-2.5 text-xs text-gray-600">{lastMsg}</td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-gray-400">{timeAgo(c.lastMessageAt)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => navigate(`/gestao/comunicacao/conversas/${c.id}`)}
                        className="text-xs font-medium text-[#003399] hover:underline"
                        type="button"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
              {ultimas10.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                    {loading ? 'Carregando conversas...' : 'Nenhuma conversa encontrada'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
