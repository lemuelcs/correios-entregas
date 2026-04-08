/**
 * prisma-extended.ts
 * Acesso tipado ao Prisma para o módulo de comunicação.
 */
import { prisma } from '../../../shared/utils/prisma';

// No correios-entregas, o PrismaClient já expõe todos os delegates
// após os modelos serem adicionados ao schema.
export const db = prisma;
