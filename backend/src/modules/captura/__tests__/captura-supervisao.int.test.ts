import bcrypt from 'bcryptjs';
import type { StatusCarga } from '@prisma/client';
import type { Express } from 'express';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import * as ganchos from '../../entregas/ganchos';
import { formatarData, hojeBrasilia } from '../../entregas/datas';
import {
  SENHA_PADRAO,
  criarCarga,
  criarCarteiro,
  criarPacote,
  criarSupervisor,
  escala,
  limparBanco,
  matriculaUnica,
  pacoteCapturado,
} from '../../../__tests__/fixtures/entregas';
import { tokenPara } from '../../../__tests__/helpers/login';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { executarRetencao } from '../retencao';
import {
  AGORA,
  HOJE,
  api,
  auth,
  desmontarAmbiente,
  enviar,
  eventos,
  jpegDe,
  meta,
  prepararAmbiente,
  redefinirFakes,
  semear,
  type AmbienteCaptura,
  type Semente,
} from './captura.helpers';

const OY = 'OY716488072BR';
const UM_DIA = 24 * 60 * 60 * 1000;

interface Camada {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Camada[] };
}

/** A rota existe no app? (a liberação é da task_06 do monitoramento). */
function rotaExiste(metodo: string, caminho: string): boolean {
  const procurar = (pilha: Camada[] | undefined): boolean =>
    (pilha ?? []).some((c) =>
      (c.route?.path === caminho && !!c.route.methods[metodo]) || procurar(c.handle?.stack));
  return procurar((app as Express & { _router?: { stack: Camada[] } })._router?.stack);
}

interface TransferenciaCartao {
  distrito: string;
  carteiro: { id: string };
  [campo: string]: unknown;
}
interface Cartao {
  codigo: string;
  paraConferir: number;
  transferencias: { entrada: TransferenciaCartao[]; saida: TransferenciaCartao[] };
  [campo: string]: unknown;
}

describe('Captura › supervisor no módulo entregas', () => {
  let amb: AmbienteCaptura;
  let s: Semente;
  let tokenS1: string;
  let gancho: jest.SpiedFunction<typeof ganchos.aoAdicionarPacotesEmCargaLiberada>;

  beforeAll(() => {
    amb = prepararAmbiente();
  });
  beforeEach(async () => {
    await limparBanco();
    redefinirFakes(amb);
    s = await semear();
    tokenS1 = tokenPara({ id: s.s1.id, role: 'UNIDADE', unidadeId: s.u1.id });
    gancho = jest.spyOn(ganchos, 'aoAdicionarPacotesEmCargaLiberada').mockResolvedValue(undefined);
  });
  afterEach(() => gancho.mockRestore());
  afterAll(async () => {
    desmontarAmbiente(amb);
    await limparBanco();
    await encerrarRecursos();
  });

  const carga = (distritoId: string, status: StatusCarga = 'CARREGADO') => criarCarga({ distritoId, data: HOJE, status });
  const confirmar = (token: string, id: string, corpo: object) =>
    api().post(`/api/v1/captura/capturas/${id}/confirmar`).set(auth(token)).send(corpo);
  const login = (matricula: string, senha: string) => api().post('/api/v1/auth/login').send({ matricula, senha });
  const definirSenha = (token: string, carteiroId: string, senha: unknown) =>
    api().put(`/api/v1/entregas/captura/carteiros/${carteiroId}/senha`).set(auth(token)).send({ senha });
  const quadro = (token = tokenS1) => api().get('/api/v1/entregas/quadro?data=2026-09-30').set(auth(token));
  const cartao = (body: { distritos: Cartao[] }, codigo: string) => body.distritos.find((d) => d.codigo === codigo) as Cartao;
  async function supervisorU2(): Promise<string> {
    const s2 = await criarSupervisor({ unidadeId: s.u2.id });
    return tokenPara({ id: s2.id, role: 'UNIDADE', unidadeId: s.u2.id });
  }

  /** C1 fotografa o rótulo completo no D-03 (carga com o status dado) → pacote novo, origem FOTO. */
  async function capturadoNoD03(status: StatusCarga = 'CARREGADO') {
    const c = await carga(s.d03.id, status);
    const m = meta(s.d03.id);
    const r = await enviar(s.c1.token, m);
    expect(r.body).toMatchObject({ tipo: 'SALVO', atualizado: false });
    const cap = await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } });
    return { carga: c, pacoteId: r.body.pacoteId as string, capturaId: m.capturaId, fotoKey: cap.fotoKey as string };
  }

  /** Pacote da planilha no D-01; C1 o captura no D-03 e confirma a transferência. */
  async function transferidoD01ParaD03(statusOrigem: StatusCarga = 'CARREGADO') {
    const origem = await carga(s.d01.id, statusOrigem);
    const p = await criarPacote({ cargaId: origem.id, codigo: OY, nome: 'Aline R.', status: statusOrigem === 'CARREGADO' ? 'AGUARDANDO_LIBERACAO' : 'ENVIADO' });
    const m = meta(s.d03.id);
    expect((await enviar(s.c1.token, m)).body).toMatchObject({ tipo: 'TRANSFERENCIA_PENDENTE', distritoOrigem: 'D-01' });
    const r = await confirmar(s.c1.token, m.capturaId, { confirmarTransferencia: true });
    expect(r.body).toEqual({ tipo: 'SALVO', pacoteId: p.id, atualizado: true });
    return p;
  }

  // ——— Distrito do dia (escala do monitoramento) ————————————————————————

  it('IT-003 a escala do monitoramento (PUT /entregas/cadastro/.../escala) reflete em /captura/hoje', async () => {
    // A escala recusa data passada pelo relógio real: usa o dia de hoje e alinha o relógio da captura.
    amb.relogio.agora = new Date();
    const hoje = formatarData(hojeBrasilia());
    const e1 = await api().put(`/api/v1/entregas/cadastro/distritos/${s.d05.id}/escala/${hoje}`).set(auth(tokenS1)).send({ carteiroId: s.c1.carteiro.id });
    expect(e1.status).toBe(200);
    const e2 = await api().put(`/api/v1/entregas/cadastro/distritos/${s.d03.id}/escala/${hoje}`).set(auth(tokenS1)).send({ carteiroId: s.c2.carteiro.id });
    expect(e2.status).toBe(200);

    const r = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(r.status).toBe(200);
    expect(r.body.distritos.map((d: { codigo: string }) => d.codigo)).toEqual(['D-05']);
    expect(r.body.ativo).toBe(s.d05.id);
  });

  // ——— Senha do carteiro ——————————————————————————————————————————————

  it('IT-046 S1 define a senha de C1 → 204; C1 entra com ela e senhaTemporaria = true', async () => {
    const r = await definirSenha(tokenS1, s.c1.carteiro.id, 'Temp@2026');
    expect(r.status).toBe(204);
    const l = await login(s.c1.usuario.matricula!, 'Temp@2026');
    expect(l.status).toBe(200);
    expect(l.body.user.senhaTemporaria).toBe(true);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: s.c1.usuario.id } })).senhaTemporaria).toBe(true);
    expect((await login(s.c1.usuario.matricula!, SENHA_PADRAO)).status).toBe(401);
  });

  it('IT-047 redefinir a senha revoga os refresh tokens de C1 (o refresh anterior dá 401)', async () => {
    const entrada = await login(s.c1.usuario.matricula!, SENHA_PADRAO);
    expect(entrada.status).toBe(200);
    expect((await definirSenha(tokenS1, s.c1.carteiro.id, 'Temp@2026')).status).toBe(204);
    const r = await api().post('/api/v1/auth/refresh').send({ refreshToken: entrada.body.refreshToken });
    expect(r.status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { usuarioId: s.c1.usuario.id, revogado: false } })).toBe(0);
  });

  it('IT-048 senha fora da política → 400 senha_fraca', async () => {
    const r = await definirSenha(tokenS1, s.c1.carteiro.id, '123');
    expect(r.status).toBe(400);
    expect(r.body.details.code).toBe('senha_fraca');
    expect((await login(s.c1.usuario.matricula!, SENHA_PADRAO)).status).toBe(200);
  });

  it('IT-049 carteiro sem matrícula → 409 matricula_ausente, sem criar login', async () => {
    const semMatricula = await criarCarteiro({ unidadeId: s.u1.id, matricula: '' });
    const r = await definirSenha(tokenS1, semMatricula.id, 'Temp@2026');
    expect(r.status).toBe(409);
    expect(r.body.details.code).toBe('matricula_ausente');
    expect((await prisma.carteiro.findUniqueOrThrow({ where: { id: semMatricula.id } })).usuarioId).toBeNull();
  });

  it('IT-114 carteiro com matrícula fora de 8 caracteres → 409 matricula_invalida, sem criar login', async () => {
    const legado = await criarCarteiro({ unidadeId: s.u1.id, matricula: 'X123456' });
    const r = await definirSenha(tokenS1, legado.id, 'Temp@2026');
    expect(r.status).toBe(409);
    expect(r.body.details.code).toBe('matricula_invalida');
    expect((await prisma.carteiro.findUniqueOrThrow({ where: { id: legado.id } })).usuarioId).toBeNull();
  });

  it('IT-050 duas redefinições paralelas → exatamente uma senha vale (a última gravada)', async () => {
    const [a, b] = await Promise.all([
      definirSenha(tokenS1, s.c1.carteiro.id, 'SenhaA@2026'),
      definirSenha(tokenS1, s.c1.carteiro.id, 'SenhaB@2026'),
    ]);
    expect([a.status, b.status]).toEqual([204, 204]);
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: s.c1.usuario.id } });
    const valeA = await bcrypt.compare('SenhaA@2026', usuario.senha);
    const valeB = await bcrypt.compare('SenhaB@2026', usuario.senha);
    expect(valeA !== valeB).toBe(true);
    const [la, lb] = [await login(usuario.matricula!, 'SenhaA@2026'), await login(usuario.matricula!, 'SenhaB@2026')];
    expect([la.status, lb.status].sort()).toEqual([200, 401]);
    expect(la.status === 200).toBe(valeA);
    expect(usuario.updatedAt.getTime()).toBeGreaterThan(s.c1.usuario.updatedAt.getTime());

    // Também sem login: as duas criações se serializam num só `Usuario`.
    const c4 = await criarCarteiro({ unidadeId: s.u1.id, matricula: matriculaUnica() });
    const r = await Promise.all([definirSenha(tokenS1, c4.id, 'SenhaA@2026'), definirSenha(tokenS1, c4.id, 'SenhaB@2026')]);
    expect(r.map((x) => x.status)).toEqual([204, 204]);
    expect(await prisma.usuario.count({ where: { matricula: c4.matricula } })).toBe(1);
    const statusLogin = [(await login(c4.matricula, 'SenhaA@2026')).status, (await login(c4.matricula, 'SenhaB@2026')).status];
    expect(statusLogin.sort()).toEqual([200, 401]);
  });

  it('IT-051 supervisor da U2 → PUT da senha de C1 → 404', async () => {
    const r = await definirSenha(await supervisorU2(), s.c1.carteiro.id, 'Temp@2026');
    expect(r.status).toBe(404);
    expect((await login(s.c1.usuario.matricula!, SENHA_PADRAO)).status).toBe(200);
  });

  it('IT-112 carteiro sem usuarioId → 204; cria o Usuario CARTEIRO vinculado; C4 entra com senhaTemporaria', async () => {
    const c4 = await criarCarteiro({ unidadeId: s.u1.id, matricula: matriculaUnica() });
    expect(c4.usuarioId).toBeNull();
    const r = await definirSenha(tokenS1, c4.id, 'Temp@2026');
    expect(r.status).toBe(204);

    const vinculado = await prisma.carteiro.findUniqueOrThrow({ where: { id: c4.id }, include: { usuario: true } });
    expect(vinculado.usuario).toMatchObject({ role: 'CARTEIRO', matricula: c4.matricula, unidadeId: s.u1.id, senhaTemporaria: true, ativo: true });

    const l = await login(c4.matricula, 'Temp@2026');
    expect(l.status).toBe(200);
    expect(l.body.user).toMatchObject({ id: vinculado.usuarioId, senhaTemporaria: true });
    const hoje = await api().get('/api/v1/captura/hoje').set(auth(l.body.accessToken));
    expect(hoje.status).toBe(403);
    expect(hoje.body.details.code).toBe('troca_de_senha_obrigatoria');
  });

  // ——— Remoção pelo supervisor ———————————————————————————————————————

  it('IT-077 S1 remove um pacote de carga LIBERADO → 204; REMOVIDO com snapshot; foto excluída', async () => {
    const { pacoteId, fotoKey } = await capturadoNoD03('LIBERADO');
    expect(await amb.fotos.get(fotoKey)).not.toBeNull();

    const r = await api().delete(`/api/v1/entregas/captura/pacotes/${pacoteId}`).set(auth(tokenS1));
    expect(r.status).toBe(204);
    expect(await prisma.pacoteDia.findUnique({ where: { id: pacoteId } })).toBeNull();
    const [ev] = await eventos(null, 'REMOVIDO');
    expect(ev.dados).toMatchObject({
      modo: 'EXCLUIDO',
      codigo: OY,
      por: { usuarioId: s.s1.id, role: 'UNIDADE' },
      snapshot: { nome: 'ALINE RODRIGUES', origem: 'FOTO' },
    });
    expect(await amb.fotos.get(fotoKey)).toBeNull();
  });

  it('IT-078 depois da remoção, /captura/hoje de C1 não traz o pacote nos recentes nem no contador', async () => {
    const { pacoteId } = await capturadoNoD03('LIBERADO');
    const antes = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(antes.body.contadores.capturados).toBe(1);
    expect(antes.body.recentes.map((x: { pacoteId: string }) => x.pacoteId)).toEqual([pacoteId]);

    expect((await api().delete(`/api/v1/entregas/captura/pacotes/${pacoteId}`).set(auth(tokenS1))).status).toBe(204);
    const depois = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(depois.body.contadores.capturados).toBe(0);
    expect(depois.body.recentes).toEqual([]);
  });

  it('IT-079 pacote ENTREGUE → 409 pacote_entregue', async () => {
    const c = await carga(s.d03.id, 'EM_ENTREGA');
    const p = await criarPacote({ cargaId: c.id, status: 'ENTREGUE' });
    const r = await api().delete(`/api/v1/entregas/captura/pacotes/${p.id}`).set(auth(tokenS1));
    expect(r.status).toBe(409);
    expect(r.body.details.code).toBe('pacote_entregue');
    expect(await prisma.pacoteDia.findUnique({ where: { id: p.id } })).not.toBeNull();
  });

  // ——— Lista estendida, histórico e foto ——————————————————————————————

  it('IT-080 lista de pacotes do monitoramento ganha origem, codigoDigitado e temFoto, sem perder campos', async () => {
    const { carga: c, pacoteId } = await capturadoNoD03();
    const planilha = await criarPacote({ cargaId: c.id });
    const digitado = await pacoteCapturado({ cargaId: c.id, capturadoPorId: s.c1.carteiro.id, codigoDigitado: true });

    const r = await api().get(`/api/v1/entregas/cargas/${c.id}/pacotes`).set(auth(tokenS1));
    expect(r.status).toBe(200);
    const porId = new Map<string, Record<string, unknown>>(r.body.pacotes.map((p: { id: string }) => [p.id, p]));
    expect(porId.get(pacoteId)).toMatchObject({ origem: 'FOTO', codigoDigitado: false, temFoto: true });
    expect(porId.get(planilha.id)).toMatchObject({ origem: 'PLANILHA', codigoDigitado: false, temFoto: false });
    expect(porId.get(digitado.id)).toMatchObject({ origem: 'FOTO', codigoDigitado: true, temFoto: false });

    for (const campo of ['id', 'codigo', 'nome', 'whatsapp', 'endereco', 'status', 'rotulo', 'naoEnviadoMotivo', 'escalonado',
      'sinais', 'descadastrado', 'rastreio', 'orientacaoVigente', 'respostaCarteiro']) {
      expect(porId.get(pacoteId)).toHaveProperty(campo);
    }
    expect(r.body).toMatchObject({ cargaId: c.id, distrito: { codigo: 'D-03' }, resumo: { total: 3 } });
  });

  it('IT-081 histórico: CAPTURA_CRIADO e CAPTURA_ATUALIZADO em ordem, com os campos antes e depois', async () => {
    const { pacoteId } = await capturadoNoD03();
    amb.llm.responder({ nome: { valor: 'ALINE RODRIGUES SILVA' } });
    expect((await enviar(s.c1.token, meta(s.d03.id))).body).toEqual({ tipo: 'SALVO', pacoteId, atualizado: true });

    const r = await api().get(`/api/v1/entregas/captura/pacotes/${pacoteId}/historico`).set(auth(tokenS1));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pacoteId, codigo: OY });
    expect(r.body.eventos.map((e: { tipo: string }) => e.tipo)).toEqual(['CAPTURA_CRIADO', 'CAPTURA_ATUALIZADO']);
    const atualizado = r.body.eventos[1];
    expect(atualizado.mudancas).toEqual([{ campo: 'nome', antes: 'ALINE RODRIGUES', depois: 'ALINE RODRIGUES SILVA' }]);
    expect(atualizado.dados.campos.nome).toEqual({ antes: 'ALINE RODRIGUES', depois: 'ALINE RODRIGUES SILVA' });
    expect(atualizado.carteiro).toEqual({ id: s.c1.carteiro.id, nome: s.c1.carteiro.nome });
    expect(Date.parse(r.body.eventos[0].em)).toBeLessThanOrEqual(Date.parse(atualizado.em));
  });

  it('IT-082 foto do pacote → 200 image/jpeg com os bytes do upload', async () => {
    const { pacoteId } = await capturadoNoD03();
    const r = await api().get(`/api/v1/entregas/captura/pacotes/${pacoteId}/foto`).set(auth(tokenS1)).buffer(true);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(Buffer.compare(r.body as Buffer, jpegDe('rotulo-completo'))).toBe(0);
  });

  it('IT-083 foto excluída pela retenção → 410 com details.fotoExcluidaEm', async () => {
    const { pacoteId, capturaId } = await capturadoNoD03();
    const depois = new Date(AGORA.getTime() + 31 * UM_DIA);
    expect(await executarRetencao({ agora: depois })).toBe(1);
    const cap = await prisma.captura.findUniqueOrThrow({ where: { id: capturaId } });
    expect(cap.fotoExcluidaEm).not.toBeNull();

    const r = await api().get(`/api/v1/entregas/captura/pacotes/${pacoteId}/foto`).set(auth(tokenS1));
    expect(r.status).toBe(410);
    expect(r.body.details).toEqual({ code: 'foto_excluida', fotoExcluidaEm: cap.fotoExcluidaEm!.toISOString() });
    const lista = await api().get(`/api/v1/entregas/cargas/${cap.cargaId}/pacotes`).set(auth(tokenS1));
    expect(lista.body.pacotes[0]).toMatchObject({ id: pacoteId, temFoto: false });
  });

  it('IT-084 supervisor da U2 → histórico, foto e remoção de pacote da U1 → 404', async () => {
    const { pacoteId } = await capturadoNoD03();
    const token = await supervisorU2();
    for (const req of [
      api().get(`/api/v1/entregas/captura/pacotes/${pacoteId}/historico`).set(auth(token)),
      api().get(`/api/v1/entregas/captura/pacotes/${pacoteId}/foto`).set(auth(token)),
      api().delete(`/api/v1/entregas/captura/pacotes/${pacoteId}`).set(auth(token)),
    ]) {
      expect((await req).status).toBe(404);
    }
    expect(await prisma.pacoteDia.findUnique({ where: { id: pacoteId } })).not.toBeNull();
  });

  // ——— Transferências e pendências no quadro ———————————————————————————

  it('IT-085 depois de IT-054, o quadro mostra a saída no D-01 e a entrada no D-03', async () => {
    const p = await transferidoD01ParaD03();
    const r = await quadro();
    expect(r.status).toBe(200);
    const d01 = cartao(r.body, 'D-01');
    const d03 = cartao(r.body, 'D-03');
    expect(d01.transferencias.entrada).toEqual([]);
    expect(d01.transferencias.saida).toHaveLength(1);
    expect(d01.transferencias.saida[0]).toMatchObject({
      pacoteId: p.id, codigo: OY, distrito: 'D-03', carteiro: { id: s.c1.carteiro.id }, hora: expect.any(String), origemLiberada: false,
    });
    expect(d03.transferencias.saida).toEqual([]);
    expect(d03.transferencias.entrada).toEqual([{ ...d01.transferencias.saida[0], distrito: 'D-01', distritoId: s.d01.id }]);
    expect(cartao(r.body, 'D-05').transferencias).toEqual({ entrada: [], saida: [] });
  });

  it('IT-085 origem liberada → origemLiberada = true na saída e na entrada', async () => {
    await transferidoD01ParaD03('LIBERADO');
    const r = await quadro();
    expect(cartao(r.body, 'D-01').transferencias.saida[0]).toMatchObject({ origemLiberada: true, carteiroAnterior: { id: s.c2.carteiro.id } });
    expect(cartao(r.body, 'D-03').transferencias.entrada[0]).toMatchObject({ origemLiberada: true });
  });

  it('IT-086 transferido D-01 → D-03 → D-05: o histórico traz 2 TRANSFERIDO em ordem', async () => {
    const p = await transferidoD01ParaD03();
    await escala({ distritoId: s.d05.id, carteiroId: s.c3.carteiro.id, data: HOJE });
    const m = meta(s.d05.id);
    expect((await enviar(s.c3.token, m)).body).toMatchObject({ tipo: 'TRANSFERENCIA_PENDENTE', distritoOrigem: 'D-03' });
    expect((await confirmar(s.c3.token, m.capturaId, { confirmarTransferencia: true })).status).toBe(200);

    const h = await api().get(`/api/v1/entregas/captura/pacotes/${p.id}/historico`).set(auth(tokenS1));
    const transf = h.body.eventos.filter((e: { tipo: string }) => e.tipo === 'TRANSFERIDO');
    expect(transf.map((e: { dados: { de: string; para: string } }) => [e.dados.de, e.dados.para])).toEqual([['D-01', 'D-03'], ['D-03', 'D-05']]);

    const r = await quadro();
    expect(cartao(r.body, 'D-03').transferencias.entrada.map((t: { distrito: string }) => t.distrito)).toEqual(['D-01']);
    expect(cartao(r.body, 'D-03').transferencias.saida.map((t: { distrito: string; carteiro: { id: string } }) => [t.distrito, t.carteiro.id]))
      .toEqual([['D-05', s.c3.carteiro.id]]);
  });

  /** C1 faz 4 capturas PARA_CONFERIR no D-03 (o nome lido com dúvida). */
  async function quatroParaConferir(): Promise<string[]> {
    amb.llm.responder({ nome: { valor: 'ALINE R0DRIGUES', duvida: true, motivo: 'letra ambígua' } });
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const m = meta(s.d03.id);
      expect((await enviar(s.c1.token, m)).body).toMatchObject({ tipo: 'PARA_CONFERIR' });
      ids.push(m.capturaId);
    }
    amb.llm.redefinir();
    return ids;
  }

  it('IT-087 4 capturas PARA_CONFERIR de C1 no D-03 → paraConferir 4 no D-03 do quadro', async () => {
    await quatroParaConferir();
    const r = await quadro();
    expect(r.status).toBe(200);
    expect(cartao(r.body, 'D-03').paraConferir).toBe(4);
    expect(cartao(r.body, 'D-01').paraConferir).toBe(0);
    expect(cartao(r.body, 'D-05').paraConferir).toBe(0);
    // Campos do monitoramento continuam no cartão.
    expect(cartao(r.body, 'D-03')).toMatchObject({ codigo: 'D-03', status: expect.any(String), total: 0, porStatus: {} });
  });

  it('a detecção de rota do IT-088 enxerga rotas montadas no módulo entregas', () => {
    expect(rotaExiste('post', '/cargas/:distritoId/confirmar')).toBe(true);
    expect(rotaExiste('post', '/cargas/:cargaId/rota-inexistente')).toBe(false);
  });

  // Ativa sozinho quando a liberação (task_06 do monitoramento) for mesclada.
  const liberacaoDisponivel = rotaExiste('post', '/cargas/:cargaId/liberar');
  (liberacaoDisponivel ? it : it.skip)('IT-088 liberar o D-03 com paraConferir > 0 é permitido (a captura não bloqueia)', async () => {
    // A liberação (monitoramento) lê o relógio real e recusa carga de dia passado
    // (`somente_leitura`); a semente usa HOJE fixo, então só o Date é congelado nele.
    // Pacote sem WhatsApp + confirmarSemAvisos: o caso não depende de canal Prosio.
    jest.useFakeTimers({
      now: new Date('2026-09-30T15:00:00-03:00'),
      doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout',
        'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
    });
    try {
      const c = await carga(s.d03.id);
      await criarPacote({ cargaId: c.id, whatsappE164: null });
      await quatroParaConferir();
      const r = await api().post(`/api/v1/entregas/cargas/${c.id}/liberar`).set(auth(tokenS1)).send({ confirmarSemAvisos: true });
      expect(r.status).toBeLessThan(300);
      expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: c.id } })).status).not.toBe('CARREGADO');
      expect(cartao((await quadro()).body, 'D-03').paraConferir).toBe(4);
    } finally {
      jest.useRealTimers();
    }
  });

  it('IT-089 depois de conferir as 4 → paraConferir 0', async () => {
    const ids = await quatroParaConferir();
    for (const id of ids) {
      const r = await confirmar(s.c1.token, id, { campos: { nome: 'ALINE RODRIGUES' } });
      expect(r.body).toMatchObject({ tipo: 'SALVO' });
    }
    expect(cartao((await quadro()).body, 'D-03').paraConferir).toBe(0);
  });
});
