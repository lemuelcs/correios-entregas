import { randomUUID } from 'crypto';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import type { Prisma, StatusCarga } from '@prisma/client';
import { prisma } from '../../../shared/utils/prisma';
import * as ganchos from '../../entregas/ganchos';
import { criarCarga, criarPacote, dia, escala, limparBanco } from '../../../__tests__/fixtures/entregas';
import { tokenPara } from '../../../__tests__/helpers/login';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { conciliacaoInternos } from '../conciliacao.service';
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

/** As fotos gravadas sob um diretório (a unidade de cada teste é nova). */
function jpegsNoDisco(dir: string): string[] {
  const achados: string[] = [];
  if (!existsSync(dir)) return achados;
  const andar = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.jpg')) achados.push(p);
    }
  };
  andar(dir);
  return achados;
}

describe('Captura › transferência, correção, retenção e falhas', () => {
  let amb: AmbienteCaptura;
  let s: Semente;
  let gancho: jest.SpiedFunction<typeof ganchos.aoAdicionarPacotesEmCargaLiberada>;

  beforeAll(() => {
    amb = prepararAmbiente();
  });
  beforeEach(async () => {
    await limparBanco();
    redefinirFakes(amb);
    s = await semear();
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
  const cargaDe = async (pacoteId: string) => (await prisma.pacoteDia.findUniqueOrThrow({ where: { id: pacoteId }, include: { carga: true } })).carga;

  // ——— Transferência ——————————————————————————————————————————————

  async function pacoteNoD01(status: StatusCarga = 'CARREGADO', over: Partial<Prisma.PacoteDiaUncheckedCreateInput> = {}) {
    const origem = await carga(s.d01.id, status);
    return criarPacote({ cargaId: origem.id, codigo: OY, nome: 'Aline R.', ...over });
  }

  it('IT-053 código no D-01 capturado no D-03 → TRANSFERENCIA_PENDENTE; o pacote continua no D-01', async () => {
    const p = await pacoteNoD01();
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body).toMatchObject({ tipo: 'TRANSFERENCIA_PENDENTE', distritoOrigem: 'D-01' });
    expect((await cargaDe(p.id)).distritoId).toBe(s.d01.id);
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } })).nome).toBe('Aline R.');
  });

  it('IT-054 confirmar a transferência → mesmo pacote no D-03, TRANSFERIDO {de: D-01, para: D-03} e campos da foto', async () => {
    const p = await pacoteNoD01();
    const m = meta(s.d03.id);
    await enviar(s.c1.token, m);
    const r = await confirmar(s.c1.token, m.capturaId, { confirmarTransferencia: true });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ tipo: 'SALVO', pacoteId: p.id, atualizado: true });
    expect((await cargaDe(p.id)).distritoId).toBe(s.d03.id);
    const [ev] = await eventos(p.id, 'TRANSFERIDO');
    expect(ev.dados).toMatchObject({ de: 'D-01', para: 'D-03', origemLiberada: false });
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } })).nome).toBe('ALINE RODRIGUES');
  });

  it('IT-055 descartar a transferência pendente → 204; o pacote fica no D-01 sem alteração e a foto é excluída', async () => {
    const p = await pacoteNoD01();
    const m = meta(s.d03.id);
    await enviar(s.c1.token, m);
    const fotoKey = (await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } })).fotoKey!;
    const r = await api().post(`/api/v1/captura/capturas/${m.capturaId}/descartar`).set(auth(s.c1.token));
    expect(r.status).toBe(204);
    expect(await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } })).toEqual(p);
    expect(await amb.fotos.get(fotoKey)).toBeNull();
    expect((await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } })).resultado).toBe('DESCARTADO');
  });

  it('IT-056 origem LIBERADO → TRANSFERIDO com origemLiberada = true e carteiroAnterior = C2', async () => {
    const p = await pacoteNoD01('LIBERADO', { status: 'ENVIADO' });
    const m = meta(s.d03.id);
    await enviar(s.c1.token, m);
    await confirmar(s.c1.token, m.capturaId, { confirmarTransferencia: true });
    const [ev] = await eventos(p.id, 'TRANSFERIDO');
    expect(ev.dados).toMatchObject({ origemLiberada: true, carteiroAnterior: s.c2.carteiro.id, carteiroId: s.c1.carteiro.id });
  });

  it('IT-057 pacote do D-01 já ENTREGUE → RECUSADO/JA_ENTREGUE', async () => {
    await pacoteNoD01('EM_ENTREGA', { status: 'ENTREGUE' });
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body).toEqual({ tipo: 'RECUSADO', codigo: 'JA_ENTREGUE' });
  });

  it('IT-058 duas confirmações paralelas da mesma transferência → um 200 e um 409 transferencia_concorrente', async () => {
    const p = await pacoteNoD01();
    await escala({ distritoId: s.d05.id, carteiroId: s.c3.carteiro.id, data: HOJE });
    const m1 = meta(s.d03.id);
    const m3 = meta(s.d05.id);
    expect((await enviar(s.c1.token, m1)).body.tipo).toBe('TRANSFERENCIA_PENDENTE');
    expect((await enviar(s.c3.token, m3)).body.tipo).toBe('TRANSFERENCIA_PENDENTE');
    const [a, b] = await Promise.all([
      confirmar(s.c1.token, m1.capturaId, { confirmarTransferencia: true }),
      confirmar(s.c3.token, m3.capturaId, { confirmarTransferencia: true }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const perdedor = a.status === 409 ? a : b;
    expect(perdedor.body.details.code).toBe('transferencia_concorrente');
    expect(await prisma.pacoteDia.count({ where: { codigo: OY } })).toBe(1);
    expect(await eventos(p.id, 'TRANSFERIDO')).toHaveLength(1);
  });

  it('IT-059 código num distrito da U2 → RECUSADO/OUTRA_UNIDADE', async () => {
    const alheia = await carga(s.d90.id);
    await criarPacote({ cargaId: alheia.id, codigo: OY });
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body).toEqual({ tipo: 'RECUSADO', codigo: 'OUTRA_UNIDADE' });
  });

  it('IT-060 captura offline de 2 h atrás com o código no D-01 → TRANSFERENCIA_PENDENTE listada em /conferir', async () => {
    await pacoteNoD01();
    const m = meta(s.d03.id, { capturadoEm: new Date(AGORA.getTime() - 2 * 3600_000).toISOString() });
    const r = await enviar(s.c1.token, m);
    expect(r.body.tipo).toBe('TRANSFERENCIA_PENDENTE');
    const lista = await api().get('/api/v1/captura/conferir').set(auth(s.c1.token));
    expect(lista.body).toEqual([expect.objectContaining({ capturaId: m.capturaId, tipo: 'TRANSFERENCIA_PENDENTE', distritoOrigem: 'D-01' })]);
  });

  // ——— Correção pelo carteiro ————————————————————————————————————————

  async function capturado(status: StatusCarga = 'CARREGADO') {
    if (status !== 'CARREGADO') await carga(s.d03.id, status);
    const m = meta(s.d03.id);
    const r = await enviar(s.c1.token, m);
    expect(r.body.tipo).toBe('SALVO');
    return { pacoteId: r.body.pacoteId as string, capturaId: m.capturaId };
  }
  const patch = (id: string, corpo: object, token = s.c1.token) => api().patch(`/api/v1/captura/pacotes/${id}`).set(auth(token)).send(corpo);
  const del = (id: string, token = s.c1.token) => api().delete(`/api/v1/captura/pacotes/${id}`).set(auth(token));

  it('IT-069 PATCH complemento pelo carteiro que capturou → 200 e um evento de atualização', async () => {
    const { pacoteId } = await capturado();
    const r = await patch(pacoteId, { complemento: 'CASA B' });
    expect(r.status).toBe(200);
    expect(r.body.endereco.complemento).toBe('CASA B');
    const evs = (await eventos(pacoteId, 'CAPTURA_ATUALIZADO')).filter((e) => (e.dados as { fonte?: string }).fonte === 'CARTEIRO');
    expect(evs).toHaveLength(1);
    expect((evs[0].dados as { campos: object }).campos).toEqual({ complemento: { antes: 'CASA', depois: 'CASA B' } });
  });

  it('IT-070 DELETE de pacote FOTO com a carga aberta → 204; excluído, REMOVIDO com snapshot e foto excluída', async () => {
    const { pacoteId, capturaId } = await capturado();
    const fotoKey = (await prisma.captura.findUniqueOrThrow({ where: { id: capturaId } })).fotoKey!;
    const r = await del(pacoteId);
    expect(r.status).toBe(204);
    expect(await prisma.pacoteDia.findUnique({ where: { id: pacoteId } })).toBeNull();
    const [ev] = await eventos(null, 'REMOVIDO');
    expect(ev.dados).toMatchObject({ codigo: OY, snapshot: { nome: 'ALINE RODRIGUES', origem: 'FOTO' } });
    expect(await amb.fotos.get(fotoKey)).toBeNull();
  });

  it('IT-071 carga LIBERADO: PATCH → 200; DELETE → 403 remocao_nao_permitida', async () => {
    const { pacoteId } = await capturado('LIBERADO');
    expect((await patch(pacoteId, { complemento: 'FUNDOS' })).status).toBe(200);
    const r = await del(pacoteId);
    expect(r.status).toBe(403);
    expect(r.body.details.code).toBe('remocao_nao_permitida');
    expect(await prisma.pacoteDia.findUnique({ where: { id: pacoteId } })).not.toBeNull();
  });

  it('IT-072 pacote de origem PLANILHA → DELETE pelo carteiro 403 remocao_nao_permitida', async () => {
    const c = await carga(s.d03.id);
    const p = await criarPacote({ cargaId: c.id });
    const r = await del(p.id);
    expect(r.status).toBe(403);
    expect(r.body.details.code).toBe('remocao_nao_permitida');
  });

  it('IT-073 PLANILHA_FOTO com a carga aberta → DELETE 204; volta ao snapshot pré-foto com origem PLANILHA', async () => {
    const c = await carga(s.d03.id);
    const p = await criarPacote({ cargaId: c.id, codigo: OY, nome: 'Aline R.', numero: '71', whatsappE164: '+5561991112222' });
    await enviar(s.c1.token, meta(s.d03.id));
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } })).origem).toBe('PLANILHA_FOTO');
    const r = await del(p.id);
    expect(r.status).toBe(204);
    expect(await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      nome: 'Aline R.', numero: '71', whatsappE164: '+5561991112222', origem: 'PLANILHA', capturadoPorId: null, status: p.status,
    });
  });

  it('IT-074 carga LIBERADO: PATCH com outro WhatsApp → WHATSAPP_ALTERADO e o gancho recebe [pacoteId]', async () => {
    const { pacoteId } = await capturado('LIBERADO');
    gancho.mockClear();
    const r = await patch(pacoteId, { whatsapp: '(61) 98888-7777' });
    expect(r.status).toBe(200);
    const [ev] = await eventos(pacoteId, 'WHATSAPP_ALTERADO');
    expect(ev.dados).toEqual({ antes: '+5561993401287', depois: '+5561988887777' });
    expect(gancho).toHaveBeenCalledWith([pacoteId]);
  });

  it('IT-075 liberação comitada entre a leitura e o DELETE → 403 remocao_nao_permitida', async () => {
    const { pacoteId } = await capturado();
    const original = conciliacaoInternos.antesDeRemover;
    conciliacaoInternos.antesDeRemover = async () => {
      await prisma.cargaDistrito.update({ where: { distritoId_data: { distritoId: s.d03.id, data: HOJE } }, data: { status: 'LIBERADO' } });
    };
    try {
      const r = await del(pacoteId);
      expect(r.status).toBe(403);
      expect(r.body.details.code).toBe('remocao_nao_permitida');
    } finally {
      conciliacaoInternos.antesDeRemover = original;
    }
    expect(await prisma.pacoteDia.findUnique({ where: { id: pacoteId } })).not.toBeNull();
  });

  it('IT-076 PATCH com código → 400 codigo_nao_editavel_use_nova_captura', async () => {
    const { pacoteId } = await capturado();
    const r = await patch(pacoteId, { codigo: OY });
    expect(r.status).toBe(400);
    expect(r.body.details.code).toBe('codigo_nao_editavel_use_nova_captura');
  });

  // ——— Retenção ——————————————————————————————————————————————————————

  it('IT-090 pacote de 31 dias atrás com foto → o job exclui o arquivo e grava fotoExcluidaEm; pacote intacto', async () => {
    const antiga = dia('2026-08-30');
    const c = await criarCarga({ distritoId: s.d03.id, data: antiga });
    const p = await criarPacote({ cargaId: c.id, origem: 'FOTO' });
    const id = randomUUID();
    const fotoKey = `${s.u1.id}/2026-08-30/${id}.jpg`;
    await amb.fotos.put(fotoKey, jpegDe('rotulo-completo'));
    await prisma.captura.create({
      data: { id, carteiroId: s.c1.carteiro.id, distritoId: s.d03.id, data: antiga, resultado: 'SALVO', pacoteId: p.id, fotoKey, capturadoEm: new Date('2026-08-30T10:00:00-03:00') },
    });
    const recente = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-dm-sem-telefone' }), jpegDe('rotulo-dm-sem-telefone'));
    expect(recente.body.tipo).toBe('SALVO');

    expect(await executarRetencao({ agora: AGORA })).toBe(1);
    expect(await amb.fotos.get(fotoKey)).toBeNull();
    expect((await prisma.captura.findUniqueOrThrow({ where: { id } })).fotoExcluidaEm).toEqual(AGORA);
    expect(await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } })).toEqual(p);
    expect(jpegsNoDisco(path.join(amb.dirFotos, s.u1.id))).toHaveLength(1);
  });

  it('IT-091 pendência sem pacote de 91 dias → foto excluída; de 89 dias → mantida', async () => {
    const criar = async (dias: number) => {
      const id = randomUUID();
      const capturadoEm = new Date(AGORA.getTime() - dias * UM_DIA);
      const fotoKey = `${s.u1.id}/${capturadoEm.toISOString().slice(0, 10)}/${id}.jpg`;
      await amb.fotos.put(fotoKey, Buffer.from([0xff, 0xd8, 0xff, dias]));
      await prisma.captura.create({
        data: { id, carteiroId: s.c1.carteiro.id, distritoId: s.d03.id, data: dia(capturadoEm.toISOString().slice(0, 10)), resultado: 'PARA_CONFERIR', fotoKey, capturadoEm },
      });
      return { id, fotoKey };
    };
    const velha = await criar(91);
    const nova = await criar(89);
    expect(await executarRetencao({ agora: AGORA })).toBe(1);
    expect(await amb.fotos.get(velha.fotoKey)).toBeNull();
    expect(await amb.fotos.get(nova.fotoKey)).not.toBeNull();
    expect((await prisma.captura.findUniqueOrThrow({ where: { id: nova.id } })).fotoExcluidaEm).toBeNull();
  });

  it('IT-092 desfazer e DELETE de pacote → a foto não existe logo depois da resposta', async () => {
    const a = await capturado();
    const keyA = (await prisma.captura.findUniqueOrThrow({ where: { id: a.capturaId } })).fotoKey!;
    expect((await api().post(`/api/v1/captura/capturas/${a.capturaId}/desfazer`).set(auth(s.c1.token))).status).toBe(204);
    expect(await amb.fotos.get(keyA)).toBeNull();

    const b = await capturado();
    const keyB = (await prisma.captura.findUniqueOrThrow({ where: { id: b.capturaId } })).fotoKey!;
    expect((await del(b.pacoteId)).status).toBe(204);
    expect(await amb.fotos.get(keyB)).toBeNull();
    expect(jpegsNoDisco(path.join(amb.dirFotos, s.u1.id))).toEqual([]);
  });

  it('IT-093 capturas recusadas (DV inválido, outra unidade) → fotoKey nulo e nenhum arquivo gravado', async () => {
    const dv = meta(s.d03.id, { codigo: 'AA123456784BR' });
    expect((await enviar(s.c1.token, dv)).body.codigo).toBe('DV_INVALIDO');
    const alheia = await carga(s.d90.id);
    await criarPacote({ cargaId: alheia.id, codigo: OY });
    const ou = meta(s.d03.id);
    expect((await enviar(s.c1.token, ou)).body.codigo).toBe('OUTRA_UNIDADE');
    for (const id of [dv.capturaId, ou.capturaId]) {
      expect((await prisma.captura.findUniqueOrThrow({ where: { id } })).fotoKey).toBeNull();
    }
    expect(jpegsNoDisco(path.join(amb.dirFotos, s.u1.id))).toEqual([]);
  });

  // ——— Falhas documentadas ——————————————————————————————————————————

  it('IT-094 POST sem a parte foto → 400', async () => {
    const r = await api().post('/api/v1/captura/capturas').set(auth(s.c1.token)).field('meta', JSON.stringify(meta(s.d03.id)));
    expect(r.status).toBe(400);
    expect(r.body.details.code).toBe('foto_ausente');
  });

  it('IT-095 foto de 2,5 MB → 413 foto_muito_grande', async () => {
    const grande = Buffer.alloc(Math.round(2.5 * 1024 * 1024), 0);
    grande[0] = 0xff; grande[1] = 0xd8; grande[2] = 0xff;
    const r = await enviar(s.c1.token, meta(s.d03.id), grande);
    expect(r.status).toBe(413);
    expect(r.body.details.code).toBe('foto_muito_grande');
  });

  it('IT-096 "foto" PNG ou texto → 415 foto_invalida', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const r1 = await enviar(s.c1.token, meta(s.d03.id), png);
    expect(r1.status).toBe(415);
    expect(r1.body.details.code).toBe('foto_invalida');
    const r2 = await enviar(s.c1.token, meta(s.d03.id), Buffer.from('não sou uma foto'));
    expect(r2.status).toBe(415);
    expect(await prisma.captura.count()).toBe(0);
  });

  it('IT-097 meta.capturaId que não é UUID → 400', async () => {
    const r = await enviar(s.c1.token, { ...meta(s.d03.id), capturaId: 'abc' });
    expect(r.status).toBe(400);
  });

  it('IT-098 token de papel UNIDADE → 403', async () => {
    const token = tokenPara({ id: s.s1.id, role: 'UNIDADE', unidadeId: s.u1.id });
    const r = await enviar(token, meta(s.d03.id));
    expect(r.status).toBe(403);
    expect((await api().get('/api/v1/captura/hoje').set(auth(token))).status).toBe(403);
  });

  it('IT-099 confirmar uma captura já SALVO → 409 captura_ja_resolvida', async () => {
    const { capturaId } = await capturado();
    const r = await confirmar(s.c1.token, capturaId, { campos: { nome: 'OUTRO' } });
    expect(r.status).toBe(409);
    expect(r.body.details.code).toBe('captura_ja_resolvida');
  });

  it('IT-100 confirmar uma captura de outro carteiro → 404', async () => {
    amb.llm.falhar('erro');
    const m = meta(s.d03.id);
    await enviar(s.c1.token, m);
    const r = await confirmar(s.c2.token, m.capturaId, { campos: { nome: 'X' } });
    expect(r.status).toBe(404);
  });

  it('IT-101 descartar uma captura SALVO → 409 captura_ja_resolvida', async () => {
    const { capturaId } = await capturado();
    const r = await api().post(`/api/v1/captura/capturas/${capturaId}/descartar`).set(auth(s.c1.token));
    expect(r.status).toBe(409);
    expect(r.body.details.code).toBe('captura_ja_resolvida');
  });

  it('IT-104 GET da foto de outro carteiro → 404; a própria → 200 image/jpeg', async () => {
    const { capturaId } = await capturado();
    const propria = await api().get(`/api/v1/captura/capturas/${capturaId}/foto`).set(auth(s.c1.token)).buffer(true);
    expect(propria.status).toBe(200);
    expect(propria.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(Buffer.compare(propria.body as Buffer, jpegDe('rotulo-completo'))).toBe(0);
    const alheia = await api().get(`/api/v1/captura/capturas/${capturaId}/foto`).set(auth(s.c2.token));
    expect(alheia.status).toBe(404);
  });

  it('IT-105 foto já excluída → 410 foto_excluida', async () => {
    const id = randomUUID();
    const fotoKey = `${s.u1.id}/2026-06-01/${id}.jpg`;
    await amb.fotos.put(fotoKey, jpegDe('rotulo-completo'));
    await prisma.captura.create({
      data: { id, carteiroId: s.c1.carteiro.id, distritoId: s.d03.id, data: dia('2026-06-01'), resultado: 'PARA_CONFERIR', fotoKey, capturadoEm: new Date('2026-06-01T10:00:00-03:00') },
    });
    await executarRetencao({ agora: AGORA });
    const r = await api().get(`/api/v1/captura/capturas/${id}/foto`).set(auth(s.c1.token));
    expect(r.status).toBe(410);
    expect(r.body.details).toMatchObject({ code: 'foto_excluida', fotoExcluidaEm: AGORA.toISOString() });
  });
});
