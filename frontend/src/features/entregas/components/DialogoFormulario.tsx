/**
 * Formulário num diálogo, com os erros da API no lugar certo:
 * - erros por campo (Zod ou `details.campo`) aparecem sob o campo (`CampoF`);
 * - o erro geral fica num alerta dentro do diálogo, que continua aberto;
 * - 409 `alterado_por_outro`: o formulário recebe a versão atual (`details.atual`),
 *   recarrega os campos com ela e explica o que houve — nada é perdido em silêncio.
 */
import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { ApiError } from '@/services/api';
import { ehSessaoExpirada, errosPorCampo, mensagemDeErro } from '../mensagens';
import { Botao, Campo, Dialogo } from './ui';

const ErrosDoFormulario = createContext<Record<string, string>>({});

export const MENSAGEM_CONFLITO =
  'Outra pessoa alterou este registro enquanto você editava. Os campos abaixo já mostram a versão mais recente: confira, refaça a sua alteração e salve de novo.';

/** A versão atual do registro num 409 `alterado_por_outro`, ou `null`. */
export function registroAtualDoConflito<T>(err: unknown): T | null {
  if (!(err instanceof ApiError) || err.status !== 409 || err.codigo !== 'alterado_por_outro') return null;
  const det = err.detalhes as { atual?: T } | undefined;
  return det && typeof det === 'object' && det.atual ? det.atual : null;
}

export function DialogoFormulario<T = unknown>({ titulo, aberto, aoFechar, aoEnviar, aoConflito, rotuloEnviar = 'Salvar', variante = 'primario', children }: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  aoEnviar: () => Promise<void>;
  /** Recebe o registro atual do servidor quando outra pessoa gravou antes. */
  aoConflito?: (atual: T) => void;
  rotuloEnviar?: string;
  variante?: 'primario' | 'perigo';
  children: ReactNode;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [alerta, setAlerta] = useState<{ texto: string; conflito: boolean } | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErros({});
    setAlerta(null);
    try {
      await aoEnviar();
    } catch (err) {
      if (ehSessaoExpirada(err)) return;
      const atual = aoConflito ? registroAtualDoConflito<T>(err) : null;
      if (atual && aoConflito) {
        aoConflito(atual);
        setAlerta({ texto: MENSAGEM_CONFLITO, conflito: true });
        return;
      }
      const porCampo = errosPorCampo(err);
      setErros(porCampo);
      const texto = mensagemDeErro(err, 'Não foi possível salvar.');
      const soCampos = Object.keys(porCampo).length > 0 && err instanceof ApiError && err.codigo === 'Dados inválidos';
      setAlerta({ texto: soCampos ? 'Confira os campos destacados.' : texto, conflito: false });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={titulo} aberto={aberto} aoFechar={() => !enviando && aoFechar()} largura="max-w-[560px]">
      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3.5">
        <ErrosDoFormulario.Provider value={erros}>{children}</ErrosDoFormulario.Provider>
        {alerta && (
          <p
            role="alert"
            data-conflito={alerta.conflito || undefined}
            className={`m-0 rounded-lg px-3 py-2.5 text-[15px] font-semibold leading-normal ${alerta.conflito ? 'bg-ce-corrigir-bg text-ce-corrigir' : 'bg-ce-erro-bg text-ce-erro'}`}
          >
            {alerta.texto}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2.5 pt-1">
          <Botao variante="secundario" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" variante={variante} disabled={enviando}>{enviando ? 'Salvando…' : rotuloEnviar}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** `Campo` ligado aos erros do formulário: `nome` é o campo no corpo enviado à API. */
export function CampoF({ nome, rotulo, dica, children }: { nome: string; rotulo: string; dica?: string; children: (id: string) => ReactNode }) {
  const erros = useContext(ErrosDoFormulario);
  return <Campo rotulo={rotulo} dica={dica} erro={erros[nome]}>{children}</Campo>;
}

/** Aviso que não bloqueia (ex.: `avisos: ['carteiro_em_dois_distritos']`): fica mais tempo que o de sucesso. */
export function avisarAtencao(texto: string): void {
  toast(texto, {
    id: texto,
    duration: 9000,
    ariaProps: { role: 'alert', 'aria-live': 'assertive' },
    style: { background: '#fff7e0', color: '#6b4500', border: '1px solid #e0a400', fontWeight: 600 },
  });
}
