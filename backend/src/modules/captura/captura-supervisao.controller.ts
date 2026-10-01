/**
 * Controller das rotas do supervisor da captura (`/api/v1/entregas/captura`):
 * confere o escopo por unidade (`escopo.ts` do monitoramento; outra unidade → 404)
 * e delega ao `captura-supervisao.service`.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { garantirUnidade, naoEncontrado, pacoteNoEscopo } from '../entregas/escopo';
import { definirSenhaCarteiro, fotoDoPacote, historicoDoPacote, removerPacote } from './captura-supervisao.service';

type Handler = (req: Request, res: Response) => Promise<void>;
const rota = (fn: Handler) => (req: Request, res: Response, next: NextFunction): void => {
  fn(req, res).catch(next);
};

const senhaSchema = z.object({ senha: z.string() });

async function carteiroNoEscopo(req: Request, carteiroId: string) {
  const carteiro = await prisma.carteiro.findUnique({ where: { id: carteiroId } });
  if (!carteiro) throw naoEncontrado();
  garantirUnidade(req, carteiro.unidadeId);
  return carteiro;
}

export const capturaSupervisaoController = {
  historico: rota(async (req, res) => {
    const pacote = await pacoteNoEscopo(req, String(req.params.id));
    res.json(await historicoDoPacote(pacote));
  }),

  foto: rota(async (req, res) => {
    const pacote = await pacoteNoEscopo(req, String(req.params.id));
    const bytes = await fotoDoPacote(pacote.id);
    res.set('Cache-Control', 'private, no-store');
    res.type('image/jpeg').send(bytes);
  }),

  remover: rota(async (req, res) => {
    const pacote = await pacoteNoEscopo(req, String(req.params.id));
    await removerPacote(pacote.id, { usuarioId: req.user!.sub, role: req.user!.role });
    res.status(204).end();
  }),

  definirSenha: rota(async (req, res) => {
    const carteiro = await carteiroNoEscopo(req, String(req.params.id));
    const corpo = senhaSchema.safeParse(req.body ?? {});
    if (!corpo.success) throw new AppError(400, 'Informe a senha', { code: 'senha_fraca' });
    await definirSenhaCarteiro(carteiro, corpo.data.senha);
    res.status(204).end();
  }),
};
