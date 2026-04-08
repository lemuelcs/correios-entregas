import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge } from '@/shared/ui/Badge';
import { ESTADO_BADGE, TIPO_BADGE } from '@/types/comunicacao.types';
import type { EstadoConversa, TipoParticipante } from '@/types/comunicacao.types';
import { useComunicacaoStore } from '@/stores/comunicacao.store';

// ── helpers ────────────────────────────────────────────────────────────────

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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── ConversasPage (lista) ───────────────────────────────────────────────────

export function ConversasPage() {
  const navigate = useNavigate();
  const { conversas, fetchConversas, loading } = useComunicacaoStore();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoParticipante>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoConversa>('todos');

  useEffect(() => {
    fetchConversas();
  }, []);

  const filtradas = conversas.filter((c) => {
    const lastMsg = c.ultimasMensagens?.[0]?.content ?? '';
    if (busca && !c.phoneDisplay.includes(busca) && !lastMsg.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroTipo !== 'todos' && c.participantType !== filtroTipo) return false;
    if (filtroEstado !== 'todos' && c.state !== filtroEstado) return false;
    return true;
  });

  return (
    <div className="space-y-4 p-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por numero ou mensagem..."
          className="w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as any)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="todos">Todos os tipos</option>
          <option value="MOTORISTA">Carteiro</option>
          <option value="DESTINATARIO">Destinatario</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as any)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="todos">Todos os estados</option>
          <option value="BOT_ACTIVE">Bot ativo</option>
          <option value="DISPATCHER_ACTIVE">Atendimento humano</option>
          <option value="OPTED_OUT">Opt-out</option>
          <option value="CLOSED">Encerrado</option>
        </select>
        <span className="text-xs text-gray-500">
          {loading ? 'Carregando...' : `${filtradas.length} conversa(s)`}
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 text-left font-semibold">Participante</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Ultima mensagem</th>
              <th className="px-4 py-3 text-right font-semibold">Msgs</th>
              <th className="px-4 py-3 text-right font-semibold">Ha</th>
              <th className="px-4 py-3 text-center font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.map((c) => {
              const tipo = TIPO_BADGE[c.participantType] ?? TIPO_BADGE.UNKNOWN;
              const estado = ESTADO_BADGE[c.state] ?? ESTADO_BADGE.BOT_ACTIVE;
              const lastMsg = c.ultimasMensagens?.[0]?.content ?? '—';
              const isDispatcher = c.dispatcherAtivo;
              return (
                <tr key={c.id} className={`hover:bg-gray-50 ${isDispatcher ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isDispatcher && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                      <span className="font-mono text-xs text-gray-700">{c.phoneDisplay}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={tipo.variant as any} size="sm">
                      {tipo.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={estado.variant as any} size="sm" dot>
                      {estado.label}
                    </Badge>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-600">{lastMsg}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{c.totalMessages}</td>
                  <td className="px-4 py-3 text-right text-[11px] text-gray-400">{timeAgo(c.lastMessageAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => navigate(`/gestao/comunicacao/conversas/${c.id}`)}
                      className="text-xs font-medium text-[#003399] hover:underline"
                      type="button"
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtradas.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <p className="mb-2 text-2xl">💬</p>
            <p className="text-sm">{loading ? 'Carregando...' : 'Nenhuma conversa encontrada'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ConversaDetalhePage ─────────────────────────────────────────────────────

export function ConversaDetalhePage() {
  const navigate = useNavigate();
  const { conversaId } = useParams<{ conversaId: string }>();
  const {
    conversas, conversaAtual, mensagens, loading,
    fetchConversas, fetchMensagens, enviarMensagemGestor,
    assumirConversa, encerrarConversa,
  } = useComunicacaoStore();

  const [mensagem, setMensagem] = useState('');
  const [dispatcherSessionId, setDispatcherSessionId] = useState<string | null>(null);
  const [assumindo, setAssumindo] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversaId) return;
    // Load conversas if not loaded (e.g. direct URL access)
    if (conversas.length === 0) fetchConversas();
    fetchMensagens(conversaId);
    const interval = setInterval(() => fetchMensagens(conversaId), 5000);
    return () => clearInterval(interval);
  }, [conversaId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Sync dispatcherSessionId from conversation data
  useEffect(() => {
    const c = conversas.find((c) => c.id === conversaId);
    if (c?.dispatcherSessionId) setDispatcherSessionId(c.dispatcherSessionId);
  }, [conversas, conversaId]);

  const conversa = conversaAtual ?? conversas.find((c) => c.id === conversaId);

  async function handleAssumir() {
    if (!conversaId) return;
    setAssumindo(true);
    try {
      // TODO: use real dispatcher name from auth context
      const result = await assumirConversa(conversaId, 'Gestor');
      setDispatcherSessionId(result.dispatcherSessionId);
    } catch {
      // error is set in store
    } finally {
      setAssumindo(false);
    }
  }

  async function handleEncerrar() {
    if (!dispatcherSessionId) return;
    await encerrarConversa(dispatcherSessionId);
    setDispatcherSessionId(null);
    if (conversaId) fetchMensagens(conversaId);
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mensagem.trim() || !dispatcherSessionId) return;
    await enviarMensagemGestor(dispatcherSessionId, mensagem.trim());
    setMensagem('');
    if (conversaId) fetchMensagens(conversaId);
  }

  const tipo = conversa ? (TIPO_BADGE[conversa.participantType] ?? TIPO_BADGE.UNKNOWN) : null;
  const estado = conversa ? (ESTADO_BADGE[conversa.state] ?? ESTADO_BADGE.BOT_ACTIVE) : null;

  return (
    <div className="space-y-4 p-6">
      {/* Header conversa */}
      <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card">
        <button
          onClick={() => navigate('/gestao/comunicacao/conversas')}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100"
          type="button"
        >
          ←
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6EBF7] text-sm font-bold text-[#003399]">
          {conversa?.participantType === 'MOTORISTA' ? 'CA' : 'DE'}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{conversa?.phoneDisplay ?? '...'}</p>
          <p className="text-xs text-gray-500">
            {tipo?.label ?? '—'} · {conversa?.totalMessages ?? 0} mensagens
            {conversa?.dispatcherNome ? ` · Dispatcher: ${conversa.dispatcherNome}` : ''}
          </p>
        </div>
        {estado && (
          <Badge variant={estado.variant as any} dot>
            {estado.label}
          </Badge>
        )}
        <div className="flex gap-2">
          {!dispatcherSessionId && conversa?.state !== 'CLOSED' && conversa?.state !== 'OPTED_OUT' && (
            <button
              onClick={handleAssumir}
              disabled={assumindo}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              type="button"
            >
              {assumindo ? 'Entrando...' : 'Assumir conversa'}
            </button>
          )}
          {dispatcherSessionId && (
            <button
              onClick={handleEncerrar}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
              type="button"
            >
              Encerrar atendimento
            </button>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="flex flex-col rounded-xl bg-white shadow-card" style={{ height: 400 }}>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && mensagens.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Carregando mensagens...</p>
          )}
          {mensagens.map((m) => {
            const isInbound = m.direction === 'INBOUND';
            const isDispatcher = m.tipo === 'DISPATCHER';
            return (
              <div key={m.id} className={`flex ${isInbound ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs rounded-2xl px-3 py-2 text-sm leading-snug lg:max-w-md ${
                    isInbound
                      ? 'rounded-br-sm bg-[#003399] text-white'
                      : isDispatcher
                        ? 'rounded-bl-sm bg-[#FFD600] font-medium text-[#003399]'
                        : 'rounded-bl-sm bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.tipo === 'BOT' && m.direction === 'OUTBOUND' && (
                    <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">Agente IA</p>
                  )}
                  {isDispatcher && (
                    <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-[#003399]/60">
                      {m.remetente}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.content}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      isInbound ? 'text-white/60' : isDispatcher ? 'text-[#003399]/50' : 'text-gray-400'
                    }`}
                  >
                    {formatTime(m.createdAt)}
                    {m.direction === 'OUTBOUND' && (
                      <span className="ml-1">
                        {m.deliveryStatus === 'READ' ? '✓✓' : m.deliveryStatus === 'DELIVERED' ? '✓✓' : m.deliveryStatus === 'FAILED' ? '✗' : '✓'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input gestor */}
        <form onSubmit={enviar} className="flex gap-2 border-t border-gray-100 p-3">
          <input
            type="text"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={dispatcherSessionId ? 'Responder como gestor...' : 'Assuma a conversa para responder'}
            disabled={!dispatcherSessionId}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={!dispatcherSessionId || !mensagem.trim()}
            className="rounded-lg bg-[#003399] px-4 py-2 text-sm font-semibold text-white hover:bg-[#002266] disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>

      {/* Metadados */}
      {conversa && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-card">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Informacoes da sessao</h3>
          <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
            {[
              { label: 'Estado', value: conversa.state },
              { label: 'Total msgs', value: String(conversa.totalMessages) },
              { label: 'Tipo', value: conversa.participantType },
              { label: 'Bot silenciado', value: conversa.botSilenciado ? 'Sim' : 'Nao' },
              { label: 'Dispatcher ativo', value: conversa.dispatcherAtivo ? 'Sim' : 'Nao' },
              { label: 'Dispatcher', value: conversa.dispatcherNome ?? '—' },
              { label: 'Ultima msg', value: timeAgo(conversa.lastMessageAt) },
              { label: 'ID sessao', value: conversa.id.slice(0, 8) + '...' },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-gray-500">{f.label}</p>
                <p className="font-semibold text-gray-800">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
