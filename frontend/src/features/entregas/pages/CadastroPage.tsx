/**
 * Cadastro (US-001–US-006, ADR-009/010): abas Unidades, Supervisores e Canais
 * (só a Gestão) e Rotas, Carteiros, Agências e lockers (o supervisor grava
 * na própria unidade; a Gestão consulta a unidade em foco). Na aba Rotas,
 * o carteiro do dia (troca só para hoje).
 *
 * Rotas, carteiros e pontos têm busca e paginação; a Gestão edita unidades,
 * supervisores e canais (inclusive desativar o canal e gerar um novo token de entrada).
 *
 * (Nos identificadores, rotas e campos da API a rota ainda se chama "distrito".)
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { entregasApi } from '../entregas.api';
import type { CanalProsio, CarteiroCadastro, Distrito, Pagina, PontoRetirada, Quadro, Supervisor, UnidadeGestao } from '../entregas.types';
import { avisarErro, formatarWhatsapp } from '../mensagens';
import { Botao, CLASSE_ENTRADA, CabecalhoPagina, Cartao, Carregando, FOCO, Pilula } from '../components/ui';
import { CarteiroDoDia, FormCarteiro, FormDistrito, FormPonto, FormSenhaCarteiro } from '../components/FormulariosCadastro';
import { DialogoConfirmar, DialogoToken, FormCanal, FormSupervisor, FormUnidade, rotuloTipoCanal } from '../components/FormulariosGestao';

type Aba = 'unidades' | 'supervisores' | 'canais' | 'distritos' | 'carteiros' | 'pontos';

const ABAS: Record<Aba, { rotulo: string; acao: string; dica: string; gestao: boolean; busca?: string }> = {
  unidades: { rotulo: 'Unidades', acao: 'Nova unidade', dica: 'Cadastrado pela Gestão (sede): tipo, endereço e canal de WhatsApp de cada unidade.', gestao: true },
  supervisores: { rotulo: 'Supervisores', acao: 'Novo supervisor', dica: 'Cadastrado pela Gestão. Cada supervisor vê só a própria unidade.', gestao: true },
  canais: { rotulo: 'Canais de WhatsApp', acao: 'Novo canal', dica: 'Canais do Prosio usados pelas unidades. Os segredos nunca voltam depois de gravados.', gestao: true },
  distritos: { rotulo: 'Rotas', acao: 'Nova rota', dica: 'Cada rota tem um carteiro padrão.', gestao: false, busca: 'Buscar rota por código ou nome' },
  carteiros: { rotulo: 'Carteiros', acao: 'Novo carteiro', dica: 'Carteiros da unidade. Recebem as orientações pelo WhatsApp, sem login.', gestao: false, busca: 'Buscar carteiro por nome ou matrícula' },
  pontos: { rotulo: 'Agências e lockers', acao: 'Novo ponto de retirada', dica: 'Oferecidos ao destinatário em “Deixar na agência” e “Deixar no locker”. Até 10 ativos de cada tipo.', gestao: false, busca: 'Buscar agência ou locker por nome ou endereço' },
};

const ABAS_UNIDADE: Aba[] = ['distritos', 'carteiros', 'pontos'];
const ABAS_GESTAO: Aba[] = ['unidades', 'supervisores', 'canais', 'distritos', 'carteiros', 'pontos'];

/** Linhas por página nas listas com busca (rotas, carteiros, pontos). */
export const TAMANHO_PAGINA_CADASTRO = 20;

// ——— Tabela ———————————————————————————————————————————————————————

function Tabela({ colunas, linhas, vazio, rotulo }: { colunas: string[]; linhas: Array<{ id: string; celulas: ReactNode[] }> | null; vazio: string; rotulo: string }) {
  if (!linhas) return <Carregando />;
  return (
    <Cartao className="overflow-x-auto" aria-label={rotulo}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.06em] text-ce-suave">
            {colunas.map((c, i) => (
              <th key={i} scope="col" className="px-5 py-3 font-semibold">{c || <span className="sr-only">Ações</span>}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-t border-ce-linha-fraca">
              {l.celulas.map((c, i) => <td key={i} className="px-5 py-3.5">{c}</td>)}
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr><td colSpan={colunas.length} className="px-5 py-6 text-ce-suave">{vazio}</td></tr>
          )}
        </tbody>
      </table>
    </Cartao>
  );
}

function Situacao({ ativo, feminino = false, extra }: { ativo: boolean; feminino?: boolean; extra?: string }) {
  const texto = ativo ? (feminino ? 'Ativa' : 'Ativo') : feminino ? 'Inativa' : 'Inativo';
  return <span className={ativo ? '' : 'text-ce-suave'}>{texto}{extra ? ` · ${extra}` : ''}</span>;
}

function Paginacao({ pagina, totalPaginas, total, aoMudar }: { pagina: number; totalPaginas: number; total: number; aoMudar: (p: number) => void }) {
  if (totalPaginas <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-ce-suave">Página {pagina} de {totalPaginas} · {total} {total === 1 ? 'registro' : 'registros'}</span>
      <div className="flex gap-2">
        <Botao variante="secundario" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>Anterior</Botao>
        <Botao variante="secundario" disabled={pagina >= totalPaginas} onClick={() => aoMudar(pagina + 1)}>Próxima</Botao>
      </div>
    </nav>
  );
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pontos de retirada: a API devolve todos; a busca e as páginas são feitas aqui. */
export function paginarPontos(pontos: PontoRetirada[], busca: string, pagina: number, tamanho = TAMANHO_PAGINA_CADASTRO): Pagina<PontoRetirada> {
  const termo = semAcento(busca.trim());
  const filtrados = termo ? pontos.filter((p) => semAcento(`${p.nome} ${p.endereco}`).includes(termo)) : pontos;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanho));
  const atual = Math.min(Math.max(1, pagina), totalPaginas);
  return { itens: filtrados.slice((atual - 1) * tamanho, atual * tamanho), total: filtrados.length, pagina: atual, tamanho, totalPaginas };
}

// ——— Página ———————————————————————————————————————————————————————

type Edicao =
  | { tipo: 'distrito'; item: Distrito | null }
  | { tipo: 'carteiro'; item: CarteiroCadastro | null }
  | { tipo: 'senha'; item: CarteiroCadastro }
  | { tipo: 'ponto'; item: PontoRetirada | null }
  | { tipo: 'unidade'; item: UnidadeGestao | null }
  | { tipo: 'supervisor'; item: Supervisor | null }
  | { tipo: 'canal'; item: CanalProsio | null }
  | { tipo: 'token'; item: CanalProsio }
  | { tipo: 'situacao-canal'; item: CanalProsio }
  | null;

export function CadastroPage() {
  const user = useAuthStore((s) => s.user);
  const unidadeNomeSalvo = useAuthStore((s) => s.unidadeNome);
  const ehGestao = user?.role === 'GESTAO';
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const escolherUnidade = useEntregasContextoStore((s) => s.escolherUnidade);
  const cad = useEntregasCadastroStore();
  const [params, setParams] = useSearchParams();
  const abas = ehGestao ? ABAS_GESTAO : ABAS_UNIDADE;
  const pedida = params.get('aba') as Aba | null;
  const aba: Aba = pedida && abas.includes(pedida) ? pedida : abas[0];
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [token, setToken] = useState<{ canal: CanalProsio; novo: boolean } | null>(null);
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  // Listas com busca e páginas (rotas e carteiros vêm paginados do servidor).
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState({ busca: '', pagina: 1 });
  const [paginaDistritos, setPaginaDistritos] = useState<Pagina<Distrito> | null>(null);
  const [paginaCarteiros, setPaginaCarteiros] = useState<Pagina<CarteiroCadastro> | null>(null);
  const pedido = useRef(0);

  const unidadeId = ehGestao ? unidadeGestaoId ?? undefined : undefined;
  const operacional = !ABAS[aba].gestao;
  const podeEditar = !ehGestao || ABAS[aba].gestao;
  const unidadeFoco = ehGestao ? cad.unidades?.find((u) => u.id === unidadeGestaoId) : null;

  // Outra aba ou outra unidade: a busca recomeça e as listas da unidade anterior saem da tela.
  useEffect(() => {
    setBusca('');
    setFiltro((f) => (f.busca === '' && f.pagina === 1 ? f : { busca: '', pagina: 1 }));
    setPaginaDistritos(null);
    setPaginaCarteiros(null);
    setQuadro(null);
  }, [aba, unidadeId]);

  // Busca aplicada com uma pequena espera, sem uma chamada por tecla.
  useEffect(() => {
    const t = window.setTimeout(() => setFiltro((f) => (f.busca === busca.trim() ? f : { busca: busca.trim(), pagina: 1 })), 350);
    return () => window.clearTimeout(t);
  }, [busca]);

  const recarregar = useCallback(async () => {
    pedido.current += 1;
    const meu = pedido.current;
    const listagem = { unidadeId, busca: filtro.busca || undefined, pagina: filtro.pagina, tamanho: TAMANHO_PAGINA_CADASTRO };
    try {
      if (operacional) {
        if (ehGestao && !unidadeId) return;
        const [, , , pagina] = await Promise.all([
          cad.carregarDistritos(unidadeId),
          cad.carregarCarteiros(unidadeId),
          aba === 'pontos' ? cad.carregarPontos(unidadeId) : null,
          aba === 'distritos' ? entregasApi.distritosPagina(listagem) : aba === 'carteiros' ? entregasApi.carteirosPagina(listagem) : null,
        ]);
        // Só a resposta do pedido mais recente chega à tela (busca digitada depressa, troca de unidade).
        if (meu !== pedido.current) return;
        if (aba === 'distritos') setPaginaDistritos(pagina as Pagina<Distrito>);
        if (aba === 'carteiros') setPaginaCarteiros(pagina as Pagina<CarteiroCadastro>);
        if (aba === 'distritos' && !ehGestao) {
          const q = await entregasApi.quadro({});
          if (meu === pedido.current) setQuadro(q);
        }
      } else if (aba === 'canais') {
        await cad.carregarCanais();
      } else if (aba === 'unidades') {
        await Promise.all([cad.carregarUnidades(), cad.carregarCanais()]);
      } else {
        await Promise.all([cad.carregarSupervisores(), cad.carregarUnidades()]);
      }
    } catch (err) {
      if (meu === pedido.current) avisarErro(err, 'Não foi possível carregar o cadastro.');
    }
    // `cad` é o store inteiro; as funções dele são estáveis.
  }, [aba, operacional, ehGestao, unidadeId, filtro]);

  // Troca de aba ou de unidade: as listas da unidade anterior não ficam na tela enquanto as novas chegam.
  useEffect(() => {
    if (operacional) cad.limparUnidade();
  }, [aba, operacional, unidadeId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const fechar = () => setEdicao(null);
  const salvarERecarregar = async () => {
    setEdicao(null);
    await recarregar();
  };

  const pontosPagina = useMemo(
    () => (cad.pontos ? paginarPontos(cad.pontos, filtro.busca, filtro.pagina) : null),
    [cad.pontos, filtro],
  );
  const paginaAtual: Pagina<unknown> | null = aba === 'distritos' ? paginaDistritos : aba === 'carteiros' ? paginaCarteiros : aba === 'pontos' ? pontosPagina : null;

  const linhas = useMemo(() => {
    const acao = (rotulo: string, nomeAcessivel: string, fn: () => void, perigo = false) => (
      <Botao variante="texto" className={`!px-2 ${perigo ? '!text-ce-erro' : ''}`} onClick={fn} aria-label={nomeAcessivel}>{rotulo}</Botao>
    );
    const editar = (rotulo: string, fn: () => void) => acao('Editar', rotulo, fn);
    switch (aba) {
      case 'distritos':
        return paginaDistritos?.itens.map((d) => ({
          id: d.id,
          celulas: [
            <span className="font-codigo font-medium">{d.codigo}</span>,
            d.nome,
            d.carteiroPadrao?.nome ?? '—',
            <Situacao ativo={d.ativo} feminino extra={!d.carteiroPadrao ? 'sem carteiro padrão' : undefined} />,
            podeEditar ? editar(`Editar ${d.codigo}`, () => setEdicao({ tipo: 'distrito', item: d })) : null,
          ],
        })) ?? null;
      case 'carteiros':
        return paginaCarteiros?.itens.map((c) => ({
          id: c.id,
          celulas: [
            c.nome ?? '—',
            c.matricula,
            <span className="tabular-nums">{formatarWhatsapp(c.whatsapp)}</span>,
            c.distritosPadrao.map((d) => d.codigo).join(', ') || '— (volante)',
            <Situacao ativo={c.ativo} />,
            podeEditar ? (
              <div className="flex flex-wrap gap-x-1">
                {editar(`Editar ${c.nome ?? c.matricula}`, () => setEdicao({ tipo: 'carteiro', item: c }))}
                {acao('Definir senha', `Definir senha de ${c.nome ?? c.matricula}`, () => setEdicao({ tipo: 'senha', item: c }))}
              </div>
            ) : null,
          ],
        })) ?? null;
      case 'pontos':
        return pontosPagina?.itens.map((p) => ({
          id: p.id,
          celulas: [
            p.nome,
            p.tipo === 'AGENCIA' ? 'Agência' : 'Locker',
            p.endereco,
            p.horario,
            <Situacao ativo={p.ativo} feminino={p.tipo === 'AGENCIA'} />,
            podeEditar ? editar(`Editar ${p.nome}`, () => setEdicao({ tipo: 'ponto', item: p })) : null,
          ],
        })) ?? null;
      case 'unidades':
        return cad.unidades?.map((u) => ({
          id: u.id,
          celulas: [
            <span>{u.nome}{!u.ativa && <span className="text-ce-suave"> · desativada</span>}</span>,
            u.tipo === 'HIBRIDA' ? 'Híbrida' : u.tipo,
            `${u.logradouro} ${u.numero} · ${u.bairro} · ${u.uf}`,
            u.canalProsio ? `${rotuloTipoCanal(u.canalProsio.tipo)} · ${u.canalProsio.nome}${u.canalProsio.ativo ? '' : ' (desativado)'}` : '—',
            u.semSupervisor ? '0 · sem supervisor' : String(u.supervisoresAtivos),
            editar(`Editar ${u.nome}`, () => setEdicao({ tipo: 'unidade', item: u })),
          ],
        })) ?? null;
      case 'supervisores':
        return cad.supervisores?.map((s) => ({
          id: s.id,
          celulas: [
            s.nome,
            s.matricula ?? '—',
            <span className="tabular-nums">{formatarWhatsapp(s.telefoneCelular)}</span>,
            s.unidade?.nome ?? '—',
            <Situacao ativo={s.ativo} />,
            editar(`Editar ${s.nome}`, () => setEdicao({ tipo: 'supervisor', item: s })),
          ],
        })) ?? null;
      case 'canais':
        return cad.canais?.map((c) => ({
          id: c.id,
          celulas: [
            c.nome,
            c.baseUrl,
            rotuloTipoCanal(c.tipo),
            c.compartilhado ? 'Sim' : 'Não',
            String(c.unidades ?? 0),
            <Situacao ativo={c.ativo} />,
            <div className="flex flex-wrap gap-x-1">
              {editar(`Editar ${c.nome}`, () => setEdicao({ tipo: 'canal', item: c }))}
              {acao('Gerar novo token', `Gerar novo token de ${c.nome}`, () => setEdicao({ tipo: 'token', item: c }))}
              {acao(c.ativo ? 'Desativar' : 'Reativar', `${c.ativo ? 'Desativar' : 'Reativar'} ${c.nome}`, () => setEdicao({ tipo: 'situacao-canal', item: c }), c.ativo)}
            </div>,
          ],
        })) ?? null;
      default:
        return null;
    }
  }, [aba, paginaDistritos, paginaCarteiros, pontosPagina, cad.unidades, cad.supervisores, cad.canais, podeEditar]);

  const colunas: Record<Aba, string[]> = {
    distritos: ['Código', 'Nome', 'Carteiro padrão', 'Situação', ''],
    carteiros: ['Nome', 'Matrícula', 'WhatsApp', 'Rota padrão', 'Situação', ''],
    pontos: ['Nome', 'Tipo', 'Endereço', 'Horário', 'Situação', ''],
    unidades: ['Unidade', 'Tipo', 'Endereço', 'Canal de WhatsApp', 'Supervisores', ''],
    supervisores: ['Nome', 'Matrícula', 'WhatsApp', 'Unidade', 'Situação', ''],
    canais: ['Nome', 'Endereço do Prosio', 'Tipo', 'Compartilhado', 'Unidades', 'Situação', ''],
  };

  function novo() {
    if (aba === 'distritos') setEdicao({ tipo: 'distrito', item: null });
    else if (aba === 'carteiros') setEdicao({ tipo: 'carteiro', item: null });
    else if (aba === 'pontos') setEdicao({ tipo: 'ponto', item: null });
    else if (aba === 'unidades') setEdicao({ tipo: 'unidade', item: null });
    else if (aba === 'supervisores') setEdicao({ tipo: 'supervisor', item: null });
    else setEdicao({ tipo: 'canal', item: null });
  }

  const unidadeNome = ehGestao ? unidadeFoco?.nome : user?.unidade?.nome ?? unidadeNomeSalvo;
  const dica = operacional && unidadeNome ? `${unidadeNome} · ${ABAS[aba].dica}` : ABAS[aba].dica;
  const rotuloBusca = ABAS[aba].busca;
  const vazio = filtro.busca ? `Nada encontrado para “${filtro.busca}”.` : 'Nada cadastrado ainda.';

  return (
    <>
      <CabecalhoPagina
        titulo="Cadastro"
        subtitulo={dica}
        acoes={podeEditar ? <Botao onClick={novo}>{ABAS[aba].acao}</Botao> : undefined}
      />

      <div role="tablist" aria-label="Cadastros" className="-mx-4 flex gap-1 overflow-x-auto border-b border-[#dce1e8] px-4 md:mx-0 md:flex-wrap md:px-0">
        {abas.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={a === aba}
            onClick={() => setParams({ aba: a }, { replace: true })}
            className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-0 border-b-[3px] bg-transparent px-4 text-[15px] ${FOCO} ${a === aba ? 'border-ce-azul font-bold text-ce-azul' : 'border-transparent font-medium text-ce-suave'}`}
          >
            {ABAS[a].rotulo}
          </button>
        ))}
      </div>

      {operacional && ehGestao && !unidadeId ? (
        <p className="m-0 text-[15px] text-ce-suave">Escolha a unidade em foco no menu para consultar {ABAS[aba].rotulo.toLowerCase()}.</p>
      ) : (
        <div role="tabpanel" aria-label={ABAS[aba].rotulo} className="flex flex-col gap-5">
          {operacional && ehGestao && <Pilula classe="bg-ce-linha-fraca text-ce-tinta-2" className="self-start">Somente consulta · o supervisor da unidade faz as alterações</Pilula>}
          {rotuloBusca && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="w-full sm:w-80">
                <label htmlFor="cadastro-busca" className="sr-only">{rotuloBusca}</label>
                <input
                  id="cadastro-busca"
                  type="search"
                  placeholder={rotuloBusca}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  maxLength={80}
                  className={CLASSE_ENTRADA}
                />
              </div>
              {aba === 'pontos' && cad.pontos && (
                <p className="m-0 text-sm text-ce-suave">Ativos: {cad.ativosPorTipo.AGENCIA}/10 agências · {cad.ativosPorTipo.LOCKER}/10 lockers</p>
              )}
            </div>
          )}
          <Tabela colunas={colunas[aba]} linhas={linhas} rotulo={ABAS[aba].rotulo} vazio={vazio} />
          {paginaAtual && (
            <Paginacao
              pagina={paginaAtual.pagina}
              totalPaginas={paginaAtual.totalPaginas}
              total={paginaAtual.total}
              aoMudar={(p) => setFiltro((f) => ({ ...f, pagina: p }))}
            />
          )}
          {aba === 'distritos' && !ehGestao && cad.distritos && cad.carteiros && (
            <CarteiroDoDia distritos={cad.distritos} carteiros={cad.carteiros} quadro={quadro} aoMudar={recarregar} />
          )}
        </div>
      )}

      {edicao?.tipo === 'distrito' && <FormDistrito distrito={edicao.item} carteiros={cad.carteiros ?? []} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'carteiro' && <FormCarteiro carteiro={edicao.item} distritos={cad.distritos ?? []} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'senha' && <FormSenhaCarteiro carteiro={edicao.item} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'ponto' && <FormPonto ponto={edicao.item} aoFechar={fechar} aoSalvar={salvarERecarregar} />}
      {edicao?.tipo === 'canal' && (
        <FormCanal
          canal={edicao.item}
          aoFechar={fechar}
          aoSalvar={async (canal) => {
            setEdicao(null);
            if (canal.tokenEntrada) setToken({ canal, novo: false });
            await recarregar();
          }}
        />
      )}
      {edicao?.tipo === 'token' && (
        <DialogoConfirmar
          titulo={`Gerar novo token de ${edicao.item.nome}?`}
          rotulo="Gerar novo token"
          perigo
          aoFechar={fechar}
          aoConfirmar={async () => {
            const canal = await entregasApi.editarCanal(edicao.item.id, { regenerarTokenEntrada: true });
            setEdicao(null);
            setToken({ canal, novo: true });
            await recarregar();
          }}
        >
          <p className="m-0">O token atual deixa de valer na hora. As ações de botão do Prosio deste canal param de chegar até você configurar o novo token lá.</p>
          <p className="m-0">O novo token aparece uma única vez, na próxima tela.</p>
        </DialogoConfirmar>
      )}
      {edicao?.tipo === 'situacao-canal' && (
        <DialogoConfirmar
          titulo={`${edicao.item.ativo ? 'Desativar' : 'Reativar'} ${edicao.item.nome}?`}
          rotulo={edicao.item.ativo ? 'Desativar canal' : 'Reativar canal'}
          perigo={edicao.item.ativo}
          aoFechar={fechar}
          aoConflito={(atual) => {
            setEdicao({ tipo: 'situacao-canal', item: atual as CanalProsio });
            void recarregar();
          }}
          aoConfirmar={async () => {
            const c = edicao.item;
            await entregasApi.editarCanal(c.id, { ativo: !c.ativo, ...(c.atualizadoEm ? { atualizadoEm: c.atualizadoEm } : {}) });
            toast.success(c.ativo ? `Canal ${c.nome} desativado.` : `Canal ${c.nome} reativado.`);
            await salvarERecarregar();
          }}
        >
          {edicao.item.ativo ? (
            <p className="m-0">
              {(edicao.item.unidades ?? 0) > 0
                ? `${edicao.item.unidades === 1 ? '1 unidade usa' : `${edicao.item.unidades} unidades usam`} este canal. Desativado, os avisos aos destinatários e o atendimento dessas unidades param.`
                : 'Nenhuma unidade usa este canal. Ele deixa de aparecer para novas unidades.'}
            </p>
          ) : (
            <p className="m-0">O canal volta a enviar avisos e a abrir o atendimento das unidades vinculadas.</p>
          )}
        </DialogoConfirmar>
      )}
      {edicao?.tipo === 'unidade' && (
        <FormUnidade
          unidade={edicao.item}
          canais={cad.canais ?? []}
          aoFechar={fechar}
          aoSalvar={async (u) => {
            if (!unidadeGestaoId) escolherUnidade(u.id);
            await salvarERecarregar();
          }}
        />
      )}
      {edicao?.tipo === 'supervisor' && <FormSupervisor supervisor={edicao.item} unidades={cad.unidades ?? []} aoFechar={fechar} aoSalvar={salvarERecarregar} />}

      <DialogoToken canal={token?.canal ?? null} novo={!!token?.novo} aoFechar={() => setToken(null)} />
    </>
  );
}
