/**
 * evolution-error.ts
 * Utilitários de tratamento de erros da Evolution API.
 * Substitui o padrão repetido 5+ vezes em comunicacao.routes.ts.
 */
import { describeEvolutionBaseUrl } from '../services/comunicacao/evolution-url';

/**
 * Tenta extrair mensagem amigável de erro "instance does not exist" da Evolution API.
 * Retorna null se o erro não é desse tipo.
 */
export function parseEvolutionInstanceMissingError(err: any): string | null {
  const message = err?.response?.data?.response?.message?.[0]
    ?? err?.response?.data?.message
    ?? err?.message;

  if (typeof message !== 'string') return null;
  if (!message.includes('instance does not exist')) return null;

  const instanceName = message.match(/"(.+?)"/)?.[1] ?? 'informada';
  return `A instância "${instanceName}" não existe na Evolution API. Crie ou recrie a instância antes de configurar o webhook.`;
}

/**
 * Formata erro da Evolution API em mensagem amigável com HTTP status.
 * Trata: ECONNREFUSED, ECONNRESET, ETIMEDOUT, instância não encontrada, erros genéricos.
 */
export function formatEvolutionApiError(
  err: any,
  instanceName?: string,
): { status: number; message: string } {
  const code = err?.code;
  const responseStatus = err?.response?.status;

  const missingInstanceError = parseEvolutionInstanceMissingError(err);
  if (missingInstanceError) {
    return { status: 409, message: missingInstanceError };
  }

  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT') {
    return {
      status: 502,
      message: `Evolution API indisponível (${describeEvolutionBaseUrl()}). Verifique se o serviço está rodando.`,
    };
  }

  if (responseStatus === 404 && instanceName) {
    return {
      status: 404,
      message: `Instância '${instanceName}' não encontrada na Evolution API. Verifique se a instância existe ou reconfigure.`,
    };
  }

  return {
    status: 500,
    message: err?.response?.data?.message || err.message || 'Erro desconhecido',
  };
}
