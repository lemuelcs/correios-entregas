import { useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import type { StatusInstancia } from '@/types/comunicacao.types';

// ── helpers ─────────────────────────────────────────────────────────────────

const PROVIDERS: Record<string, { label: string; models: string[] }> = {
  openai: { label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  anthropic: { label: 'Anthropic', models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'] },
  google: { label: 'Google', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] },
  openrouter: { label: 'OpenRouter', models: ['meta-llama/llama-3.3-70b', 'mistralai/mistral-7b', 'deepseek/deepseek-chat'] },
};

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

const STATUS_BADGE: Record<StatusInstancia, { variant: string; label: string }> = {
  ACTIVE: { variant: 'success', label: 'Conectado' },
  INACTIVE: { variant: 'neutral', label: 'Desconectado' },
  PENDING: { variant: 'warning', label: 'Conectando...' },
  SUSPENDED: { variant: 'danger', label: 'Suspenso' },
};

// ── Aba Conexão ─────────────────────────────────────────────────────────────

function AbaConexao() {
  const [status, setStatus] = useState<StatusInstancia>('ACTIVE');
  const [connecting, setConnecting] = useState(false);

  function handleConectar() {
    setConnecting(true);
    setStatus('PENDING');
    setTimeout(() => {
      setConnecting(false);
      setStatus('ACTIVE');
    }, 2500);
  }

  const s = STATUS_BADGE[status];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
        <span className="text-xs font-semibold text-gray-600">Status da instancia</span>
        <Badge variant={s.variant as any} dot size="md">
          {s.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { label: 'Nome da instancia (instanceName)', id: 'instanceName', type: 'text', placeholder: 'cdd_bsb_01', value: 'cdd_bsb_01' },
          { label: 'Numero de telefone', id: 'phoneNumber', type: 'tel', placeholder: '+55 61 3003-0100', value: '+55 61 3003-0100' },
          { label: 'WABA ID', id: 'wabaId', type: 'text', placeholder: '123456789012345', value: '987654321098765' },
          { label: 'Meta Access Token', id: 'metaToken', type: 'password', placeholder: '••••••••', value: 'EAAx...' },
        ].map((f) => (
          <div key={f.id}>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{f.label}</label>
            <input
              type={f.type}
              defaultValue={f.value}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#003399] focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
            />
          </div>
        ))}
      </div>

      {status === 'PENDING' && (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6">
          <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-gray-200 bg-white">
            <span className="animate-pulse text-4xl">📱</span>
          </div>
          <p className="text-center text-xs text-gray-500">
            Escaneie o QR Code com o WhatsApp Business (modo Baileys)
            <br />
            <span className="text-[10px] text-gray-400">Expira em 60 segundos</span>
          </p>
        </div>
      )}

      <div className="flex gap-3 border-t border-gray-100 pt-2">
        {status !== 'ACTIVE' ? (
          <button
            onClick={handleConectar}
            disabled={connecting}
            className="flex items-center gap-2 rounded-lg bg-[#003399] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002266] disabled:opacity-60"
            type="button"
          >
            {connecting ? 'Conectando...' : 'Conectar'}
          </button>
        ) : (
          <button
            onClick={() => setStatus('INACTIVE')}
            className="rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
            type="button"
          >
            Desconectar
          </button>
        )}
        <button className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium hover:bg-gray-50" type="button">
          Testar Conexao
        </button>
      </div>
    </div>
  );
}

// ── Aba LLM ─────────────────────────────────────────────────────────────────

function AbaLLM() {
  const [provider, setProvider] = useState('openai');
  const [modeloPrincipal, setModeloPrincipal] = useState('gpt-4o-mini');
  const [modeloComplexo, setModeloComplexo] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(500);
  const [roteamento, setRoteamento] = useState(true);
  const [chips, setChips] = useState(['endereco desconhecido', 'problema com objeto', 'reclamacao']);
  const [chipInput, setChipInput] = useState('');

  const models = PROVIDERS[provider]?.models ?? [];

  function addChip(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = chipInput.trim().replace(/,$/, '');
      if (val && !chips.includes(val)) setChips([...chips, val]);
      setChipInput('');
    }
  }

  function removeChip(c: string) {
    setChips(chips.filter((x) => x !== c));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Provider LLM</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setModeloPrincipal(PROVIDERS[e.target.value]?.models[0] ?? '');
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          >
            {Object.entries(PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Modelo principal</label>
          <select
            value={modeloPrincipal}
            onChange={(e) => setModeloPrincipal(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Modelo para casos complexos</label>
          <select
            value={modeloComplexo}
            onChange={(e) => setModeloComplexo(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          >
            <option value="">— Nao usar —</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Max Tokens (100–4000)</label>
          <input
            type="number"
            min={100}
            max={4000}
            step={50}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
        </div>
      </div>

      {/* Temperature slider */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-600">Temperature</label>
          <span className="rounded-lg bg-[#E6EBF7] px-2 py-0.5 text-xs font-bold text-[#003399]">{temperature.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="w-full accent-[#003399]"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
          <span>Deterministico (0)</span>
          <span>Criativo (1)</span>
        </div>
      </div>

      {/* Roteamento */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Roteamento por complexidade</p>
          <p className="text-[10px] text-gray-500">Usa modelo complexo quando gatilhos sao detectados</p>
        </div>
        <button
          onClick={() => setRoteamento(!roteamento)}
          className={`relative h-6 w-11 rounded-full transition-colors ${roteamento ? 'bg-[#003399]' : 'bg-gray-300'}`}
          type="button"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${roteamento ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      {/* Chips */}
      {roteamento && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Gatilhos de complexidade</label>
          <div className="flex min-h-10 flex-wrap gap-1.5 rounded-lg border border-gray-200 px-3 py-2">
            {chips.map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-full bg-[#E6EBF7] px-2 py-0.5 text-xs font-medium text-[#003399]">
                {c}
                <button onClick={() => removeChip(c)} className="text-xs leading-none text-[#003399]/60 hover:text-[#003399]" type="button">
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={chipInput}
              onChange={(e) => setChipInput(e.target.value)}
              onKeyDown={addChip}
              placeholder="Adicionar gatilho..."
              className="min-w-24 flex-1 text-xs text-gray-600 placeholder-gray-300 outline-none"
            />
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400">Pressione Enter ou virgula para adicionar</p>
        </div>
      )}

      <div className="border-t border-gray-100 pt-2">
        <button className="rounded-lg bg-[#003399] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002266]" type="button">
          Salvar Config. LLM
        </button>
      </div>
    </div>
  );
}

// ── Aba Chatwoot ────────────────────────────────────────────────────────────

function AbaChatwoot() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        A integracao com o Chatwoot e usada para handoff humano quando o bot nao consegue resolver a solicitacao.
      </div>
      {[
        { label: 'Account ID', id: 'accountId', type: 'text', placeholder: '1', value: '1' },
        { label: 'Inbox ID', id: 'inboxId', type: 'text', placeholder: '3', value: '3' },
        { label: 'API Key', id: 'apiKey', type: 'password', placeholder: '••••••••', value: 'key_abc123' },
        { label: 'URL base', id: 'url', type: 'url', placeholder: 'https://chat.correios-entregas.com', value: 'https://chat.correios-entregas.com' },
      ].map((f) => (
        <div key={f.id}>
          <label className="mb-1 block text-xs font-semibold text-gray-600">{f.label}</label>
          <input
            type={f.type}
            defaultValue={f.value}
            placeholder={f.placeholder}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
        </div>
      ))}
      <div className="flex gap-3 border-t border-gray-100 pt-2">
        <button className="rounded-lg bg-[#003399] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002266]" type="button">
          Salvar
        </button>
        <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50" type="button">
          Testar conexao
        </button>
      </div>
    </div>
  );
}

// ── Aba Horários ────────────────────────────────────────────────────────────

function AbaHorarios() {
  const [diasAtivos, setDiasAtivos] = useState([0, 1, 2, 3, 4]);
  const [maxProxy, setMaxProxy] = useState(4);
  const [maxMsgs, setMaxMsgs] = useState(50);

  function toggleDia(i: number) {
    setDiasAtivos((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Horario de inicio</label>
          <input
            type="time"
            defaultValue="07:00"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Horario de termino</label>
          <input
            type="time"
            defaultValue="18:00"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-600">Dias de operacao</label>
        <div className="flex gap-2">
          {DIAS_SEMANA.map((d, i) => (
            <button
              key={d}
              onClick={() => toggleDia(i)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                diasAtivos.includes(i) ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              type="button"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Duracao max. sessao proxy (horas)</label>
          <input
            type="number"
            min={1}
            max={24}
            value={maxProxy}
            onChange={(e) => setMaxProxy(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
          <p className="mt-0.5 text-[10px] text-gray-400">Padrao: 4h (alinhado com a CSW do WhatsApp)</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Max. mensagens por sessao proxy</label>
          <input
            type="number"
            min={5}
            max={200}
            value={maxMsgs}
            onChange={(e) => setMaxMsgs(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
          <p className="mt-0.5 text-[10px] text-gray-400">Padrao: 50 mensagens</p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-2">
        <button className="rounded-lg bg-[#003399] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002266]" type="button">
          Salvar Horarios
        </button>
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'conexao', label: 'Conexao', component: AbaConexao },
  { id: 'llm', label: 'LLM', component: AbaLLM },
  { id: 'chatwoot', label: 'Chatwoot', component: AbaChatwoot },
  { id: 'horarios', label: 'Horarios', component: AbaHorarios },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export function ConfiguracaoWhatsappPage() {
  const [tab, setTab] = useState('conexao');
  const ActiveTab = TABS.find((t) => t.id === tab)?.component ?? AbaConexao;

  return (
    <div className="space-y-4 p-6">
      <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-[#003399] shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-card">
        <ActiveTab />
      </div>
    </div>
  );
}
