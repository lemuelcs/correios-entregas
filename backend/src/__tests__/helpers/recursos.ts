/**
 * Encerra as conexões abertas pelo import do `app` (Prisma e filas BullMQ),
 * para o Jest terminar sem handles pendentes. Chamar no `afterAll`.
 */
export async function encerrarRecursos(): Promise<void> {
  const { prisma } = await import('../../shared/utils/prisma');
  const filas = await import('../../queue');
  const todas = [filas.vroomQueue, filas.pyvrpQueue, filas.geocoderQueue, filas.dneSyncQueue, filas.npsNotifyQueue, filas.entregasRastreioQueue];
  await Promise.allSettled(todas.map((f) => f.close()));
  // close() manda QUIT e não espera o socket fechar; disconnect() fecha na hora.
  await Promise.allSettled(todas.map((f) => f.disconnect()));
  await prisma.$disconnect();
}
