import request from 'supertest';
import { app } from '../app';
import { encerrarRecursos } from './helpers/recursos';

describe('app health', () => {
  afterAll(encerrarRecursos);

  it('IT-053 GET /health responde 200 com status ok, sem servidor externo', async () => {
    // Connection: close — sem keep-alive o servidor efêmero do supertest fecha na hora
    // e o Jest termina sem handles pendentes.
    const res = await request(app).get('/health').set('Connection', 'close');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(typeof res.body.timestamp).toBe('string');
  });
});
