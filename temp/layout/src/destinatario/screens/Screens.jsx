import { useState } from 'react'
import Badge from '../../shared/components/Badge'

// ─── Login ────────────────────────────────────────────────────────────────────
export function Login({ onNavigate }) {
  const [tab, setTab] = useState('login') // 'login' | 'rastrear'

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      {/* Hero */}
      <div className="bg-[#003399] px-6 py-8 text-center">
        <div className="w-14 h-14 bg-[#FFD600] rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-lg">
          📬
        </div>
        <h1 className="text-white text-xl font-black">Correios Entregas</h1>
        <p className="text-white/60 text-xs mt-1">Acompanhe suas encomendas</p>
      </div>

      <div className="px-6 pt-6 flex-1 space-y-4">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {[{ id: 'login', label: 'Entrar' }, { id: 'rastrear', label: 'Rastrear sem login' }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t.id ? 'bg-white text-[#003399] shadow-sm' : 'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'login' && (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">CPF ou e-mail</label>
                <input type="text" placeholder="000.000.000-00" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Senha</label>
                <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
              </div>
            </div>
            <button
              onClick={() => onNavigate('objetos')}
              className="w-full py-4 bg-[#003399] text-white font-bold text-sm rounded-xl hover:bg-[#002266] transition-colors"
            >
              Entrar
            </button>
            <button className="w-full py-3 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">
              Criar conta
            </button>
          </>
        )}

        {tab === 'rastrear' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Código de rastreio</label>
              <input type="text" placeholder="AA000000000BR" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
            </div>
            <button
              onClick={() => onNavigate('detalhe')}
              className="w-full py-4 bg-[#003399] text-white font-bold text-sm rounded-xl hover:bg-[#002266]"
            >
              🔍 Rastrear
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Meus Objetos ─────────────────────────────────────────────────────────────
const OBJETOS = [
  {
    codigo: 'AA123456789BR', tipo: 'SEDEX',  remetente: 'Amazon Brasil',
    status: 'Saiu para entrega', badge: 'info', icon: '🚚',
    previsao: 'Hoje, até 18h',
  },
  {
    codigo: 'AA987654321BR', tipo: 'PAC',    remetente: 'Magazine Luiza',
    status: 'Em trânsito', badge: 'warning', icon: '📦',
    previsao: 'Amanhã, 20/03',
  },
  {
    codigo: 'SX000001111BR', tipo: 'SEDEX',  remetente: 'Mercado Livre',
    status: 'Entregue', badge: 'success', icon: '✅',
    previsao: 'Entregue em 17/03',
  },
]

export function Objetos({ onNavigate }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-4">
      {/* Alerta saiu entrega */}
      <div className="mx-4 mt-4 bg-[#003399] rounded-xl p-3 flex items-center gap-3">
        <span className="text-2xl">🚚</span>
        <div className="flex-1">
          <p className="text-white text-xs font-bold">Saiu para entrega hoje!</p>
          <p className="text-white/70 text-[10px]">AA123456789BR · Previsão até 18h</p>
        </div>
        <button
          onClick={() => onNavigate('interacao')}
          className="bg-[#FFD600] text-[#003399] text-[10px] font-bold px-3 py-1.5 rounded-lg"
        >
          Gerenciar
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Todos os objetos ({OBJETOS.length})</p>
        <div className="space-y-2">
          {OBJETOS.map((obj) => (
            <button
              key={obj.codigo}
              onClick={() => onNavigate('detalhe')}
              className="w-full bg-white rounded-xl shadow-card p-4 text-left flex items-start gap-3"
            >
              <span className="text-2xl">{obj.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs font-mono font-semibold text-gray-700 truncate">{obj.codigo}</span>
                  <Badge variant={obj.badge} size="sm">{obj.tipo}</Badge>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-snug">{obj.status}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{obj.remetente} · {obj.previsao}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Detalhe do Objeto ────────────────────────────────────────────────────────
const TIMELINE = [
  { evento: 'OEC',   desc: 'Objeto saiu para entrega',             local: 'CDD São Paulo Centro', hora: '07:14', atual: true },
  { evento: 'RO',    desc: 'Objeto recebido na unidade de entrega', local: 'CDD São Paulo Centro', hora: 'Ontem, 22:30' },
  { evento: 'CTE',   desc: 'Objeto em transferência',              local: 'CTE São Paulo',         hora: 'Ontem, 18:45' },
  { evento: 'Postado', desc: 'Objeto postado',                     local: 'Agência Centro, SP',    hora: '15/03, 14:20' },
]

export function Detalhe({ onNavigate }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-4">
      <div className="px-4 pt-4 space-y-4">
        {/* Card principal */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-gray-600">AA123456789BR</span>
            <Badge variant="info" dot>Saiu para entrega</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'Remetente',  value: 'Amazon Brasil' },
              { label: 'Serviço',    value: 'SEDEX' },
              { label: 'Peso',       value: '1,2 kg' },
              { label: 'Previsão',   value: 'Hoje, até 18h' },
            ].map((f, i) => (
              <div key={i}>
                <p className="text-gray-500">{f.label}</p>
                <p className="font-semibold text-gray-800">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stepper de progresso */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3">Progresso</p>
          <div className="flex items-center">
            {['Postado', 'Em trânsito', 'Na unidade', 'Saiu', 'Entregue'].map((s, i) => {
              const done = i <= 3
              const active = i === 3
              return (
                <div key={i} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${active ? 'bg-[#003399] text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {done && !active ? '✓' : i + 1}
                    </div>
                    <p className={`text-[8px] mt-1 text-center w-12 ${active ? 'text-[#003399] font-bold' : done ? 'text-green-600' : 'text-gray-400'}`}>{s}</p>
                  </div>
                  {i < 4 && <div className={`flex-1 h-0.5 mb-4 ${i < 3 ? 'bg-green-500' : 'bg-gray-200'}`} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Timeline SRO */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3">Histórico de Eventos (SRO)</p>
          <div className="space-y-3">
            {TIMELINE.map((t, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${t.atual ? 'bg-[#003399]' : 'bg-gray-300'}`} />
                  {i < TIMELINE.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 mt-1" />}
                </div>
                <div className="pb-3">
                  <p className={`text-xs font-semibold ${t.atual ? 'text-[#003399]' : 'text-gray-700'}`}>{t.desc}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t.local} · {t.hora}</p>
                  <span className="text-[9px] font-mono text-gray-400">{t.evento}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => onNavigate('interacao')}
          className="w-full py-3.5 bg-[#003399] text-white text-sm font-bold rounded-xl"
        >
          Gerenciar Entrega
        </button>
      </div>
    </div>
  )
}

// ─── Gerenciar Entrega ────────────────────────────────────────────────────────
const OPCOES = [
  { id: 'reagendar',  icon: '📅', title: 'Reagendar entrega',       sub: 'Escolher nova data' },
  { id: 'terceiro',   icon: '👤', title: 'Autorizar terceiro',       sub: 'Permitir retirada por outra pessoa' },
  { id: 'redirecionar', icon: '📍', title: 'Redirecionar',          sub: 'Entregar em outro endereço' },
  { id: 'agencia',    icon: '🏢', title: 'Guardar na agência',       sub: 'Retirar pessoalmente' },
  { id: 'contatar',   icon: '📞', title: 'Contatar carteiro',        sub: 'Informações adicionais' },
]

export function Interacao({ onNavigate }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-4">
      <div className="px-4 pt-4 space-y-3">
        <div className="bg-[#E6EBF7] rounded-xl p-3">
          <p className="text-xs text-[#003399] font-semibold">AA123456789BR — Saiu para entrega</p>
          <p className="text-[10px] text-[#003399]/70 mt-0.5">Escolha uma opção abaixo para gerenciar sua entrega</p>
        </div>

        {OPCOES.map((op) => (
          <button
            key={op.id}
            onClick={() => op.id === 'reagendar' ? onNavigate('reagendar') : null}
            className="w-full bg-white rounded-xl shadow-card p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="w-10 h-10 bg-[#E6EBF7] rounded-xl flex items-center justify-center text-xl shrink-0">
              {op.icon}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">{op.title}</p>
              <p className="text-xs text-gray-500">{op.sub}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Reagendar ────────────────────────────────────────────────────────────────
const DIAS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 2, 20 + i)
  return {
    dia: d.getDate(),
    nome: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    disponivel: ![0, 6].includes(d.getDay()),
  }
}).slice(0, 7)

export function Reagendar({ onNavigate }) {
  const [selecionado, setSelecionado] = useState(null)
  const [turno, setTurno] = useState(null)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-4">
      <div className="px-4 pt-4 space-y-4">
        {/* Mini calendário */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3">Escolha a data</p>
          <div className="flex gap-2">
            {DIAS.map((d, i) => (
              <button key={i}
                onClick={() => d.disponivel && setSelecionado(i)}
                disabled={!d.disponivel}
                className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all ${
                  !d.disponivel ? 'opacity-30 cursor-not-allowed bg-gray-50' :
                  selecionado === i ? 'bg-[#003399] text-white' :
                  'bg-gray-50 hover:bg-[#E6EBF7]'
                }`}
              >
                <span className={`text-[10px] font-medium ${selecionado === i ? 'text-white/70' : 'text-gray-500'}`}>{d.nome}</span>
                <span className={`text-base font-black ${selecionado === i ? 'text-white' : 'text-gray-800'}`}>{d.dia}</span>
                <span className={`text-[9px] ${selecionado === i ? 'text-white/60' : 'text-gray-400'}`}>{d.mes}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Turno */}
        {selecionado !== null && (
          <div className="bg-white rounded-xl shadow-card p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Período</p>
            <div className="flex gap-2">
              {['Manhã (08-12h)', 'Tarde (12-18h)'].map((t) => (
                <button key={t} onClick={() => setTurno(t)}
                  className={`flex-1 py-3 rounded-xl text-xs font-semibold transition-colors ${turno === t ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {turno && (
          <button
            onClick={() => onNavigate('nps')}
            className="w-full py-4 bg-[#FFD600] text-[#003399] font-black text-sm rounded-xl"
          >
            Confirmar Reagendamento
          </button>
        )}
      </div>
    </div>
  )
}

// ─── NPS ──────────────────────────────────────────────────────────────────────
export function Nps({ onNavigate }) {
  const [nota, setNota] = useState(null)
  const [enviado, setEnviado] = useState(false)

  if (enviado) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50 px-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mb-4">✅</div>
        <h2 className="text-lg font-black text-gray-900 mb-2">Obrigado!</h2>
        <p className="text-sm text-gray-500 mb-6">Sua avaliação foi registrada.</p>
        <button onClick={() => onNavigate('objetos')} className="px-6 py-3 bg-[#003399] text-white font-bold rounded-xl text-sm">
          Voltar para Meus Objetos
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-4">
      <div className="px-4 pt-6 space-y-5">
        <div className="text-center">
          <p className="text-2xl mb-2">⭐</p>
          <h2 className="text-base font-bold text-gray-800">Como foi sua experiência?</h2>
          <p className="text-xs text-gray-500 mt-1">De 0 a 10, qual a probabilidade de recomendar os Correios?</p>
        </div>

        {/* Grid NPS */}
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 11 }, (_, i) => {
            const color = i <= 6 ? 'bg-red-100 text-red-700 border-red-200' :
                          i <= 8 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                   'bg-green-100 text-green-700 border-green-200'
            const activeColor = i <= 6 ? 'bg-red-500 text-white border-red-500' :
                                 i <= 8 ? 'bg-amber-500 text-white border-amber-500' :
                                          'bg-green-500 text-white border-green-500'
            return (
              <button key={i} onClick={() => setNota(i)}
                className={`aspect-square rounded-xl border-2 font-black text-base flex items-center justify-center transition-all ${nota === i ? activeColor : color}`}>
                {i}
              </button>
            )
          })}
        </div>

        {nota !== null && (
          <>
            <div className="flex justify-between text-[10px] text-gray-400 px-1">
              <span>Muito improvável</span>
              <span>Muito provável</span>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Comentário (opcional)</label>
              <textarea rows={3} placeholder="Conte mais sobre sua experiência..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30 resize-none" />
            </div>
            <button
              onClick={() => setEnviado(true)}
              className="w-full py-4 bg-[#003399] text-white font-bold text-sm rounded-xl"
            >
              Enviar Avaliação
            </button>
          </>
        )}
      </div>
    </div>
  )
}
