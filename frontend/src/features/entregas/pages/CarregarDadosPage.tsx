/**
 * Monitoramento › Carregar Dados: quadro de distritos do dia (US-039), com
 * resumo, filtros por status, busca, data e o diálogo de liberação (US-011,
 * US-040.EC-1). Atualiza sozinho a cada 30 s (ADR-015).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { useEntregasQuadroStore } from '@/stores/entregas-quadro.store';
import type { CartaoDistrito, StatusQuadro } from '../entregas.types';
import {
  ORDEM_STATUS_PACOTE,
  ORDEM_STATUS_QUADRO,
  STATUS_PACOTE,
  STATUS_QUADRO,
  avisarErro,
  formatarDataLonga,
  formatarHora,
  mensagemDeErro,
} from '../mensagens';
import { usePolling } from '../usePolling';
import {
  Botao,
  BotaoLink,
  CabecalhoPagina,
  CLASSE_ENTRADA,
  Carregando,
  CodigoDistrito,
  Dialogo,
  EstadoVazio,
  FOCO,
  FalhaCarga,
  Pilula,
} from '../components/ui';

type Filtro = 'TODOS' | StatusQuadro;

function BarraProgresso({ valor, total, cor, rotulo }: { valor: number; total: number; cor: string; rotulo: string }) {
  const pct = total > 0 ? Math.round((100 * valor) / total) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ce-linha-fraca" role="progressbar" aria-label={rotulo} aria-valuenow={valor} aria-valuemin={0} aria-valuemax={total}>
      <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CartaoDoDistrito({ d, somenteLeitura, podeLiberar, aoLiberar }: {
  d: CartaoDistrito;
  somenteLeitura: boolean;
  podeLiberar: boolean;
  aoLiberar: (d: CartaoDistrito) => void;
}) {
  const status = STATUS_QUADRO[d.status];
  const semWhats = d.total - d.comWhatsapp;
  const enviados = (['ENVIADO', 'LIDO', 'INTERAGINDO', 'INSUCESSO', 'ENTREGUE'] as const).reduce((a, s) => a + (d.porStatus[s] ?? 0), 0);
  const segmentos = ORDEM_STATUS_PACOTE.filter((s) => (d.porStatus[s] ?? 0) > 0);
  const tituloId = `distrito-${d.distritoId}`;

  return (
    <article aria-labelledby={tituloId} data-distrito={d.codigo} className="flex min-w-0 flex-col gap-3.5 rounded-xl border border-ce-linha bg-white p-[18px]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <CodigoDistrito>{d.codigo}</CodigoDistrito>
            <h2 id={tituloId} className="m-0 text-lg font-bold">{d.nome}</h2>
          </div>
          {d.semCarteiro ? (
            <span className="text-sm font-semibold text-ce-erro">Sem carteiro definido para hoje</span>
          ) : (
            <span className="text-sm text-ce-suave">Carteiro: {d.carteiro?.nome}</span>
          )}
        </div>
        <Pilula classe={status.classe}>{status.rotulo}</Pilula>
      </div>

      {d.status === 'PENDENTE_UPLOAD' && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[15px] text-ce-suave">Nenhum pacote carregado {somenteLeitura ? 'nesta data' : 'hoje'}.</p>
          {!somenteLeitura && podeLiberar && (
            <BotaoLink to={`/entregas/carregar/${d.distritoId}`} className="self-start">Carregar pacotes</BotaoLink>
          )}
        </div>
      )}

      {d.status === 'DADOS_CARREGADOS' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px]">
              <strong className="tabular-nums">{d.comWhatsapp} de {d.total}</strong> pacotes com WhatsApp
            </span>
            <BarraProgresso valor={d.comWhatsapp} total={d.total} cor="bg-ce-seg-whats" rotulo="Pacotes com WhatsApp" />
            <span className="text-[13px] text-ce-suave">{semWhats} sem WhatsApp não serão avisados</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {!somenteLeitura && podeLiberar && (
              <Botao onClick={() => aoLiberar(d)} disabled={d.semCarteiro} aria-describedby={d.semCarteiro ? `${tituloId}-sem-carteiro` : undefined}>
                Liberar distrito
              </Botao>
            )}
            {d.cargaId && <BotaoLink variante="secundario" to={`/entregas/distritos/${d.cargaId}`}>Ver pacotes</BotaoLink>}
            {d.semCarteiro && !somenteLeitura && (
              <span id={`${tituloId}-sem-carteiro`} className="text-[13px] font-semibold text-ce-erro">
                Sem carteiro: <Link to="/entregas/cadastro" className="underline">defina o carteiro do dia</Link>
              </span>
            )}
          </div>
        </div>
      )}

      {d.status === 'LIBERADO' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px]">
            Enviando avisos · <strong className="tabular-nums">{enviados} de {d.comWhatsapp}</strong>
          </span>
          <BarraProgresso valor={enviados} total={d.comWhatsapp} cor="bg-ce-azul" rotulo="Avisos enviados" />
          <span className="text-[13px] text-ce-suave">
            Liberado {d.liberadoEm ? `às ${formatarHora(d.liberadoEm)}` : ''} · o carteiro recebeu o resumo das orientações
          </span>
          {d.cargaId && <Link to={`/entregas/distritos/${d.cargaId}`} className={`self-end text-sm font-semibold text-ce-azul ${FOCO}`}>Ver pacotes →</Link>}
        </div>
      )}

      {(d.status === 'EM_ENTREGA' || d.status === 'CONCLUIDO') && (
        <div className="flex flex-col gap-2.5">
          <div className="flex h-3 overflow-hidden rounded-full bg-ce-linha-fraca" aria-hidden="true">
            {segmentos.map((s) => (
              <div key={s} className={STATUS_PACOTE[s].ponto} style={{ flexGrow: d.porStatus[s] ?? 0 }} />
            ))}
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-2.5 gap-y-1.5 p-0" aria-label="Pacotes por status">
            {segmentos.map((s) => (
              <li key={s} data-status={s} className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ce-tinta-2">
                <span className={`size-[9px] shrink-0 rounded-full ${STATUS_PACOTE[s].ponto}`} aria-hidden="true" />
                {STATUS_PACOTE[s].rotulo} <strong className="tabular-nums">{d.porStatus[s]}</strong>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {d.escalonamentos > 0 && (
              <Link to="/entregas/atendimento" className="rounded-full bg-ce-corrigir-bg px-2.5 py-1 text-[13px] font-semibold text-ce-corrigir no-underline">
                {d.escalonamentos} escalonamento(s) aberto(s)
              </Link>
            )}
            {d.cargaId && <Link to={`/entregas/distritos/${d.cargaId}`} className={`ml-auto text-sm font-semibold text-ce-azul ${FOCO}`}>Ver pacotes →</Link>}
          </div>
        </div>
      )}
    </article>
  );
}

export function CarregarDadosPage() {
  const user = useAuthStore((s) => s.user);
  const unidadeNomeSalvo = useAuthStore((s) => s.unidadeNome);
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const { quadro, carregar, liberar } = useEntregasQuadroStore();
  const [data, setData] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busca, setBusca] = useState('');
  const [falha, setFalha] = useState<string | null>(null);
  const [aLiberar, setALiberar] = useState<CartaoDistrito | null>(null);
  const [cienteSemAvisos, setCienteSemAvisos] = useState(false);
  const [liberando, setLiberando] = useState(false);

  const ehGestao = user?.role === 'GESTAO';
  const unidadeId = ehGestao ? unidadeGestaoId ?? undefined : undefined;

  const atualizar = useCallback(async (silencioso = false) => {
    try {
      await carregar({ data, unidadeId });
      setFalha(null);
    } catch (err) {
      if (!silencioso) setFalha(mensagemDeErro(err, 'Não foi possível carregar o quadro.'));
      avisarErro(err, 'Não foi possível atualizar o quadro.');
    }
  }, [carregar, data, unidadeId]);

  useEffect(() => {
    useEntregasQuadroStore.getState().limpar();
    void atualizar();
  }, [atualizar]);

  usePolling(() => void atualizar(true));

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { TODOS: 0, PENDENTE_UPLOAD: 0, DADOS_CARREGADOS: 0, LIBERADO: 0, EM_ENTREGA: 0, CONCLUIDO: 0 };
    for (const d of quadro?.distritos ?? []) {
      c.TODOS += 1;
      c[d.status] += 1;
    }
    return c;
  }, [quadro]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (quadro?.distritos ?? []).filter((d) =>
      (filtro === 'TODOS' || d.status === filtro)
      && (!termo || d.codigo.toLowerCase().includes(termo) || d.nome.toLowerCase().includes(termo)));
  }, [quadro, filtro, busca]);

  const resumo = useMemo(() => {
    const ds = quadro?.distritos ?? [];
    const soma = (fn: (d: CartaoDistrito) => number) => ds.reduce((a, d) => a + fn(d), 0);
    return [
      { valor: ds.length, rotulo: 'distritos hoje' },
      { valor: soma((d) => d.total), rotulo: 'pacotes carregados' },
      { valor: soma((d) => d.comWhatsapp), rotulo: 'com WhatsApp' },
      { valor: soma((d) => d.porStatus.ENTREGUE ?? 0), rotulo: 'entregues' },
      { valor: soma((d) => d.porStatus.INSUCESSO ?? 0), rotulo: 'insucessos' },
    ];
  }, [quadro]);

  function abrirLiberacao(d: CartaoDistrito) {
    setCienteSemAvisos(false);
    setALiberar(d);
  }

  async function confirmarLiberacao() {
    if (!aLiberar?.cargaId) return;
    const semAvisos = aLiberar.comWhatsapp === 0;
    setLiberando(true);
    try {
      const r = await liberar(aLiberar.cargaId, semAvisos);
      const quando = r.agendadoPara ? ` Os avisos saem às ${formatarHora(r.agendadoPara)} do dia seguinte.` : '';
      toast.success(`${aLiberar.codigo} liberado: ${r.avisosAgendados} aviso(s) agendado(s).${quando}`);
      setALiberar(null);
      await atualizar(true);
    } catch (err) {
      avisarErro(err, 'Não foi possível liberar o distrito.');
    } finally {
      setLiberando(false);
    }
  }

  const unidadeNome = user?.unidade?.nome ?? unidadeNomeSalvo ?? '';
  const somenteLeitura = quadro?.somenteLeitura ?? false;
  const podeLiberar = user?.role === 'UNIDADE';
  const semAvisos = aLiberar ? aLiberar.comWhatsapp === 0 : false;

  return (
    <>
      <CabecalhoPagina
        secao="Monitoramento"
        titulo="Carregar Dados"
        subtitulo={quadro ? `${formatarDataLonga(quadro.data)}${!ehGestao && unidadeNome ? ` · ${unidadeNome}` : ''}${somenteLeitura ? ' · somente consulta' : ''}` : undefined}
        acoes={
          <div className="flex items-center gap-2.5">
            <label htmlFor="quadro-data" className="text-[13px] text-ce-suave">Data</label>
            <input
              id="quadro-data"
              type="date"
              value={data ?? quadro?.data ?? ''}
              max={quadro && !data ? quadro.data : undefined}
              onChange={(e) => setData(e.target.value || null)}
              className={`${CLASSE_ENTRADA} w-auto`}
            />
          </div>
        }
      />

      {falha && !quadro && <FalhaCarga mensagem={falha} aoTentar={() => void atualizar()} />}
      {!quadro && !falha && <Carregando texto="Carregando o quadro de distritos…" />}

      {quadro && quadro.semDistritos && (
        <EstadoVazio titulo="Cadastre distritos">
          <p className="m-0 text-[15px] text-ce-tinta-2">
            A unidade ainda não tem distritos. Cadastre os distritos e os carteiros para carregar os pacotes do dia.
          </p>
          <BotaoLink to="/entregas/cadastro">Ir para o Cadastro</BotaoLink>
        </EstadoVazio>
      )}

      {quadro && !quadro.semDistritos && (
        <>
          <section aria-label="Resumo do dia" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {resumo.map((r) => (
              <div key={r.rotulo} className="flex flex-col gap-0.5 rounded-[10px] border border-ce-linha bg-white px-4 py-3.5">
                <span className="text-[26px] font-bold tabular-nums">{r.valor}</span>
                <span className="text-[13px] text-ce-suave">{r.rotulo}</span>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filtrar distritos" className="flex flex-wrap gap-2">
              {(['TODOS', ...ORDEM_STATUS_QUADRO] as Filtro[]).map((f) => {
                const ativo = filtro === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltro(f)}
                    className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${FOCO} ${ativo ? 'border-ce-tinta bg-ce-tinta text-white' : 'border-ce-linha-forte bg-white text-ce-tinta'}`}
                  >
                    {f === 'TODOS' ? 'Todos' : STATUS_QUADRO[f].rotulo} <span className="tabular-nums opacity-75">{contagem[f]}</span>
                  </button>
                );
              })}
            </div>
            <label htmlFor="quadro-busca" className="sr-only">Buscar distrito por código ou nome</label>
            <input
              id="quadro-busca"
              type="search"
              placeholder="Buscar distrito"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`${CLASSE_ENTRADA} sm:ml-auto sm:w-56`}
            />
          </div>

          <section aria-label="Distritos" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
            {visiveis.map((d) => (
              <CartaoDoDistrito key={d.distritoId} d={d} somenteLeitura={somenteLeitura} podeLiberar={podeLiberar} aoLiberar={abrirLiberacao} />
            ))}
            {visiveis.length === 0 && <p className="m-0 text-[15px] text-ce-suave">Nenhum distrito com esse filtro.</p>}
          </section>
        </>
      )}

      <Dialogo
        titulo={aLiberar ? `Liberar ${aLiberar.codigo} · ${aLiberar.nome}?` : ''}
        aberto={!!aLiberar}
        aoFechar={() => !liberando && setALiberar(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setALiberar(null)} disabled={liberando}>Cancelar</Botao>
            <Botao onClick={() => void confirmarLiberacao()} disabled={liberando || (semAvisos && !cienteSemAvisos)}>
              {liberando ? 'Liberando…' : semAvisos ? 'Liberar sem avisos' : 'Liberar e enviar avisos'}
            </Botao>
          </>
        }
      >
        {aLiberar && (semAvisos ? (
          <>
            <p role="alert" className="m-0 rounded-lg bg-ce-carregado-bg px-3 py-2.5 text-[15px] font-semibold text-ce-carregado">
              Nenhum destinatário será avisado.
            </p>
            <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
              Os {aLiberar.total} pacotes deste distrito estão sem WhatsApp. Eles seguem para entrega e o rastreio continua valendo.
            </p>
            <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
              <input type="checkbox" checked={cienteSemAvisos} onChange={(e) => setCienteSemAvisos(e.target.checked)} className="size-5" />
              Entendo e quero liberar sem enviar avisos
            </label>
          </>
        ) : (
          <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
            <strong>{aLiberar.comWhatsapp} destinatários</strong> vão receber o aviso “sua encomenda já saiu para entrega”, com as opções de entrega.{' '}
            <strong>{aLiberar.total - aLiberar.comWhatsapp} sem WhatsApp</strong> não serão avisados.
          </p>
        ))}
        {aLiberar && (
          <p className="m-0 text-[15px] text-ce-tinta-2">
            Carteiro do dia: <strong>{aLiberar.carteiro?.nome}</strong>. Ele recebe no WhatsApp o resumo das orientações já conhecidas.
          </p>
        )}
      </Dialogo>
    </>
  );
}
