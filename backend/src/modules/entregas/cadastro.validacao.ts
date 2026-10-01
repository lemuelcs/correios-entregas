/**
 * Regras de cadastro sem banco (UT-081, UT-082, UT-090): nome e limite dos
 * pontos de retirada, compatibilidade do canal da unidade, matrícula e WhatsApp.
 */
import type { TipoCanal } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { normalizarTelefone, TelefoneInvalido } from '../../shared/utils/telefone';

/** A linha da lista do WhatsApp trunca títulos acima de 24 caracteres (US-006.EC-3). */
export const MAX_NOME_PONTO = 24;
/** A lista do WhatsApp tem no máximo 10 linhas por seção (US-006.EC-2). */
export const MAX_PONTOS_ATIVOS_POR_TIPO = 10;

export const FORMATO_WHATSAPP = '(61) 99812-4412';

/** Nome do ponto: obrigatório e com até 24 caracteres. Devolve o nome aparado. */
export function validarNomePonto(nome: string): string {
  const limpo = (nome ?? '').trim();
  if (!limpo) throw new AppError(400, 'nome_obrigatorio');
  if ([...limpo].length > MAX_NOME_PONTO) {
    throw new AppError(400, 'nome_longo', { max: MAX_NOME_PONTO, mensagem: `Use até ${MAX_NOME_PONTO} caracteres` });
  }
  return limpo;
}

/**
 * `ativosAtuais` é quantos pontos ativos do mesmo tipo a unidade já tem (sem
 * contar o que está sendo ativado). O 10º passa; o 11º → 409 `limite_pontos`.
 */
export function garantirLimitePontos(ativosAtuais: number): void {
  if (ativosAtuais + 1 > MAX_PONTOS_ATIVOS_POR_TIPO) {
    throw new AppError(409, 'limite_pontos', {
      max: MAX_PONTOS_ATIVOS_POR_TIPO,
      mensagem: `Máximo de ${MAX_PONTOS_ATIVOS_POR_TIPO} por tipo no WhatsApp`,
    });
  }
}

export interface CanalParaUnidade {
  tipo: TipoCanal;
  ativo: boolean;
  compartilhado: boolean;
}

export interface PedidoCanalUnidade {
  /** Tipo de canal escolhido na tela (número atual = WAHA, oficial = WABA). */
  canal?: TipoCanal | null;
  prosioUnidadeRef?: string | null;
}

/**
 * Canal da unidade (US-001.EC-2, ADR-012):
 * - canal pedido sem `CanalProsio`, canal inativo ou de tipo diferente do
 *   pedido → 400 `canal_indisponivel`;
 * - canal compartilhado sem `prosioUnidadeRef` → 400 `unidade_ref_obrigatoria`.
 * `canal` é `null` quando nenhum `CanalProsio` foi escolhido ou ele não existe.
 */
export function validarCanalDaUnidade(canal: CanalParaUnidade | null, pedido: PedidoCanalUnidade): void {
  if (!canal) {
    if (pedido.canal) throw canalIndisponivel(pedido.canal);
    return;
  }
  if (!canal.ativo || (pedido.canal && pedido.canal !== canal.tipo)) {
    throw canalIndisponivel(pedido.canal ?? canal.tipo);
  }
  if (canal.compartilhado && !pedido.prosioUnidadeRef?.trim()) {
    throw new AppError(400, 'unidade_ref_obrigatoria', {
      campo: 'prosioUnidadeRef',
      mensagem: 'Informe a referência da unidade no canal compartilhado',
    });
  }
}

function canalIndisponivel(tipo: TipoCanal): AppError {
  return new AppError(400, 'canal_indisponivel', {
    campo: 'canalProsioId',
    mensagem: tipo === 'WABA'
      ? 'Número oficial ainda não disponível para esta unidade'
      : 'Canal indisponível para esta unidade',
  });
}

/**
 * Matrícula sem máscara: `8.301.552-0` → `83015520`. Mantém letras (matrículas
 * de terceiros), em maiúsculas.
 */
export function normalizarMatricula(matricula: string): string {
  return (matricula ?? '').replace(/[\s.\-/]/g, '').toUpperCase();
}

/** Tamanho da matrícula sem máscara (o login também exige exatamente 8). */
export const TAMANHO_MATRICULA = 8;

/** Matrícula normalizada com exatamente 8 caracteres; senão 400 `matricula_invalida`. */
export function lerMatricula(entrada: string): string {
  const matricula = normalizarMatricula(entrada);
  if (matricula.length !== TAMANHO_MATRICULA) {
    throw new AppError(400, 'matricula_invalida', {
      campo: 'matricula',
      mensagem: 'A matrícula deve ter 8 caracteres (com ou sem pontos)',
    });
  }
  return matricula;
}

/** WhatsApp em E.164; inválido → 400 `whatsapp_invalido` com o formato esperado. */
export function lerWhatsapp(entrada: string, campo = 'whatsapp'): string {
  try {
    return normalizarTelefone(entrada);
  } catch (err) {
    if (err instanceof TelefoneInvalido) {
      throw new AppError(400, 'whatsapp_invalido', { campo, motivo: err.codigo, formato: FORMATO_WHATSAPP });
    }
    throw err;
  }
}
