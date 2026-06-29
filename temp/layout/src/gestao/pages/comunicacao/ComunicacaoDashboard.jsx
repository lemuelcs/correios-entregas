import { useState } from 'react'
import KpiCard from '../../../shared/components/KpiCard'
import Badge from '../../../shared/components/Badge'

// ── Dados mock ────────────────────────────────────────────────────────────────
const INSTANCE_STATUS = 'ACTIVE' // 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

const INSTANCE_BADGE = {
  ACTIVE:    { variant: 'success', label: 'ACTIVE — Conectado' },
  INACTIVE:  { variant: 'neutral', label: 'INACTIVE — Desconectado' },
  SUSPENDED: { variant: 'danger',  label: 'SUSPENDED — Suspenso' },
}

// Gráfico: 30 dias de mensagens recebidas/enviadas
const CHART_DATA = Array.from({ length: 30 }, (_, i) => ({
  dia: i + 1,
  recebidas: Math.floor(Math.random() * 80 + 30),
  enviadas:  Math.floor(Math.random() * 120 + 60),
}))

const ULTIMAS_CONVERSAS = [
  { participante: '+55 61 9 9801-****', tipo: 'carteiro',     estado: 'bot_active',   ultimaMsg: 'Qual minha rota amanhã?',                  ha: '2 min' },
  { participante: '+55 61 9 9234-****', tipo: 'destinatario', estado: 'bot_active',   ultimaMsg: 'Quero reagendar minha entrega',             ha: '8 min' },
  { participante: '+55 61 9 9445-****', tipo: 'carteiro',     estado: 'human_active', ultimaMsg: 'Não consigo acessar o app',                 ha: '14 min' },
  { participante: '+55 61 9 8812-****', tipo: 'destinatario', estado: 'bot_active',   ultimaMsg: 'Autorizar vizinha a retirar',               ha: '21 min' },
  { participante: '+55 61 9 9102-****', tipo: 'carteiro',     estado: 'opted_out',    ultimaMsg: 'SAIR',                                     ha: '45 min' },
  { participante: '+55 21 9 9777-****', tipo: 'destinatario', estado: 'ended',        ultimaMsg: '10 — excelente atendimento!',               ha: '1h' },
  { participante: '+55 61 9 9003-****', tipo: 'carteiro',     estado: 'bot_active',   ultimaMsg: 'Tenho 3 objetos com insucesso pendente',    ha: '1h 10min' },
  { participante: '+55 61 9 8500-****', tipo: 'destinatario', estado: 'human_active', ultimaMsg: 'Não reconheço esse envio',                  ha: '2h' },
  { participante: '+55 61 9 9311-****', tipo: 'destinatario', estado: 'bot_active',   ultimaMsg: 'Quando chega meu SEDEX?',                   ha: '2h 30min' },
  { participante: '+55 61 9 8991-****', tipo: 'carteiro',     estado: 'ended',        ultimaMsg: 'OK, confirmado!',                          ha: '3h' },
]

const ESTADO_BADGE = {
  bot_active:   { variant: 'info',    label: 'Bot ativo' },
  human_active: { variant: 'warning', label: 'Humano' },
  opted_out:    { variant: 'neutral', label: 'Opt-out' },
  ended:        { variant: 'neutral', label: 'Encerrado' },
}

const TIPO_BADGE = {
  carteiro:     { variant: 'blue',   label: '🏍️ Carteiro' },
  destinatario: { variant: 'yellow', label: '📦 Destinatário' },
}

// Mini LineChart SVG
function LineChart({ data }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.recebidas, d.enviadas)))
  const W = 560
  const H = 100
  const pad = 8

  function toY(val) {
    return H - pad - ((val / maxVal) * (H - pad * 2))
  }
  function toX(i) {
    return pad + (i / (data.length - 1)) * (W - pad * 2)
  }

  const pathRecebidas = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.recebidas)}`).join(' ')
  const pathEnviadas  = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.enviadas)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={pad} y1={pad + p * (H - pad * 2)} x2={W - pad} y2={pad + p * (H - pad * 2)}
          stroke="#F3F4F6" strokeWidth="1" />
      ))}
      {/* Enviadas */}
      <path d={pathEnviadas} fill="none" stroke="#003399" strokeWidth="2" strokeLinejoin="round" />
      {/* Recebidas */}
      <path d={pathRecebidas} fill="none" stroke="#FFD600" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
    </svg>
  )
}

export default function ComunicacaoDashboard({ onNavigate }) {
  const inst = INSTANCE_BADGE[INSTANCE_STATUS]

  return (
    <div className="p-6 space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Conversas Ativas"      value="23"    accent="blue"   delta="agora" deltaPos />
        <KpiCard label="Resolução Bot (24h)"   value="76"    unit="%" accent="green" delta="+4% vs ontem" deltaPos />
        <KpiCard label="Custo LLM (mês)"       value="R$ 84" accent="yellow" delta="meta: R$ 150/mês" deltaPos />
        <KpiCard label="Sessões Proxy Ativas"  value="4"     accent="blue"   />
      </div>

      {/* Status instância + gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Status Evolution */}
        <div className="bg-white rounded-xl shadow-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">📡 Instância WhatsApp</h2>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">💬</span>
            <div className="flex-1">
              <p className="text-xs font-mono font-semibold text-gray-700">cdd_bsb_01</p>
              <p className="text-[10px] text-gray-500">+55 61 3003-0100</p>
            </div>
            <Badge variant={inst.variant} dot>{inst.label}</Badge>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Última mensagem recebida</span>
              <span className="font-medium text-gray-700">há 2 min</span>
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
          <div className="pt-2 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => onNavigate && onNavigate('comunicacao-config')}
              className="flex-1 py-2 text-xs font-semibold text-[#003399] border border-[#003399] rounded-lg hover:bg-[#E6EBF7] transition-colors"
            >
              ⚙️ Configurar
            </button>
            <button
              onClick={() => onNavigate && onNavigate('comunicacao-conversas')}
              className="flex-1 py-2 text-xs font-semibold bg-[#003399] text-white rounded-lg hover:bg-[#002266] transition-colors"
            >
              💬 Conversas
            </button>
          </div>
        </div>

        {/* Gráfico 30 dias */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Mensagens — Últimos 30 dias</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-[#003399] inline-block rounded" />Enviadas
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-[#FFD600] inline-block rounded border-dashed border border-[#E6C000]" />Recebidas
              </span>
            </div>
          </div>
          <LineChart data={CHART_DATA} />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
            <span>Dia 1</span>
            <span>Dia 15</span>
            <span>Hoje</span>
          </div>
        </div>
      </div>

      {/* Tabela últimas conversas */}
      <div className="bg-white rounded-xl shadow-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Últimas 10 Conversas</h2>
          <button
            onClick={() => onNavigate && onNavigate('comunicacao-conversas')}
            className="text-xs text-[#003399] font-medium hover:underline"
          >
            Ver todas →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-semibold">Participante</th>
                <th className="text-left px-4 py-2.5 font-semibold">Tipo</th>
                <th className="text-left px-4 py-2.5 font-semibold">Estado</th>
                <th className="text-left px-4 py-2.5 font-semibold">Última Mensagem</th>
                <th className="text-right px-4 py-2.5 font-semibold">Há</th>
                <th className="text-center px-4 py-2.5 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ULTIMAS_CONVERSAS.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{c.participante}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={TIPO_BADGE[c.tipo].variant} size="sm">{TIPO_BADGE[c.tipo].label}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={ESTADO_BADGE[c.estado].variant} size="sm" dot>{ESTADO_BADGE[c.estado].label}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate">{c.ultimaMsg}</td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-gray-400">{c.ha}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => onNavigate && onNavigate('comunicacao-conversa-detalhe')}
                      className="text-xs text-[#003399] hover:underline font-medium"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
