/**
 * Resultado da importação de uma saída (ADR-019): "N aceitos, M descartados" e
 * a lista das linhas que não entraram (linha, rota, código e motivo). Sem
 * prévia, este é o único lugar em que um telefone errado ou um código inválido
 * aparece: por isso o bloco fica em destaque quando há descartes.
 */
import { useId, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SaidaDoDia } from '../entregas.types';
import { motivoDoDescarte, plural } from '../saidas';
import { Botao } from './ui';

export function ResumoImportacao({ saidas, agregado }: { saidas: SaidaDoDia[]; agregado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const listaId = useId();
  const aceitos = saidas.reduce((a, s) => a + s.aceitos, 0);
  const descartados = saidas.reduce((a, s) => a + s.descartados, 0);
  const descartes = saidas.flatMap((s) => s.descartes ?? []);
  const frase = `${plural(aceitos, 'aceito', 'aceitos')}, ${descartados === 0 ? 'nenhum descartado' : plural(descartados, 'descartado', 'descartados')}`;

  if (descartados === 0) {
    return (
      <p data-resumo-importacao className="m-0 flex items-center gap-2 text-[15px] font-semibold text-ce-concluido">
        <CheckCircle2 size={18} aria-hidden="true" /> {frase}
      </p>
    );
  }

  return (
    <section
      data-resumo-importacao
      aria-label="Resultado da importação"
      className="flex flex-col gap-3 rounded-xl border border-ce-corrigir bg-ce-corrigir-bg px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5 text-ce-corrigir">
          <AlertTriangle size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <strong className="text-[17px]">{frase}</strong>
            <span className="text-sm text-ce-tinta-2">
              {descartados === 1 ? 'A linha descartada não entrou' : 'As linhas descartadas não entraram'} em nenhuma rota: o destinatário não será avisado.
              Corrija o arquivo e importe a saída de novo.
            </span>
          </div>
        </div>
        {agregado ? (
          <span className="text-sm text-ce-tinta-2">Escolha uma unidade para ver as linhas descartadas.</span>
        ) : (
          <Botao variante="secundario" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-controls={listaId}>
            {aberto ? 'Ocultar linhas descartadas' : `Ver linhas descartadas (${descartados})`}
          </Botao>
        )}
      </div>
      {aberto && !agregado && (
        <div id={listaId} className="max-h-[420px] overflow-auto rounded-lg border border-ce-linha bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Linhas descartadas na importação</caption>
            <thead className="sticky top-0 bg-ce-linha-fraca text-[13px] text-ce-tinta-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Linha</th>
                <th scope="col" className="px-3 py-2 font-semibold">Rota</th>
                <th scope="col" className="px-3 py-2 font-semibold">Código</th>
                <th scope="col" className="px-3 py-2 font-semibold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {descartes.map((d) => (
                <tr key={`${d.n}-${d.codigo}`} data-descarte={d.n} className="border-t border-ce-linha-fraca">
                  <td className="px-3 py-2 tabular-nums">{d.n}</td>
                  <td className="px-3 py-2 font-codigo">{d.rota ?? '—'}</td>
                  <td className="px-3 py-2 font-codigo">{d.codigo || '—'}</td>
                  <td className="px-3 py-2">{motivoDoDescarte(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
