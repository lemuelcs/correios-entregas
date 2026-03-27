import { useState } from 'react'
import Badge from '../../../shared/components/Badge'

// ── dados mock ────────────────────────────────────────────────────────────────
const CONVERSAS = [
  { id: '1', participante: '+55 61 9 9801-0042', tipo: 'carteiro',     estado: 'bot_active',   msgs: 7,  ultimaMsg: 'Qual minha rota amanhã?',               ha: '2 min',   unresolved: false },
  { id: '2', participante: '+55 61 9 9234-1188', tipo: 'destinatario', estado: 'bot_active',   msgs: 3,  ultimaMsg: 'Quero reagendar minha entrega',          ha: '8 min',   unresolved: false },
  { id: '3', participante: '+55 61 9 9445-2200', tipo: 'carteiro',     estado: 'human_active', msgs: 15, ultimaMsg: 'Não consigo acessar o app',              ha: '14 min',  unresolved: true },
  { id: '4', participante: '+55 61 9 8812-3311', tipo: 'destinatario', estado: 'bot_active',   msgs: 5,  ultimaMsg: 'Autorizar vizinha a retirar',            ha: '21 min',  unresolved: false },
  { id: '5', participante: '+55 61 9 9102-4400', tipo: 'carteiro',     estado: 'opted_out',    msgs: 1,  ultimaMsg: 'SAIR',                                  ha: '45 min',  unresolved: false },
  { id: '6', participante: '+55 21 9 9777-5500', tipo: 'destinatario', estado: 'ended',        msgs: 12, ultimaMsg: '10 — excelente atendimento!',            ha: '1h',      unresolved: false },
  { id: '7', participante: '+55 61 9 9003-6611', tipo: 'carteiro',     estado: 'bot_active',   msgs: 9,  ultimaMsg: 'Tenho 3 objetos com insucesso pendente', ha: '1h 10min',unresolved: false },
  { id: '8', participante: '+55 61 9 8500-7722', tipo: 'destinatario', estado: 'human_active', msgs: 22, ultimaMsg: 'Não reconheço esse envio',               ha: '2h',      unresolved: true },
]

const ESTADO_BADGE = {
  bot_active:   { v: 'info',    l: 'Bot ativo' },
  human_active: { v: 'warning', l: '👤 Humano' },
  opted_out:    { v: 'neutral', l: 'Opt-out' },
  ended:        { v: 'neutral', l: 'Encerrado' },
}

const TIPO_BADGE = {
  carteiro:     { v: 'blue',   l: '🏍️ Carteiro' },
  destinatario: { v: 'yellow', l: '📦 Destinatário' },
}

// ── ConversasList ─────────────────────────────────────────────────────────────
export function ConversasList({ onNavigate }) {
  const [busca, setBusca]         = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const filtradas = CONVERSAS.filter(c => {
    if (busca && !c.participante.includes(busca) && !c.ultimaMsg.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false
    return true
  })

  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por número ou mensagem…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
        />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="todos">Todos os tipos</option>
          <option value="carteiro">Carteiro</option>
          <option value="destinatario">Destinatário</option>
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="todos">Todos os estados</option>
          <option value="bot_active">Bot ativo</option>
          <option value="human_active">Atendimento humano</option>
          <option value="opted_out">Opt-out</option>
          <option value="ended">Encerrado</option>
        </select>
        <span className="text-xs text-gray-500">{filtradas.length} conversa(s)</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-3 font-semibold">Participante</th>
              <th className="text-left px-4 py-3 font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold">Estado</th>
              <th className="text-left px-4 py-3 font-semibold">Última mensagem</th>
              <th className="text-right px-4 py-3 font-semibold">Msgs</th>
              <th className="text-right px-4 py-3 font-semibold">Há</th>
              <th className="text-center px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.map(c => (
              <tr key={c.id} className={`hover:bg-gray-50 ${c.unresolved ? 'bg-amber-50/30' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {c.unresolved && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                    <span className="font-mono text-xs text-gray-700">{c.participante}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={TIPO_BADGE[c.tipo].v} size="sm">{TIPO_BADGE[c.tipo].l}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ESTADO_BADGE[c.estado].v} size="sm" dot>{ESTADO_BADGE[c.estado].l}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{c.ultimaMsg}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">{c.msgs}</td>
                <td className="px-4 py-3 text-right text-[11px] text-gray-400">{c.ha}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onNavigate && onNavigate('comunicacao-conversa-detalhe', { id: c.id })}
                    className="text-xs text-[#003399] hover:underline font-medium"
                  >
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ConversaDetalhe ───────────────────────────────────────────────────────────
const MENSAGENS_MOCK = [
  { de: 'participante', texto: 'Oi, qual minha rota amanhã?', hora: '14:02', tipo: 'text' },
  { de: 'bot',          texto: '🤖 Olá Carlos! Consultando sua escala no sistema…', hora: '14:02', tipo: 'text' },
  { de: 'bot',          texto: 'Sua rota de amanhã é a **R-01**, com despacho previsto às **07:30**. Você tem 142 objetos pré-alocados. Deseja confirmar sua presença?', hora: '14:02', tipo: 'text' },
  { de: 'participante', texto: 'Sim, confirmo!', hora: '14:03', tipo: 'text' },
  { de: 'bot',          texto: '✅ Presença confirmada para R-01 em 20/03/2026. Você receberá uma notificação 30 min antes do despacho. Mais alguma dúvida?', hora: '14:03', tipo: 'text' },
  { de: 'participante', texto: 'Tenho 3 insucessos de ontem, o que fazer?', hora: '14:05', tipo: 'text' },
  { de: 'bot',          texto: '📦 Encontrei 3 objetos com BDE pendente:\n• AA123456789BR — BDE_02 (ausente) — 1ª tentativa\n• AA987654321BR — BDE_04 (endereço) — 1ª tentativa\n• SX000001111BR — BDE_07 (recusado) — 2ª tentativa (última!)\n\nDeseja reagendar algum deles?', hora: '14:05', tipo: 'text' },
]

export function ConversaDetalhe({ onNavigate }) {
  const [mensagem, setMensagem] = useState('')
  const [msgs, setMsgs] = useState(MENSAGENS_MOCK)

  function enviar(e) {
    e.preventDefault()
    if (!mensagem.trim()) return
    setMsgs(prev => [...prev, { de: 'gestor', texto: mensagem.trim(), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), tipo: 'text' }])
    setMensagem('')
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header conversa */}
      <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-4">
        <button
          onClick={() => onNavigate && onNavigate('comunicacao-conversas')}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          ←
        </button>
        <div className="w-10 h-10 rounded-full bg-[#E6EBF7] flex items-center justify-center text-[#003399] font-bold text-sm">
          🏍️
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">+55 61 9 9801-0042</p>
          <p className="text-xs text-gray-500">Carteiro · Carlos Mendes · CDD São Paulo Centro</p>
        </div>
        <Badge variant="info" dot>Bot ativo</Badge>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs border border-amber-300 text-amber-700 bg-amber-50 rounded-lg font-medium hover:bg-amber-100">
            👤 Assumir conversa
          </button>
          <button className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-medium hover:bg-gray-50">
            Encerrar
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="bg-white rounded-xl shadow-card flex flex-col" style={{ height: 400 }}>
        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.map((m, i) => {
            const isParticipante = m.de === 'participante'
            const isGestor = m.de === 'gestor'
            return (
              <div key={i} className={`flex ${isParticipante ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm leading-snug ${
                  isParticipante ? 'bg-[#003399] text-white rounded-br-sm' :
                  isGestor       ? 'bg-[#FFD600] text-[#003399] rounded-bl-sm font-medium' :
                                   'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.de === 'bot' && (
                    <p className="text-[9px] font-bold text-gray-400 mb-0.5 uppercase tracking-wide">🤖 Agente IA</p>
                  )}
                  {m.de === 'gestor' && (
                    <p className="text-[9px] font-bold text-[#003399]/60 mb-0.5 uppercase tracking-wide">👤 Gestor</p>
                  )}
                  <p className="whitespace-pre-line">{m.texto}</p>
                  <p className={`text-[10px] mt-1 text-right ${isParticipante ? 'text-white/60' : isGestor ? 'text-[#003399]/50' : 'text-gray-400'}`}>
                    {m.hora}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input gestor */}
        <form onSubmit={enviar} className="border-t border-gray-100 p-3 flex gap-2">
          <input
            type="text"
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder="Responder como gestor (bypassa o bot)…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
          <button type="submit" className="px-4 py-2 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">
            Enviar
          </button>
        </form>
      </div>

      {/* Metadados laterais */}
      <div className="bg-white rounded-xl shadow-card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Informações da sessão</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[
            { label: 'Início',         value: '14:02' },
            { label: 'Duração',        value: '4 min' },
            { label: 'Msgs trocadas',  value: '7' },
            { label: 'Custo LLM',      value: 'US$ 0,002' },
            { label: 'Modelo usado',   value: 'gpt-4o-mini' },
            { label: 'Handoffs',       value: '0' },
            { label: 'Proxy ativo',    value: 'Não' },
            { label: 'Session TTL',    value: '23h 56min' },
          ].map((f, i) => (
            <div key={i}>
              <p className="text-gray-500">{f.label}</p>
              <p className="font-semibold text-gray-800">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
