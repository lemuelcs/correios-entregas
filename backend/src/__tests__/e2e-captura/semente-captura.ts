/**
 * Cenário das jornadas E2E da captura: o carteiro C1 (matrícula 40123456) com
 * login, carteiro padrão do D-03 · Águas Claras Sul na unidade CDD Taguatinga.
 * Cada chamada apaga o banco de teste e recria tudo (estado limpo por jornada).
 */
import { prisma } from '../../shared/utils/prisma';
import { getRedis } from '../../shared/utils/redis';
import { criarCarteiroComLogin, criarDistrito, criarUnidade, limparBanco } from '../fixtures/entregas';

export const C1 = {
  matricula: '40123456',
  nome: 'Renato Alves Costa',
  senhaInicial: 'senha-inicial-123',
  senha: 'senha-do-carteiro-1',
};

export async function semearCaptura(opcoes: { senhaTemporaria: boolean }) {
  await limparBanco();
  const unidade = await criarUnidade({ nome: 'CDD Taguatinga' });
  const { usuario, carteiro } = await criarCarteiroComLogin({
    unidadeId: unidade.id,
    matricula: C1.matricula,
    senha: opcoes.senhaTemporaria ? C1.senhaInicial : C1.senha,
    senhaTemporaria: opcoes.senhaTemporaria,
  });
  await prisma.usuario.update({ where: { id: usuario.id }, data: { nome: C1.nome } });
  await prisma.carteiro.update({ where: { id: carteiro.id }, data: { nome: C1.nome } });
  const distrito = await criarDistrito({
    unidadeId: unidade.id,
    codigo: 'D-03',
    nome: 'Águas Claras Sul',
    carteiroPadraoId: carteiro.id,
  });
  return { unidadeId: unidade.id, distritoId: distrito.id, carteiroId: carteiro.id, matricula: C1.matricula };
}

/** O cache de CEP é compartilhado no Redis de teste: as jornadas leem sempre o ViaCEP falso. */
export async function limparCacheCep(ceps: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(...ceps.map((c) => `cep:${c}`));
  } catch {
    // sem Redis: o serviço de CEP também não usa cache
  }
}
