/**
 * RastreioWorker pela fila real (Redis de teste, banco da REDIS_URL):
 * IT-047 (seleção adaptativa e varredura) e IT-056 (entregue cancela o caso).
 */
import { QueueEvents } from 'bullmq';
import type { PacoteDia } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { entregasRastreioQueue, redisConnection } from '../../queue';
import { encerrarRecursos } from '../../__tests__/helpers/recursos';
import { ProsioFake } from '../../__tests__/fakes/prosio.fake';
import { SeuRastreioFake } from '../../__tests__/fakes/seu-rastreio.fake';
import { criarCanal, criarCarteiro, criarDistrito, criarPacote, criarUnidade, limparBanco } from '../../__tests__/fixtures/entregas';
import { hojeBrasilia, horaDeBrasilia } from '../../modules/entregas/datas';
import { startEntregasRastreioWorker, stopEntregasRastreioWorker, type JobRastreio } from '../entregas-rastreio.worker';
import { processarRastreio } from '../../modules/entregas/rastreio.service';

let prosio: ProsioFake;
let rastreio: SeuRastreioFake;
let eventos: QueueEvents;
const hoje = hojeBrasilia();

async function cargaCom(status: PacoteDia['status'][], opcoes: { mediacao?: boolean } = {}): Promise<PacoteDia[]> {
  const { canal } = await criarCanal({ baseUrl: prosio.url });
  const unidade = await criarUnidade({ canalProsioId: canal.id, mediacaoAtiva: !!opcoes.mediacao });
  const carteiro = await criarCarteiro({ unidadeId: unidade.id });
  const distrito = await criarDistrito({ unidadeId: unidade.id, carteiroPadraoId: carteiro.id });
  const carga = await prisma.cargaDistrito.create({ data: { distritoId: distrito.id, data: hoje, status: 'EM_ENTREGA', carteiroId: carteiro.id } });
  const pacotes: PacoteDia[] = [];
  for (const s of status) {
    pacotes.push(await criarPacote({ cargaId: carga.id, data: hoje, status: s, ...(s === 'SEM_WHATSAPP' ? { whatsappE164: null } : {}) }));
  }
  return pacotes;
}

async function rodar(dados: JobRastreio): Promise<unknown> {
  const job = await entregasRastreioQueue.add('teste', dados, { removeOnComplete: true, removeOnFail: true });
  return job.waitUntilFinished(eventos, 20_000);
}

beforeAll(async () => {
  await limparBanco();
  prosio = await ProsioFake.iniciar();
  rastreio = await SeuRastreioFake.iniciar({ token: 'token-rastreio-teste' });
  process.env.SEU_RASTREIO_URL = rastreio.url;
  process.env.SEU_RASTREIO_TOKEN = 'token-rastreio-teste';
  await entregasRastreioQueue.obliterate({ force: true });
  eventos = new QueueEvents('entregas-rastreio', { connection: redisConnection });
  await eventos.waitUntilReady();
  startEntregasRastreioWorker({}, { agendar: false });
});

beforeEach(async () => {
  prosio.redefinir();
  rastreio.redefinir();
  await limparBanco();
});

afterAll(async () => {
  await stopEntregasRastreioWorker();
  await eventos.close();
  await entregasRastreioQueue.obliterate({ force: true });
  await prosio.parar();
  await rastreio.parar();
  await limparBanco();
  await encerrarRecursos();
});

describe('RastreioWorker', () => {
  it('IT-047 às 14h consulta só LIDO e INTERAGINDO; varredura das 20h consulta os não finais', async () => {
    const [lido, interagindo, enviado, semWhatsapp, entregue, insucesso] = await cargaCom(['LIDO', 'INTERAGINDO', 'ENVIADO', 'SEM_WHATSAPP', 'ENTREGUE', 'INSUCESSO']);
    rastreio.definirEvento(lido.codigo, 'Objeto entregue ao destinatário');
    rastreio.definirEvento(interagindo.codigo, 'Objeto em trânsito - por favor aguarde');
    const logs = jest.spyOn(console, 'log');

    await rodar({ agora: horaDeBrasilia(hoje, 14).toISOString() });
    expect(rastreio.consultas().sort()).toEqual([lido.codigo, interagindo.codigo].sort());
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: lido.id } })).status).toBe('ENTREGUE');
    const naoMapeado = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: interagindo.id } });
    expect(naoMapeado.status).toBe('INTERAGINDO');
    expect(naoMapeado.rastreioDescricao).toBe('Objeto em trânsito - por favor aguarde');
    expect(logs.mock.calls.some((c) => String(c[0]).includes('entregas.rastreio.nao_mapeado'))).toBe(true);
    logs.mockRestore();

    rastreio.redefinir();
    rastreio.definirEvento(enviado.codigo, 'Carteiro não atendido - Entrega não realizada');
    await rodar({ agora: horaDeBrasilia(hoje, 20).toISOString(), varredura: true });
    expect(rastreio.consultas().sort()).toEqual([interagindo.codigo, enviado.codigo, semWhatsapp.codigo].sort());
    expect(rastreio.consultas()).not.toContain(entregue.codigo);
    expect(rastreio.consultas()).not.toContain(insucesso.codigo);
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: enviado.id } })).status).toBe('INSUCESSO');

    // Fora da janela (22h, sem varredura) → nenhuma consulta.
    rastreio.redefinir();
    await rodar({ agora: horaDeBrasilia(hoje, 22).toISOString() });
    expect(rastreio.consultas()).toHaveLength(0);
  });

  it('IT-056 rastreio "entregue" num pacote com caso de mediação → cancelarCaso chamado uma vez', async () => {
    const [p] = await cargaCom(['INTERAGINDO'], { mediacao: true });
    await prisma.pacoteDia.update({ where: { id: p.id }, data: { mediacaoCaseId: 'caso_it056' } });
    rastreio.definirEvento(p.codigo, 'Objeto entregue ao destinatário');

    await rodar({ agora: horaDeBrasilia(hoje, 15).toISOString() });
    await processarRastreio({ agora: horaDeBrasilia(hoje, 20), varredura: true });

    const cancelamentos = prosio.cancelamentos();
    expect(cancelamentos).toHaveLength(1);
    expect(cancelamentos[0].caminho).toBe('/api/v1/mediation/cases/caso_it056/cancel');
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('ENTREGUE');
    expect(await prisma.eventoPacote.count({ where: { pacoteId: p.id, tipo: 'caso_cancelado' } })).toBe(1);
  });
});
