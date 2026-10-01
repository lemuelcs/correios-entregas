/** Peças visuais da área Entregas (protótipo validado: Source Sans 3, pílulas, botões de 44 px). */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { X } from 'lucide-react';

export const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ce-azul';

type Variante = 'primario' | 'secundario' | 'perigo' | 'texto';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-ce-azul text-white hover:bg-ce-azul-escuro disabled:bg-ce-linha-forte disabled:text-ce-suave',
  secundario: 'border border-ce-linha-forte bg-white text-ce-tinta hover:bg-ce-linha-fraca disabled:text-ce-suave',
  perigo: 'bg-ce-erro text-white hover:opacity-90 disabled:opacity-50',
  texto: 'text-ce-azul hover:text-ce-azul-escuro hover:bg-ce-linha-fraca',
};

export function classeBotao(variante: Variante = 'primario', extra = ''): string {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors disabled:cursor-not-allowed ${FOCO} ${VARIANTES[variante]} ${extra}`;
}

export function Botao({ variante = 'primario', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return <button type={type} className={classeBotao(variante, className)} {...props} />;
}

export function BotaoLink({ variante = 'primario', className = '', ...props }: LinkProps & { variante?: Variante }) {
  return <Link className={classeBotao(variante, className)} {...props} />;
}

export function Pilula({ classe, children, className = '' }: { classe: string; children: ReactNode; className?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${classe} ${className}`}>{children}</span>;
}

export function CodigoDistrito({ children, grande = false }: { children: ReactNode; grande?: boolean }) {
  return (
    <span className={`rounded-md bg-ce-codigo px-2 py-0.5 font-codigo font-medium ${grande ? 'text-[15px]' : 'text-sm'}`}>{children}</span>
  );
}

export function Cartao({ children, className = '', ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return <section className={`relative rounded-xl border border-ce-linha bg-white ${className}`} {...props}>{children}</section>;
}

export function CabecalhoPagina({ secao, titulo, subtitulo, acoes, extra }: { secao?: string; titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; extra?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {secao && <span className="text-[13px] text-ce-suave">{secao}</span>}
        <div className="flex flex-wrap items-center gap-2.5">
          {typeof titulo === 'string' ? <h1 className="m-0 text-[26px] font-bold leading-tight md:text-[28px]">{titulo}</h1> : titulo}
          {extra}
        </div>
        {subtitulo && <div className="text-[15px] text-ce-suave">{subtitulo}</div>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2.5">{acoes}</div>}
    </header>
  );
}

export function Campo({ rotulo, children, dica, erro, id }: { rotulo: string; children: (id: string) => ReactNode; dica?: string; erro?: string | null; id?: string }) {
  const gerado = useId();
  const campoId = id ?? gerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-sm font-semibold">{rotulo}</label>
      {children(campoId)}
      {dica && !erro && <span className="text-[13px] text-ce-suave">{dica}</span>}
      {erro && <span className="text-[13px] font-semibold text-ce-erro">{erro}</span>}
    </div>
  );
}

export const CLASSE_ENTRADA = `min-h-11 w-full rounded-lg border border-ce-linha-forte bg-white px-3 text-[15px] ${FOCO}`;

/** Diálogo modal acessível (foco inicial, Esc fecha, foco volta ao gatilho). */
export function Dialogo({ titulo, aberto, aoFechar, children, rodape, largura = 'max-w-[480px]' }: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const tituloId = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement as HTMLElement | null;
    const primeiro = caixa.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-fechar])');
    (primeiro ?? caixa.current)?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,33,58,0.45)] p-4">
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`flex max-h-[calc(100vh-2rem)] w-full ${largura} flex-col gap-3.5 overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(20,33,58,0.25)] font-entregas text-ce-tinta`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={tituloId} className="m-0 text-xl font-bold">{titulo}</h2>
          <button type="button" data-fechar onClick={aoFechar} aria-label="Fechar" className={`-mr-2 -mt-2 inline-flex size-11 items-center justify-center rounded-lg text-ce-suave hover:bg-ce-linha-fraca ${FOCO}`}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
        {rodape && <div className="flex flex-wrap justify-end gap-2.5">{rodape}</div>}
      </div>
    </div>
  );
}

export function EstadoVazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <Cartao className="flex flex-col items-start gap-3 p-6">
      <h2 className="m-0 text-lg font-bold">{titulo}</h2>
      {children}
    </Cartao>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <p role="status" className="m-0 text-[15px] text-ce-suave">{texto}</p>;
}

export function FalhaCarga({ mensagem, aoTentar }: { mensagem: string; aoTentar: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-ce-erro-bg bg-ce-erro-bg px-4 py-3 text-ce-erro">
      <span className="font-semibold">{mensagem}</span>
      <Botao variante="secundario" onClick={aoTentar}>Tentar de novo</Botao>
    </div>
  );
}
