import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge } from '@/shared/ui/Badge';
import { ESTADO_BADGE, TIPO_BADGE } from '@/types/comunicacao.types';
import type { EstadoConversa, Mensagem, TipoParticipante } from '@/types/comunicacao.types';
import { CONVERSAS, MENSAGENS_MOCK } from '../../comunicacao.data';

// ── ConversasPage (lista) ───────────────────────────────────────────────────

export function ConversasPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoParticipante>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoConversa>('todos');

  const filtradas = CONVERSAS.filter((c) => {
    if (busca && !c.participante.includes(busca) && !c.ultimaMsg.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
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
          <option value="carteiro">Carteiro</option>
          <option value="destinatario">Destinatario</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as any)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="todos">Todos os estados</option>
          <option value="bot_active">Bot ativo</option>
          <option value="human_active">Atendimento humano</option>
          <option value="opted_out">Opt-out</option>
          <option value="ended">Encerrado</option>
        </select>
        <span className="text-xs text-gray-500">{filtradas.length} conversa(s)</span>
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
              const tipo = TIPO_BADGE[c.tipo];
              const estado = ESTADO_BADGE[c.estado];
              return (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.unresolved ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.unresolved && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                      <span className="font-mono text-xs text-gray-700">{c.participante}</span>
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
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-600">{c.ultimaMsg}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{c.msgs}</td>
                  <td className="px-4 py-3 text-right text-[11px] text-gray-400">{c.ha}</td>
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
            <p className="text-sm">Nenhuma conversa encontrada</p>
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
  const [mensagem, setMensagem] = useState('');
  const [msgs, setMsgs] = useState<Mensagem[]>(MENSAGENS_MOCK);

  const conversa = CONVERSAS.find((c) => c.id === conversaId);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mensagem.trim()) return;
    setMsgs((prev) => [
      ...prev,
      {
        de: 'gestor',
        texto: mensagem.trim(),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'text',
      },
    ]);
    setMensagem('');
  }

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
          {conversa?.tipo === 'carteiro' ? 'CA' : 'DE'}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{conversa?.participante ?? '+55 61 9 9801-0042'}</p>
          <p className="text-xs text-gray-500">
            {conversa?.tipo === 'carteiro' ? 'Carteiro' : 'Destinatario'} · Carlos Mendes · CDD Sao Paulo Centro
          </p>
        </div>
        <Badge variant="info" dot>
          Bot ativo
        </Badge>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            type="button"
          >
            Assumir conversa
          </button>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50" type="button">
            Encerrar
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="flex flex-col rounded-xl bg-white shadow-card" style={{ height: 400 }}>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m, i) => {
            const isParticipante = m.de === 'participante';
            const isGestor = m.de === 'gestor';
            return (
              <div key={i} className={`flex ${isParticipante ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs rounded-2xl px-3 py-2 text-sm leading-snug lg:max-w-md ${
                    isParticipante
                      ? 'rounded-br-sm bg-[#003399] text-white'
                      : isGestor
                        ? 'rounded-bl-sm bg-[#FFD600] font-medium text-[#003399]'
                        : 'rounded-bl-sm bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.de === 'bot' && <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">Agente IA</p>}
                  {m.de === 'gestor' && <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-[#003399]/60">Gestor</p>}
                  <p className="whitespace-pre-line">{m.texto}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      isParticipante ? 'text-white/60' : isGestor ? 'text-[#003399]/50' : 'text-gray-400'
                    }`}
                  >
                    {m.hora}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input gestor */}
        <form onSubmit={enviar} className="flex gap-2 border-t border-gray-100 p-3">
          <input
            type="text"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Responder como gestor (bypassa o bot)..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
          <button type="submit" className="rounded-lg bg-[#003399] px-4 py-2 text-sm font-semibold text-white hover:bg-[#002266]">
            Enviar
          </button>
        </form>
      </div>

      {/* Metadados */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-card">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Informacoes da sessao</h3>
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
          {[
            { label: 'Inicio', value: '14:02' },
            { label: 'Duracao', value: '4 min' },
            { label: 'Msgs trocadas', value: '7' },
            { label: 'Custo LLM', value: 'US$ 0,002' },
            { label: 'Modelo usado', value: 'gpt-4o-mini' },
            { label: 'Handoffs', value: '0' },
            { label: 'Proxy ativo', value: 'Nao' },
            { label: 'Session TTL', value: '23h 56min' },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-gray-500">{f.label}</p>
              <p className="font-semibold text-gray-800">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
