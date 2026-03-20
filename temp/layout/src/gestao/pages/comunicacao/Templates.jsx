import { useState } from 'react'
import Badge from '../../../shared/components/Badge'

// ── dados mock baseados no PRD seção 13 ───────────────────────────────────────
const TEMPLATES = [
  // Carteiros
  {
    id: 't1', nome: 'rota_disponivel', publico: 'carteiro',
    status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} código rota', '{{3}} horário despacho'],
    corpo: '🗺️ Olá, {{1}}! Sua rota {{2}} está disponível para coleta a partir de {{3}}. Acesse o app para confirmar.',
  },
  {
    id: 't2', nome: 'escala_publicada', publico: 'carteiro',
    status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} período', '{{3}} dias'],
    corpo: '📅 {{1}}, sua escala para {{2}} foi publicada. Dias: {{3}}. Responda aqui se tiver dúvidas.',
  },
  {
    id: 't3', nome: 'aviso_operacional', publico: 'carteiro',
    status: 'PENDING', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} assunto', '{{3}} instrução'],
    corpo: '⚠️ Aviso para {{1}}: {{2}}. {{3}}. Confirme o recebimento respondendo OK.',
  },
  {
    id: 't4', nome: 'insucesso_pendente', publico: 'carteiro',
    status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} qtd', '{{3}} prazo'],
    corpo: '📦 {{1}}, você tem {{2}} objeto(s) com insucesso pendente até {{3}}. Acesse o app para reagendar.',
  },
  // Destinatários
  {
    id: 't5', nome: 'entrega_iniciada', publico: 'destinatario',
    status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} código rastreio', '{{3}} estimativa'],
    corpo: '🚚 {{1}}, seu objeto {{2}} saiu para entrega! Previsão: hoje até {{3}}. Responda AJUDA para interagir.',
  },
  {
    id: 't6', nome: 'tentativa_insucesso', publico: 'destinatario',
    status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} código', '{{3}} prazo reagendamento'],
    corpo: '📦 {{1}}, tentamos entregar {{2}} mas não encontramos ninguém. Reagende até {{3}} respondendo REAGENDAR.',
  },
  {
    id: 't7', nome: 'entrega_confirmada', publico: 'destinatario',
    status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} código'],
    corpo: '✅ {{1}}, seu objeto {{2}} foi entregue com sucesso! Como foi sua experiência? Responda com uma nota de 1 a 10.',
  },
  {
    id: 't8', nome: 'aguardando_retirada', publico: 'destinatario',
    status: 'PENDING', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} código', '{{3}} unidade', '{{4}} prazo'],
    corpo: '📮 {{1}}, seu objeto {{2}} aguarda retirada na unidade {{3}} até {{4}}. Horário: seg-sex 8h–18h, sáb 8h–12h.',
  },
  {
    id: 't9', nome: 'carteiro_contato', publico: 'destinatario',
    status: 'REJECTED', categoria: 'UTILITY', idioma: 'pt_BR',
    variaveis: ['{{1}} nome', '{{2}} código'],
    corpo: '📲 {{1}}, o carteiro responsável pelo objeto {{2}} tentará contato. As mensagens são anônimas por segurança.',
  },
]

const STATUS_BADGE = {
  APPROVED: { v: 'success', l: 'Aprovado' },
  PENDING:  { v: 'warning', l: 'Aguardando Meta' },
  REJECTED: { v: 'danger',  l: 'Rejeitado' },
}

const PUBLICO_BADGE = {
  carteiro:     { v: 'blue',   l: '🏍️ Carteiro' },
  destinatario: { v: 'yellow', l: '📦 Destinatário' },
}

function ModalPreview({ template, onClose }) {
  function previewText(corpo) {
    return corpo
      .replace('{{1}}', '<strong>João Silva</strong>')
      .replace('{{2}}', '<strong>R-01</strong>')
      .replace('{{3}}', '<strong>07:30</strong>')
      .replace('{{4}}', '<strong>25/03</strong>')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">{template.nome}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">×</button>
        </div>

        {/* Preview WhatsApp */}
        <div className="bg-[#e8f5e9] rounded-xl p-4 mb-4">
          <p className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wide">Preview no WhatsApp</p>
          <div className="bg-white rounded-xl px-3 py-2.5 shadow-sm max-w-xs">
            <p className="text-sm text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: previewText(template.corpo) }} />
            <p className="text-[10px] text-gray-400 text-right mt-1">14:32 ✓✓</p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex justify-between">
            <span className="text-gray-500">Nome</span>
            <code className="font-mono bg-gray-100 px-1.5 rounded">{template.nome}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Categoria</span>
            <span>{template.categoria}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Idioma</span>
            <span>{template.idioma}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status Meta</span>
            <Badge variant={STATUS_BADGE[template.status].v} size="sm">{STATUS_BADGE[template.status].l}</Badge>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-500 font-medium mb-1">Variáveis</p>
          <div className="flex flex-wrap gap-1">
            {template.variaveis.map((v, i) => (
              <span key={i} className="bg-white border border-gray-200 text-xs text-gray-600 px-2 py-0.5 rounded-full">{v}</span>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-4 py-2.5 text-sm font-semibold text-[#003399] border border-[#003399] rounded-xl hover:bg-[#E6EBF7]">
          Fechar
        </button>
      </div>
    </div>
  )
}

export default function Templates() {
  const [filtro, setFiltro]   = useState('todos')
  const [preview, setPreview] = useState(null)
  const [tab, setTab]         = useState('lista') // 'lista' | 'submeter'

  const filtrados = TEMPLATES.filter(t => filtro === 'todos' || t.publico === filtro)

  const aprovados = TEMPLATES.filter(t => t.status === 'APPROVED').length
  const pendentes = TEMPLATES.filter(t => t.status === 'PENDING').length
  const rejeitados = TEMPLATES.filter(t => t.status === 'REJECTED').length

  return (
    <div className="p-6 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-lg">✅</span>
          <div><p className="text-xl font-black text-green-600">{aprovados}</p><p className="text-xs text-gray-500">Aprovados</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-lg">⏳</span>
          <div><p className="text-xl font-black text-amber-600">{pendentes}</p><p className="text-xs text-gray-500">Aguardando Meta</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-lg">❌</span>
          <div><p className="text-xl font-black text-red-500">{rejeitados}</p><p className="text-xs text-gray-500">Rejeitados</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ id: 'lista', l: '📋 Templates cadastrados' }, { id: 'submeter', l: '➕ Submeter novo' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-[#003399] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'lista' && (
        <>
          {/* Filtro tipo */}
          <div className="flex gap-2">
            {[{ v: 'todos', l: 'Todos' }, { v: 'carteiro', l: '🏍️ Carteiro' }, { v: 'destinatario', l: '📦 Destinatário' }].map(f => (
              <button key={f.v} onClick={() => setFiltro(f.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filtro === f.v ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.l}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filtrados.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-card p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <code className="text-xs font-mono font-bold text-[#003399] bg-[#E6EBF7] px-2 py-0.5 rounded">{t.nome}</code>
                    <Badge variant={PUBLICO_BADGE[t.publico].v} size="sm">{PUBLICO_BADGE[t.publico].l}</Badge>
                    <Badge variant={STATUS_BADGE[t.status].v} size="sm" dot>{STATUS_BADGE[t.status].l}</Badge>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{t.corpo}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {t.variaveis.map((v, i) => (
                      <span key={i} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{v}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setPreview(t)} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
                    Preview
                  </button>
                  {t.status === 'REJECTED' && (
                    <button className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">
                      Resubmeter
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'submeter' && (
        <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
          <div className="p-3 bg-[#E6EBF7] rounded-lg text-xs text-[#003399]">
            ℹ️ Templates são submetidos à Meta via Evolution API e levam 2–5 dias úteis para aprovação. Categoria padrão: <strong>UTILITY</strong> · Idioma: <strong>pt_BR</strong>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Nome do template</label>
              <input type="text" placeholder="ex: nova_tentativa_entrega" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
              <p className="text-[10px] text-gray-400 mt-0.5">Apenas letras minúsculas, números e _</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Público-alvo</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="carteiro">Carteiro</option>
                <option value="destinatario">Destinatário</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Corpo da mensagem</label>
            <textarea rows={4} placeholder="Use {{1}}, {{2}}, etc. para variáveis dinâmicas"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30 resize-none" />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button className="px-5 py-2.5 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">
              Submeter à Meta
            </button>
            <button className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Visualizar preview
            </button>
          </div>
        </div>
      )}

      {preview && <ModalPreview template={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
