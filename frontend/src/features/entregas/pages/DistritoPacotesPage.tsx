/**
 * Pacotes do distrito no dia (US-038): status de cada pacote, orientação
 * vigente, resposta do carteiro e sinalizações; filtros por status, busca e
 * paginação. Atualiza sozinho a cada 30 s (ADR-015). Cada pacote ainda não
 * entregue aceita uma orientação manual do supervisor (US-026).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { useEntregasPacotesStore, type FiltroPacotes } from '@/stores/entregas-pacotes.store';
import type { PacoteDistrito, StatusPacote } from '../entregas.types';
import {
  ORDEM_STATUS_PACOTE,
  STATUS_PACOTE,
  STATUS_QUADRO,
  avisarErro,
  formatarDataCurta,
  formatarEndereco,
  formatarHora,
  mensagemDeErro,
} from '../mensagens';
import { usePolling } from '../usePolling';
import { Botao, BotaoLink, CLASSE_ENTRADA, Cartao, Carregando, CodigoDistrito, FOCO, FalhaCarga, Pilula } from '../components/ui';
import { DialogoFoto, DialogoHistorico, DialogoRemover, OrigemDoPacote } from '../components/CapturaSupervisor';
import { DialogoOrientacao } from '../components/DialogoOrientacao';

const RESPOSTAS_CARTEIRO: Record<string, string> = {
  VI: 'Vi',
  FEITO: 'Feito',
  NAO: 'Não foi possível',
  NAO_ATENDEU: 'Não foi possível: ninguém atendeu',
  ENDERECO: 'Não foi possível: endereço não encontrado',
  RECUSOU: 'Não foi possível: recusou',
  FECHADO: 'Não foi possível: local fechado',
  OUTRO: 'Não foi possível: outro motivo',
};

const MOTIVOS_NAO_ENVIADO: Record<string, string> = {
  limite_canal: 'Não enviado: limite do canal (reenvio automático)',
  descadastrado: 'Não enviado: pediu para não receber mensagens',
  falha_envio: 'Não enviado: falha no envio',
};

function sinalizacoes(p: PacoteDistrito): string[] {
  const s: string[] = [];
  if (p.naoEnviadoMotivo) s.push(MOTIVOS_NAO_ENVIADO[p.naoEnviadoMotivo] ?? `Não enviado: ${p.naoEnviadoMotivo}`);
  else if (p.descadastrado) s.push('Descadastrado');
  if (p.escalonado) s.push('Escalonamento aberto');
  if (p.orientacaoVigente?.estado === 'GUARDADA') {
    const quando = p.orientacaoVigente.valeAPartirDe ? ` para ${formatarDataCurta(p.orientacaoVigente.valeAPartirDe)}` : '';
    s.push(`Orientação guardada${quando}`);
  }
  if (p.orientacaoVigente?.pontoDesativado) s.push('Ponto de retirada desativado');
  return s;
}

export function DistritoPacotesPage() {
  const { cargaId = '' } = useParams();
  const user = useAuthStore((s) => s.user);
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const { lista, carregar } = useEntregasPacotesStore();
  const [filtro, setFiltro] = useState<FiltroPacotes>({ status: null, busca: '', pagina: 1 });
  const [busca, setBusca] = useState('');
  const [falha, setFalha] = useState<string | null>(null);
  // Captura (task_06): histórico, foto e remoção de um pacote.
  const [historicoDe, setHistoricoDe] = useState<PacoteDistrito | null>(null);
  const [fotoDe, setFotoDe] = useState<PacoteDistrito | null>(null);
  const [removerDe, setRemoverDe] = useState<PacoteDistrito | null>(null);
  const [orientarDe, setOrientarDe] = useState<PacoteDistrito | null>(null);
  const unidadeId = user?.role === 'GESTAO' ? unidadeGestaoId ?? undefined : undefined;

  const atualizar = useCallback(async (silencioso = false) => {
    try {
      await carregar(cargaId, filtro, unidadeId);
      setFalha(null);
    } catch (err) {
      if (!silencioso) setFalha(mensagemDeErro(err, 'Não foi possível carregar os pacotes.'));
      avisarErro(err, 'Não foi possível atualizar os pacotes.');
    }
  }, [carregar, cargaId, filtro, unidadeId]);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  usePolling(() => void atualizar(true));

  // Busca aplicada com uma pequena espera, sem uma chamada por tecla.
  useEffect(() => {
    const t = window.setTimeout(() => setFiltro((f) => (f.busca === busca ? f : { ...f, busca, pagina: 1 })), 350);
    return () => window.clearTimeout(t);
  }, [busca]);

  const dados = lista && lista.cargaId === cargaId ? lista : null;
  const porStatus = dados?.resumo.porStatus ?? {};
  const podeRemover = !!dados && !dados.somenteLeitura && user?.role === 'UNIDADE';
  const podeOrientar = !!dados && !dados.somenteLeitura && (user?.role === 'UNIDADE' || user?.role === 'GESTAO');
  const filtros: Array<StatusPacote | null> = [null, ...ORDEM_STATUS_PACOTE.filter((s) => (porStatus[s] ?? 0) > 0 || s === filtro.status)];

  return (
    <>
      <Link to="/entregas/carregar" className={`self-start text-sm font-semibold text-ce-azul no-underline ${FOCO}`}>← Voltar ao quadro de distritos</Link>

      {falha && !dados && <FalhaCarga mensagem={falha} aoTentar={() => void atualizar()} />}
      {!dados && !falha && <Carregando texto="Carregando os pacotes…" />}

      {dados && (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <CodigoDistrito grande>{dados.distrito.codigo}</CodigoDistrito>
                <h1 className="m-0 text-[26px] font-bold md:text-[28px]">{dados.distrito.nome}</h1>
                <Pilula classe={STATUS_QUADRO[dados.statusCarga].classe}>{STATUS_QUADRO[dados.statusCarga].rotulo}</Pilula>
              </div>
              <span className="text-[15px] text-ce-suave">
                {formatarDataCurta(dados.data)} · {dados.resumo.total} pacotes, {dados.resumo.comWhatsapp} com WhatsApp
                {!dados.liberada && ' · lista pronta, ainda não liberada'}
              </span>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
              <label htmlFor="pacotes-busca" className="sr-only">Buscar por código ou nome</label>
              <input
                id="pacotes-busca"
                type="search"
                placeholder="Buscar código ou nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className={`${CLASSE_ENTRADA} sm:w-64`}
              />
              {!dados.somenteLeitura && user?.role === 'UNIDADE' && (
                <BotaoLink variante="secundario" to={`/entregas/carregar/${dados.distrito.id}`}>Adicionar pacotes</BotaoLink>
              )}
            </div>
          </header>

          <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-2">
            {filtros.map((s) => {
              const ativo = filtro.status === s;
              const n = s ? porStatus[s] ?? 0 : dados.resumo.total;
              return (
                <button
                  key={s ?? 'todos'}
                  type="button"
                  aria-pressed={ativo}
                  data-filtro={s ?? 'TODOS'}
                  onClick={() => setFiltro((f) => ({ ...f, status: s, pagina: 1 }))}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${FOCO} ${ativo ? 'border-ce-tinta bg-ce-tinta text-white' : 'border-ce-linha-forte bg-white text-ce-tinta'}`}
                >
                  {s && <span className={`size-[9px] rounded-full ${STATUS_PACOTE[s].ponto}`} aria-hidden="true" />}
                  {s ? (dados.liberada || s === 'SEM_WHATSAPP' ? STATUS_PACOTE[s].rotulo : 'Lista pronta') : 'Todos'}
                  <span className="tabular-nums opacity-80">{n}</span>
                </button>
              );
            })}
          </div>

          <Cartao className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.06em] text-ce-suave">
                  <th scope="col" className="px-5 py-3 font-semibold">Código</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Destinatário</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Orientação</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Carteiro</th>
                  <th scope="col" className="px-5 py-3 font-semibold"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {dados.pacotes.map((p) => {
                  const st = STATUS_PACOTE[p.status];
                  const flags = sinalizacoes(p);
                  const conversa = p.escalonado || p.status === 'INTERAGINDO' || !!p.orientacaoVigente;
                  return (
                    <tr key={p.id} data-pacote={p.codigo} className="border-t border-ce-linha-fraca align-top">
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="font-codigo text-[13px]">{p.codigo}</span>
                        <OrigemDoPacote p={p} />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="font-semibold">{p.nome}</div>
                        <div className="text-[13px] text-ce-suave">{formatarEndereco(p.endereco)}</div>
                      </td>
                      <td className="px-3 py-3.5">
                        <Pilula classe={st.classe} className="!px-2 !py-0.5">{dados.liberada ? st.rotulo : p.rotulo}</Pilula>
                        {flags.map((f) => <div key={f} className="mt-1 text-xs font-semibold text-ce-corrigir">{f}</div>)}
                        {p.rastreio && <div className="mt-1 text-xs text-ce-suave">Rastreio: {p.rastreio.descricao}</div>}
                      </td>
                      <td className="max-w-[280px] px-3 py-3.5">{p.orientacaoVigente?.texto ?? '—'}</td>
                      <td className="px-3 py-3.5 text-ce-tinta-2">
                        {p.respostaCarteiro
                          ? `${RESPOSTAS_CARTEIRO[p.respostaCarteiro.resposta] ?? p.respostaCarteiro.resposta}${p.respostaCarteiro.em ? ` · ${formatarHora(p.respostaCarteiro.em)}` : ''}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        {conversa && <Link to="/entregas/atendimento" className="font-semibold text-ce-azul">Ver conversa</Link>}
                        {((podeOrientar && p.status !== 'ENTREGUE') || p.origem) && (
                          <div className="flex flex-wrap justify-end gap-x-1">
                            {podeOrientar && p.status !== 'ENTREGUE' && (
                              <Botao variante="texto" className="!px-2" onClick={() => setOrientarDe(p)} aria-label={`Registrar orientação para ${p.codigo}`}>Registrar orientação</Botao>
                            )}
                            {p.origem && (
                              <Botao variante="texto" className="!px-2" onClick={() => setHistoricoDe(p)} aria-label={`Histórico de ${p.codigo}`}>Histórico</Botao>
                            )}
                            {p.origem && p.origem !== 'PLANILHA' && (
                              <Botao variante="texto" className="!px-2" onClick={() => setFotoDe(p)} aria-label={`Foto do rótulo de ${p.codigo}`}>Foto</Botao>
                            )}
                            {p.origem && podeRemover && p.status !== 'ENTREGUE' && (
                              <Botao variante="texto" className="!px-2 !text-ce-erro" onClick={() => setRemoverDe(p)} aria-label={`Remover ${p.codigo}`}>Remover</Botao>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {dados.pacotes.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-6 text-ce-suave">Nenhum pacote com esse filtro.</td></tr>
                )}
              </tbody>
            </table>
          </Cartao>

          {dados.totalPaginas > 1 && (
            <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-ce-suave">Página {dados.pagina} de {dados.totalPaginas} · {dados.total} pacotes</span>
              <div className="flex gap-2">
                <Botao variante="secundario" disabled={dados.pagina <= 1} onClick={() => setFiltro((f) => ({ ...f, pagina: f.pagina - 1 }))}>Anterior</Botao>
                <Botao variante="secundario" disabled={dados.pagina >= dados.totalPaginas} onClick={() => setFiltro((f) => ({ ...f, pagina: f.pagina + 1 }))}>Próxima</Botao>
              </div>
            </nav>
          )}
        </>
      )}

      <DialogoOrientacao
        pacote={orientarDe}
        unidadeId={unidadeId}
        aoFechar={() => setOrientarDe(null)}
        aoRegistrar={async () => {
          setOrientarDe(null);
          await atualizar(true);
        }}
        aoRecusar={() => void atualizar(true)}
      />
      <DialogoHistorico pacote={historicoDe} unidadeId={unidadeId} aoFechar={() => setHistoricoDe(null)} />
      <DialogoFoto pacote={fotoDe} unidadeId={unidadeId} aoFechar={() => setFotoDe(null)} />
      <DialogoRemover
        pacote={removerDe}
        distrito={dados?.distrito.codigo ?? 'distrito'}
        aoFechar={() => setRemoverDe(null)}
        aoRemover={async () => {
          setRemoverDe(null);
          await atualizar(true);
        }}
      />
    </>
  );
}
