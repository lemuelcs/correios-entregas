import { randomBytes } from 'crypto';
import type { CanalProsio } from '@prisma/client';
import { cifrar } from '../../../shared/utils/cripto';
import { ProsioFake } from '../../../__tests__/fakes/prosio.fake';
import { ProsioError, ProsioHttpClient, resolverCanal, type CanalResolvido } from '../prosio.client';

const CHAVE = randomBytes(32);
const API_KEY = `psk_test_${randomBytes(8).toString('hex')}`;
const SEGREDO = `cb_${randomBytes(12).toString('hex')}`;

function canalCifrado(baseUrl: string, over: Partial<CanalProsio> = {}): CanalProsio {
  return {
    id: 'canal-1',
    nome: 'Canal de teste',
    baseUrl: `${baseUrl}/`,
    apiKeyCifrada: cifrar(API_KEY, CHAVE),
    callbackSecretCifrado: cifrar(SEGREDO, CHAVE),
    tokenEntradaHash: 'x',
    tipo: 'WAHA',
    compartilhado: false,
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...over,
  } as CanalProsio;
}

describe('ProsioClient', () => {
  let fake: ProsioFake;
  let canal: CanalResolvido;
  const client = new ProsioHttpClient({ timeoutMs: 2_000, extensoesMediacao: false });
  let saidas: string[];
  let espioes: jest.SpyInstance[];

  beforeAll(async () => {
    fake = await ProsioFake.iniciar({ apiKey: API_KEY });
    canal = resolverCanal(canalCifrado(fake.url), CHAVE);
  });

  afterAll(async () => {
    await fake.parar();
  });

  beforeEach(() => {
    fake.redefinir();
    saidas = [];
    const grava = (...args: unknown[]) => {
      saidas.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(grava),
    );
  });

  afterEach(() => {
    espioes.forEach((e) => e.mockRestore());
    // Nenhum segredo do canal em log, em nenhum cenário.
    for (const linha of saidas) {
      expect(linha).not.toContain(API_KEY);
      expect(linha).not.toContain(SEGREDO);
    }
  });

  describe('resolverCanal', () => {
    it('decifra as credenciais sem expô-las na serialização', () => {
      expect(canal.apiKey).toBe(API_KEY);
      expect(canal.callbackSecret).toBe(SEGREDO);
      expect(canal.baseUrl).toBe(fake.url);
      const serializado = JSON.stringify(canal);
      expect(serializado).not.toContain(API_KEY);
      expect(serializado).not.toContain(SEGREDO);
      expect(Object.keys(canal)).not.toEqual(expect.arrayContaining(['apiKey']));
    });

    it('credencial ilegível → ProsioError(503, credencial_ilegivel) não tentável', () => {
      const outraChave = randomBytes(32);
      try {
        resolverCanal(canalCifrado(fake.url), outraChave);
        throw new Error('deveria falhar');
      } catch (err) {
        expect(err).toBeInstanceOf(ProsioError);
        expect(err).toMatchObject({ status: 503, code: 'credencial_ilegivel', tentavel: false });
      }
    });
  });

  it('UT-086: enviarMensagem manda Bearer da apiKey decifrada, Idempotency-Key e corpo com buttons e reference', async () => {
    const r = await client.enviarMensagem(canal, {
      to: '+5561999990001',
      body: 'Sua encomenda saiu para entrega',
      reference: 'pacote-1',
      idempotencyKey: 'aviso:pacote-1',
      buttons: [
        { id: 'CE_OP:pacote-1.AMANHA', text: 'Entregar amanhã' },
        { id: 'CE_OP:pacote-1.VIZINHO', text: 'Deixar com meu vizinho' },
      ],
    });

    expect(r.messageId).toMatch(/^msg_falso_/);
    const [req] = fake.mensagens();
    expect(req.headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(req.headers['idempotency-key']).toBe('aviso:pacote-1');
    expect(req.corpo).toEqual({
      channel: 'whatsapp',
      to: '+5561999990001',
      body: 'Sua encomenda saiu para entrega',
      reference: 'pacote-1',
      idempotencyKey: 'aviso:pacote-1',
      buttons: [
        { id: 'CE_OP:pacote-1.AMANHA', text: 'Entregar amanhã' },
        { id: 'CE_OP:pacote-1.VIZINHO', text: 'Deixar com meu vizinho' },
      ],
    });

    // mesma chave → mesmo messageId (idempotência do Prosio)
    const de_novo = await client.enviarMensagem(canal, {
      to: '+5561999990001', body: 'x', reference: 'pacote-1', idempotencyKey: 'aviso:pacote-1',
    });
    expect(de_novo.messageId).toBe(r.messageId);
    expect(fake.mensagens()[1].corpo).not.toHaveProperty('buttons');
  });

  it('enviarMensagem inclui unidadeRef quando informada (P1)', async () => {
    await client.enviarMensagem(canal, {
      to: '+5561999990001', body: 'x', reference: 'p', idempotencyKey: 'k', unidadeRef: 'cdd-asa-sul',
    });
    expect(fake.mensagens()[0].corpo.unidadeRef).toBe('cdd-asa-sul');
  });

  it('UT-087: 429 → ProsioError(429, rate_limited) tentável; 422 invalid_phone → não tentável', async () => {
    const msg = { to: '+5561999990001', body: 'x', reference: 'p', idempotencyKey: 'aviso:p' };

    // Formato real do limitador do Prosio: AppError(429, 'Too many requests', { limiter }).
    fake.roteirizar('POST', '/api/v1/messages', {
      status: 429,
      corpo: { error: 'Too many requests', details: { limiter: 'rl:api-key' } },
    }, 1);
    const e429 = await client.enviarMensagem(canal, msg).catch((e: unknown) => e);
    expect(e429).toBeInstanceOf(ProsioError);
    expect(e429).toMatchObject({ status: 429, code: 'rate_limited', tentavel: true });

    fake.roteirizar('POST', '/api/v1/messages', { status: 422, corpo: { code: 'invalid_phone', message: 'x' } }, 1);
    const e422 = await client.enviarMensagem(canal, msg).catch((e: unknown) => e);
    expect(e422).toMatchObject({ status: 422, code: 'invalid_phone', tentavel: false });

    // Formato da mediação: { error, details: { reason } }.
    fake.roteirizar('POST', '/api/v1/messages', {
      status: 422,
      corpo: { error: 'Pontas inválidas', details: { reason: 'invalid_phone', detail: 'to: must be E.164' } },
    }, 1);
    const eMed = await client.enviarMensagem(canal, msg).catch((e: unknown) => e);
    expect(eMed).toMatchObject({ status: 422, code: 'invalid_phone', tentavel: false });

    fake.roteirizar('POST', '/api/v1/messages', { status: 500, corpo: { error: 'Internal server error' } }, 1);
    const e500 = await client.enviarMensagem(canal, msg).catch((e: unknown) => e);
    expect(e500).toMatchObject({ status: 500, code: 'erro_prosio', tentavel: true });

    fake.roteirizar('POST', '/api/v1/messages', { status: 400, corpo: { error: 'Invalid request', details: {} } }, 1);
    const e400 = await client.enviarMensagem(canal, msg).catch((e: unknown) => e);
    expect(e400).toMatchObject({ status: 400, code: 'requisicao_invalida', tentavel: false });
  });

  it('401 de chave inválida vira ProsioError não tentável', async () => {
    const outro = resolverCanal(
      canalCifrado(fake.url, { apiKeyCifrada: cifrar('psk_test_errada', CHAVE) }),
      CHAVE,
    );
    const e = await client
      .enviarMensagem(outro, { to: '+5561999990001', body: 'x', reference: 'p', idempotencyKey: 'k' })
      .catch((err: unknown) => err);
    expect(e).toMatchObject({ status: 401, code: 'chave_invalida', tentavel: false });
  });

  it('tempo limite → ProsioError(0, timeout) tentável', async () => {
    const lento = new ProsioHttpClient({ timeoutMs: 100 });
    fake.roteirizar('POST', '/api/v1/messages', { status: 202, corpo: { messageId: 'm', status: 'accepted' }, atrasoMs: 400 }, 1);
    const e = await lento
      .enviarMensagem(canal, { to: '+5561999990001', body: 'x', reference: 'p', idempotencyKey: 'k' })
      .catch((err: unknown) => err);
    expect(e).toMatchObject({ status: 0, code: 'timeout', tentavel: true });
  });

  it('UT-088: abrirCaso com 201 → created true; com 200 (caso existente) → created false', async () => {
    const caso = {
      externalRef: 'AA123456785BR@2026-09-30',
      providerPhone: '+5561999990002',
      recipientPhone: '+5561999990001',
      resumo: 'Maria · QNA 12 Casa 45',
      respondBy: new Date('2026-09-30T23:00:00.000Z'),
    };
    const primeiro = await client.abrirCaso(canal, caso);
    expect(primeiro).toMatchObject({ created: true, firstContact: 'queued' });
    const segundo = await client.abrirCaso(canal, caso);
    expect(segundo).toMatchObject({ caseId: primeiro.caseId, created: false });

    // Contrato real (strictObject): sem as extensões, só os campos que o Prosio aceita.
    expect(fake.aberturasDeCaso()[0].corpo).toEqual({
      externalRef: 'AA123456785BR@2026-09-30',
      providerPhone: '+5561999990002',
      recipientPhone: '+5561999990001',
    });
    expect(fake.aberturasDeCaso()[0].headers.authorization).toBe(`Bearer ${API_KEY}`);
  });

  it('abrirCaso contra um Prosio estrito passa sem extensões e é recusado com elas', async () => {
    fake.mediacaoEstrita = true;
    try {
      const caso = {
        externalRef: 'AA100000025BR@2026-09-30',
        providerPhone: '+5561999990002',
        recipientPhone: '+5561999990001',
        motivo: 'outro' as const,
        resumo: 'João · QNB 3',
        respondBy: new Date('2026-09-30T23:00:00.000Z'),
        unidadeRef: 'cdd-1',
      };
      await expect(client.abrirCaso(canal, caso)).resolves.toMatchObject({ created: true });

      const comExtensoes = new ProsioHttpClient({ extensoesMediacao: true });
      const e = await comExtensoes.abrirCaso(canal, { ...caso, externalRef: 'outro@2026-09-30' }).catch((err: unknown) => err);
      expect(e).toMatchObject({ status: 422, code: 'invalid_phone', tentavel: false });
      expect(fake.aberturasDeCaso()[1].corpo).toMatchObject({
        firstContact: 'integrador',
        resumo: 'João · QNB 3',
        respondBy: '2026-09-30T23:00:00.000Z',
        unidadeRef: 'cdd-1',
      });
    } finally {
      fake.mediacaoEstrita = false;
    }
  });

  it('atualizarFatosCaso: sem extensões recusa sem rede; com extensões faz PATCH dos fatos', async () => {
    const fatos = { motivoRelatado: 'entrega_indireta' as const, perguntaAberta: 'Qual o nome e a casa do vizinho?' };
    const e = await client.atualizarFatosCaso(canal, 'caso-1', fatos).catch((err: unknown) => err);
    expect(e).toMatchObject({ status: 501, code: 'fatos_nao_suportados', tentavel: false });
    expect(fake.atualizacoesDeFatos()).toHaveLength(0);

    await new ProsioHttpClient({ extensoesMediacao: true }).atualizarFatosCaso(canal, 'caso-1', fatos);
    const [req] = fake.atualizacoesDeFatos();
    expect(req.caminho).toBe('/api/v1/mediation/cases/caso-1/facts');
    expect(req.corpo).toEqual(fatos);
  });

  it('cancelarCaso faz POST /cases/:id/cancel', async () => {
    await client.cancelarCaso(canal, 'caso-9');
    await client.cancelarCaso(canal, 'caso-9');
    expect(fake.cancelamentos().map((r) => r.resposta?.corpo)).toEqual([
      expect.objectContaining({ cancelled: true }),
      expect.objectContaining({ cancelled: false }),
    ]);
  });

  it('criarSessaoAtendimento envia usuario, dominio e unidadeRef e devolve { url, expiraEm }', async () => {
    const s = await client.criarSessaoAtendimento(canal, {
      idExterno: 'u-1', nome: 'Ana', email: 'ana@example.com', papel: 'agente', unidadeRef: 'cdd-1', dominio: 'correios.example.com',
    });
    expect(s.url).toContain(fake.url);
    expect(new Date(s.expiraEm).getTime()).toBeGreaterThan(Date.now());
    expect(fake.sessoes()[0].corpo).toEqual({
      usuario: { idExterno: 'u-1', nome: 'Ana', email: 'ana@example.com', papel: 'agente' },
      dominio: 'correios.example.com',
      unidadeRef: 'cdd-1',
    });
  });

  it('UT-098: 503 chatwoot_indisponivel em criarSessaoAtendimento → ProsioError(503, chatwoot_indisponivel)', async () => {
    fake.roteirizar('POST', '/api/v1/atendimento/sessoes', {
      status: 503,
      corpo: { code: 'chatwoot_indisponivel', message: 'O atendimento está indisponível no momento.' },
    });
    const e = await client
      .criarSessaoAtendimento(canal, { idExterno: 'u-1', nome: 'Ana', email: 'ana@example.com', papel: 'administrador' })
      .catch((err: unknown) => err);
    expect(e).toBeInstanceOf(ProsioError);
    expect(e).toMatchObject({ status: 503, code: 'chatwoot_indisponivel', tentavel: true });
  });
});
