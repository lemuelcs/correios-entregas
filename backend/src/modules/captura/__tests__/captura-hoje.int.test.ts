import { prisma } from '../../../shared/utils/prisma';
import { SENHA_PADRAO, criarCarteiroComLogin, escala, limparBanco } from '../../../__tests__/fixtures/entregas';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import {
  HOJE,
  api,
  auth,
  desmontarAmbiente,
  enviar,
  meta,
  prepararAmbiente,
  redefinirFakes,
  semear,
  type AmbienteCaptura,
  type Semente,
} from './captura.helpers';

describe('Captura › distrito do dia (/captura/hoje)', () => {
  let amb: AmbienteCaptura;
  let s: Semente;

  beforeAll(() => {
    amb = prepararAmbiente();
  });
  beforeEach(async () => {
    await limparBanco();
    redefinirFakes(amb);
    s = await semear();
  });
  afterAll(async () => {
    desmontarAmbiente(amb);
    await limparBanco();
    await encerrarRecursos();
  });

  it('IT-001 escala de hoje do D-03 para C1 e sem carga → D-03 com cargaStatus null', async () => {
    await escala({ distritoId: s.d03.id, carteiroId: s.c1.carteiro.id, data: HOJE });
    const r = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(r.status).toBe(200);
    expect(r.body.distritos[0]).toMatchObject({ distritoId: s.d03.id, codigo: 'D-03', cargaStatus: null });
    expect(r.body.ativo).toBe(s.d03.id);
    expect(r.body.contadores).toEqual({ capturados: 0, paraConferir: 0 });
    expect(r.body.recentes).toEqual([]);
  });

  it('IT-002 sem escala → D-03 (padrão); após o primeiro SALVO existe a carga CARREGADO', async () => {
    const r = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(r.body.distritos.map((d: { codigo: string }) => d.codigo)).toEqual(['D-03']);
    expect(await prisma.cargaDistrito.count({ where: { distritoId: s.d03.id } })).toBe(0);

    const salvo = await enviar(s.c1.token, meta(s.d03.id));
    expect(salvo.body.tipo).toBe('SALVO');
    const carga = await prisma.cargaDistrito.findUniqueOrThrow({ where: { distritoId_data: { distritoId: s.d03.id, data: HOJE } } });
    expect(carga.status).toBe('CARREGADO');

    const depois = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(depois.body.distritos[0].cargaStatus).toBe('CARREGADO');
    expect(depois.body.contadores.capturados).toBe(1);
    expect(depois.body.recentes[0]).toMatchObject({ codigo: 'OY716488072BR', semWhatsapp: false });
  });

  it('IT-004 carteiro sem padrão nem escala → distritos [] e captura 403 distrito_nao_autorizado', async () => {
    const r = await api().get('/api/v1/captura/hoje').set(auth(s.c3.token));
    expect(r.status).toBe(200);
    expect(r.body.distritos).toEqual([]);
    expect(r.body.ativo).toBeNull();

    const post = await enviar(s.c3.token, meta(s.d03.id));
    expect(post.status).toBe(403);
    expect(post.body.details.code).toBe('distrito_nao_autorizado');
    expect(await prisma.captura.count()).toBe(0);
  });

  it('IT-005 C1 escalado para D-03 e D-05 → 2 distritos; PUT /hoje/ativo D-05 → 204 e ativo D-05', async () => {
    await escala({ distritoId: s.d03.id, carteiroId: s.c1.carteiro.id, data: HOJE });
    await escala({ distritoId: s.d05.id, carteiroId: s.c1.carteiro.id, data: HOJE });
    const r = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(r.body.distritos).toHaveLength(2);
    expect(r.body.ativo).toBeNull();

    const put = await api().put('/api/v1/captura/hoje/ativo').set(auth(s.c1.token)).send({ distritoId: s.d05.id });
    expect(put.status).toBe(204);
    const depois = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(depois.body.ativo).toBe(s.d05.id);

    const fora = await api().put('/api/v1/captura/hoje/ativo').set(auth(s.c1.token)).send({ distritoId: s.d01.id });
    expect(fora.status).toBe(403);
  });

  it('IT-006 captura do D-03 enviada depois de a escala levar C1 ao D-05: padrão vale; sem vínculo → 403', async () => {
    await escala({ distritoId: s.d05.id, carteiroId: s.c1.carteiro.id, data: HOJE });
    const ok = await enviar(s.c1.token, meta(s.d03.id));
    expect(ok.status).toBe(200);
    expect(ok.body.tipo).toBe('SALVO');
    const pacote = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: ok.body.pacoteId }, include: { carga: true } });
    expect(pacote.carga.distritoId).toBe(s.d03.id);

    // C1 deixa de ser o padrão do D-03 e não é escalado nele.
    await prisma.distrito.update({ where: { id: s.d03.id }, data: { carteiroPadraoId: s.c2.carteiro.id } });
    const negado = await enviar(s.c1.token, meta(s.d03.id, { codigo: 'AA123456785BR', rotulo: 'rotulo-sem-datamatrix' }));
    expect(negado.status).toBe(403);
    expect(negado.body.details.code).toBe('distrito_nao_autorizado');
  });

  it('IT-040 login com senha temporária → 200; GET /captura/hoje → 403 troca_de_senha_obrigatoria', async () => {
    const { usuario } = await criarCarteiroComLogin({ unidadeId: s.u1.id, senhaTemporaria: true });
    const login = await api().post('/api/v1/auth/login').set('Connection', 'close').send({ matricula: usuario.matricula, senha: SENHA_PADRAO });
    expect(login.status).toBe(200);
    const r = await api().get('/api/v1/captura/hoje').set(auth(login.body.accessToken));
    expect(r.status).toBe(403);
    expect(r.body.details.code).toBe('troca_de_senha_obrigatoria');
  });

  it('IT-041 depois de POST /auth/trocar-senha → GET /captura/hoje 200', async () => {
    const { usuario } = await criarCarteiroComLogin({ unidadeId: s.u1.id, senhaTemporaria: true });
    const { accessToken } = (await api().post('/api/v1/auth/login').set('Connection', 'close')
      .send({ matricula: usuario.matricula, senha: SENHA_PADRAO })).body;
    const troca = await api().post('/api/v1/auth/trocar-senha').set(auth(accessToken))
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha-2026' });
    expect(troca.status).toBe(204);
    const r = await api().get('/api/v1/captura/hoje').set(auth(accessToken));
    expect(r.status).toBe(200);
    expect(r.body.distritos).toEqual([]);
  });
});
