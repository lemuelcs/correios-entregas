import { useState } from 'react'
import ProgressBar from '../../shared/components/ProgressBar'
import Badge from '../../shared/components/Badge'

// ─── Home ─────────────────────────────────────────────────────────────────────
export function Home({ onNavigate }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      {/* Header card azul */}
      <div className="bg-[#003399] px-4 pt-4 pb-8">
        <p className="text-white/70 text-xs">Bom dia,</p>
        <h2 className="text-white text-xl font-bold">Carlos Mendes</h2>
        <p className="text-white/60 text-xs mt-0.5">Rota R-01 · CDD São Paulo Centro</p>

        <div className="mt-4 bg-white/10 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[10px] font-medium">Objetos hoje</p>
            <p className="text-white text-2xl font-black">142</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-[10px] font-medium">Entregues</p>
            <p className="text-white text-2xl font-black">97</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-[10px] font-medium">SPH</p>
            <p className="text-[#FFD600] text-2xl font-black">18,4</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3 pb-6">
        {/* Card status rota */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">Progresso da Rota</span>
            <Badge variant="info" dot>Em rota</Badge>
          </div>
          <ProgressBar value={68} showPct color="bg-[#003399]" />
          <p className="text-xs text-gray-500 mt-2">Parada atual: Rua das Flores, 234 — Apto 42</p>
        </div>

        {/* CTA principal */}
        <button
          onClick={() => onNavigate('rota')}
          className="w-full py-4 bg-[#003399] text-white text-base font-bold rounded-xl hover:bg-[#002266] transition-colors shadow-card-md flex items-center justify-center gap-2"
        >
          🗺️ Ver Rota Atual
        </button>

        {/* Coleta */}
        <button
          onClick={() => onNavigate('coleta')}
          className="w-full py-3.5 bg-[#FFD600] text-[#003399] text-sm font-bold rounded-xl hover:bg-[#E6C000] transition-colors flex items-center justify-center gap-2"
        >
          📦 Coletar Unitizadores
        </button>

        {/* Stats do dia */}
        <div className="bg-white rounded-xl shadow-card p-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">Resumo do Dia</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Entregues',  value: '97',  color: 'text-green-600' },
              { label: 'Insucessos', value: '4',   color: 'text-red-500' },
              { label: 'Pendentes',  value: '41',  color: 'text-amber-500' },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-lg py-2">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Coleta ───────────────────────────────────────────────────────────────────
export function Coleta({ onNavigate }) {
  const [scanned, setScanned] = useState(['UNI-20240301-001'])

  const esperados = [
    { codigo: 'UNI-20240301-001', tipo: 'Bag',  qtd: 48 },
    { codigo: 'UNI-20240301-002', tipo: 'Saca', qtd: 67 },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-6">
      <div className="px-4 pt-4 space-y-4">
        {/* Scan area */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden relative h-52 flex items-center justify-center">
          <div className="absolute inset-6 border-2 border-[#FFD600] rounded-xl" />
          <div className="absolute h-0.5 bg-[#FFD600]/70 left-8 right-8 scan-line" />
          <div className="text-center">
            <p className="text-4xl">📦</p>
            <p className="text-white/40 text-xs mt-2">Aponte para o QR Code do unitizador</p>
          </div>
        </div>

        {/* Lista esperados */}
        <div className="bg-white rounded-xl shadow-card divide-y divide-gray-50">
          {esperados.map((u) => {
            const ok = scanned.includes(u.codigo)
            return (
              <div key={u.codigo} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${ok ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {ok ? '✓' : '○'}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-mono font-semibold text-gray-800">{u.codigo}</p>
                  <p className="text-[10px] text-gray-500">{u.tipo} · {u.qtd} objetos</p>
                </div>
                {ok && <Badge variant="success" size="sm">Coletado</Badge>}
              </div>
            )
          })}
        </div>

        <button
          onClick={() => onNavigate('rota')}
          disabled={scanned.length < esperados.length}
          className="w-full py-4 bg-[#003399] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-[#002266] transition-colors"
        >
          Confirmar Coleta e Iniciar Rota →
        </button>
      </div>
    </div>
  )
}

// M13 — Botão Proxy WhatsApp (Seção 14.5 do PRD-CE-M13)
// Exibido na parada atual quando o destinatário tem telefone cadastrado.
// Em produção chama: POST /api/v1/comunicacao/proxy/:unidadeId/start
function ProxyButton() {
  const [estado, setEstado] = useState('idle') // 'idle' | 'loading' | 'ativo'

  function iniciarProxy() {
    setEstado('loading')
    // Em produção: await api.post(`/comunicacao/proxy/${unidadeId}/start`, {...})
    setTimeout(() => setEstado('ativo'), 1200)
  }

  if (estado === 'ativo') {
    return (
      <div className="mt-2 px-3 py-2 bg-green-500/20 border border-green-400/40 rounded-xl flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot shrink-0" />
        <div className="flex-1">
          <p className="text-white text-xs font-bold">Canal aberto com destinatário</p>
          <p className="text-white/60 text-[10px]">Envie mensagens pelo seu WhatsApp — número do dest. protegido</p>
        </div>
        <button
          onClick={() => setEstado('idle')}
          className="text-white/60 hover:text-white text-xs"
        >
          Encerrar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={iniciarProxy}
      disabled={estado === 'loading'}
      className="w-full mt-2 py-2.5 bg-white/10 border border-white/20 text-white text-xs font-semibold rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {estado === 'loading'
        ? <><span className="animate-spin">⚙️</span> Abrindo canal…</>
        : <>📱 Chamar Destinatário pelo WhatsApp</>
      }
    </button>
  )
}

// ─── Rota em andamento ────────────────────────────────────────────────────────
export function Rota({ onNavigate }) {
  const paradas = [
    { idx: 1,  end: 'Rua das Flores, 234 — Apto 42', objetos: 3, tipo: 'PAC', dist: '0,4 km', done: false, current: true },
    { idx: 2,  end: 'Av. Paulista, 1578 — Sala 302',  objetos: 1, tipo: 'SEDEX', dist: '1,2 km', done: false },
    { idx: 3,  end: 'Rua Augusta, 89',                objetos: 2, tipo: 'PAC',   dist: '2,1 km', done: false },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-6">
      {/* Stats inline */}
      <div className="bg-[#003399] px-4 py-3 flex items-center gap-4">
        <div className="text-center">
          <p className="text-[#FFD600] text-lg font-black">29</p>
          <p className="text-white/60 text-[9px]">Restantes</p>
        </div>
        <div className="flex-1 px-2">
          <ProgressBar value={68} size="sm" color="bg-[#FFD600]" />
          <p className="text-white/60 text-[9px] mt-1 text-center">68% concluído</p>
        </div>
        <div className="text-center">
          <p className="text-white text-lg font-black">18,4</p>
          <p className="text-white/60 text-[9px]">SPH</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Parada atual — destaque */}
        {paradas.filter(p => p.current).map((p) => (
          <div key={p.idx} className="bg-[#003399] rounded-2xl p-4 text-white shadow-card-lg">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">Parada Atual</p>
            <p className="text-base font-bold leading-snug">{p.end}</p>
            <p className="text-[#FFD600] text-xs font-medium mt-1">{p.objetos} objeto(s) · {p.tipo}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onNavigate('entrega')}
                className="flex-1 py-2.5 bg-[#FFD600] text-[#003399] text-sm font-bold rounded-xl"
              >
                ✓ Registrar Entrega
              </button>
              <button
                onClick={() => onNavigate('insucesso')}
                className="flex-1 py-2.5 bg-white/10 text-white text-sm font-medium rounded-xl"
              >
                ✗ Insucesso
              </button>
            </div>
            {/* M13 — Botão Proxy WhatsApp */}
            <ProxyButton />
          </div>
        ))}

        {/* Próximas paradas */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Próximas Paradas</p>
        <div className="bg-white rounded-xl shadow-card divide-y divide-gray-50">
          {paradas.filter(p => !p.current).map((p) => (
            <div key={p.idx} className="flex items-start gap-3 px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-[#E6EBF7] text-[#003399] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {p.idx}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug">{p.end}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{p.objetos} obj · {p.tipo} · {p.dist}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Finalizar rota */}
        <button
          onClick={() => onNavigate('resumo')}
          className="w-full py-3 border-2 border-[#003399] text-[#003399] text-sm font-bold rounded-xl hover:bg-[#E6EBF7] transition-colors"
        >
          Finalizar Rota
        </button>
      </div>
    </div>
  )
}

// ─── Registrar Entrega ────────────────────────────────────────────────────────
export function Entrega({ onNavigate }) {
  const [step, setStep] = useState(0) // 0=foto, 1=scan, 2=confirmar

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-6">
      <div className="px-4 pt-4 space-y-4">
        {/* Endereço */}
        <div className="bg-white rounded-xl shadow-card p-3">
          <p className="text-[10px] text-gray-500 font-medium">Entregando em</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">Rua das Flores, 234 — Apto 42</p>
          <p className="text-xs text-gray-500">AA123456789BR · PAC · 1,2 kg</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-0">
          {['Foto POD', 'Scan', 'Confirmar'].map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex flex-col items-center ${i < 2 ? 'flex-1' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? 'bg-[#003399] text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <p className="text-[9px] text-gray-500 mt-0.5">{s}</p>
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 mb-4 ${i < step ? 'bg-[#003399]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Área de foto POD */}
        {step === 0 && (
          <>
            <div className="bg-gray-900 rounded-2xl h-48 flex flex-col items-center justify-center gap-2 cursor-pointer"
              onClick={() => setStep(1)}>
              <span className="text-4xl">📸</span>
              <p className="text-white/60 text-xs">Toque para fotografar comprovante</p>
              <p className="text-white/40 text-[10px]">(POD — Proof of Delivery)</p>
            </div>
            <button onClick={() => setStep(1)} className="w-full py-4 bg-[#003399] text-white font-bold rounded-xl">
              Tirar Foto
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="bg-gray-900 rounded-2xl overflow-hidden relative h-48 flex items-center justify-center">
              <div className="absolute inset-5 border-2 border-[#FFD600] rounded-xl" />
              <div className="absolute h-0.5 bg-[#FFD600]/70 left-7 right-7 scan-line" />
              <p className="text-white/30 text-2xl">📦</p>
            </div>
            <button onClick={() => setStep(2)} className="w-full py-4 bg-[#003399] text-white font-bold rounded-xl">
              Escanear Código do Objeto
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-sm font-semibold text-green-700">Objeto e foto confirmados</p>
              <p className="text-xs text-green-600 mt-0.5">AA123456789BR · GPS registrado</p>
            </div>
            <button
              onClick={() => onNavigate('entrega-ok')}
              className="w-full py-4 bg-green-600 text-white text-base font-black rounded-xl hover:bg-green-700"
            >
              ✓ Confirmar Entrega
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Entrega OK ───────────────────────────────────────────────────────────────
export function EntregaOk({ onNavigate }) {
  return (
    <div className="flex flex-col h-full items-center justify-center bg-gray-50 px-6 text-center pb-8">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mb-4 shadow-card-md">
        ✅
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-1">Entrega Registrada!</h2>
      <p className="text-sm text-gray-500 mb-1">AA123456789BR</p>
      <p className="text-xs text-gray-400 mb-8">Evento BDE_01 gerado · GPS confirmado · 14:32</p>

      <div className="w-full bg-white rounded-xl shadow-card p-4 mb-4 text-left">
        <p className="text-xs font-semibold text-gray-500 mb-2">Próxima parada</p>
        <p className="text-sm font-semibold text-gray-800">Av. Paulista, 1578 — Sala 302</p>
        <p className="text-xs text-gray-500 mt-0.5">SEDEX · 1 objeto · 1,2 km</p>
      </div>

      <button
        onClick={() => onNavigate('rota')}
        className="w-full py-4 bg-[#003399] text-white text-sm font-bold rounded-xl hover:bg-[#002266]"
      >
        Ir para Próxima Parada →
      </button>
    </div>
  )
}

// ─── Insucesso ────────────────────────────────────────────────────────────────
const MOTIVOS = [
  { code: 'BDE_02', label: 'Destinatário ausente' },
  { code: 'BDE_04', label: 'Endereço insuficiente/incorreto' },
  { code: 'BDE_07', label: 'Recusado pelo destinatário' },
  { code: 'BDE_10', label: 'Empresa/residência fechada' },
]

export function Insucesso({ onNavigate }) {
  const [motivo, setMotivo] = useState(null)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-6">
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-xl shadow-card p-3">
          <p className="text-[10px] text-gray-500">Objeto</p>
          <p className="text-sm font-semibold text-gray-800">AA123456789BR · Rua das Flores, 234</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Motivo do Insucesso</p>
          <div className="space-y-2">
            {MOTIVOS.map((m) => (
              <button key={m.code}
                onClick={() => setMotivo(m.code)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                  motivo === m.code
                    ? 'border-[#003399] bg-[#E6EBF7]'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${motivo === m.code ? 'border-[#003399] bg-[#003399]' : 'border-gray-300'}`}>
                  {motivo === m.code && <span className="w-2 h-2 bg-white rounded-full" />}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.label}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{m.code}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {motivo && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-700">
                ⚠️ Tentativa 1/2 — Próxima tentativa possível amanhã.
                Se 2ª tentativa falhar, será gerado evento FC_45 (devolução).
              </p>
            </div>
            <button
              onClick={() => onNavigate('rota')}
              className="w-full py-4 bg-[#003399] text-white text-sm font-bold rounded-xl"
            >
              Confirmar Insucesso e Continuar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Resumo da Rota ───────────────────────────────────────────────────────────
export function Resumo({ onNavigate }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-6">
      {/* Header resultado */}
      <div className="bg-[#003399] px-4 py-5 text-center">
        <p className="text-white/70 text-xs mb-1">Rota R-01 — Finalizada</p>
        <p className="text-5xl font-black text-white">92,9%</p>
        <p className="text-[#FFD600] text-sm font-semibold mt-1">Taxa de entrega</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats finais */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Entregues',  value: 131, color: 'text-green-600' },
            { label: 'Insucessos', value: 8,   color: 'text-red-500' },
            { label: 'Devolvidos', value: 3,   color: 'text-amber-500' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl shadow-card p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-card p-3 flex items-center justify-between">
          <span className="text-xs text-gray-600">SPH Final</span>
          <span className="text-lg font-black text-[#003399]">18,4 obj/h</span>
        </div>

        {/* Scan chegada */}
        <div className="bg-white rounded-xl shadow-card p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">📷 Escanear Chegada à Unidade</p>
          <div className="bg-gray-900 rounded-xl h-28 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-4 border border-[#FFD600] rounded-lg" />
            <p className="text-white/30">📦</p>
          </div>
          <p className="text-xs text-gray-500">Escaneie o QR da unidade para confirmar retorno (evento OEC_P ou FC_45).</p>
        </div>

        <button className="w-full py-4 bg-[#FFD600] text-[#003399] text-sm font-black rounded-xl">
          Finalizar e Encerrar Turno
        </button>
      </div>
    </div>
  )
}

// ─── Histórico ────────────────────────────────────────────────────────────────
const HISTORICO_DATA = [
  { data: '19/03', rotas: 1, entregues: 131, sph: 18.4, taxa: 92.9, fadr: 18.4 },
  { data: '18/03', rotas: 1, entregues: 118, sph: 17.2, taxa: 90.1, fadr: 17.2 },
  { data: '17/03', rotas: 1, entregues: 142, sph: 19.8, taxa: 96.6, fadr: 19.8 },
  { data: '15/03', rotas: 1, entregues: 109, sph: 15.6, taxa: 88.3, fadr: 15.6 },
]

export function Historico() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 pb-6">
      <div className="px-4 pt-4 space-y-3">
        {/* FADR destaque */}
        <div className="bg-[#003399] rounded-xl p-4 text-center">
          <p className="text-white/70 text-xs mb-1">FADR — Fator de Aproveitamento da Distribuição</p>
          <p className="text-4xl font-black text-[#FFD600]">17,8</p>
          <p className="text-white/60 text-xs">Média 30 dias · Meta: 18,0</p>
        </div>

        {/* Lista histórico */}
        <div className="bg-white rounded-xl shadow-card divide-y divide-gray-50">
          {HISTORICO_DATA.map((h) => (
            <div key={h.data} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">{h.data}</span>
                <Badge variant={h.taxa >= 95 ? 'success' : h.taxa >= 90 ? 'info' : 'warning'} size="sm">
                  {h.taxa}%
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>✅ {h.entregues} entregues</span>
                <span>⚡ SPH {h.sph}</span>
                <span>📊 FADR {h.fadr}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
