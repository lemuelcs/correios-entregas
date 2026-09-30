import { SeuRastreioFake } from '../../../__tests__/fakes/seu-rastreio.fake';
import { RastreioError, SeuRastreioClient } from '../rastreio.client';

describe('SeuRastreioClient', () => {
  let fake: SeuRastreioFake;
  let client: SeuRastreioClient;

  beforeAll(async () => {
    fake = await SeuRastreioFake.iniciar({ token: 'token-teste' });
    client = new SeuRastreioClient({ token: 'token-teste', baseUrl: fake.url });
  });
  afterAll(() => fake.parar());
  beforeEach(() => {
    fake.redefinir();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('consulta GET /api/public/rastreio/{codigo} com bearer e classifica o evento', async () => {
    fake.definirEvento('AA123456785BR', 'Objeto entregue ao destinatário', { data: '2026-09-30T14:02:00-03:00' });
    const r = await client.consultar('AA123456785BR');
    expect(r).toEqual({
      codigo: 'AA123456785BR',
      status: 'Objeto entregue ao destinatário',
      eventoMaisRecente: {
        data: '2026-09-30T14:02:00-03:00',
        local: 'CDD Teste - Brasília/DF',
        destino: null,
        descricao: 'Objeto entregue ao destinatário',
      },
      classificacao: 'ENTREGUE',
    });
    expect(fake.consultas()).toEqual(['AA123456785BR']);
    expect(fake.requisicoes[0].headers.authorization).toBe('Bearer token-teste');
  });

  it('evento não mapeado → classificacao null', async () => {
    fake.definirEvento('AA1', 'Objeto em trânsito - por favor aguarde');
    await expect(client.consultar('AA1')).resolves.toMatchObject({ classificacao: null });
  });

  it('código desconhecido (404) → null', async () => {
    await expect(client.consultar('ZZ000000000BR')).resolves.toBeNull();
  });

  it('5xx → RastreioError tentável; 401 → não tentável', async () => {
    fake.definirResposta('AA2', { status: 502, corpo: { error: 'bad gateway' } });
    await expect(client.consultar('AA2')).rejects.toMatchObject({ status: 502, tentavel: true });
    const semToken = new SeuRastreioClient({ token: 'errado', baseUrl: fake.url });
    await expect(semToken.consultar('AA2')).rejects.toMatchObject({ status: 401, code: 'nao_autorizado', tentavel: false });
  });

  it('respeita o limite de tempo (padrão 3 s)', async () => {
    fake.definirResposta('AA3', { status: 200, corpo: { status: 'x', eventoMaisRecente: null }, atrasoMs: 400 });
    const rapido = new SeuRastreioClient({ token: 'token-teste', baseUrl: fake.url, timeoutMs: 100 });
    const e = await rapido.consultar('AA3').catch((err: unknown) => err);
    expect(e).toBeInstanceOf(RastreioError);
    expect(e).toMatchObject({ status: 0, code: 'timeout', tentavel: true });
  });

  it('sem SEU_RASTREIO_TOKEN → RastreioError(503, sem_credencial) sem chamar a rede', async () => {
    const anterior = process.env.SEU_RASTREIO_TOKEN;
    delete process.env.SEU_RASTREIO_TOKEN;
    try {
      const semCredencial = new SeuRastreioClient({ baseUrl: fake.url });
      await expect(semCredencial.consultar('AA4')).rejects.toMatchObject({ status: 503, code: 'sem_credencial', tentavel: false });
      expect(fake.requisicoes).toHaveLength(0);
    } finally {
      if (anterior !== undefined) process.env.SEU_RASTREIO_TOKEN = anterior;
    }
  });

  it('lê SEU_RASTREIO_TOKEN e SEU_RASTREIO_URL do ambiente a cada chamada', async () => {
    const env = { ...process.env };
    process.env.SEU_RASTREIO_TOKEN = 'token-teste';
    process.env.SEU_RASTREIO_URL = fake.url;
    try {
      fake.definirEvento('AA5', 'Destinatário ausente');
      await expect(new SeuRastreioClient().consultar('AA5')).resolves.toMatchObject({ classificacao: 'INSUCESSO' });
    } finally {
      process.env = env;
    }
  });
});
