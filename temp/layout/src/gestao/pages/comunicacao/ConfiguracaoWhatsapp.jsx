import { useState } from 'react'
import Badge from '../../../shared/components/Badge'

// ── helpers ───────────────────────────────────────────────────────────────────
const PROVIDERS = {
  openai:     { label: 'OpenAI',     models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  anthropic:  { label: 'Anthropic',  models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'] },
  google:     { label: 'Google',     models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] },
  openrouter: { label: 'OpenRouter', models: ['meta-llama/llama-3.3-70b', 'mistralai/mistral-7b', 'deepseek/deepseek-chat'] },
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ── subcomponentes de aba ─────────────────────────────────────────────────────
function AbaConexao() {
  const [status, setStatus] = useState('ACTIVE') // 'ACTIVE' | 'INACTIVE' | 'PENDING'
  const [connecting, setConnecting] = useState(false)

  function handleConectar() {
    setConnecting(true)
    setStatus('PENDING')
    setTimeout(() => { setConnecting(false); setStatus('ACTIVE') }, 2500)
  }

  const STATUS_BADGE = {
    ACTIVE:   { v: 'success', l: 'Conectado' },
    INACTIVE: { v: 'neutral', l: 'Desconectado' },
    PENDING:  { v: 'warning', l: 'Conectando…' },
    SUSPENDED:{ v: 'danger',  l: 'Suspenso' },
  }
  const s = STATUS_BADGE[status]

  return (
    <div className="space-y-5">
      {/* Status badge */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-xs font-semibold text-gray-600">Status da instância</span>
        <Badge variant={s.v} dot size="md">{s.l}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Nome da instância (instanceName)', id: 'instanceName', type: 'text',     placeholder: 'cdd_bsb_01', value: 'cdd_bsb_01' },
          { label: 'Número de telefone',               id: 'phoneNumber',  type: 'tel',      placeholder: '+55 61 3003-0100', value: '+55 61 3003-0100' },
          { label: 'WABA ID',                          id: 'wabaId',       type: 'text',     placeholder: '123456789012345', value: '987654321098765' },
          { label: 'Meta Access Token',                id: 'metaToken',    type: 'password', placeholder: '••••••••••••••••', value: 'EAAx...' },
        ].map((f) => (
          <div key={f.id}>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{f.label}</label>
            <input
              type={f.type}
              defaultValue={f.value}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30 focus:border-[#003399]"
            />
          </div>
        ))}
      </div>

      {/* QR Code placeholder */}
      {status === 'PENDING' && (
        <div className="flex flex-col items-center gap-2 p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <div className="w-32 h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <span className="text-4xl animate-pulse">📱</span>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Escaneie o QR Code com o WhatsApp Business (modo Baileys)<br/>
            <span className="text-[10px] text-gray-400">Expira em 60 segundos</span>
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        {status !== 'ACTIVE' ? (
          <button
            onClick={handleConectar}
            disabled={connecting}
            className="px-5 py-2.5 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266] disabled:opacity-60 flex items-center gap-2"
          >
            {connecting ? <><span className="animate-spin">⚙️</span> Conectando…</> : '🔗 Conectar'}
          </button>
        ) : (
          <button
            onClick={() => setStatus('INACTIVE')}
            className="px-5 py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 hover:bg-red-100"
          >
            🔌 Desconectar
          </button>
        )}
        <button className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
          Testar Conexão
        </button>
      </div>
    </div>
  )
}

function AbaLLM() {
  const [provider, setProvider]     = useState('openai')
  const [modeloPrincipal, setModeloPrincipal] = useState('gpt-4o-mini')
  const [modeloComplexo, setModeloComplexo]   = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.3)
  const [maxTokens, setMaxTokens]     = useState(500)
  const [roteamento, setRoteamento]   = useState(true)
  const [chips, setChips]             = useState(['endereço desconhecido', 'problema com objeto', 'reclamação'])
  const [chipInput, setChipInput]     = useState('')

  const models = PROVIDERS[provider]?.models || []

  function addChip(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = chipInput.trim().replace(/,$/, '')
      if (val && !chips.includes(val)) setChips([...chips, val])
      setChipInput('')
    }
  }
  function removeChip(c) { setChips(chips.filter(x => x !== c)) }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Provider */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Provider LLM</label>
          <select
            value={provider}
            onChange={e => { setProvider(e.target.value); setModeloPrincipal(PROVIDERS[e.target.value]?.models[0]) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          >
            {Object.entries(PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {/* Modelo principal */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Modelo principal</label>
          <select
            value={modeloPrincipal}
            onChange={e => setModeloPrincipal(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          >
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {/* Modelo complexo */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Modelo para casos complexos</label>
          <select
            value={modeloComplexo}
            onChange={e => setModeloComplexo(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          >
            <option value="">— Não usar —</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {/* Max tokens */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Max Tokens (100–4000)</label>
          <input
            type="number" min={100} max={4000} step={50}
            value={maxTokens}
            onChange={e => setMaxTokens(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
        </div>
      </div>

      {/* Temperature slider */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-semibold text-gray-600">Temperature</label>
          <span className="text-xs font-bold text-[#003399] bg-[#E6EBF7] px-2 py-0.5 rounded-lg">{temperature.toFixed(1)}</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.1}
          value={temperature}
          onChange={e => setTemperature(Number(e.target.value))}
          className="w-full accent-[#003399]"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>Determinístico (0)</span>
          <span>Criativo (1)</span>
        </div>
      </div>

      {/* Roteamento por complexidade */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-700">Roteamento por complexidade</p>
          <p className="text-[10px] text-gray-500">Usa modelo complexo quando gatilhos são detectados</p>
        </div>
        <button
          onClick={() => setRoteamento(!roteamento)}
          className={`w-11 h-6 rounded-full transition-colors ${roteamento ? 'bg-[#003399]' : 'bg-gray-300'} relative`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${roteamento ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Chips */}
      {roteamento && (
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Gatilhos de complexidade</label>
          <div className="border border-gray-200 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 min-h-10">
            {chips.map(c => (
              <span key={c} className="bg-[#E6EBF7] text-[#003399] text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                {c}
                <button onClick={() => removeChip(c)} className="text-[#003399]/60 hover:text-[#003399] text-xs leading-none">×</button>
              </span>
            ))}
            <input
              type="text"
              value={chipInput}
              onChange={e => setChipInput(e.target.value)}
              onKeyDown={addChip}
              placeholder="Adicionar gatilho…"
              className="text-xs text-gray-600 placeholder-gray-300 outline-none flex-1 min-w-24"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Pressione Enter ou vírgula para adicionar</p>
        </div>
      )}

      <div className="pt-2 border-t border-gray-100">
        <button className="px-5 py-2.5 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">
          Salvar Config. LLM
        </button>
      </div>
    </div>
  )
}

function AbaChatwoot() {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        ⚠️ A integração com o Chatwoot é usada para handoff humano quando o bot não consegue resolver a solicitação.
      </div>
      {[
        { label: 'Account ID',  id: 'accountId', type: 'text',     placeholder: '1', value: '1' },
        { label: 'Inbox ID',    id: 'inboxId',   type: 'text',     placeholder: '3', value: '3' },
        { label: 'API Key',     id: 'apiKey',    type: 'password', placeholder: '••••••••', value: 'key_abc123' },
        { label: 'URL base',    id: 'url',       type: 'url',      placeholder: 'https://chat.correios-entregas.com', value: 'https://chat.correios-entregas.com' },
      ].map(f => (
        <div key={f.id}>
          <label className="text-xs font-semibold text-gray-600 block mb-1">{f.label}</label>
          <input type={f.type} defaultValue={f.value} placeholder={f.placeholder}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
        </div>
      ))}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button className="px-5 py-2.5 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">Salvar</button>
        <button className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Testar conexão</button>
      </div>
    </div>
  )
}

function AbaHorarios() {
  const [diasAtivos, setDiasAtivos] = useState([0, 1, 2, 3, 4]) // seg–sex
  const [maxProxy, setMaxProxy]     = useState(4)
  const [maxMsgs, setMaxMsgs]       = useState(50)

  function toggleDia(i) {
    setDiasAtivos(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Horário de início</label>
          <input type="time" defaultValue="07:00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Horário de término</label>
          <input type="time" defaultValue="18:00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-2">Dias de operação</label>
        <div className="flex gap-2">
          {DIAS_SEMANA.map((d, i) => (
            <button key={d} onClick={() => toggleDia(i)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                diasAtivos.includes(i) ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">
            Duração máx. sessão proxy (horas)
          </label>
          <input type="number" min={1} max={24} value={maxProxy} onChange={e => setMaxProxy(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
          <p className="text-[10px] text-gray-400 mt-0.5">Padrão: 4h (alinhado com a CSW do WhatsApp)</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">
            Máx. mensagens por sessão proxy
          </label>
          <input type="number" min={5} max={200} value={maxMsgs} onChange={e => setMaxMsgs(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
          <p className="text-[10px] text-gray-400 mt-0.5">Padrão: 50 mensagens</p>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <button className="px-5 py-2.5 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">
          Salvar Horários
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'conexao',   label: '🔗 Conexão',   component: AbaConexao },
  { id: 'llm',       label: '🤖 LLM',        component: AbaLLM },
  { id: 'chatwoot',  label: '💬 Chatwoot',   component: AbaChatwoot },
  { id: 'horarios',  label: '⏰ Horários',   component: AbaHorarios },
]

export default function ConfiguracaoWhatsapp() {
  const [tab, setTab] = useState('conexao')
  const ActiveTab = TABS.find(t => t.id === tab)?.component || AbaConexao

  return (
    <div className="p-6 space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-[#003399] shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-card p-5">
        <ActiveTab />
      </div>
    </div>
  )
}
