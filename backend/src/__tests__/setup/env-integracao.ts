/**
 * setupFiles do projeto `integration`: roda em cada worker ANTES de importar o
 * código testado, para que o singleton do Prisma, as filas e o JWT leiam o ambiente
 * de teste.
 */
import 'dotenv/config';
import { resolverBancoTeste } from './banco-teste';

const { url } = resolverBancoTeste(process.env.TEST_DATABASE_URL);

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = url;
if (process.env.TEST_REDIS_URL) {
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
}
process.env.JWT_SECRET ??= 'segredo-jwt-dos-testes-com-32-caracteres';
process.env.JWT_REFRESH_SECRET ??= 'segredo-refresh-dos-testes-com-32-chars';
process.env.ENTREGAS_CRYPTO_KEY ??= 'chave-de-cifra-dos-testes-com-32-bytes!!';
