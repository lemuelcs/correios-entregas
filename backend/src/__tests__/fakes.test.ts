/**
 * Os servidores falsos (Prosio e Seu Rastreio) usados pelas tarefas de
 * integração: porta aleatória, gravação, roteiro, callbacks assinados e
 * desligamento limpo.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import { verificarAssinatura } from '../integrations/prosio/assinatura';
import { ProsioFake } from './fakes/prosio.fake';
import { SeuRastreioFake } from './fakes/seu-rastreio.fake';

interface Recebido {
  headers: http.IncomingHttpHeaders;
  corpo: Buffer;
  url: string;
}

async function receptor(): Promise<{ url: string; recebidos: Recebido[]; parar: () => Promise<void> }> {
  const recebidos: Recebido[] = [];
  const srv = http.createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on('data', (p: Buffer) => partes.push(p));
    req.on('end', () => {
      recebidos.push({ headers: req.headers, corpo: Buffer.concat(partes), url: req.url ?? '' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ mensagem: 'ok' }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  const { port } = srv.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    recebidos,
    parar: () => new Promise<void>((ok) => srv.close(() => ok())),
  };
}

describe('servidores falsos', () => {
  it('sobem em portas aleatórias distintas e descem limpos', async () => {
    const a = await ProsioFake.iniciar();
    const b = await ProsioFake.iniciar();
    const c = await SeuRastreioFake.iniciar();
    expect(new Set([a.url, b.url, c.url]).size).toBe(3);
    await Promise.all([a.parar(), b.parar(), c.parar()]);
    await expect(fetch(`${a.url}/api/v1/messages`, { method: 'POST' })).rejects.toThrow();
    await a.parar(); // idempotente
  });

  it('ProsioFake: roteiro por vezes, depois o padrão; grava a requisição e a resposta', async () => {
    const fake = await ProsioFake.iniciar();
    try {
      fake.roteirizar('POST', '/api/v1/messages', { status: 500, corpo: { error: 'x' } }, 2);
      const statuses: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const r = await fetch(`${fake.url}/api/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': 'k1' },
          body: JSON.stringify({ to: '+5561999990001', body: 'oi' }),
        });
        statuses.push(r.status);
        await r.text();
      }
      expect(statuses).toEqual([500, 500, 202]);
      expect(fake.mensagens()).toHaveLength(3);
      expect(fake.messageIdDe(fake.mensagens()[2])).toMatch(/^msg_falso_/);
      expect(fake.mensagens()[0].corpo).toEqual({ to: '+5561999990001', body: 'oi' });

      // função de roteiro que devolve undefined passa a vez ao padrão
      fake.roteirizar('POST', /^\/api\/v1\/mediation\/cases$/, (req) =>
        req.corpo?.externalRef === 'bloq' ? undefined : { status: 403, corpo: { error: 'x', details: { reason: 'modulo_desligado' } } });
      const r1 = await fetch(`${fake.url}/api/v1/mediation/cases`, { method: 'POST', body: JSON.stringify({ externalRef: 'a' }) });
      expect(r1.status).toBe(403);
      await r1.text();
    } finally {
      await fake.parar();
    }
  });

  it('ProsioFake: callbacks de status e de desfecho saem assinados com HMAC do corpo cru', async () => {
    const fake = await ProsioFake.iniciar();
    const dest = await receptor();
    try {
      const segredo = 'segredo-do-callback-123';
      const r = await fake.enviarCallbackStatus(`${dest.url}/webhook`, segredo, {
        messageId: 'msg_1', status: 'read', reference: 'pacote-1',
      });
      expect(r).toEqual({ status: 200, corpo: { mensagem: 'ok' } });
      await fake.enviarCallbackDesfecho(`${dest.url}/webhook`, segredo, {
        caseId: 'caso_1', externalRef: 'AA1@2026-09-30',
        outcome: { motivo: 'entrega_indireta', condicao: { local: 'vizinho da casa 47' } },
      });
      await fake.enviarCallback(`${dest.url}/webhook`, { a: 1 }, segredo, { assinatura: 'sha256=00' });
      await fake.enviarCallback(`${dest.url}/webhook`, { a: 1 }, segredo, { assinatura: null });

      const [status, desfecho, invalido, semAssinatura] = dest.recebidos;
      expect(verificarAssinatura(status.corpo, String(status.headers['x-webhook-signature']), segredo)).toBe(true);
      expect(JSON.parse(status.corpo.toString())).toMatchObject({
        messageId: 'msg_1', channel: 'whatsapp', status: 'read', reference: 'pacote-1', failureReason: null,
      });
      expect(verificarAssinatura(desfecho.corpo, String(desfecho.headers['x-webhook-signature']), segredo)).toBe(true);
      expect(JSON.parse(desfecho.corpo.toString())).toMatchObject({
        event: 'mediation.outcome', caseId: 'caso_1', externalRef: 'AA1@2026-09-30', sequence: 1, disposition: 'decidido',
        outcome: { estado: 'resolvido', motivo: 'entrega_indireta', condicao: { local: 'vizinho da casa 47' } },
      });
      expect(verificarAssinatura(invalido.corpo, String(invalido.headers['x-webhook-signature']), segredo)).toBe(false);
      expect(semAssinatura.headers['x-webhook-signature']).toBeUndefined();
    } finally {
      await Promise.all([fake.parar(), dest.parar()]);
    }
  });

  it('ProsioFake: acionarBotao chama a URL como a integração buttonAction do tenant', async () => {
    const fake = await ProsioFake.iniciar();
    const dest = await receptor();
    try {
      const r = await fake.acionarBotao(`${dest.url}/acao/CE_OP`, { token: 'tok', acao: 'p1.AMANHA', telefone: '+5561999990001' });
      expect(r.status).toBe(200);
      const [req] = dest.recebidos;
      expect(req.url).toBe('/acao/CE_OP');
      expect(req.headers.authorization).toBe('Bearer tok');
      expect(req.headers['x-actor-phone']).toBe('+5561999990001');
      expect(JSON.parse(req.corpo.toString())).toEqual({ acao: 'p1.AMANHA' });
    } finally {
      await Promise.all([fake.parar(), dest.parar()]);
    }
  });
});
