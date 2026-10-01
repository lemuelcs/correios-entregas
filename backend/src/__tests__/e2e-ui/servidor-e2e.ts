/**
 * Backend em modo de teste para os testes de interface (Playwright, task_07).
 *
 * Sobe, num processo só:
 * - a API real (`app`) em E2E_API_PORTA (3712), contra o banco dedicado de
 *   TEST_DATABASE_URL (recusa nomes que não terminem em `_test`; o schema é
 *   apagado e as migrations reaplicadas na partida);
 * - o Prosio falso (`ProsioFake`) em E2E_PROSIO_PORTA (3713);
 * - um servidor de controle em E2E_CONTROLE_PORTA (3714), só para os testes:
 *   limpa o banco, monta cenários, programa o Prosio falso, envia callbacks
 *   assinados e serve as planilhas de exemplo.
 *
 * Os workers BullMQ NÃO sobem: a liberação só enfileira (os pacotes ficam
 * `AGENDADO`), e o estado mostrado na tela fica determinístico.
 *
 * Uso: `npx tsx src/__tests__/e2e-ui/servidor-e2e.ts` (o playwright.config do
 * frontend faz isso sozinho).
 */
import { resolverBancoTeste } from '../setup/banco-teste';

const { url: urlBanco } = resolverBancoTeste(process.env.TEST_DATABASE_URL);

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = urlBanco;
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/2';
process.env.JWT_SECRET ??= 'segredo-jwt-dos-testes-com-32-caracteres';
process.env.JWT_REFRESH_SECRET ??= 'segredo-refresh-dos-testes-com-32-chars';
process.env.ENTREGAS_CRYPTO_KEY ??= 'chave-de-cifra-dos-testes-com-32-bytes!!';
process.env.LOG_LEVEL ??= 'warn';

const PORTA_API = Number(process.env.E2E_API_PORTA ?? 3712);
const PORTA_PROSIO = Number(process.env.E2E_PROSIO_PORTA ?? 3713);
const PORTA_CONTROLE = Number(process.env.E2E_CONTROLE_PORTA ?? 3714);

async function main(): Promise<void> {
  // Imports depois do ambiente: Prisma, filas e JWT leem as variáveis na carga do módulo.
  const { default: globalSetup } = await import('../setup/global-setup');
  await globalSetup();

  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const ExcelJS = (await import('exceljs')).default;
  const { app } = await import('../../app');
  const { prisma } = await import('../../shared/utils/prisma');
  const { entregasAvisoQueue, entregasRastreioQueue } = await import('../../queue');
  const { ProsioFake } = await import('../fakes/prosio.fake');
  const f = await import('../fixtures/entregas');

  const prosio = await new ProsioFake().iniciar(PORTA_PROSIO);
  const servidorApi = app.listen(PORTA_API, '127.0.0.1');

  const SENHA = 'senha-e2e-123';
  const hoje = () => f.dia(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()));

  /** Último canal criado pelo cenário (para assinar callbacks). */
  let canalAtual: { id: string; callbackSecret: string } | null = null;

  const telefone = (n: number) => `(61) 9${String(81_000_000 + n).slice(0, 4)}-${String(81_000_000 + n).slice(4, 8)}`;

  async function cenarioSupervisor(opcoes: { d03?: 'pendente' | 'carregado' }) {
    const canal = await f.criarCanal({ nome: 'Canal CDD Taguatinga', baseUrl: prosio.url });
    canalAtual = { id: canal.canal.id, callbackSecret: canal.callbackSecret };
    const unidade = await f.criarUnidade({ nome: 'CDD Taguatinga', canalProsioId: canal.canal.id });
    await f.criarSupervisor({ unidadeId: unidade.id, nome: 'Ana Ribeiro', email: 'ana.ribeiro@e2e.local', senha: SENHA });

    const carteiro = (nome: string) => f.criarCarteiro({ unidadeId: unidade.id, nome });
    const marcos = await carteiro('Marcos Paulo Lima');
    const renato = await carteiro('Renato Alves Costa');
    const patricia = await carteiro('Patrícia Nunes');
    await carteiro('Wesley Mota Ramos');

    const data = hoje();
    const distritos: Record<string, { id: string; cargaId: string | null }> = {};
    const pacotesD01: Array<{ id: string; codigo: string }> = [];

    // D-01: liberado, avisos enviados (Em entrega). Pacotes com messageId para os callbacks.
    const d01 = await f.criarDistrito({ unidadeId: unidade.id, codigo: 'D-01', nome: 'Taguatinga Norte', carteiroPadraoId: marcos.id });
    const c01 = await f.criarCarga({ distritoId: d01.id, data, status: 'LIBERADO', carteiroId: marcos.id, liberadoEm: new Date() });
    for (let i = 1; i <= 3; i += 1) {
      const p = await f.criarPacote({ cargaId: c01.id, data, status: 'ENVIADO', prosioMessageId: `msg_e2e_${i}`, nome: `Destinatário Norte ${i}` });
      pacotesD01.push({ id: p.id, codigo: p.codigo });
    }
    await f.criarPacote({ cargaId: c01.id, data, whatsappE164: null, nome: 'Edson Pereira' });
    distritos['D-01'] = { id: d01.id, cargaId: c01.id };

    // D-03: pendente de upload, ou já carregado com 28 de 37 com WhatsApp.
    const d03 = await f.criarDistrito({ unidadeId: unidade.id, codigo: 'D-03', nome: 'Águas Claras Sul', carteiroPadraoId: renato.id });
    let c03: string | null = null;
    if (opcoes.d03 === 'carregado') {
      const carga = await f.criarCarga({ distritoId: d03.id, data });
      for (let i = 0; i < 37; i += 1) {
        await f.criarPacote({ cargaId: carga.id, data, ...(i >= 28 ? { whatsappE164: null } : {}) });
      }
      c03 = carga.id;
    }
    distritos['D-03'] = { id: d03.id, cargaId: c03 };

    // D-04: carregado, nenhum pacote com WhatsApp (liberação pede confirmação explícita).
    const d04 = await f.criarDistrito({ unidadeId: unidade.id, codigo: 'D-04', nome: 'Águas Claras Norte', carteiroPadraoId: patricia.id });
    const c04 = await f.criarCarga({ distritoId: d04.id, data });
    for (let i = 0; i < 3; i += 1) await f.criarPacote({ cargaId: c04.id, data, whatsappE164: null });
    distritos['D-04'] = { id: d04.id, cargaId: c04.id };

    // D-06: carregado, sem carteiro (liberação bloqueada).
    const d06 = await f.criarDistrito({ unidadeId: unidade.id, codigo: 'D-06', nome: 'Ceilândia Sul' });
    const c06 = await f.criarCarga({ distritoId: d06.id, data });
    for (let i = 0; i < 2; i += 1) await f.criarPacote({ cargaId: c06.id, data });
    distritos['D-06'] = { id: d06.id, cargaId: c06.id };

    return { supervisor: { email: 'ana.ribeiro@e2e.local', senha: SENHA }, unidadeId: unidade.id, distritos, pacotesD01 };
  }

  async function cenarioVazio() {
    const canal = await f.criarCanal({ nome: 'Canal CDD Ceilândia', baseUrl: prosio.url });
    canalAtual = { id: canal.canal.id, callbackSecret: canal.callbackSecret };
    const unidade = await f.criarUnidade({ nome: 'CDD Ceilândia', canalProsioId: canal.canal.id });
    await f.criarSupervisor({ unidadeId: unidade.id, nome: 'Luana Teixeira', email: 'luana@e2e.local', senha: SENHA });
    return { supervisor: { email: 'luana@e2e.local', senha: SENHA }, unidadeId: unidade.id };
  }

  async function cenarioGestor() {
    await f.criarGestor({ nome: 'Gestão Sede', email: 'gestor@e2e.local', senha: SENHA });
    // Outra unidade, com distrito: o supervisor novo não pode enxergá-la.
    const outra = await f.criarUnidade({ nome: 'CEE Águas Claras', tipo: 'CEE' });
    await f.criarDistrito({ unidadeId: outra.id, codigo: 'D-50', nome: 'Arniqueiras' });
    return { gestor: { email: 'gestor@e2e.local', senha: SENHA }, prosioUrl: prosio.url, outraUnidadeId: outra.id };
  }

  async function cenarioCarteiro() {
    const unidade = await f.criarUnidade({ nome: 'CDD Legado' });
    const u = await prisma.usuario.create({
      data: {
        nome: 'Carteiro Legado',
        email: 'carteiro@e2e.local',
        matricula: '80000001',
        role: 'CARTEIRO',
        unidadeId: unidade.id,
        senha: await (await import('bcryptjs')).default.hash(SENHA, 4),
      },
    });
    await f.criarCarteiro({ unidadeId: unidade.id, nome: 'Carteiro Legado', usuarioId: u.id });
    return { carteiro: { email: 'carteiro@e2e.local', senha: SENHA } };
  }

  // ——— Planilhas de exemplo ———————————————————————————————————————

  /** 40 linhas: 28 válidas, 8 sem WhatsApp, 1 para corrigir (sem DDD), 3 inválidas. */
  function linhasAguasClarasSul(): string[][] {
    const linhas: string[][] = [];
    const endereco = (i: number) => [`Rua ${i} Sul Lote ${i}`, String(i), '', 'Águas Claras', 'Brasília', 'DF', '71931720'];
    for (let i = 1; i <= 36; i += 1) {
      const codigo = f.codigoS10(52_601_000 + i, 'OY');
      const whats = i <= 28 ? telefone(i) : '';
      linhas.push([codigo, `Destinatário Sul ${i}`, whats, ...endereco(i)]);
    }
    linhas.push([f.codigoS10(52_601_900, 'OY'), 'Beatriz Lima Castro', '98876-1102', ...endereco(37)]);
    linhas.push(['AB123456789BR', 'Rafael Moreira', telefone(90), ...endereco(38)]);
    linhas.push([linhas[2][0], 'Luciana F. Gomes', telefone(91), ...endereco(39)]);
    linhas.push([f.codigoS10(52_601_950, 'OY'), '', telefone(92), ...endereco(40)]);
    return linhas;
  }

  const CABECALHO = ['Código', 'Nome', 'WhatsApp', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'CEP'];

  async function xlsx(linhas: string[][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Pacotes');
    ws.addRow(CABECALHO);
    for (const l of linhas) ws.addRow(l);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  function csv(linhas: string[][]): Buffer {
    return Buffer.from([CABECALHO, ...linhas].map((l) => l.join(';')).join('\n'), 'utf8');
  }

  // ——— Controle ———————————————————————————————————————————————————

  const controle = express();
  controle.use(express.json());

  const rota = (fn: (req: import('express').Request) => Promise<unknown>) =>
    (req: import('express').Request, res: import('express').Response) => {
      fn(req).then((r) => res.json(r ?? { ok: true })).catch((err: Error) => {
        console.error('[e2e controle]', err);
        res.status(500).json({ error: err.message });
      });
    };

  controle.get('/saude', (_req, res) => {
    res.json({ ok: true, api: `http://127.0.0.1:${PORTA_API}`, prosio: prosio.url });
  });

  controle.post('/reset', rota(async () => {
    await f.limparBanco();
    prosio.redefinir();
    canalAtual = null;
    await entregasAvisoQueue.obliterate({ force: true });
    await entregasRastreioQueue.obliterate({ force: true });
    return { ok: true, prosioUrl: prosio.url };
  }));

  controle.post('/cenarios/:nome', rota(async (req) => {
    switch (req.params.nome) {
      case 'supervisor': return cenarioSupervisor(req.body ?? {});
      case 'vazio': return cenarioVazio();
      case 'gestor': return cenarioGestor();
      case 'carteiro': return cenarioCarteiro();
      default: throw new Error(`cenário desconhecido: ${req.params.nome}`);
    }
  }));

  /** `{ indisponivel: true }` → o Prosio falso responde 503 à criação de sessão do Chatwoot. */
  controle.post('/prosio/sessoes', rota(async (req) => {
    prosio.redefinir();
    if (req.body?.indisponivel) {
      prosio.roteirizar('POST', '/api/v1/atendimento/sessoes', { status: 503, corpo: { code: 'chatwoot_indisponivel' } });
    }
    return { ok: true };
  }));

  /** URLs de sessão que o Prosio falso devolveu, na ordem. */
  controle.get('/prosio/sessoes', rota(async () => prosio.sessoes().map((s) => (s.resposta?.corpo as { url?: string } | undefined)?.url ?? null)));

  /** Mensagens que o Prosio falso recebeu (`POST /api/v1/messages`), na ordem: `{ to, body, reference }`. */
  controle.get('/prosio/mensagens', rota(async () => prosio.mensagens().map((m) => {
    const corpo = (m.corpo ?? {}) as { to?: string; body?: string; reference?: string };
    return { to: corpo.to ?? null, body: corpo.body ?? null, reference: corpo.reference ?? null };
  })));

  /** Marca o pacote como entregue por fora da tela (como o rastreio faria). */
  controle.post('/pacotes/:id/entregue', rota(async (req) => {
    await prisma.pacoteDia.update({ where: { id: String(req.params.id) }, data: { status: 'ENTREGUE' } });
    return { ok: true };
  }));

  /** Callback de status assinado, como o Prosio faria: `{ pacoteId, status }`. */
  controle.post('/prosio/status', rota(async (req) => {
    if (!canalAtual) throw new Error('nenhum canal no cenário');
    const pacote = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: String(req.body.pacoteId) } });
    const r = await prosio.enviarCallbackStatus(
      `http://127.0.0.1:${PORTA_API}/api/v1/entregas/prosio/${canalAtual.id}/webhook`,
      canalAtual.callbackSecret,
      { messageId: pacote.prosioMessageId ?? `msg_${pacote.id}`, status: req.body.status ?? 'read', reference: pacote.id },
    );
    return r;
  }));

  /**
   * Sessão pronta (o mesmo `authService.login` da rota, sem o limite de tentativas
   * do `/auth/login`): os testes que não testam o login entram por aqui.
   */
  controle.post('/sessoes', rota(async (req) => {
    const { authService } = await import('../../modules/auth/auth.service');
    return authService.login({ email: String(req.body.email), senha: String(req.body.senha ?? SENHA) });
  }));

  /** Access token já expirado do usuário (sessão vencida). */
  controle.post('/tokens/expirado', rota(async (req) => {
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: String(req.body.email) } });
    const agora = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      { sub: u.id, role: u.role, unidadeId: u.unidadeId ?? undefined, iat: agora - 3600, exp: agora - 60 },
      process.env.JWT_SECRET!,
    );
    return { accessToken: token };
  }));

  controle.get('/planilhas/:nome', (req, res) => {
    const nome = req.params.nome;
    const enviar = (buf: Buffer, tipo: string) => res.type(tipo).send(buf);
    if (nome === 'aguas-claras-sul.xlsx') {
      xlsx(linhasAguasClarasSul()).then((b) => enviar(b, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
        .catch((err: Error) => res.status(500).json({ error: err.message }));
      return;
    }
    if (nome === 'so-invalidas.csv') {
      enviar(csv([
        ['AB123456789BR', 'Rafael Moreira', telefone(1), 'Rua 1', '1', '', 'Águas Claras', 'Brasília', 'DF', '71931720'],
        ['XX12', 'Sérgio Almeida', telefone(2), 'Rua 2', '2', '', 'Águas Claras', 'Brasília', 'DF', '71931720'],
        [f.codigoS10(52_602_001, 'OY'), '', telefone(3), 'Rua 3', '3', '', 'Águas Claras', 'Brasília', 'DF', '71931720'],
      ]), 'text/csv');
      return;
    }
    res.status(404).json({ error: 'planilha desconhecida' });
  });

  const servidorControle = controle.listen(PORTA_CONTROLE, '127.0.0.1');
  console.log(`[e2e] API http://127.0.0.1:${PORTA_API} · Prosio falso ${prosio.url} · controle http://127.0.0.1:${PORTA_CONTROLE}`);

  const encerrar = async () => {
    servidorControle.close();
    servidorApi.close();
    await prosio.parar();
    await Promise.allSettled([entregasAvisoQueue.close(), entregasRastreioQueue.close()]);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void encerrar());
  process.on('SIGINT', () => void encerrar());
}

// Um erro solto não pode derrubar o servidor no meio da suíte: registra e segue.
process.on('unhandledRejection', (err) => console.error('[e2e] unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('[e2e] uncaughtException:', err));

main().catch((err) => {
  console.error('[e2e] falha ao subir o backend de teste:', err);
  process.exit(1);
});
