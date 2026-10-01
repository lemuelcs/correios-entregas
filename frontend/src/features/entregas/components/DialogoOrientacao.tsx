/**
 * Orientação manual do supervisor para o carteiro (US-026), a partir da lista de
 * pacotes do distrito: `POST /entregas/pacotes/:id/orientacao`.
 *
 * O servidor é quem decide: troca CPF, telefone e e-mail por "[removido]", recusa vazio
 * ou acima de 300 (`orientacao_vazia`, `orientacao_longa`) e bloqueia pacote entregue
 * (`pacote_entregue`). Aqui o contador e a checagem antes do envio só evitam a ida à toa;
 * a troca pode alongar o texto, então o servidor ainda pode recusar um texto de 300.
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { ApiError } from '@/services/api';
import { entregasApi } from '../entregas.api';
import type { PacoteDistrito } from '../entregas.types';
import { ehSessaoExpirada, mensagemDeErro } from '../mensagens';
import { Botao, Dialogo, FOCO } from './ui';

export const LIMITE_ORIENTACAO = 300;

const VAZIA = 'Escreva a orientação para o carteiro.';
const LONGA = `A orientação passa de ${LIMITE_ORIENTACAO} caracteres. Encurte o texto.`;
const ENTREGUE = 'Este pacote já consta como entregue: não cabe nova orientação.';

/** O tamanho que o servidor mede: espaços e quebras de linha contam como um só. */
export function tamanhoOrientacao(texto: string): number {
  return texto.replace(/\s+/g, ' ').trim().length;
}

function mensagemDaFalha(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.codigo === 'pacote_entregue') return ENTREGUE;
    if (err.codigo === 'orientacao_vazia') return VAZIA;
    if (err.codigo === 'orientacao_longa') {
      return `A orientação passa de ${LIMITE_ORIENTACAO} caracteres depois da troca de CPF, telefone ou e-mail por “[removido]”. Encurte o texto.`;
    }
  }
  return mensagemDeErro(err, 'Não foi possível registrar a orientação.');
}

export function DialogoOrientacao({ pacote, unidadeId, aoFechar, aoRegistrar, aoRecusar }: {
  pacote: PacoteDistrito | null;
  /** Só a Gestão envia (o supervisor fica na unidade do token). */
  unidadeId?: string;
  aoFechar: () => void;
  /** Orientação registrada: a tela fecha o diálogo e recarrega a lista. */
  aoRegistrar: () => Promise<void> | void;
  /** O servidor recusou porque o pacote mudou (entregue): a lista é recarregada por baixo do diálogo. */
  aoRecusar?: () => void;
}) {
  const formId = useId();
  const textoId = useId();
  const contadorId = useId();
  const dicaId = useId();
  const erroId = useId();
  const [texto, setTexto] = useState('');
  const [amanha, setAmanha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pacoteId = pacote?.id ?? null;

  useEffect(() => {
    setTexto('');
    setAmanha(false);
    setErro(null);
    setEnviando(false);
  }, [pacoteId]);

  const tamanho = tamanhoOrientacao(texto);
  const passou = tamanho > LIMITE_ORIENTACAO;

  async function registrar(e: FormEvent) {
    e.preventDefault();
    if (!pacote || enviando) return;
    if (tamanho === 0) return setErro(VAZIA);
    if (passou) return setErro(LONGA);
    setErro(null);
    setEnviando(true);
    try {
      await entregasApi.registrarOrientacao(pacote.id, { texto, valeParaAmanha: amanha }, unidadeId);
      toast.success(amanha ? `Orientação de ${pacote.codigo} guardada para o próximo dia de entrega.` : `Orientação de ${pacote.codigo} registrada.`);
      await aoRegistrar();
    } catch (err) {
      if (ehSessaoExpirada(err)) return;
      setErro(mensagemDaFalha(err));
      if (err instanceof ApiError && err.codigo === 'pacote_entregue') aoRecusar?.();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo="Registrar orientação"
      aberto={!!pacote}
      aoFechar={() => !enviando && aoFechar()}
      largura="max-w-[560px]"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" form={formId} disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar orientação'}</Botao>
        </>
      }
    >
      {pacote && (
        <form id={formId} onSubmit={(e) => void registrar(e)} noValidate className="flex flex-col gap-3.5">
          <p className="m-0 text-[15px] leading-normal text-ce-tinta-2">
            <span className="font-codigo text-[13px] text-ce-tinta">{pacote.codigo}</span> · {pacote.nome}
          </p>

          {pacote.orientacaoVigente && (
            <p className="m-0 rounded-lg bg-ce-linha-fraca px-3 py-2.5 text-sm leading-normal text-ce-tinta-2">
              <strong className="font-semibold text-ce-tinta">Substitui a orientação atual:</strong> {pacote.orientacaoVigente.texto}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={textoId} className="text-sm font-semibold">Orientação para o carteiro</label>
            <textarea
              id={textoId}
              rows={4}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                if (erro) setErro(null);
              }}
              aria-describedby={`${dicaId} ${contadorId}${erro ? ` ${erroId}` : ''}`}
              aria-invalid={!!erro || passou}
              placeholder="Ex.: deixar com o porteiro do bloco B"
              className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[15px] leading-normal ${FOCO} ${erro || passou ? 'border-ce-erro' : 'border-ce-linha-forte'}`}
            />
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-[13px]">
              <span id={dicaId} className="text-ce-suave">CPF, telefone e e-mail viram “[removido]” antes do envio.</span>
              <span id={contadorId} data-contador className={`ml-auto tabular-nums ${passou ? 'font-semibold text-ce-erro' : 'text-ce-suave'}`}>
                <span aria-hidden="true">{tamanho}/{LIMITE_ORIENTACAO}</span>
                <span className="sr-only">{tamanho} de {LIMITE_ORIENTACAO} caracteres</span>
              </span>
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={amanha}
              onChange={(e) => setAmanha(e.target.checked)}
              className={`mt-0.5 size-5 shrink-0 accent-ce-azul ${FOCO}`}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Vale também para amanhã</span>
              <span className="text-[13px] leading-normal text-ce-suave">
                {amanha
                  ? 'A orientação fica guardada e segue ao carteiro na liberação do próximo dia de entrega. Hoje ela não é enviada.'
                  : 'Sem marcar, a orientação segue agora para o carteiro do dia.'}
              </span>
            </span>
          </label>

          {erro && <p id={erroId} role="alert" className="m-0 rounded-lg bg-ce-erro-bg px-3 py-2.5 text-[15px] font-semibold text-ce-erro">{erro}</p>}
        </form>
      )}
    </Dialogo>
  );
}
