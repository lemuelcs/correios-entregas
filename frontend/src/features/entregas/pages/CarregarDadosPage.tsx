/**
 * Monitoramento › Carregar Dados (ADR-019): a carga do dia organizada por
 * saída. Um arquivo por unidade por saída, com todas as rotas, importado direto
 * (sem prévia); abas por saída, resumo, filtros, cartões das rotas, liberação
 * de uma rota ou em lote e o modal dos carteiros. Atualiza sozinho a cada 30 s
 * (ADR-015).
 *
 * Escopo: o supervisor fica na própria unidade (sem seletor); a Gestão escolhe
 * a unidade ou vê "Todas as unidades" (só leitura).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { useEntregasQuadroStore } from '@/stores/entregas-quadro.store';
import type { AtribuicaoCarteiro, CartaoRota, ResultadoImportacaoSaida } from '../entregas.types';
import { ORDEM_STATUS_PACOTE, STATUS_PACOTE, avisarErro, formatarDataLonga, formatarHora, mensagemDeErro } from '../mensagens';
import {
  ORDEM_STATUS_ROTA,
  STATUS_ROTA,
  abasDoDia,
  nomeDaRota,
  plural,
  rotasLiberaveis,
  statusDaRota,
  type AbaSaida,
  type StatusRota,
} from '../saidas';
import { usePolling } from '../usePolling';
import { Botao, BotaoLink, CabecalhoPagina, Carregando, Dialogo, FOCO, FalhaCarga, Pilula } from '../components/ui';
import { CapturaNoCartao } from '../components/CapturaSupervisor';
import { ResumoImportacao } from '../components/ResumoImportacao';
import { AtribuirCarteiros } from '../components/AtribuirCarteiros';

type Filtro = 'TODAS' | StatusRota;

const TODAS_UNIDADES = 'todas';
const CAMPO = `h-11 rounded-lg border bg-white px-2.5 font-semibold text-ce-tinta ${FOCO}`;

function BarraProgresso({ valor, total, cor, rotulo }: { valor: number; total: number; cor: string; rotulo: string }) {
  const pct = total > 0 ? Math.round((100 * valor) / total) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ce-linha-fraca" role="progressbar" aria-label={rotulo} aria-valuenow={valor} aria-valuemin={0} aria-valuemax={total}>
      <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CartaoDaRota({ r, mostrarUnidade, podeLiberar, podeAtribuir, aoLiberar, aoDefinirCarteiro }: {
  r: CartaoRota;
  mostrarUnidade: boolean;
  podeLiberar: boolean;
  podeAtribuir: boolean;
  aoLiberar: (r: CartaoRota) => void;
  aoDefinirCarteiro: (r: CartaoRota) => void;
}) {
  const status = statusDaRota(r);
  const pilula = STATUS_ROTA[status];
  const semWhats = r.total - r.comWhatsapp;
  const enviados = (['ENVIADO', 'LIDO', 'INTERAGINDO', 'INSUCESSO', 'ENTREGUE'] as const).reduce((a, s) => a + (r.porStatus[s] ?? 0), 0);
  const segmentos = ORDEM_STATUS_PACOTE.filter((s) => (r.porStatus[s] ?? 0) > 0);
  const nome = nomeDaRota(r);
  const subtitulo = [plural(r.total, 'pacote', 'pacotes'), nome, mostrarUnidade ? r.unidade.nome : null].filter(Boolean).join(' · ');
  const pacotes = r.cargaId ? `/entregas/distritos/${r.cargaId}` : null;

  return (
    <article
      aria-label={`Rota ${r.codigo}`}
      data-rota={r.codigo}
      data-distrito={r.codigo}
      data-status={status}
      className="flex min-w-0 flex-col gap-3.5 rounded-xl border border-ce-linha bg-white p-[18px]"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-lg bg-ce-linha-fraca px-2.5 py-2 font-codigo text-xl font-semibold leading-none" aria-hidden="true">
            {r.codigo}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className={`m-0 truncate text-lg font-bold ${r.semCarteiro ? 'text-ce-erro' : ''}`}>
              {r.semCarteiro ? 'Sem carteiro definido' : r.carteiro?.nome ?? 'Carteiro sem nome'}
            </h3>
            <span className="text-[13px] text-ce-suave">{subtitulo}</span>
          </div>
        </div>
        <Pilula classe={pilula.classe}>{pilula.rotulo}</Pilula>
      </div>

      {status === 'DADOS_CARREGADOS' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px]">
              <strong className="tabular-nums">{r.comWhatsapp} de {r.total}</strong> pacotes com WhatsApp
            </span>
            <BarraProgresso valor={r.comWhatsapp} total={r.total} cor="bg-ce-seg-whats" rotulo="Pacotes com WhatsApp" />
            <span className="text-[13px] text-ce-suave">{semWhats} sem WhatsApp não serão avisados</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {!r.semCarteiro && podeLiberar && r.cargaId && <Botao onClick={() => aoLiberar(r)}>Liberar rota</Botao>}
            {r.semCarteiro && podeAtribuir && (
              <Botao variante="perigo" onClick={() => aoDefinirCarteiro(r)}>Definir carteiro</Botao>
            )}
            {pacotes && <BotaoLink variante="secundario" to={pacotes}>Ver pacotes</BotaoLink>}
            {r.semCarteiro && <span className="text-[13px] text-ce-suave">Necessário para liberar a rota</span>}
          </div>
        </div>
      )}

      {status === 'LIBERADO' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px]">
            Enviando avisos · <strong className="tabular-nums">{enviados} de {r.comWhatsapp}</strong>
          </span>
          <BarraProgresso valor={enviados} total={r.comWhatsapp} cor="bg-ce-azul" rotulo="Avisos enviados" />
          <span className="text-[13px] text-ce-suave">
            Liberada {r.liberadoEm ? `às ${formatarHora(r.liberadoEm)}` : ''} · o carteiro recebeu o resumo das orientações
          </span>
          {pacotes && <Link to={pacotes} className={`self-end text-sm font-semibold text-ce-azul ${FOCO}`}>Ver pacotes →</Link>}
        </div>
      )}

      {(status === 'EM_ENTREGA' || status === 'CONCLUIDO') && (
        <div className="flex flex-col gap-2.5">
          <div className="flex h-3 overflow-hidden rounded-full bg-ce-linha-fraca" aria-hidden="true">
            {segmentos.map((s) => (
              <div key={s} className={STATUS_PACOTE[s].ponto} style={{ flexGrow: r.porStatus[s] ?? 0 }} />
            ))}
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-2.5 gap-y-1.5 p-0" aria-label="Pacotes por status">
            {segmentos.map((s) => (
              <li key={s} data-status={s} className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ce-tinta-2">
                <span className={`size-[9px] shrink-0 rounded-full ${STATUS_PACOTE[s].ponto}`} aria-hidden="true" />
                {STATUS_PACOTE[s].rotulo} <strong className="tabular-nums">{r.porStatus[s]}</strong>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {r.escalonamentos > 0 && (
              <Link to="/entregas/atendimento" className="rounded-full bg-ce-corrigir-bg px-2.5 py-1 text-[13px] font-semibold text-ce-corrigir no-underline">
                {r.escalonamentos} escalonamento(s) aberto(s)
              </Link>
            )}
            {pacotes && <Link to={pacotes} className={`ml-auto text-sm font-semibold text-ce-azul ${FOCO}`}>Ver pacotes →</Link>}
          </div>
        </div>
      )}

      <CapturaNoCartao d={r} />
    </article>
  );
}

export function CarregarDadosPage() {
  const user = useAuthStore((s) => s.user);
  const unidadeNomeSalvo = useAuthStore((s) => s.unidadeNome);
  const unidades = useEntregasCadastroStore((s) => s.unidades);
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const escolherUnidade = useEntregasContextoStore((s) => s.escolherUnidade);
  const { quadro, carregar, importar, liberar, liberarVarias, atribuirCarteiros } = useEntregasQuadroStore();

  const [data, setData] = useState<string | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [abaEscolhida, setAbaEscolhida] = useState<AbaSaida | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [falha, setFalha] = useState<string | null>(null);

  const [impNumero, setImpNumero] = useState<number | null>(null);
  const [impHorario, setImpHorario] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroHorario, setErroHorario] = useState(false);
  const [erroArquivo, setErroArquivo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [ultima, setUltima] = useState<ResultadoImportacaoSaida | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [aLiberar, setALiberar] = useState<CartaoRota | null>(null);
  const [emLote, setEmLote] = useState(false);
  const [cienteSemAvisos, setCienteSemAvisos] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [carteiros, setCarteiros] = useState<{ foco: string | null } | null>(null);
  const [salvandoCarteiros, setSalvandoCarteiros] = useState(false);

  const ehGestao = user?.role === 'GESTAO';
  const todas = ehGestao && (verTodas || !unidadeGestaoId);
  /** Só a Gestão envia a unidade (ou `todas`); o supervisor fica na unidade do token. */
  const unidadeParam = ehGestao ? (todas ? TODAS_UNIDADES : unidadeGestaoId ?? TODAS_UNIDADES) : undefined;
  const unidadeDaAcao = ehGestao && !todas ? unidadeGestaoId ?? undefined : undefined;

  const atualizar = useCallback(async (silencioso = false) => {
    try {
      await carregar({ data, unidadeId: unidadeParam });
      setFalha(null);
    } catch (err) {
      if (!silencioso) setFalha(mensagemDeErro(err, 'Não foi possível carregar as saídas.'));
      avisarErro(err, 'Não foi possível atualizar as saídas.');
    }
  }, [carregar, data, unidadeParam]);

  // Outra data ou outra unidade: a tela volta ao começo.
  useEffect(() => {
    useEntregasQuadroStore.getState().limpar();
    setAbaEscolhida(null);
    setFiltro('TODAS');
    setImpNumero(null);
    setImpHorario('');
    setArquivo(null);
    setErroHorario(false);
    setErroArquivo(false);
    setUltima(null);
    void atualizar();
  }, [atualizar]);

  usePolling(() => void atualizar(true));

  const abas = useMemo(() => (quadro ? abasDoDia(quadro) : []), [quadro]);
  const aba = abas.find((a) => a.aba === abaEscolhida) ?? abas[0] ?? null;
  const rotasDaAba = useMemo(() => aba?.rotas ?? [], [aba]);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { TODAS: 0, DADOS_CARREGADOS: 0, LIBERADO: 0, EM_ENTREGA: 0, CONCLUIDO: 0 };
    for (const r of rotasDaAba) {
      c.TODAS += 1;
      c[statusDaRota(r)] += 1;
    }
    return c;
  }, [rotasDaAba]);

  const visiveis = useMemo(() => rotasDaAba.filter((r) => filtro === 'TODAS' || statusDaRota(r) === filtro), [rotasDaAba, filtro]);

  const resumo = useMemo(() => {
    const soma = (fn: (r: CartaoRota) => number) => rotasDaAba.reduce((a, r) => a + fn(r), 0);
    return [
      { valor: rotasDaAba.length, rotulo: aba?.aba === 'sem' ? 'rotas sem saída' : 'rotas nesta saída' },
      { valor: soma((r) => r.total), rotulo: 'pacotes' },
      { valor: soma((r) => r.comWhatsapp), rotulo: 'com WhatsApp' },
      { valor: soma((r) => r.porStatus.ENTREGUE ?? 0), rotulo: 'entregues' },
      { valor: soma((r) => r.porStatus.INSUCESSO ?? 0), rotulo: 'insucessos' },
    ];
  }, [rotasDaAba, aba]);

  const somenteLeitura = quadro?.somenteLeitura ?? false;
  const agregado = quadro?.agregado ?? todas;
  const podeImportar = !somenteLeitura && !agregado;
  const podeLiberar = user?.role === 'UNIDADE' && !somenteLeitura;
  const liberaveis = useMemo(() => rotasLiberaveis(rotasDaAba), [rotasDaAba]);
  const semCarteiro = useMemo(() => rotasDaAba.filter((r) => r.semCarteiro && statusDaRota(r) === 'DADOS_CARREGADOS'), [rotasDaAba]);

  // ——— Importação ———

  const numerosImportados = useMemo(() => [...new Set((quadro?.saidas ?? []).map((s) => s.numero))].sort((a, b) => a - b), [quadro]);
  const proxima = quadro?.proximaSaida ?? 1;
  const numeroImp = impNumero ?? proxima;
  const opcoesImp = useMemo(() => [...new Set([...numerosImportados, proxima])], [numerosImportados, proxima]);
  const jaImportada = quadro?.saidas.find((s) => s.numero === numeroImp) ?? null;

  function escolherNumero(n: number) {
    setImpNumero(n);
    setImpHorario(quadro?.saidas.find((s) => s.numero === n)?.horario ?? '');
    setErroHorario(false);
  }

  function escolherArquivo(f: File | null | undefined) {
    setArquivo(f ?? null);
    if (f) setErroArquivo(false);
  }

  function aoSoltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastando(false);
    if (podeImportar && !importando) escolherArquivo(e.dataTransfer.files?.[0]);
  }

  async function importarSaida() {
    const semHorario = !impHorario;
    const semArquivo = !arquivo;
    setErroHorario(semHorario);
    setErroArquivo(semArquivo);
    if (semHorario || !arquivo) return;
    setImportando(true);
    try {
      const r = await importar({ arquivo, numero: numeroImp, horario: impHorario, data, unidadeId: unidadeDaAcao });
      const frase = `Saída ${numeroImp} importada: ${plural(r.aceitos, 'aceito', 'aceitos')}, ${plural(r.descartados, 'descartado', 'descartados')}.`;
      if (r.descartados > 0) toast(frase, { duration: 8000 });
      else toast.success(frase);
      setUltima(r);
      setAbaEscolhida(numeroImp);
      setFiltro('TODAS');
      setImpNumero(null);
      setImpHorario('');
      setArquivo(null);
      if (arquivoRef.current) arquivoRef.current.value = '';
      await atualizar(true);
    } catch (err) {
      avisarErro(err, 'Não foi possível importar a saída.');
    } finally {
      setImportando(false);
    }
  }

  // ——— Liberação ———

  function abrirLiberacao(r: CartaoRota) {
    setCienteSemAvisos(false);
    setEmLote(false);
    setALiberar(r);
  }

  function fecharLiberacao() {
    if (liberando) return;
    setALiberar(null);
    setEmLote(false);
  }

  async function confirmarLiberacao() {
    if (!aLiberar?.cargaId) return;
    const semAvisos = aLiberar.comWhatsapp === 0;
    setLiberando(true);
    try {
      const r = await liberar(aLiberar.cargaId, semAvisos);
      const quando = r.agendadoPara ? ` Os avisos saem às ${formatarHora(r.agendadoPara)} do dia seguinte.` : '';
      toast.success(`Rota ${aLiberar.codigo} liberada: ${r.avisosAgendados} aviso(s) agendado(s).${quando}`);
      setALiberar(null);
      await atualizar(true);
    } catch (err) {
      avisarErro(err, 'Não foi possível liberar a rota.');
    } finally {
      setLiberando(false);
    }
  }

  async function confirmarLote() {
    const ids = liberaveis.flatMap((r) => (r.cargaId ? [r.cargaId] : []));
    if (ids.length === 0) return;
    setLiberando(true);
    try {
      const r = await liberarVarias(ids);
      const quando = r.agendadoPara ? ` Os avisos saem às ${formatarHora(r.agendadoPara)} do dia seguinte.` : '';
      if (r.liberadas > 0) toast.success(`${plural(r.liberadas, 'rota liberada', 'rotas liberadas')}: ${r.avisosAgendados} aviso(s) agendado(s).${quando}`);
      for (const f of r.resultados) {
        if (!f.ok) toast.error(`Rota ${f.rota ?? '?'} não foi liberada: ${mensagemDeErro(new ApiError(409, f.erro))}`, { duration: 8000 });
      }
      setEmLote(false);
      await atualizar(true);
    } catch (err) {
      avisarErro(err, 'Não foi possível liberar as rotas.');
    } finally {
      setLiberando(false);
    }
  }

  // ——— Carteiros ———

  async function salvarCarteiros(atribuicoes: AtribuicaoCarteiro[]) {
    if (atribuicoes.length === 0) return;
    setSalvandoCarteiros(true);
    try {
      const r = await atribuirCarteiros(atribuicoes, { data, unidadeId: unidadeDaAcao });
      if (r.atribuidas > 0) toast.success(`${plural(r.atribuidas, 'rota', 'rotas')} com carteiro definido.`);
      for (const f of r.resultados) {
        if (!f.ok) toast.error(`Rota ${f.rota ?? '?'}: ${mensagemDeErro(new ApiError(409, f.erro))}`, { duration: 8000 });
      }
      setCarteiros(null);
      await atualizar(true);
    } catch (err) {
      avisarErro(err, 'Não foi possível salvar os carteiros.');
    } finally {
      setSalvandoCarteiros(false);
    }
  }

  const unidadeNome = user?.unidade?.nome ?? unidadeNomeSalvo ?? '';
  const semAvisos = aLiberar ? aLiberar.comWhatsapp === 0 : false;
  const lote = {
    comWhatsapp: liberaveis.reduce((a, r) => a + r.comWhatsapp, 0),
    semWhatsapp: liberaveis.reduce((a, r) => a + r.total - r.comWhatsapp, 0),
  };
  const nomeDaAba = aba?.aba === 'sem' ? 'sem saída' : `da Saída ${aba?.aba ?? ''}`;

  return (
    <>
      <CabecalhoPagina
        secao="Monitoramento"
        titulo="Carregar Dados"
        subtitulo={quadro ? `${formatarDataLonga(quadro.data)}${!ehGestao && unidadeNome ? ` · ${unidadeNome}` : ''}${somenteLeitura ? ' · somente consulta' : ''}` : undefined}
        acoes={
          <div className="flex flex-wrap items-end gap-4">
            {ehGestao && (
              <div className="flex flex-col gap-1">
                <label htmlFor="saidas-unidade" className="text-[13px] text-ce-suave">Unidade</label>
                <select
                  id="saidas-unidade"
                  value={todas ? TODAS_UNIDADES : unidadeGestaoId ?? TODAS_UNIDADES}
                  onChange={(e) => {
                    if (e.target.value === TODAS_UNIDADES) {
                      setVerTodas(true);
                    } else {
                      setVerTodas(false);
                      escolherUnidade(e.target.value);
                    }
                  }}
                  className={`h-10 min-w-[200px] rounded-lg border border-ce-linha-forte bg-white px-2.5 text-ce-tinta ${FOCO}`}
                >
                  <option value={TODAS_UNIDADES}>Todas as unidades</option>
                  {(unidades ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="quadro-data" className="text-[13px] text-ce-suave">Data</label>
              <input
                id="quadro-data"
                type="date"
                value={data ?? quadro?.data ?? ''}
                max={quadro && !data ? quadro.data : undefined}
                onChange={(e) => setData(e.target.value || null)}
                className={`h-10 rounded-lg border border-ce-linha-forte bg-white px-2.5 ${FOCO}`}
              />
            </div>
          </div>
        }
      />

      {falha && !quadro && <FalhaCarga mensagem={falha} aoTentar={() => void atualizar()} />}
      {!quadro && !falha && <Carregando texto="Carregando as saídas do dia…" />}

      {quadro && !somenteLeitura && (
        <section aria-labelledby="importar-titulo" className="flex flex-col gap-3 rounded-xl border border-ce-linha bg-white px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
              <h2 id="importar-titulo" className="m-0 text-[17px] font-bold">Importar arquivo da saída</h2>
              <span className="text-sm leading-snug text-ce-suave">Um arquivo por unidade, com todas as rotas da saída.</span>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="saida-numero" className="text-[13px] font-semibold text-ce-tinta-2">Número da saída</label>
              <select
                id="saida-numero"
                value={numeroImp}
                disabled={!podeImportar || importando}
                onChange={(e) => escolherNumero(Number(e.target.value))}
                className={`${CAMPO} min-w-[140px] border-[#b9c3d3]`}
              >
                {opcoesImp.map((n) => (
                  <option key={n} value={n}>Saída {n}{numerosImportados.includes(n) ? ' (reimportar)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="saida-horario" className="text-[13px] font-semibold text-ce-tinta-2">Horário da saída</label>
              <input
                id="saida-horario"
                type="time"
                value={impHorario}
                disabled={!podeImportar || importando}
                aria-invalid={erroHorario}
                aria-describedby={erroHorario ? 'saida-horario-erro' : undefined}
                onChange={(e) => {
                  setImpHorario(e.target.value);
                  setErroHorario(false);
                }}
                className={`${CAMPO} w-[130px] ${erroHorario ? 'border-2 border-ce-erro' : 'border-[#b9c3d3]'}`}
              />
            </div>
            <label
              htmlFor="saida-arquivo"
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={aoSoltar}
              className={`relative flex min-h-16 min-w-[260px] flex-[2] items-center gap-3 rounded-[10px] border-2 border-dashed px-4 py-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ce-azul ${
                podeImportar ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              } ${arrastando ? 'border-ce-azul bg-ce-liberado-bg' : erroArquivo ? 'border-ce-erro bg-ce-erro-bg' : 'border-[#b9c3d3] bg-[#f8fafc]'}`}
            >
              <Upload size={24} className="shrink-0 text-ce-azul" aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-px">
                <span className="truncate text-[15px] font-semibold">{arquivo ? arquivo.name : 'Arquivo da saída'}</span>
                <span className="text-[13px] text-ce-suave">Arraste aqui ou clique para escolher · CSV ou XLSX</span>
              </span>
              <input
                ref={arquivoRef}
                id="saida-arquivo"
                type="file"
                accept=".csv,.xlsx"
                disabled={!podeImportar || importando}
                aria-invalid={erroArquivo}
                aria-describedby={erroArquivo ? 'saida-arquivo-erro' : undefined}
                onChange={(e) => escolherArquivo(e.target.files?.[0])}
                className="sr-only"
              />
            </label>
            <Botao onClick={() => void importarSaida()} disabled={!podeImportar || importando} className="whitespace-nowrap">
              {importando ? 'Importando…' : `Importar Saída ${numeroImp}`}
            </Botao>
          </div>
          {agregado && (
            <span className="self-start rounded-lg bg-ce-linha-fraca px-2.5 py-1.5 text-sm text-ce-tinta-2">
              Escolha uma unidade para importar. Em “Todas as unidades” a tela é só de consulta.
            </span>
          )}
          {erroHorario && (
            <span id="saida-horario-erro" role="alert" className="self-start rounded-lg bg-ce-erro-bg px-2.5 py-1.5 text-sm font-semibold text-ce-erro">
              Confirme o horário da Saída {numeroImp} antes de importar.
            </span>
          )}
          {erroArquivo && (
            <span id="saida-arquivo-erro" role="alert" className="self-start rounded-lg bg-ce-erro-bg px-2.5 py-1.5 text-sm font-semibold text-ce-erro">
              Escolha o arquivo da Saída {numeroImp}.
            </span>
          )}
          {podeImportar && jaImportada && (
            <span className="self-start rounded-lg bg-ce-carregado-bg px-2.5 py-1.5 text-sm text-ce-carregado">
              A Saída {numeroImp} já foi importada às {formatarHora(jaImportada.importadaEm)}. Importar de novo substitui os dados das rotas que ainda não foram liberadas.
            </span>
          )}
          <span className="text-[13px] text-ce-suave">
            Colunas do arquivo: <strong>rota</strong>, <strong>código</strong> e <strong>nome</strong> (obrigatórias); WhatsApp, endereço e <strong>carteiro</strong> (matrícula ou nome) são opcionais.
          </span>
        </section>
      )}

      {quadro && abas.length > 0 && (
        <div role="tablist" aria-label="Saídas do dia" className="flex flex-wrap gap-2.5">
          {abas.map((a) => {
            const ativa = a.aba === aba?.aba;
            return (
              <button
                key={a.aba}
                type="button"
                role="tab"
                id={`aba-saida-${a.aba}`}
                aria-selected={ativa}
                aria-controls="painel-saida"
                data-saida={a.aba}
                onClick={() => {
                  setAbaEscolhida(a.aba);
                  setFiltro('TODAS');
                }}
                className={`flex min-h-14 min-w-[220px] flex-col items-start justify-center gap-0.5 rounded-[10px] border px-4 py-2 text-left ${FOCO} ${
                  ativa ? 'border-ce-menu bg-ce-menu text-white' : 'border-ce-linha-forte bg-white text-ce-tinta'
                }`}
              >
                <span className="text-base font-bold">{a.titulo}</span>
                <span className={`text-[13px] ${ativa ? 'text-ce-menu-texto' : a.importada ? 'text-ce-concluido' : 'text-ce-carregado'}`}>{a.sub}</span>
              </button>
            );
          })}
        </div>
      )}

      {quadro && abas.length === 0 && (
        <p className="m-0 text-[15px] text-ce-suave">Nenhuma saída foi importada nesta data.</p>
      )}

      {quadro && aba && (
        <div id="painel-saida" role="tabpanel" aria-labelledby={`aba-saida-${aba.aba}`} className="flex flex-col gap-5">
          {!aba.importada && (
            <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#b9c3d3] bg-white px-6 py-10 text-center">
              <h2 className="m-0 text-xl font-bold">Saída {aba.aba} ainda não foi importada</h2>
              <p className="m-0 max-w-[56ch] text-[15px] leading-normal text-ce-suave">
                Escolha “Saída {aba.aba}” no número da saída, selecione o arquivo e clique em Importar. As rotas aparecem aqui assim que o arquivo for lido.
              </p>
            </section>
          )}

          {aba.importada && (
            <>
              {aba.aba === 'sem' ? (
                <span className="text-sm text-ce-suave">
                  Rotas com pacotes que não vieram de um arquivo de saída (fotos dos rótulos ou lista carregada direto na rota).
                  Elas entram na saída quando o arquivo dela trouxer a rota.
                </span>
              ) : (
                <div className="flex flex-col gap-3">
                  {aba.saidas.length === 1 ? (
                    <span className="text-sm text-ce-suave">
                      Arquivo <strong className="text-ce-tinta">{aba.saidas[0].arquivoNome}</strong> · importado às {formatarHora(aba.saidas[0].importadaEm)} · {plural(rotasDaAba.length, 'rota', 'rotas')}
                    </span>
                  ) : (
                    <span className="text-sm text-ce-suave">
                      {plural(aba.saidas.length, 'unidade importou', 'unidades importaram')} esta saída · {plural(rotasDaAba.length, 'rota', 'rotas')}
                    </span>
                  )}
                  <ResumoImportacao key={`${aba.aba}-${aba.saidas.map((s) => s.importadaEm).join()}`} saidas={aba.saidas} agregado={agregado} />
                  {ultima && ultima.saida.numero === aba.aba && (ultima.rotasCriadas.length > 0 || ultima.carteirosNaoEncontrados.length > 0 || ultima.rotasLiberadas.length > 0) && (
                    <ul data-avisos-importacao className="m-0 flex list-none flex-col gap-1 rounded-lg bg-ce-linha-fraca px-3 py-2.5 text-sm text-ce-tinta-2">
                      {ultima.rotasCriadas.length > 0 && (
                        <li>{ultima.rotasCriadas.length === 1 ? 'Rota criada' : 'Rotas criadas'} no Cadastro: <strong>{ultima.rotasCriadas.join(', ')}</strong>.</li>
                      )}
                      {ultima.rotasLiberadas.length > 0 && (
                        <li>{ultima.rotasLiberadas.length === 1 ? 'Rota já liberada, mantida' : 'Rotas já liberadas, mantidas'} como estava: <strong>{ultima.rotasLiberadas.join(', ')}</strong>.</li>
                      )}
                      {ultima.carteirosNaoEncontrados.map((c) => (
                        <li key={c.rota}>Rota <strong>{c.rota}</strong>: o carteiro “{c.valor}” do arquivo não foi encontrado entre os carteiros ativos da unidade.</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <section aria-label={aba.aba === 'sem' ? 'Resumo das rotas sem saída' : 'Resumo da saída'} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {resumo.map((r) => (
                  <div key={r.rotulo} className="flex flex-col gap-0.5 rounded-[10px] border border-ce-linha bg-white px-4 py-3.5">
                    <span className="text-[26px] font-bold tabular-nums">{r.valor}</span>
                    <span className="text-[13px] text-ce-suave">{r.rotulo}</span>
                  </div>
                ))}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label="Filtrar rotas" className="flex flex-wrap gap-2">
                  {(['TODAS', ...ORDEM_STATUS_ROTA] as Filtro[]).map((f) => {
                    const ativo = filtro === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setFiltro(f)}
                        className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${FOCO} ${ativo ? 'border-ce-tinta bg-ce-tinta text-white' : 'border-ce-linha-forte bg-white text-ce-tinta'}`}
                      >
                        {f === 'TODAS' ? 'Todas' : STATUS_ROTA[f].rotulo} <span className="tabular-nums opacity-75">{contagem[f]}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {podeImportar && semCarteiro.length > 0 && (
                    <Botao variante="secundario" className="border-ce-erro text-ce-erro" onClick={() => setCarteiros({ foco: null })}>
                      Atribuir carteiros ({semCarteiro.length})
                    </Botao>
                  )}
                  {podeLiberar && liberaveis.length > 1 && (
                    <Botao variante="secundario" className="border-ce-azul text-ce-azul" onClick={() => setEmLote(true)}>
                      Liberar {liberaveis.length} rotas carregadas
                    </Botao>
                  )}
                </div>
              </div>

              <section aria-label="Rotas" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
                {visiveis.map((r) => (
                  <CartaoDaRota
                    key={r.cargaId ?? r.distritoId}
                    r={r}
                    mostrarUnidade={agregado}
                    podeLiberar={podeLiberar}
                    podeAtribuir={podeImportar}
                    aoLiberar={abrirLiberacao}
                    aoDefinirCarteiro={(rota) => setCarteiros({ foco: rota.distritoId })}
                  />
                ))}
                {visiveis.length === 0 && (
                  <p className="m-0 text-[15px] text-ce-suave">
                    {rotasDaAba.length === 0 ? 'Nenhuma linha do arquivo entrou: esta saída está sem rotas.' : 'Nenhuma rota com esse filtro.'}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      )}

      <Dialogo
        titulo={aLiberar ? `Liberar rota ${aLiberar.codigo} · ${aLiberar.carteiro?.nome ?? ''}?` : ''}
        aberto={!!aLiberar}
        aoFechar={fecharLiberacao}
        rodape={
          <>
            <Botao variante="secundario" onClick={fecharLiberacao} disabled={liberando}>Cancelar</Botao>
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
              Os {aLiberar.total} pacotes desta rota estão sem WhatsApp. Eles seguem para entrega e o rastreio continua valendo.
            </p>
            <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
              <input type="checkbox" checked={cienteSemAvisos} onChange={(e) => setCienteSemAvisos(e.target.checked)} className="size-5" />
              Entendo e quero liberar sem enviar avisos
            </label>
          </>
        ) : (
          <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
            <strong>{aLiberar.comWhatsapp} destinatários</strong> vão receber agora o aviso “sua encomenda já saiu para entrega”, com as opções de entrega.{' '}
            <strong>{aLiberar.total - aLiberar.comWhatsapp} pacotes sem WhatsApp</strong> não serão avisados.
          </p>
        ))}
        {aLiberar && (aLiberar.paraConferir ?? 0) > 0 && (
          <p className="m-0 rounded-lg bg-ce-corrigir-bg px-3 py-2.5 text-[15px] text-ce-corrigir">
            <strong>{aLiberar.paraConferir} para conferir no app do carteiro</strong>: esses pacotes ainda não estão na lista. A liberação continua permitida.
          </p>
        )}
        {aLiberar && (
          <p className="m-0 text-[15px] text-ce-tinta-2">Ele(a) recebe no WhatsApp o resumo das orientações já conhecidas.</p>
        )}
      </Dialogo>

      <Dialogo
        titulo={`Liberar ${liberaveis.length} rotas ${nomeDaAba}?`}
        aberto={emLote && liberaveis.length > 0}
        aoFechar={fecharLiberacao}
        rodape={
          <>
            <Botao variante="secundario" onClick={fecharLiberacao} disabled={liberando}>Cancelar</Botao>
            <Botao onClick={() => void confirmarLote()} disabled={liberando}>{liberando ? 'Liberando…' : 'Liberar e enviar avisos'}</Botao>
          </>
        }
      >
        <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
          <strong>{lote.comWhatsapp} destinatários</strong> vão receber agora o aviso “sua encomenda já saiu para entrega”, com as opções de entrega.{' '}
          <strong>{lote.semWhatsapp} pacotes sem WhatsApp</strong> não serão avisados.
        </p>
        <p className="m-0 text-[15px] text-ce-tinta-2">
          Rotas <strong>{liberaveis.map((r) => r.codigo).join(', ')}</strong>. Cada carteiro recebe no WhatsApp o resumo das orientações já conhecidas.
        </p>
      </Dialogo>

      <AtribuirCarteiros
        aberto={!!carteiros && semCarteiro.length > 0}
        rotas={semCarteiro}
        rotaEmFoco={carteiros?.foco}
        unidadeId={unidadeDaAcao}
        salvando={salvandoCarteiros}
        aoSalvar={(a) => void salvarCarteiros(a)}
        aoFechar={() => setCarteiros(null)}
      />
    </>
  );
}
