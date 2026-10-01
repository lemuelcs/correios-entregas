/**
 * Carregar pacotes de um distrito (US-007–US-009, US-040; ADR-017): planilha
 * CSV/XLSX ou linhas coladas → prévia classificada pelo servidor (nada é
 * gravado) → correção por linha → confirmação.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { useEntregasCargaStore } from '@/stores/entregas-carga.store';
import { entregasApi } from '../entregas.api';
import type { CartaoDistrito, LinhaPrevia } from '../entregas.types';
import { AVISOS_PLANILHA, MOTIVOS, avisarErro, formatarEndereco, formatarWhatsapp } from '../mensagens';
import { Botao, CLASSE_ENTRADA, CabecalhoPagina, Cartao, Carregando, CodigoDistrito, FOCO, Pilula } from '../components/ui';

type Aba = 'arquivo' | 'colar';

const CHIP = {
  ok: 'text-ce-concluido bg-ce-concluido-bg',
  semwa: 'text-ce-carregado bg-ce-carregado-bg',
  corrigir: 'text-ce-corrigir bg-ce-corrigir-bg',
  invalida: 'text-ce-erro bg-ce-erro-bg',
  memoria: 'text-ce-liberado bg-ce-liberado-bg',
};

function situacaoDaLinha(l: LinhaPrevia): { rotulo: string; nota?: string; classe: string } {
  if (l.situacao === 'invalida' && l.motivo) {
    const m = MOTIVOS[l.motivo];
    if (l.motivo === 'ja_no_distrito' && l.detalhe) return { rotulo: `Já está no ${l.detalhe} hoje`, nota: `Remova daqui ou do ${l.detalhe}`, classe: CHIP.invalida };
    return { rotulo: m.rotulo, nota: m.nota, classe: CHIP.invalida };
  }
  if (l.situacao === 'corrigir') return { rotulo: 'WhatsApp para corrigir', nota: l.motivo ? MOTIVOS[l.motivo].nota : undefined, classe: CHIP.corrigir };
  if (l.orientacaoGuardada) return { rotulo: 'Orientação guardada', nota: `De outro dia: “${l.orientacaoGuardada.texto}”`, classe: CHIP.memoria };
  if (l.situacao === 'sem_whatsapp') return { rotulo: 'Sem WhatsApp', nota: 'Aceito; não receberá aviso', classe: CHIP.semwa };
  if (l.descadastrado) return { rotulo: 'Válido', nota: 'Pediu para não receber mensagens', classe: CHIP.ok };
  return { rotulo: 'Válido', classe: CHIP.ok };
}

const ORDEM_SITUACAO: Record<LinhaPrevia['situacao'], number> = { invalida: 0, corrigir: 1, sem_whatsapp: 2, valida: 3 };

function EdicaoLinha({ linha, aoAplicar, aoCancelar, ocupado }: {
  linha: LinhaPrevia;
  aoAplicar: (campos: { codigo: string; nome: string; whatsapp: string }) => void;
  aoCancelar: () => void;
  ocupado: boolean;
}) {
  const [codigo, setCodigo] = useState(linha.codigo);
  const [nome, setNome] = useState(linha.nome);
  const [whatsapp, setWhatsapp] = useState(linha.whatsapp ?? '');
  const base = `linha-${linha.n}`;
  return (
    <form
      className="mt-2 grid gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        aoAplicar({ codigo, nome, whatsapp });
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${base}-codigo`} className="text-[13px] font-semibold">Código</label>
        <input id={`${base}-codigo`} value={codigo} onChange={(e) => setCodigo(e.target.value)} className={`${CLASSE_ENTRADA} font-codigo`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${base}-nome`} className="text-[13px] font-semibold">Destinatário</label>
        <input id={`${base}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} className={CLASSE_ENTRADA} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${base}-whatsapp`} className="text-[13px] font-semibold">WhatsApp</label>
        <input id={`${base}-whatsapp`} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="(61) 99812-4412" className={CLASSE_ENTRADA} />
      </div>
      <div className="flex gap-2">
        <Botao type="submit" disabled={ocupado}>Aplicar</Botao>
        <Botao variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  );
}

export function CargaDistritoPage() {
  const { distritoId = '' } = useParams();
  const navigate = useNavigate();
  const { previa, origem, processando, iniciar, enviarArquivo, enviarTexto, corrigirLinha, descartarLinha, confirmar, descartarPrevia } = useEntregasCargaStore();
  const [aba, setAba] = useState<Aba>('arquivo');
  const [texto, setTexto] = useState('');
  const [cartao, setCartao] = useState<CartaoDistrito | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    iniciar(distritoId);
  }, [distritoId, iniciar]);

  useEffect(() => {
    let vivo = true;
    entregasApi.quadro({})
      .then((q) => {
        const d = q.distritos.find((x) => x.distritoId === distritoId);
        if (vivo) setCartao(d ?? null);
        if (!d && vivo) toast.error('Distrito não encontrado.');
      })
      .catch((err) => avisarErro(err, 'Não foi possível carregar o distrito.'));
    return () => {
      vivo = false;
    };
  }, [distritoId]);

  const linhas = useMemo(
    () => [...(previa?.linhas ?? [])].sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || a.n - b.n),
    [previa],
  );

  async function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      await enviarArquivo(arquivo);
    } catch (err) {
      avisarErro(err, 'Não foi possível ler a planilha.');
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  }

  async function aoColar() {
    if (!texto.trim()) {
      toast.error('Cole ao menos uma linha.');
      return;
    }
    try {
      await enviarTexto(texto);
    } catch (err) {
      avisarErro(err, 'Não foi possível ler as linhas.');
    }
  }

  async function aplicarCorrecao(n: number, campos: { codigo: string; nome: string; whatsapp: string }) {
    try {
      await corrigirLinha(n, { ...campos, whatsapp: campos.whatsapp.trim() || null });
      setEditando(null);
    } catch (err) {
      avisarErro(err, 'Não foi possível revalidar a linha.');
    }
  }

  async function aoConfirmar() {
    try {
      const r = await confirmar();
      const descartes = r.descartados > 0 ? ` ${r.descartados} descartado(s).` : '';
      toast.success(`${r.aceitos} pacote(s) carregado(s) em ${cartao?.codigo ?? 'distrito'}.${descartes}`);
      navigate('/entregas/carregar');
    } catch (err) {
      avisarErro(err, 'Não foi possível gravar os pacotes.');
    }
  }

  const resumo = previa?.resumo;
  const aceitaveis = resumo?.aceitaveis ?? 0;
  const abaClasse = (ativa: boolean) =>
    `-mb-px min-h-11 border-0 border-b-[3px] bg-transparent px-4 text-[15px] ${FOCO} ${ativa ? 'border-ce-azul font-bold text-ce-azul' : 'border-transparent font-medium text-ce-suave'}`;

  return (
    <>
      <Link to="/entregas/carregar" className={`self-start text-sm font-semibold text-ce-azul no-underline ${FOCO}`}>← Voltar ao quadro de distritos</Link>
      <CabecalhoPagina
        titulo={
          <div className="flex flex-wrap items-center gap-2.5">
            {cartao && <CodigoDistrito grande>{cartao.codigo}</CodigoDistrito>}
            <h1 className="m-0 text-[26px] font-bold md:text-[28px]">{cartao?.nome ?? 'Distrito'}</h1>
          </div>
        }
        subtitulo={
          <>
            Carregar pacotes de hoje
            {cartao && (
              <>
                {' · '}Carteiro: <strong className="text-ce-tinta">{cartao.carteiro?.nome ?? 'sem carteiro'}</strong>
                {' · '}<Link to="/entregas/cadastro" className="text-ce-azul">trocar só hoje</Link>
              </>
            )}
          </>
        }
        acoes={cartao?.cargaId ? <Link to={`/entregas/distritos/${cartao.cargaId}`} className="text-sm font-semibold text-ce-azul">Ver pacotes já carregados ({cartao.total})</Link> : undefined}
      />

      <Cartao className="flex flex-col gap-4 p-5">
        <div role="tablist" aria-label="Forma de carregar" className="flex gap-1 border-b border-ce-linha">
          <button type="button" role="tab" id="aba-arquivo" aria-controls="painel-arquivo" aria-selected={aba === 'arquivo'} onClick={() => setAba('arquivo')} className={abaClasse(aba === 'arquivo')}>Enviar planilha</button>
          <button type="button" role="tab" id="aba-colar" aria-controls="painel-colar" aria-selected={aba === 'colar'} onClick={() => setAba('colar')} className={abaClasse(aba === 'colar')}>Colar linhas</button>
        </div>

        {aba === 'arquivo' ? (
          <div role="tabpanel" id="painel-arquivo" aria-labelledby="aba-arquivo" className="flex flex-col gap-2.5">
            <label
              htmlFor="arquivo-planilha"
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                void aoEscolherArquivo(e.dataTransfer.files?.[0]);
              }}
              className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-7 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ce-azul ${arrastando ? 'border-ce-azul bg-ce-liberado-bg' : 'border-[#b9c3d3] bg-[#f8fafc]'}`}
            >
              <Upload size={28} className="text-ce-azul" aria-hidden="true" />
              <span className="text-base font-semibold">Arraste a planilha ou clique para escolher</span>
              <span className="text-sm text-ce-suave">
                CSV ou XLSX · até 500 pacotes · colunas: código, nome, WhatsApp, endereço (logradouro, número, complemento, bairro, cidade, UF, CEP)
              </span>
              <input
                ref={arquivoRef}
                id="arquivo-planilha"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="absolute h-px w-px opacity-0"
                onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
                disabled={processando}
              />
            </label>
            {origem && previa && (
              <span className="text-sm text-ce-tinta-2">
                Carregado: <strong>{origem}</strong> · {previa.resumo.total} linhas
              </span>
            )}
          </div>
        ) : (
          <div role="tabpanel" id="painel-colar" aria-labelledby="aba-colar" className="flex flex-col gap-2">
            <label htmlFor="colar-linhas" className="text-sm font-semibold">Cole as linhas (separadas por tabulação, ponto e vírgula ou vírgula)</label>
            <textarea
              id="colar-linhas"
              rows={6}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="OY526018152BR;Maria Aparecida Souza;61 99812-4412;QS 7 Rua 12 Casa 45, Taguatinga Sul, Brasília-DF, 72025-120"
              className={`resize-y rounded-lg border border-ce-linha-forte p-3 font-codigo text-[13px] ${FOCO}`}
            />
            <Botao className="self-start" onClick={() => void aoColar()} disabled={processando}>Gerar prévia</Botao>
          </div>
        )}
        {processando && <Carregando texto="Lendo e validando…" />}
      </Cartao>

      {previa && resumo && (
        <Cartao aria-label="Prévia" className="flex flex-col">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-ce-linha px-5 py-4">
            <h2 className="m-0 text-lg font-bold">Prévia</h2>
            <Pilula classe={CHIP.ok}>{resumo.validas + resumo.semWhatsapp} válidos</Pilula>
            {resumo.semWhatsapp > 0 && <Pilula classe={CHIP.semwa}>{resumo.semWhatsapp} deles sem WhatsApp (entram, não são avisados)</Pilula>}
            {resumo.corrigir > 0 && <Pilula classe={CHIP.corrigir}>{resumo.corrigir} para corrigir</Pilula>}
            {resumo.invalidas > 0 && <Pilula classe={CHIP.invalida}>{resumo.invalidas} inválidos</Pilula>}
            {resumo.orientacoesGuardadas > 0 && <Pilula classe={CHIP.memoria}>{resumo.orientacoesGuardadas} com orientação guardada</Pilula>}
          </div>
          {previa.avisos.length > 0 && (
            <ul className="m-0 list-none border-b border-ce-linha px-5 py-3 text-sm text-ce-carregado">
              {previa.avisos.map((a) => <li key={a}>{AVISOS_PLANILHA[a] ?? a}</li>)}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.06em] text-ce-suave">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Situação</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Código</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Destinatário</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">WhatsApp</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Endereço</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const s = situacaoDaLinha(l);
                  const corrigivel = l.situacao === 'corrigir' || l.situacao === 'invalida';
                  return (
                    <tr key={l.n} data-linha={l.n} className="border-t border-ce-linha-fraca align-top">
                      <td className="px-5 py-3">
                        <Pilula classe={s.classe} className="!px-2 !py-0.5">{s.rotulo}</Pilula>
                        {s.nota && <div className="mt-1 max-w-[260px] text-[13px] text-ce-suave">{s.nota}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-codigo text-[13px]">{l.codigo || '—'}</td>
                      <td className="px-3 py-3">
                        {l.nome || '—'}
                        {editando === l.n && (
                          <EdicaoLinha linha={l} ocupado={processando} aoCancelar={() => setEditando(null)} aoAplicar={(c) => void aplicarCorrecao(l.n, c)} />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{l.situacao === 'valida' ? formatarWhatsapp(l.whatsapp) : l.whatsapp || '—'}</td>
                      <td className="px-3 py-3 text-ce-tinta-2">{formatarEndereco(l)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {corrigivel && editando !== l.n && (
                          <div className="flex justify-end gap-1">
                            <Botao variante="texto" onClick={() => setEditando(l.n)} aria-label={`Corrigir linha ${l.n}`}>Corrigir</Botao>
                            <Botao variante="texto" onClick={() => void descartarLinha(l.n).catch((err) => avisarErro(err))} aria-label={`Descartar linha ${l.n}`}>Descartar</Botao>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ce-linha px-5 py-4">
            <span className="text-sm text-ce-suave">
              Inválidos são descartados. O pacote para corrigir entra como “sem WhatsApp” se você não corrigir.
            </span>
            <div className="flex flex-wrap gap-2.5">
              <Botao variante="secundario" onClick={descartarPrevia}>Cancelar</Botao>
              <Botao onClick={() => void aoConfirmar()} disabled={processando || aceitaveis === 0}>
                {aceitaveis === 0 ? 'Confirmar' : `Confirmar ${aceitaveis} pacotes`}
              </Botao>
            </div>
          </div>
        </Cartao>
      )}
    </>
  );
}
