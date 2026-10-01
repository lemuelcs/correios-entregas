/**
 * Modal "Atribuir carteiros" (ADR-019): lista as rotas carregadas sem carteiro
 * e deixa escolher, para cada uma, um carteiro ativo da unidade. Grava o
 * carteiro do dia; a caixa marca também o padrão da rota no Cadastro.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { entregasApi } from '../entregas.api';
import type { AtribuicaoCarteiro, CarteiroCadastro, CartaoRota } from '../entregas.types';
import { avisarErro } from '../mensagens';
import { plural } from '../saidas';
import { Botao, CLASSE_ENTRADA, Carregando, Dialogo } from './ui';

interface Escolha {
  carteiroId: string;
  definirPadrao: boolean;
}

export function AtribuirCarteiros({ aberto, rotas, rotaEmFoco, unidadeId, salvando, aoSalvar, aoFechar }: {
  aberto: boolean;
  /** Rotas sem carteiro da aba aberta. */
  rotas: CartaoRota[];
  /** Rota do cartão que abriu o modal: vai primeiro na lista. */
  rotaEmFoco?: string | null;
  /** Só a Gestão envia (o supervisor fica na unidade do token). */
  unidadeId?: string;
  salvando: boolean;
  aoSalvar: (atribuicoes: AtribuicaoCarteiro[]) => void;
  aoFechar: () => void;
}) {
  const [carteiros, setCarteiros] = useState<CarteiroCadastro[] | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});

  useEffect(() => {
    if (!aberto) return undefined;
    let vivo = true;
    setEscolhas({});
    setCarteiros(null);
    entregasApi.carteiros(unidadeId)
      .then((r) => vivo && setCarteiros(r.itens.filter((c) => c.ativo)))
      .catch((err) => {
        if (vivo) setCarteiros([]);
        avisarErro(err, 'Não foi possível carregar os carteiros.');
      });
    return () => {
      vivo = false;
    };
  }, [aberto, unidadeId]);

  const ordenadas = [...rotas].sort((a, b) => Number(b.distritoId === rotaEmFoco) - Number(a.distritoId === rotaEmFoco));
  const atribuicoes: AtribuicaoCarteiro[] = ordenadas
    .filter((r) => escolhas[r.distritoId]?.carteiroId)
    .map((r) => ({ distritoId: r.distritoId, carteiroId: escolhas[r.distritoId].carteiroId, definirPadrao: escolhas[r.distritoId].definirPadrao }));
  const mudar = (distritoId: string, parte: Partial<Escolha>) =>
    setEscolhas((e) => ({ ...e, [distritoId]: { ...(e[distritoId] ?? { carteiroId: '', definirPadrao: false }), ...parte } }));

  return (
    <Dialogo
      titulo="Atribuir carteiros"
      aberto={aberto}
      aoFechar={() => !salvando && aoFechar()}
      largura="max-w-[620px]"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
          <Botao onClick={() => aoSalvar(atribuicoes)} disabled={salvando || atribuicoes.length === 0}>
            {salvando ? 'Salvando…' : atribuicoes.length > 1 ? `Salvar ${atribuicoes.length} carteiros` : 'Salvar carteiro'}
          </Botao>
        </>
      }
    >
      <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
        {plural(rotas.length, 'rota está', 'rotas estão')} sem carteiro. A rota só pode ser liberada depois que tiver um carteiro para hoje.
      </p>
      {carteiros === null && <Carregando texto="Carregando os carteiros…" />}
      {carteiros?.length === 0 && (
        <p role="alert" className="m-0 rounded-lg bg-ce-erro-bg px-3 py-2.5 text-[15px] text-ce-erro">
          A unidade não tem carteiro ativo. <Link to="/entregas/cadastro?aba=carteiros" className="font-semibold underline">Cadastre os carteiros</Link> e volte aqui.
        </p>
      )}
      {carteiros && carteiros.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {ordenadas.map((r) => {
            const e = escolhas[r.distritoId];
            const base = `atribuir-${r.distritoId}`;
            return (
              <li key={r.distritoId} data-atribuir={r.codigo} className="flex flex-col gap-2 rounded-lg border border-ce-linha p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="shrink-0 rounded-lg bg-ce-linha-fraca px-2.5 py-2 font-codigo text-lg font-semibold leading-none" aria-hidden="true">{r.codigo}</span>
                  <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                    <label htmlFor={`${base}-carteiro`} className="text-[13px] font-semibold text-ce-tinta-2">
                      Carteiro da rota {r.codigo} <span className="font-normal text-ce-suave">· {plural(r.total, 'pacote', 'pacotes')}</span>
                    </label>
                    <select
                      id={`${base}-carteiro`}
                      value={e?.carteiroId ?? ''}
                      onChange={(ev) => mudar(r.distritoId, { carteiroId: ev.target.value })}
                      className={CLASSE_ENTRADA}
                    >
                      <option value="">Escolha o carteiro</option>
                      {carteiros.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome ?? c.matricula}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="flex min-h-11 items-center gap-2.5 text-sm text-ce-tinta-2">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={e?.definirPadrao ?? false}
                    disabled={!e?.carteiroId}
                    onChange={(ev) => mudar(r.distritoId, { definirPadrao: ev.target.checked })}
                  />
                  Definir também como carteiro padrão da rota {r.codigo}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Dialogo>
  );
}
