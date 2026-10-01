/** Unicidade de matrícula e WhatsApp com o Prisma falsificado: UT-084, UT-085. */
jest.mock('../../../shared/utils/prisma', () => ({
  prisma: {
    carteiro: { findFirst: jest.fn() },
    usuario: { findFirst: jest.fn() },
  },
}));

import { prisma } from '../../../shared/utils/prisma';
import { AppError } from '../../../shared/middleware/error-handler.middleware';
import { garantirMatriculaLivre, garantirWhatsappLivre } from '../cadastro.service';

const carteiroFindFirst = prisma.carteiro.findFirst as jest.Mock;
const usuarioFindFirst = prisma.usuario.findFirst as jest.Mock;

beforeEach(() => {
  carteiroFindFirst.mockResolvedValue(null);
  usuarioFindFirst.mockResolvedValue(null);
});

async function erroDe(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('esperava AppError');
}

describe('UT-084 matrícula única entre Usuario e Carteiro', () => {
  it('matrícula 8.301.552-0 já em Usuario → criar carteiro lança 409 matricula_em_uso', async () => {
    usuarioFindFirst.mockResolvedValue({ id: 'u1' });
    const e = await erroDe(garantirMatriculaLivre('8.301.552-0', { unidadeId: 'unidade-a' }));
    expect(e.statusCode).toBe(409);
    expect(e.message).toBe('matricula_em_uso');
    // Procura com e sem máscara.
    expect(usuarioFindFirst.mock.calls[0][0].where.matricula.in).toEqual(expect.arrayContaining(['8.301.552-0', '83015520']));
  });

  it('e vice-versa: matrícula já em Carteiro → criar usuário lança 409 matricula_em_uso', async () => {
    carteiroFindFirst.mockResolvedValue({ id: 'c1', unidadeId: 'unidade-a', usuarioId: null, unidade: { nome: 'CDD A' } });
    const e = await erroDe(garantirMatriculaLivre('83015520'));
    expect(e.statusCode).toBe(409);
    expect(e.message).toBe('matricula_em_uso');
  });

  it('carteiro com a matrícula em outra unidade → detalhe unidade', async () => {
    carteiroFindFirst.mockResolvedValue({ id: 'c1', unidadeId: 'unidade-b', usuarioId: null, unidade: { nome: 'CDD B' } });
    const e = await erroDe(garantirMatriculaLivre('83015520', { unidadeId: 'unidade-a' }));
    expect(e.details).toMatchObject({ detalhe: 'unidade', unidade: 'CDD B' });
  });

  it('matrícula livre passa; o usuário dono do carteiro não conflita com ele mesmo', async () => {
    await expect(garantirMatriculaLivre('83015520')).resolves.toBeUndefined();
    carteiroFindFirst.mockResolvedValue({ id: 'c1', unidadeId: 'a', usuarioId: 'u1', unidade: { nome: 'A' } });
    await expect(garantirMatriculaLivre('83015520', { ignorarUsuarioId: 'u1' })).resolves.toBeUndefined();
  });
});

describe('UT-085 WhatsApp de carteiro único', () => {
  it('WhatsApp de outro carteiro → 409 whatsapp_em_uso', async () => {
    carteiroFindFirst.mockResolvedValue({ id: 'outro' });
    const e = await erroDe(garantirWhatsappLivre('+5561998124412', 'eu'));
    expect(e.statusCode).toBe(409);
    expect(e.message).toBe('whatsapp_em_uso');
    expect(carteiroFindFirst.mock.calls[0][0].where).toEqual({ whatsappE164: '+5561998124412', id: { not: 'eu' } });
  });

  it('WhatsApp livre passa', async () => {
    await expect(garantirWhatsappLivre('+5561998124412')).resolves.toBeUndefined();
  });
});
