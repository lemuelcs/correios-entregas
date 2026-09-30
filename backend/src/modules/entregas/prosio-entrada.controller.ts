/**
 * Entrada do Prosio (ADR-014), sem JWT:
 * - `POST /prosio/:canalId/webhook` — corpo cru (HMAC), 204 / 401;
 * - `POST /prosio/:canalId/acao/:prefixo` — `Bearer <token de entrada>`,
 *   corpo `{acao}` e `x-actor-phone` → sempre `200 {mensagem}` (401 só na autenticação).
 */
import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../shared/utils/prisma';
import logger from '../../shared/utils/logger';
import { acoesService, PREFIXOS } from './acoes.service';
import { prosioWebhookService } from './prosio-webhook.service';
import { mascarar } from './orientacao.service';
import { acaoDuracao, acoesTotal } from './metricas';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mensagem devolvida quando algo inesperado falha (5xx: o Prosio libera o toque para nova tentativa). */
const INDISPONIVEL = 'Não consegui registrar sua resposta agora. Tente tocar no botão de novo em alguns minutos.';

function tokenBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (typeof h !== 'string') return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(h);
  return m ? m[1] : null;
}

/** O token confere com o hash do token de entrada do canal (ativo)? */
export async function autenticarCanal(canalId: string, token: string | null): Promise<boolean> {
  if (!token || !UUID.test(canalId)) return false;
  const canal = await prisma.canalProsio.findUnique({ where: { id: canalId }, select: { tokenEntradaHash: true, ativo: true } });
  if (!canal || !canal.ativo) return false;
  const recebido = createHash('sha256').update(token).digest();
  const esperado = Buffer.from(canal.tokenEntradaHash, 'hex');
  return esperado.length === recebido.length && timingSafeEqual(recebido, esperado);
}

export const prosioEntradaController = {
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const assinatura = req.get('x-webhook-signature');
      const r = await prosioWebhookService.processar(String(req.params.canalId), req.body as Buffer | undefined, assinatura);
      if (r.status === 204) {
        res.status(204).end();
        return;
      }
      res.status(r.status).json({ error: r.resultado });
    } catch (err) {
      next(err);
    }
  },

  async acao(req: Request, res: Response) {
    const inicio = process.hrtime.bigint();
    const canalId = String(req.params.canalId);
    const prefixo = String(req.params.prefixo).toUpperCase();
    const metrica = (PREFIXOS as readonly string[]).includes(prefixo) ? prefixo : 'desconhecido';
    const fim = () => acaoDuracao.observe({ prefixo: metrica }, Number(process.hrtime.bigint() - inicio) / 1e9);
    try {
      if (!(await autenticarCanal(canalId, tokenBearer(req)))) {
        logger.warn({ canalId, prefixo: metrica }, 'entregas.acao token de entrada inválido');
        fim();
        res.status(401).json({ error: 'nao_autorizado' });
        return;
      }
      const acao = (req.body as { acao?: unknown } | undefined)?.acao;
      const telefone = req.get('x-actor-phone') ?? undefined;
      const r = await acoesService.executar(canalId, prefixo, acao, telefone);
      const valor = typeof acao === 'string' && acao.includes('.') ? acao.slice(acao.lastIndexOf('.') + 1).toUpperCase().slice(0, 20) : 'invalido';
      acoesTotal.inc({ prefixo: metrica, valor: metrica === 'CE_PT' ? 'ponto' : valor });
      logger.info({ canalId, prefixo: metrica, valor, resultado: r.resultado, telefone: mascarar(telefone) }, 'entregas.acao');
      fim();
      res.status(200).json({ mensagem: r.mensagem });
    } catch (err) {
      fim();
      logger.error({ canalId, prefixo: metrica, erro: (err as Error).message }, 'entregas.acao falhou');
      res.status(503).json({ mensagem: INDISPONIVEL });
    }
  },
};
