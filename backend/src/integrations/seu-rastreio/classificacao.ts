/**
 * Classificação do evento mais recente do Seu Rastreio (ADR-016).
 *
 * A lista de padrões é versionada aqui: ao incluir ou mudar um padrão, suba
 * `VERSAO_PADROES_RASTREIO` (ela vai para o log `entregas.rastreio`). Descrição
 * que não casa com nenhum padrão devolve `null` (status inalterado + log para
 * ajustar a lista).
 */
export type ClassificacaoEvento = 'ENTREGUE' | 'INSUCESSO';

export const VERSAO_PADROES_RASTREIO = '2026-09-30.1';

/** Comparados contra a descrição sem acentos, em minúsculas e com espaços colapsados. */
export const PADROES_RASTREIO: Readonly<Record<ClassificacaoEvento, readonly string[]>> = Object.freeze({
  // Insucesso vem primeiro na checagem: "não entregue ..." não pode virar ENTREGUE.
  INSUCESSO: Object.freeze([
    'carteiro nao atendido',
    'destinatario ausente',
    'nao efetuada',
    'nao realizada',
    'endereco insuficiente',
    'recusado',
    'nao entregue',
  ]),
  ENTREGUE: Object.freeze(['entregue ao destinatario']),
});

export function normalizarDescricao(descricao: string): string {
  return descricao
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function classificarEvento(descricao: string | null | undefined): ClassificacaoEvento | null {
  if (typeof descricao !== 'string' || !descricao.trim()) return null;
  const texto = normalizarDescricao(descricao);
  if (PADROES_RASTREIO.INSUCESSO.some((p) => texto.includes(p))) return 'INSUCESSO';
  if (PADROES_RASTREIO.ENTREGUE.some((p) => texto.includes(p))) return 'ENTREGUE';
  return null;
}
