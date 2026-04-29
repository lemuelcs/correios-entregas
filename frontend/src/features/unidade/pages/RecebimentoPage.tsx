import { useEffect, useState } from 'react';
import { useRecebimentoStore } from '@/stores/recebimento.store';
import { AlertBanner } from '@/shared/ui/AlertBanner';
import { Badge } from '@/shared/ui/Badge';
import { Panel } from '@/shared/ui/Panel';
import {
  recebimentoHistory as mockHistory,
  recebimentoQueue as mockQueue,
} from '../unidade.data';

export function RecebimentoPage() {
  const { ultimoScan, relatorio, loading, scanUnitizador, fetchRelatorio, fetchExcecoes } = useRecebimentoStore();
  const [scanInput, setScanInput] = useState('');

  useEffect(() => {
    fetchRelatorio();
    fetchExcecoes();
  }, [fetchRelatorio, fetchExcecoes]);

  const handleScan = () => {
    if (scanInput.trim()) {
      scanUnitizador(scanInput.trim());
      setScanInput('');
    }
  };

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const recebimentoQueue: typeof mockQueue = mockQueue;
  const recebimentoHistory: typeof mockHistory = mockHistory;

  // Derive last-scan display from store or fallback mock
  const mockLastScan = {
    code: 'BAG-SP-1042',
    expectedObjects: 438,
    origin: 'CTE Guarulhos 02',
    window: '08:20',
    responsible: 'Maria Prado',
    message: 'Lacre divergente identificado. Manifesto encaminhado para tratativa antes da liberacao da bag.',
  };
  const lastScanCode = ultimoScan?.codigo ?? mockLastScan.code;
  const lastScanMessage = mockLastScan.message;
  const lastScanExpectedObjects = ultimoScan ? String(ultimoScan.objetos.length) : String(mockLastScan.expectedObjects);
  const lastScanOrigin = mockLastScan.origin;
  const lastScanWindow = mockLastScan.window;
  const lastScanResponsible = mockLastScan.responsible;

  if (loading && !relatorio) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <AlertBanner title="Scanner preparado para a janela da manha" variant="info">
        O fluxo abaixo simula a leitura de unitizadores e o tratamento imediato de divergencias de manifesto.
      </AlertBanner>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <Panel
          title="Leitura de unitizador"
          description="Area de captura para conferencia inicial no dock de recebimento."
          actions={<Badge variant="blue">Dock 03 ativo</Badge>}
        >
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Escanear codigo do unitizador..."
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-correios-blue focus:outline-none focus:ring-1 focus:ring-correios-blue"
            />
            <button
              onClick={handleScan}
              disabled={loading}
              className="rounded-full bg-correios-blue px-5 py-2 text-sm font-semibold text-white transition hover:bg-correios-blue-dark disabled:opacity-50"
            >
              {loading ? 'Lendo...' : 'Ler'}
            </button>
          </div>

          <div className="rounded-[28px] border-2 border-dashed border-correios-blue/25 bg-correios-blue-50/55 p-6">
            <div className="rounded-[24px] bg-white p-6 shadow-inner">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-correios-blue/60">Ultima leitura</p>
              <p className="mt-2 text-2xl font-black tracking-[0.22em] text-correios-blue">{lastScanCode}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {lastScanMessage}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['Objetos previstos', lastScanExpectedObjects],
                ['Origem', lastScanOrigin],
                ['Janela', lastScanWindow],
                ['Responsavel', lastScanResponsible],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Fila de recebimento" description="Unitizadores esperados e status da conferencia inicial.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="pb-3 font-semibold">Codigo</th>
                  <th className="pb-3 font-semibold">Tipo</th>
                  <th className="pb-3 font-semibold">Origem</th>
                  <th className="pb-3 font-semibold">Objetos</th>
                  <th className="pb-3 font-semibold">ETA</th>
                  <th className="pb-3 font-semibold">Divergencia</th>
                </tr>
              </thead>
              <tbody>
                {recebimentoQueue.map((item) => (
                  <tr key={item.code} className="border-t border-slate-100">
                    <td className="py-3 font-semibold text-slate-900">{item.code}</td>
                    <td className="py-3 text-slate-600">{item.type}</td>
                    <td className="py-3 text-slate-600">{item.origin}</td>
                    <td className="py-3 text-slate-600">{item.expectedObjects}</td>
                    <td className="py-3 text-slate-600">{item.eta}</td>
                    <td className="py-3">
                      <Badge variant={item.divergence === 'Sem divergencia' ? 'success' : item.divergence === 'Aguardando leitura' ? 'info' : 'warning'}>
                        {item.divergence}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <Panel title="Historico recente" description="Eventos consolidados do recebimento para acompanhamento da equipe.">
        <div className="space-y-3">
          {recebimentoHistory.map((event) => (
            <div key={`${event.time}-${event.code}`} className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {event.time} • {event.code}
                </p>
                <p className="text-sm text-slate-500">{event.action}</p>
              </div>
              <Badge variant="neutral">{event.user}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
