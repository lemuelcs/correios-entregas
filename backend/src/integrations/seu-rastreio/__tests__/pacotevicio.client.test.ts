import { PacoteVicioClient } from '../pacotevicio.client';
import { RastreioError } from '../rastreio.client';

const resposta = (status: number, corpo?: unknown) =>
  (async () => new Response(corpo === undefined ? '' : JSON.stringify(corpo), { status })) as unknown as typeof fetch;

describe('PacoteVicioClient', () => {
  it('usa o último evento e classifica a entrega', async () => {
    const c = new PacoteVicioClient({
      token: 'k',
      baseUrl: 'https://x.test',
      fetch: resposta(200, {
        tracking_code: 'AD972713337BR',
        status: 'delivered',
        events: [
          { timestamp: '2026-10-02T12:34:16Z', status: 'out_for_delivery', description: 'Objeto saiu para entrega ao destinatário' },
          { timestamp: '2026-10-02T16:47:15Z', status: 'delivered', description: 'Objeto entregue ao destinatário', location: { city: 'Jundiai', facility: 'Unidade de Distribuição' } },
        ],
      }),
    });
    const r = await c.consultar('AD972713337BR');
    expect(r?.classificacao).toBe('ENTREGUE');
    expect(r?.eventoMaisRecente).toMatchObject({ data: '2026-10-02T16:47:15Z', local: 'Jundiai - Unidade de Distribuição', descricao: 'Objeto entregue ao destinatário' });
  });

  it('404 vira null; 401 e ausência de chave viram RastreioError', async () => {
    expect(await new PacoteVicioClient({ token: 'k', fetch: resposta(404) }).consultar('X')).toBeNull();
    await expect(new PacoteVicioClient({ token: 'k', fetch: resposta(401) }).consultar('X')).rejects.toMatchObject({ code: 'nao_autorizado' });
    delete process.env.PACOTEVICIO_API_KEY;
    await expect(new PacoteVicioClient({ fetch: resposta(200, {}) }).consultar('X')).rejects.toBeInstanceOf(RastreioError);
  });
});
