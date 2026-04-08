import { useState, useEffect } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { STATUS_TEMPLATE_BADGE, TIPO_BADGE } from '@/types/comunicacao.types';
import type { TipoParticipante, TemplateHSM } from '@/types/comunicacao.types';
import { useComunicacaoStore } from '@/stores/comunicacao.store';

// ── Modal Preview ───────────────────────────────────────────────────────────

function ModalPreview({ template, onClose }: { template: TemplateHSM; onClose: () => void }) {
  function previewText(corpo: string) {
    return corpo
      .replace('{{1}}', '<strong>Joao Silva</strong>')
      .replace('{{2}}', '<strong>R-01</strong>')
      .replace('{{3}}', '<strong>07:30</strong>')
      .replace('{{4}}', '<strong>25/03</strong>');
  }

  const statusBadge = STATUS_TEMPLATE_BADGE[template.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-card-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">{template.nome}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Preview WhatsApp */}
        <div className="mb-4 rounded-xl bg-[#e8f5e9] p-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Preview no WhatsApp</p>
          <div className="max-w-xs rounded-xl bg-white px-3 py-2.5 shadow-sm">
            <p className="text-sm leading-relaxed text-gray-800" dangerouslySetInnerHTML={{ __html: previewText(template.corpo) }} />
            <p className="mt-1 text-right text-[10px] text-gray-400">14:32 ✓✓</p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex justify-between">
            <span className="text-gray-500">Nome</span>
            <code className="rounded bg-gray-100 px-1.5 font-mono">{template.nome}</code>
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
            <Badge variant={statusBadge.variant as any} size="sm">
              {statusBadge.label}
            </Badge>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 p-3">
          <p className="mb-1 text-[10px] font-medium text-gray-500">Variaveis</p>
          <div className="flex flex-wrap gap-1">
            {template.variaveis.map((v, i) => (
              <span key={i} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600">
                {v}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-[#003399] py-2.5 text-sm font-semibold text-[#003399] hover:bg-[#E6EBF7]"
          type="button"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const { templates, fetchTemplates, loading } = useComunicacaoStore();
  const [filtro, setFiltro] = useState<'todos' | TipoParticipante>('todos');
  const [preview, setPreview] = useState<TemplateHSM | null>(null);
  const [tab, setTab] = useState<'lista' | 'submeter'>('lista');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filtrados = templates.filter((t) => filtro === 'todos' || t.publico === filtro);

  const aprovados = templates.filter((t) => t.status === 'APPROVED').length;
  const pendentes = templates.filter((t) => t.status === 'PENDING').length;
  const rejeitados = templates.filter((t) => t.status === 'REJECTED').length;

  return (
    <div className="space-y-4 p-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-lg">✅</span>
          <div>
            <p className="text-xl font-black text-green-600">{aprovados}</p>
            <p className="text-xs text-gray-500">Aprovados</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-lg">⏳</span>
          <div>
            <p className="text-xl font-black text-amber-600">{pendentes}</p>
            <p className="text-xs text-gray-500">Aguardando Meta</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-lg">❌</span>
          <div>
            <p className="text-xl font-black text-red-500">{rejeitados}</p>
            <p className="text-xs text-gray-500">Rejeitados</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
        {[
          { id: 'lista' as const, l: 'Templates cadastrados' },
          { id: 'submeter' as const, l: 'Submeter novo' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-[#003399] shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
            type="button"
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'lista' && (
        <>
          {/* Filtro tipo */}
          <div className="flex gap-2">
            {[
              { v: 'todos' as const, l: 'Todos' },
              { v: 'MOTORISTA' as const, l: 'Carteiro' },
              { v: 'DESTINATARIO' as const, l: 'Destinatario' },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFiltro(f.v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filtro === f.v ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                type="button"
              >
                {f.l}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filtrados.map((t) => {
              const publico = TIPO_BADGE[t.publico] ?? TIPO_BADGE.UNKNOWN;
              const status = STATUS_TEMPLATE_BADGE[t.status];
              return (
                <div key={t.id} className="flex items-start gap-4 rounded-xl bg-white p-4 shadow-card">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <code className="rounded bg-[#E6EBF7] px-2 py-0.5 font-mono text-xs font-bold text-[#003399]">{t.nome}</code>
                      <Badge variant={publico.variant as any} size="sm">
                        {publico.label}
                      </Badge>
                      <Badge variant={status.variant as any} size="sm" dot>
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-600">{t.corpo}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.variaveis.map((v, i) => (
                        <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setPreview(t)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                      type="button"
                    >
                      Preview
                    </button>
                    {t.status === 'REJECTED' && (
                      <button
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        type="button"
                      >
                        Resubmeter
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filtrados.length === 0 && (
              <div className="py-12 text-center text-gray-400">
                <p className="text-sm">{loading ? 'Carregando templates...' : 'Nenhum template encontrado'}</p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'submeter' && (
        <div className="space-y-4 rounded-xl bg-white p-5 shadow-card">
          <div className="rounded-lg bg-[#E6EBF7] p-3 text-xs text-[#003399]">
            Templates sao submetidos a Meta via Evolution API e levam 2–5 dias uteis para aprovacao. Categoria padrao:{' '}
            <strong>UTILITY</strong> · Idioma: <strong>pt_BR</strong>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Nome do template</label>
              <input
                type="text"
                placeholder="ex: nova_tentativa_entrega"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
              />
              <p className="mt-0.5 text-[10px] text-gray-400">Apenas letras minusculas, numeros e _</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Publico-alvo</label>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                <option value="MOTORISTA">Carteiro</option>
                <option value="DESTINATARIO">Destinatario</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Corpo da mensagem</label>
            <textarea
              rows={4}
              placeholder="Use {{1}}, {{2}}, etc. para variaveis dinamicas"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
            />
          </div>
          <div className="flex gap-3 border-t border-gray-100 pt-2">
            <button className="rounded-lg bg-[#003399] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002266]" type="button">
              Submeter a Meta
            </button>
            <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50" type="button">
              Visualizar preview
            </button>
          </div>
        </div>
      )}

      {preview && <ModalPreview template={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
