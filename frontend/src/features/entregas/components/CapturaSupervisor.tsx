/**
 * Extensões da captura do rótulo nas telas do supervisor (task_06 da captura, ADR-014):
 * origem do pacote, selo "código digitado", histórico, foto do rótulo e remoção na lista
 * do distrito; pendências de conferência e transferências no quadro.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ApiError } from '@/services/api';
import { entregasApi } from '../entregas.api';
import type { CartaoDistrito, EventoHistorico, HistoricoPacote, OrigemPacote, PacoteDistrito, TransferenciaQuadro } from '../entregas.types';
import { avisarErro, formatarHora, formatarWhatsapp, mensagemDeErro } from '../mensagens';
import { Botao, Carregando, Dialogo, Pilula } from './ui';

// ——— Textos ———————————————————————————————————————————————————————————

export const ORIGEM_PACOTE: Record<OrigemPacote, { rotulo: string; classe: string }> = {
  PLANILHA: { rotulo: 'Planilha', classe: 'bg-ce-linha-fraca text-ce-tinta-2' },
  FOTO: { rotulo: 'Foto', classe: 'bg-ce-liberado-bg text-ce-liberado' },
  PLANILHA_FOTO: { rotulo: 'Planilha + foto', classe: 'bg-ce-interagindo-bg text-ce-interagindo' },
};

const CAMPOS: Record<string, string> = {
  codigo: 'Código',
  nome: 'Nome',
  whatsapp: 'WhatsApp',
  cep: 'CEP',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
  enderecoTexto: 'Endereço',
  referencia: 'Referência',
  origem: 'Origem',
};

/** `2026-10-30T06:00:00Z` → `30/10` (horário de Brasília). */
export function formatarDiaMes(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

function valorLegivel(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'whatsapp' && typeof v === 'string') return formatarWhatsapp(v);
  if (campo === 'origem' && typeof v === 'string') return ORIGEM_PACOTE[v as OrigemPacote]?.rotulo ?? v;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function descreverEvento(e: EventoHistorico): string {
  const d = e.dados ?? {};
  switch (e.tipo) {
    case 'CAPTURA_CRIADO': return 'Capturado pela foto';
    case 'CAPTURA_ATUALIZADO': return 'Dados atualizados pela foto';
    case 'TRANSFERIDO': return `Transferido de ${String(d.de ?? '?')} para ${String(d.para ?? '?')}`;
    case 'DESFEITO': return 'Captura desfeita pelo carteiro';
    case 'WHATSAPP_ALTERADO': return 'WhatsApp alterado';
    case 'REMOVIDO': return 'Removido do distrito';
    default: {
      const t = e.tipo.replace(/_/g, ' ').toLowerCase();
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
  }
}

// ——— Lista de pacotes ————————————————————————————————————————————————

/** Chip de origem e selo "código digitado" (US-019 AC-1 e AC-3). */
export function OrigemDoPacote({ p }: { p: PacoteDistrito }) {
  if (!p.origem && !p.codigoDigitado) return null;
  const origem = p.origem ? ORIGEM_PACOTE[p.origem] : null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {origem && (
        <Pilula classe={origem.classe} className="!px-2 !py-0.5 !text-xs">
          <span className="sr-only">Origem: </span>{origem.rotulo}
        </Pilula>
      )}
      {p.codigoDigitado && <Pilula classe="bg-ce-corrigir-bg text-ce-corrigir" className="!px-2 !py-0.5 !text-xs">código digitado</Pilula>}
    </div>
  );
}

export function DialogoHistorico({ pacote, unidadeId, aoFechar }: { pacote: PacoteDistrito | null; unidadeId?: string; aoFechar: () => void }) {
  const [historico, setHistorico] = useState<HistoricoPacote | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    if (!pacote) return undefined;
    let vivo = true;
    setHistorico(null);
    setFalha(null);
    entregasApi.historicoPacote(pacote.id, unidadeId)
      .then((h) => { if (vivo) setHistorico(h); })
      .catch((err: unknown) => { if (vivo) setFalha(mensagemDeErro(err, 'Não foi possível carregar o histórico.')); });
    return () => { vivo = false; };
  }, [pacote, unidadeId]);

  return (
    <Dialogo titulo={pacote ? `Histórico de ${pacote.codigo}` : ''} aberto={!!pacote} aoFechar={aoFechar} largura="max-w-[640px]">
      {falha && <p role="alert" className="m-0 text-[15px] font-semibold text-ce-erro">{falha}</p>}
      {!historico && !falha && <Carregando texto="Carregando o histórico…" />}
      {historico && historico.eventos.length === 0 && <p className="m-0 text-[15px] text-ce-suave">Nenhuma alteração registrada.</p>}
      {historico && historico.eventos.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {historico.eventos.map((e) => (
            <li key={e.id} className="flex flex-col gap-1.5 border-t border-ce-linha-fraca pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
                <strong>{descreverEvento(e)}</strong>
                <span className="text-[13px] text-ce-suave">
                  {formatarDiaMes(e.em)} {formatarHora(e.em)}{e.carteiro?.nome ? ` · ${e.carteiro.nome}` : ''}
                </span>
              </div>
              {e.mudancas.length > 0 && (
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-ce-suave">
                      <th scope="col" className="py-1 pr-3 font-semibold">Campo</th>
                      <th scope="col" className="py-1 pr-3 font-semibold">Antes</th>
                      <th scope="col" className="py-1 font-semibold">Depois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.mudancas.map((m) => (
                      <tr key={m.campo} className="align-top">
                        <th scope="row" className="py-1 pr-3 text-left font-semibold">{CAMPOS[m.campo] ?? m.campo}</th>
                        <td className="break-words py-1 pr-3 text-ce-suave">{valorLegivel(m.campo, m.antes)}</td>
                        <td className="break-words py-1">{valorLegivel(m.campo, m.depois)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          ))}
        </ol>
      )}
    </Dialogo>
  );
}

type EstadoFoto = { tipo: 'carregando' } | { tipo: 'ok'; url: string } | { tipo: 'aviso'; texto: string };

/** A foto do rótulo (US-019 AC-2); 410 → "Foto excluída em DD/MM (prazo de retenção)" (US-019 EC-1). */
export function DialogoFoto({ pacote, unidadeId, aoFechar }: { pacote: PacoteDistrito | null; unidadeId?: string; aoFechar: () => void }) {
  const [estado, setEstado] = useState<EstadoFoto>({ tipo: 'carregando' });

  useEffect(() => {
    if (!pacote) return undefined;
    let vivo = true;
    let url: string | null = null;
    setEstado({ tipo: 'carregando' });
    entregasApi.fotoPacote(pacote.id, unidadeId)
      .then((blob) => {
        if (!vivo) return;
        url = URL.createObjectURL(blob);
        setEstado({ tipo: 'ok', url });
      })
      .catch((err: unknown) => {
        if (!vivo) return;
        if (err instanceof ApiError && err.status === 410) {
          const em = (err.details as { fotoExcluidaEm?: string | null } | undefined)?.fotoExcluidaEm;
          setEstado({ tipo: 'aviso', texto: em ? `Foto excluída em ${formatarDiaMes(em)} (prazo de retenção)` : 'Foto excluída (prazo de retenção)' });
        } else if (err instanceof ApiError && err.status === 404) {
          setEstado({ tipo: 'aviso', texto: 'Este pacote não tem foto do rótulo.' });
        } else {
          setEstado({ tipo: 'aviso', texto: mensagemDeErro(err, 'Não foi possível carregar a foto.') });
        }
      });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pacote, unidadeId]);

  return (
    <Dialogo titulo={pacote ? `Foto do rótulo · ${pacote.codigo}` : ''} aberto={!!pacote} aoFechar={aoFechar} largura="max-w-[720px]">
      {estado.tipo === 'carregando' && <Carregando texto="Carregando a foto…" />}
      {estado.tipo === 'aviso' && <p role="status" className="m-0 rounded-lg bg-ce-linha-fraca px-3 py-2.5 text-[15px] font-semibold text-ce-tinta-2">{estado.texto}</p>}
      {estado.tipo === 'ok' && pacote && (
        <img src={estado.url} alt={`Foto do rótulo do pacote ${pacote.codigo}`} className="h-auto max-h-[70vh] w-full rounded-lg object-contain" />
      )}
    </Dialogo>
  );
}

/** Remoção pelo supervisor (US-018), com confirmação; ENTREGUE é recusado pelo servidor. */
export function DialogoRemover({ pacote, distrito, aoFechar, aoRemover }: {
  pacote: PacoteDistrito | null;
  distrito: string;
  aoFechar: () => void;
  aoRemover: () => Promise<void>;
}) {
  const [removendo, setRemovendo] = useState(false);

  async function remover() {
    if (!pacote) return;
    setRemovendo(true);
    try {
      await entregasApi.removerPacote(pacote.id);
      toast.success(`Pacote ${pacote.codigo} removido do ${distrito}.`);
      await aoRemover();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'pacote_entregue') {
        toast.error('Este pacote já consta como entregue: não pode ser removido.', { id: 'pacote_entregue' });
      } else {
        avisarErro(err, 'Não foi possível remover o pacote.');
      }
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Dialogo
      titulo={pacote ? `Remover ${pacote.codigo}?` : ''}
      aberto={!!pacote}
      aoFechar={() => !removendo && aoFechar()}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={removendo}>Cancelar</Botao>
          <Botao variante="perigo" onClick={() => void remover()} disabled={removendo}>{removendo ? 'Removendo…' : 'Remover pacote'}</Botao>
        </>
      }
    >
      <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
        O pacote <strong className="font-codigo">{pacote?.codigo}</strong> sai da lista do {distrito} e do app do carteiro.
        O destinatário não recebe nova mensagem.
      </p>
    </Dialogo>
  );
}

// ——— Quadro ——————————————————————————————————————————————————————————

function LinhaTransferencia({ t, sentido }: { t: TransferenciaQuadro; sentido: 'entrada' | 'saida' }) {
  const quem = t.carteiro?.nome ?? 'carteiro';
  return (
    <li className="flex flex-col text-[13px] text-ce-tinta-2" data-transferencia={sentido}>
      <span>
        <span className="font-codigo font-medium text-ce-tinta">{t.codigo ?? 'sem código'}</span>
        {sentido === 'entrada' ? ` veio do ${t.distrito}` : ` foi para o ${t.distrito}`} · {quem} · {formatarHora(t.hora)}
      </span>
      {sentido === 'saida' && t.origemLiberada && (
        <span className="text-ce-corrigir">
          Distrito já liberado: o caso passou {t.carteiroAnterior?.nome ? `de ${t.carteiroAnterior.nome} ` : ''}para {quem}
        </span>
      )}
    </li>
  );
}

/** Pendências de conferência (US-021) e transferências (US-020) no cartão do distrito. */
export function CapturaNoCartao({ d }: { d: CartaoDistrito }) {
  const paraConferir = d.paraConferir ?? 0;
  const entrada = d.transferencias?.entrada ?? [];
  const saida = d.transferencias?.saida ?? [];
  if (paraConferir === 0 && entrada.length === 0 && saida.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-ce-linha-fraca pt-3">
      {paraConferir > 0 && (
        <span className="self-start rounded-full bg-ce-corrigir-bg px-2.5 py-1 text-[13px] font-semibold text-ce-corrigir">
          {paraConferir} para conferir no app do carteiro
        </span>
      )}
      {(entrada.length > 0 || saida.length > 0) && (
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-ce-suave">Transferências</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={`Transferências do ${d.codigo}`}>
            {entrada.map((t, i) => <LinhaTransferencia key={`e-${t.pacoteId ?? i}-${t.hora}`} t={t} sentido="entrada" />)}
            {saida.map((t, i) => <LinhaTransferencia key={`s-${t.pacoteId ?? i}-${t.hora}`} t={t} sentido="saida" />)}
          </ul>
        </div>
      )}
    </div>
  );
}
