/**
 * Comportamento de camada modal (diálogos e o menu em telas estreitas):
 * prende o foco dentro da caixa (Tab e Shift+Tab dão a volta), trava a rolagem
 * da página por baixo e, ao fechar, devolve o foco a quem abriu.
 */
import { useEffect, useRef, type RefObject } from 'react';

const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const FOCO_INICIAL = [
  'input:not([disabled]):not([readonly]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([data-fechar]):not([disabled])',
  'a[href]',
].join(',');

export function focaveis(caixa: HTMLElement): HTMLElement[] {
  return Array.from(caixa.querySelectorAll<HTMLElement>(FOCAVEIS));
}

/** Mantém o Tab dentro de `caixa`; devolve `true` quando tratou a tecla. */
export function prenderTab(e: KeyboardEvent, caixa: HTMLElement): boolean {
  if (e.key !== 'Tab') return false;
  const itens = focaveis(caixa);
  if (itens.length === 0) {
    e.preventDefault();
    caixa.focus();
    return true;
  }
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  const ativo = document.activeElement as HTMLElement | null;
  const fora = !ativo || !caixa.contains(ativo);
  if (e.shiftKey && (fora || ativo === primeiro || ativo === caixa)) {
    e.preventDefault();
    ultimo.focus();
    return true;
  }
  if (!e.shiftKey && (fora || ativo === ultimo)) {
    e.preventDefault();
    primeiro.focus();
    return true;
  }
  return false;
}

// Camadas abertas ao mesmo tempo (um diálogo sobre outro): só a de cima responde ao
// teclado, e a rolagem da página só volta quando a última fecha.
const pilha: symbol[] = [];
let overflowAnterior = '';

export interface OpcoesCamada {
  /** Chamado no Esc (omitir = o Esc não fecha). */
  aoEsc?: () => void;
  /** Quem recebe o foco ao abrir; padrão: o primeiro campo, botão ou link da caixa. */
  focoInicial?: (caixa: HTMLElement) => HTMLElement | null | undefined;
}

export function useCamadaModal(caixa: RefObject<HTMLElement | null>, aberta: boolean, opcoes: OpcoesCamada = {}): void {
  // As opções mudam a cada render; o efeito lê sempre as mais recentes sem reabrir a camada.
  const atuais = useRef(opcoes);
  atuais.current = opcoes;

  useEffect(() => {
    if (!aberta) return undefined;
    const id = Symbol('camada');
    const anterior = document.activeElement as HTMLElement | null;
    pilha.push(id);
    if (pilha.length === 1) {
      overflowAnterior = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const el = caixa.current;
    if (el) (atuais.current.focoInicial?.(el) ?? el.querySelector<HTMLElement>(FOCO_INICIAL) ?? el).focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== id) return;
      if (e.key === 'Escape') {
        atuais.current.aoEsc?.();
        return;
      }
      if (caixa.current) prenderTab(e, caixa.current);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      const i = pilha.indexOf(id);
      if (i >= 0) pilha.splice(i, 1);
      if (pilha.length === 0) document.body.style.overflow = overflowAnterior;
      if (anterior && document.contains(anterior)) anterior.focus?.();
    };
  }, [aberta, caixa]);
}
