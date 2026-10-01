import { randomUUID } from 'crypto';
import type { StatusCarga } from '@prisma/client';
import { prisma } from '../../../shared/utils/prisma';
import * as ganchos from '../../entregas/ganchos';
import { criarCarga, criarPacote, limparBanco } from '../../../__tests__/fixtures/entregas';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { capturaGanchoAvisoFalhas } from '../captura.metricas';
import { conciliacaoInternos } from '../conciliacao.service';
import {
  AGORA,
  HOJE,
  api,
  auth,
  barcodesDe,
  barcodesSo,
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
const AA = 'AA123456785BR';

/** Resposta completa do LLM para um rótulo sem DataMatrix. */
const LLM_SEM_DM = {
  nome: { valor: 'JOSE CARLOS PEREIRA' },
  whatsapp: { valor: '(61) 98765-4321' },
  numero: { valor: '5' },
  complemento: { valor: 'APTO 1203' },
};

async function valorMetrica(): Promise<number> {
  const m = await capturaGanchoAvisoFalhas.get();
  return m.values.reduce((acc, v) => acc + v.value, 0);
}

describe('Captura › POST /captura/capturas e conciliação', () => {
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
  afterEach(() => {
    gancho.mockRestore();
  });
  afterAll(async () => {
    desmontarAmbiente(amb);
    await limparBanco();
    await encerrarRecursos();
  });

  const cargaD03 = (status: StatusCarga = 'CARREGADO') => criarCarga({ distritoId: s.d03.id, data: HOJE, status });
  const cargaD01 = (status: StatusCarga = 'CARREGADO') => criarCarga({ distritoId: s.d01.id, data: HOJE, status });
  const pacote = (codigo: string) => prisma.pacoteDia.findUnique({ where: { codigo_data: { codigo, data: HOJE } } });

  // ——— Captura básica ————————————————————————————————————————————————

  it('IT-007 rótulo completo com o fake → SALVO; pacote FOTO, foto guardada e um CAPTURA_CRIADO', async () => {
    const m = meta(s.d03.id);
    const r = await enviar(s.c1.token, m);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ tipo: 'SALVO', pacoteId: expect.any(String), atualizado: false });

    const p = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: r.body.pacoteId } });
    expect(p).toMatchObject({
      codigo: OY, origem: 'FOTO', status: 'AGUARDANDO_LIBERACAO', whatsappE164: '+5561993401287', cep: '72115040',
      nome: 'ALINE RODRIGUES', logradouro: 'QNC 4', numero: '17', complemento: 'CASA', capturadoPorId: s.c1.carteiro.id,
    });
    const cap = await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } });
    expect(cap.resultado).toBe('SALVO');
    expect(cap.fotoKey).toBe(`${s.u1.id}/2026-09-30/${m.capturaId}.jpg`);
    expect(await amb.fotos.get(cap.fotoKey!)).toEqual(jpegDe('rotulo-completo'));
    const evs = await eventos(p.id);
    expect(evs.map((e) => e.tipo)).toEqual(['CAPTURA_CRIADO']);
    expect(amb.llm.ultimoPedido).toEqual(['nome']);
    expect(gancho).not.toHaveBeenCalled();
  });

  it('logs da captura não contêm nome, telefone nem endereço do destinatário', async () => {
    const linhas: string[] = [];
    const guardar = (...args: unknown[]) => { linhas.push(args.map(String).join(' ')); };
    const espioes = [
      jest.spyOn(console, 'log').mockImplementation(guardar),
      jest.spyOn(console, 'warn').mockImplementation(guardar),
      jest.spyOn(console, 'error').mockImplementation(guardar),
    ];
    try {
      const r = await enviar(s.c1.token, meta(s.d03.id));
      expect(r.body.tipo).toBe('SALVO');
      amb.llm.falhar('erro');
      await enviar(s.c1.token, meta(s.d03.id));
    } finally {
      espioes.forEach((e) => e.mockRestore());
    }
    const saida = linhas.join('\n');
    expect(saida).toContain('captura: processada');
    for (const proibido of ['ALINE', 'RODRIGUES', '61993401287', '99340', 'QNC', 'Taguatinga', 'CASA', '72115040']) {
      expect(saida).not.toContain(proibido);
    }
  });

  it('IT-008 código com DV inválido → RECUSADO/DV_INVALIDO; nenhum pacote e foto não retida', async () => {
    const m = meta(s.d03.id, { codigo: 'AA123456784BR', barcodes: barcodesSo('AA123456784BR') });
    const r = await enviar(s.c1.token, m);
    expect(r.body).toEqual({ tipo: 'RECUSADO', codigo: 'DV_INVALIDO' });
    expect(await prisma.pacoteDia.count()).toBe(0);
    expect((await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } })).fotoKey).toBeNull();
    expect(amb.llm.chamadas).toBe(0);
  });

  it('IT-009 barcodes.multiplos → RECUSADO/MULTIPLOS_ROTULOS e zero pacotes', async () => {
    const r = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-dois', codigo: OY }), jpegDe('rotulo-dois'));
    expect(r.body).toEqual({ tipo: 'RECUSADO', codigo: 'MULTIPLOS_ROTULOS' });
    expect(await prisma.pacoteDia.count()).toBe(0);
  });

  it('IT-010 sem CEP linear nem DataMatrix, com o CEP "72115-040" do texto → PARA_CONFERIR com cep em dúvida', async () => {
    amb.llm.responder({ ...LLM_SEM_DM, cep: { valor: '72115-040' } });
    const r = await enviar(s.c1.token, meta(s.d03.id, { codigo: AA, barcodes: barcodesSo(AA) }), jpegDe('rotulo-sem-datamatrix'));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    expect(r.body.campos.cep).toMatchObject({ valor: '72115040', duvida: true, fonte: 'LLM' });
    expect(r.body.motivos).toContain('duvida:cep');
    expect(await prisma.pacoteDia.count()).toBe(0);
  });

  it('IT-011 código internacional RR123456785CN → SALVO', async () => {
    amb.llm.responder(LLM_SEM_DM);
    const codigo = 'RR123456785CN';
    const r = await enviar(s.c1.token, meta(s.d03.id, { codigo, barcodes: { objeto: codigo, cepLinear: '71919360', dataMatrixRaw: null, multiplos: false } }));
    expect(r.body.tipo).toBe('SALVO');
    expect((await pacote(codigo))?.origem).toBe('FOTO');
  });

  // ——— Desfazer ——————————————————————————————————————————————————————

  it('IT-012 SALVO seguido de desfazer → 204; o pacote some, um DESFEITO e a foto é excluída', async () => {
    const m = meta(s.d03.id);
    const r = await enviar(s.c1.token, m);
    const fotoKey = (await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } })).fotoKey!;
    const d = await api().post(`/api/v1/captura/capturas/${m.capturaId}/desfazer`).set(auth(s.c1.token));
    expect(d.status).toBe(204);
    expect(await prisma.pacoteDia.findUnique({ where: { id: r.body.pacoteId } })).toBeNull();
    const desfeitos = await eventos(null, 'DESFEITO');
    expect(desfeitos).toHaveLength(1);
    expect(desfeitos[0].dados).toMatchObject({ capturaId: m.capturaId, removido: true });
    expect(await amb.fotos.get(fotoKey)).toBeNull();
    const cap = await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } });
    expect(cap.resultado).toBe('DESFEITO');
    expect(cap.fotoExcluidaEm).not.toBeNull();
  });

  it('IT-013 pacote da planilha atualizado pela foto; desfazer → nome e origem da planilha de volta', async () => {
    const carga = await cargaD03();
    const p = await criarPacote({ cargaId: carga.id, codigo: OY, nome: 'Aline R.', whatsappE164: '+5561993401287' });
    const m = meta(s.d03.id);
    const r = await enviar(s.c1.token, m);
    expect(r.body).toEqual({ tipo: 'SALVO', pacoteId: p.id, atualizado: true });
    expect((await pacote(OY))).toMatchObject({ nome: 'ALINE RODRIGUES', origem: 'PLANILHA_FOTO' });

    const d = await api().post(`/api/v1/captura/capturas/${m.capturaId}/desfazer`).set(auth(s.c1.token));
    expect(d.status).toBe(204);
    expect(await pacote(OY)).toMatchObject({ id: p.id, nome: 'Aline R.', origem: 'PLANILHA', numero: p.numero, capturadoPorId: null });
  });

  it('IT-014 duas capturas salvas; desfazer a primeira mantém a segunda', async () => {
    const a = meta(s.d03.id);
    await enviar(s.c1.token, a);
    amb.llm.responder(LLM_SEM_DM);
    const b = meta(s.d03.id, { rotulo: 'rotulo-sem-datamatrix' });
    const rb = await enviar(s.c1.token, b, jpegDe('rotulo-sem-datamatrix'));
    expect(rb.body.tipo).toBe('SALVO');
    const d = await api().post(`/api/v1/captura/capturas/${a.capturaId}/desfazer`).set(auth(s.c1.token));
    expect(d.status).toBe(204);
    expect(await pacote(OY)).toBeNull();
    expect(await pacote(AA)).not.toBeNull();
  });

  it('IT-015 criado pela foto e depois liberado: desfazer → 409; pacote atualizado: desfazer restaura', async () => {
    const m = meta(s.d03.id);
    const r = await enviar(s.c1.token, m);
    await prisma.cargaDistrito.update({ where: { distritoId_data: { distritoId: s.d03.id, data: HOJE } }, data: { status: 'LIBERADO' } });
    const negado = await api().post(`/api/v1/captura/capturas/${m.capturaId}/desfazer`).set(auth(s.c1.token));
    expect(negado.status).toBe(409);
    expect(negado.body.details.code).toBe('remocao_nao_permitida');
    expect(await prisma.pacoteDia.findUnique({ where: { id: r.body.pacoteId } })).not.toBeNull();

    const carga = await prisma.cargaDistrito.findUniqueOrThrow({ where: { distritoId_data: { distritoId: s.d03.id, data: HOJE } } });
    const antes = await criarPacote({ cargaId: carga.id, codigo: AA, nome: 'Jose P.', numero: '99', whatsappE164: '+5561987654321' });
    amb.llm.responder(LLM_SEM_DM);
    const m2 = meta(s.d03.id, { rotulo: 'rotulo-sem-datamatrix' });
    const r2 = await enviar(s.c1.token, m2, jpegDe('rotulo-sem-datamatrix'));
    expect(r2.body).toMatchObject({ tipo: 'SALVO', atualizado: true });
    const ok = await api().post(`/api/v1/captura/capturas/${m2.capturaId}/desfazer`).set(auth(s.c1.token));
    expect(ok.status).toBe(204);
    expect(await pacote(AA)).toMatchObject({ nome: 'Jose P.', numero: '99', origem: 'PLANILHA', status: antes.status });
  });

  it('IT-016 duas capturas do mesmo código em paralelo → um pacote, uma criada e uma atualizada', async () => {
    const [a, b] = await Promise.all([enviar(s.c1.token, meta(s.d03.id)), enviar(s.c1.token, meta(s.d03.id))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await prisma.pacoteDia.count({ where: { codigo: OY } })).toBe(1);
    expect([a.body.atualizado, b.body.atualizado].sort()).toEqual([false, true]);
    expect(a.body.pacoteId).toBe(b.body.pacoteId);
  });

  it('IT-017 extração indisponível → PARA_CONFERIR com extracao_indisponivel e campos do LLM vazios', async () => {
    amb.llm.falhar('erro');
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    expect(r.body.motivos).toEqual(expect.arrayContaining(['extracao_indisponivel', 'nome_ausente']));
    expect(r.body.campos.nome).toMatchObject({ valor: null, fonte: 'LLM' });
    expect(await prisma.pacoteDia.count()).toBe(0);
  });

  // ——— Conferência ——————————————————————————————————————————————————

  async function pendenteWhatsapp() {
    amb.llm.responder({ ...LLM_SEM_DM, whatsapp: { valor: '(61) 98765-43?1', duvida: true, motivo: 'um dígito ilegível' } });
    const m = meta(s.d03.id, { rotulo: 'rotulo-sem-datamatrix' });
    const r = await enviar(s.c1.token, m, jpegDe('rotulo-sem-datamatrix'));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    amb.llm.responder(null);
    return m;
  }

  const confirmar = (id: string, corpo: object) =>
    api().post(`/api/v1/captura/capturas/${id}/confirmar`).set(auth(s.c1.token)).send(corpo);

  it('IT-018 WhatsApp com dúvida → PARA_CONFERIR e listado em GET /conferir', async () => {
    const m = await pendenteWhatsapp();
    const lista = await api().get('/api/v1/captura/conferir').set(auth(s.c1.token));
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]).toMatchObject({ capturaId: m.capturaId, tipo: 'PARA_CONFERIR', temFoto: true });
    expect(lista.body[0].campos.whatsapp.duvida).toBe(true);
    expect(lista.body[0].motivos).toContain('duvida:whatsapp');
  });

  it('IT-019 confirmar com o campo corrigido → SALVO e sai da lista', async () => {
    const m = await pendenteWhatsapp();
    const r = await confirmar(m.capturaId, { campos: { whatsapp: '(61) 98765-4321' } });
    expect(r.status).toBe(200);
    expect(r.body.tipo).toBe('SALVO');
    expect((await pacote(AA))?.whatsappE164).toBe('+5561987654321');
    expect((await api().get('/api/v1/captura/conferir').set(auth(s.c1.token))).body).toEqual([]);
  });

  it('IT-020 confirmar com nome vazio → 400 nome_ausente', async () => {
    const m = await pendenteWhatsapp();
    const r = await confirmar(m.capturaId, { campos: { nome: '' } });
    expect(r.status).toBe(400);
    expect(r.body.details.code).toBe('nome_ausente');
  });

  it('IT-021 número vazio → 400 endereco_incompleto; "S/N" → 200', async () => {
    const m = await pendenteWhatsapp();
    const vazio = await confirmar(m.capturaId, { campos: { numero: '', whatsapp: null } });
    expect(vazio.status).toBe(400);
    expect(vazio.body.details.code).toBe('endereco_incompleto');
    const sn = await confirmar(m.capturaId, { campos: { numero: 'S/N', whatsapp: null } });
    expect(sn.status).toBe(200);
    expect((await pacote(AA))?.numero).toBe('S/N');
  });

  it('IT-022 confirmar com WhatsApp nulo → SALVO sem WhatsApp', async () => {
    const m = await pendenteWhatsapp();
    const r = await confirmar(m.capturaId, { campos: { whatsapp: null } });
    expect(r.body.tipo).toBe('SALVO');
    expect(await pacote(AA)).toMatchObject({ whatsappE164: null, status: 'SEM_WHATSAPP' });
  });

  it('IT-023 confirmar com WhatsApp "98876-1102" → 400 whatsapp_invalido', async () => {
    const m = await pendenteWhatsapp();
    const r = await confirmar(m.capturaId, { campos: { whatsapp: '98876-1102' } });
    expect(r.status).toBe(400);
    expect(r.body.details.code).toBe('whatsapp_invalido');
  });

  it('IT-024 GET /cep/71919360 → logradouro; confirmar com esse CEP e número 3 grava o logradouro do CEP', async () => {
    const cep = await api().get('/api/v1/captura/cep/71919360').set(auth(s.c1.token));
    expect(cep.status).toBe(200);
    expect(cep.body).toEqual({ cep: '71919360', logradouro: 'Rua 25 Norte', bairro: 'Águas Claras', cidade: 'Brasília', uf: 'DF' });

    const m = meta(s.d03.id, { rotulo: 'rotulo-cep-unico' });
    const r = await enviar(s.c1.token, m, jpegDe('rotulo-cep-unico'));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    const ok = await confirmar(m.capturaId, { campos: { cep: '71919360', numero: '3' } });
    expect(ok.body.tipo).toBe('SALVO');
    expect(await pacote('OY716488293BR')).toMatchObject({ cep: '71919360', logradouro: 'Rua 25 Norte', numero: '3', cidade: 'Brasília', uf: 'DF' });
  });

  it('IT-025 confirmar com CEP de 7 dígitos → 400 cep_invalido', async () => {
    const m = await pendenteWhatsapp();
    const r = await confirmar(m.capturaId, { campos: { cep: '7191936' } });
    expect(r.status).toBe(400);
    expect(r.body.details.code).toBe('cep_invalido');
  });

  it('IT-026 código editado para um do D-01 → TRANSFERENCIA_PENDENTE; DV inválido → 400 dv_invalido', async () => {
    const cargaOrigem = await cargaD01();
    const noD01 = await criarPacote({ cargaId: cargaOrigem.id });
    const m = await pendenteWhatsapp();
    const dv = await confirmar(m.capturaId, { campos: { codigo: 'AA123456784BR' } });
    expect(dv.status).toBe(400);
    expect(dv.body.details.code).toBe('dv_invalido');
    const r = await confirmar(m.capturaId, { campos: { codigo: noD01.codigo, whatsapp: null } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tipo: 'TRANSFERENCIA_PENDENTE', distritoOrigem: 'D-01' });
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: noD01.id } })).cargaId).toBe(cargaOrigem.id);
  });

  it('IT-027 12 pendências em horários diferentes → GET /conferir em ordem crescente de capturadoEm', async () => {
    amb.llm.falhar('erro');
    const horarios = Array.from({ length: 12 }, (_, i) => new Date(AGORA.getTime() - (i + 1) * 60_000).toISOString());
    const embaralhados = [5, 2, 11, 0, 7, 3, 9, 1, 10, 4, 8, 6].map((i) => horarios[i]);
    for (const capturadoEm of embaralhados) {
      const r = await enviar(s.c1.token, meta(s.d03.id, { capturadoEm }));
      expect(r.body.tipo).toBe('PARA_CONFERIR');
    }
    const lista = await api().get('/api/v1/captura/conferir').set(auth(s.c1.token));
    expect(lista.body).toHaveLength(12);
    const ordem = lista.body.map((c: { capturadoEm: string }) => c.capturadoEm);
    expect(ordem).toEqual([...horarios].sort());
  });

  it('IT-028 pendência salva depois da liberação → SALVO e o gancho recebe [pacoteId] uma vez, depois do commit', async () => {
    amb.llm.falhar('erro');
    const m = meta(s.d03.id);
    expect((await enviar(s.c1.token, m)).body.tipo).toBe('PARA_CONFERIR');
    await prisma.cargaDistrito.update({ where: { distritoId_data: { distritoId: s.d03.id, data: HOJE } }, data: { status: 'LIBERADO' } });

    const vistoNoBanco: boolean[] = [];
    gancho.mockImplementation(async (ids) => {
      vistoNoBanco.push(!!(await prisma.pacoteDia.findUnique({ where: { id: ids[0] } })));
    });
    const r = await confirmar(m.capturaId, { campos: { nome: 'ALINE RODRIGUES' } });
    expect(r.body.tipo).toBe('SALVO');
    expect(gancho).toHaveBeenCalledTimes(1);
    expect(gancho).toHaveBeenCalledWith([r.body.pacoteId]);
    expect(vistoNoBanco).toEqual([true]);
  });

  it('IT-029 codigoDigitado → o pacote salvo tem codigoDigitado = true', async () => {
    const barcodes = { ...barcodesDe('rotulo-completo'), objeto: null };
    const r = await enviar(s.c1.token, meta(s.d03.id, { barcodes, codigoDigitado: true, codigo: 'oy 716-488-072 br' }));
    expect(r.body.tipo).toBe('SALVO');
    expect(await pacote(OY)).toMatchObject({ codigoDigitado: true });
  });

  it('IT-030 código digitado que já está no D-03 → SALVO atualizado', async () => {
    const carga = await cargaD03();
    await criarPacote({ cargaId: carga.id, codigo: OY });
    const barcodes = { ...barcodesDe('rotulo-completo'), objeto: null };
    const r = await enviar(s.c1.token, meta(s.d03.id, { barcodes, codigoDigitado: true }));
    expect(r.body).toMatchObject({ tipo: 'SALVO', atualizado: true });
    expect(await prisma.pacoteDia.count()).toBe(1);
  });

  // ——— CEP ——————————————————————————————————————————————————————————

  it('IT-031 CEP falso com "QNC 4" → logradouro do CEP e número do DataMatrix', async () => {
    const m = meta(s.d03.id);
    await enviar(s.c1.token, m);
    expect(await pacote(OY)).toMatchObject({ logradouro: 'QNC 4', numero: '17' });
    const campos = (await prisma.captura.findUniqueOrThrow({ where: { id: m.capturaId } })).campos as Record<string, { fonte: string }>;
    expect(campos.logradouro.fonte).toBe('CEP');
    expect(campos.numero.fonte).toBe('DATAMATRIX');
  });

  it('IT-032 CEP sem logradouro (73800000) → PARA_CONFERIR com logradouro em dúvida', async () => {
    const r = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-cep-unico' }), jpegDe('rotulo-cep-unico'));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    expect(r.body.campos.logradouro).toMatchObject({ valor: 'Rua Sete', duvida: true, motivo: 'cep_sem_logradouro' });
  });

  it('IT-033 CEP INDISPONIVEL → PARA_CONFERIR com cidade e UF em dúvida', async () => {
    amb.cep.forcar('INDISPONIVEL');
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    expect(r.body.campos.cidade.duvida).toBe(true);
    expect(r.body.campos.uf.duvida).toBe(true);
    expect(r.body.motivos).toContain('cep_indisponivel');
  });

  it('IT-034 CEP NAO_ENCONTRADO → PARA_CONFERIR com cep em dúvida e motivo cep_nao_encontrado', async () => {
    amb.cep.forcar('NAO_ENCONTRADO');
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    expect(r.body.campos.cep).toMatchObject({ duvida: true, motivo: 'cep_nao_encontrado' });
    expect(r.body.motivos).toContain('cep_nao_encontrado');
  });

  it('IT-102 GET /cep/00000000 com NAO_ENCONTRADO → 404 cep_nao_encontrado', async () => {
    const r = await api().get('/api/v1/captura/cep/00000000').set(auth(s.c1.token));
    expect(r.status).toBe(404);
    expect(r.body.details.code).toBe('cep_nao_encontrado');
  });

  it('IT-103 GET /cep com INDISPONIVEL → 503 cep_indisponivel', async () => {
    amb.cep.forcar('INDISPONIVEL');
    const r = await api().get('/api/v1/captura/cep/72115040').set(auth(s.c1.token));
    expect(r.status).toBe(503);
    expect(r.body.details.code).toBe('cep_indisponivel');
  });

  // ——— Planilha × foto ———————————————————————————————————————————————

  it('IT-035 rótulo sem telefone, pacote novo → SALVO sem WhatsApp (SEM_WHATSAPP)', async () => {
    const r = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-dm-sem-telefone' }), jpegDe('rotulo-dm-sem-telefone'));
    expect(r.body.tipo).toBe('SALVO');
    expect(await pacote('OY716488109BR')).toMatchObject({ whatsappE164: null, status: 'SEM_WHATSAPP' });
  });

  it('IT-036 ausência não apaga: planilha com WhatsApp, captura sem telefone → WhatsApp mantido', async () => {
    const carga = await cargaD03();
    await criarPacote({ cargaId: carga.id, codigo: 'OY716488109BR', whatsappE164: '+5561991112222' });
    const r = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-dm-sem-telefone' }), jpegDe('rotulo-dm-sem-telefone'));
    expect(r.body).toMatchObject({ tipo: 'SALVO', atualizado: true });
    expect((await pacote('OY716488109BR'))?.whatsappE164).toBe('+5561991112222');
  });

  it('IT-037 foto vence a planilha: nome e número sobrescritos, PLANILHA_FOTO, evento com antes/depois', async () => {
    const carga = await cargaD03();
    const p = await criarPacote({
      cargaId: carga.id, codigo: OY, nome: 'Aline R.', numero: '71', whatsappE164: '+5561993401287',
      mediacaoCaseId: 'caso-1', prosioMessageId: 'msg-1', referencia: 'portão azul',
    });
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body).toEqual({ tipo: 'SALVO', pacoteId: p.id, atualizado: true });
    const depois = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: p.id } });
    expect(depois).toMatchObject({
      nome: 'ALINE RODRIGUES', numero: '17', origem: 'PLANILHA_FOTO',
      status: p.status, cargaId: p.cargaId, mediacaoCaseId: 'caso-1', prosioMessageId: 'msg-1', referencia: 'portão azul',
    });
    const [ev] = await eventos(p.id, 'CAPTURA_ATUALIZADO');
    expect((ev.dados as { campos: Record<string, unknown> }).campos.nome).toEqual({ antes: 'Aline R.', depois: 'ALINE RODRIGUES' });
    expect((ev.dados as { campos: Record<string, unknown> }).campos.numero).toEqual({ antes: '71', depois: '17' });
  });

  it('IT-038 três pacotes da planilha, captura de um → os outros dois idênticos', async () => {
    const carga = await cargaD03();
    await criarPacote({ cargaId: carga.id, codigo: OY, nome: 'Aline R.' });
    const outros = [await criarPacote({ cargaId: carga.id }), await criarPacote({ cargaId: carga.id })];
    await enviar(s.c1.token, meta(s.d03.id));
    const depois = await prisma.pacoteDia.findMany({ where: { id: { in: outros.map((o) => o.id) } }, orderBy: { criadoEm: 'asc' } });
    expect(depois).toEqual(outros);
  });

  it('IT-039 carga CARREGADO e a foto troca o WhatsApp → WHATSAPP_ALTERADO, sem chamar o gancho', async () => {
    const carga = await cargaD03('CARREGADO');
    const p = await criarPacote({ cargaId: carga.id, codigo: OY, whatsappE164: '+5561991112222' });
    await enviar(s.c1.token, meta(s.d03.id));
    expect(await eventos(p.id, 'WHATSAPP_ALTERADO')).toHaveLength(1);
    expect(gancho).not.toHaveBeenCalled();
  });

  it('IT-052 carga LIBERADO e a foto troca o WhatsApp → WHATSAPP_ALTERADO {antes, depois} e o gancho recebe [pacoteId]', async () => {
    const carga = await cargaD03('LIBERADO');
    const p = await criarPacote({ cargaId: carga.id, codigo: OY, whatsappE164: '+5561991112222', status: 'ENVIADO' });
    await enviar(s.c1.token, meta(s.d03.id));
    const [ev] = await eventos(p.id, 'WHATSAPP_ALTERADO');
    expect(ev.dados).toEqual({ antes: '+5561991112222', depois: '+5561993401287' });
    expect(gancho).toHaveBeenCalledWith([p.id]);
    expect((await pacote(OY))?.whatsappE164).toBe('+5561993401287');
  });

  it('IT-068 mesmo número com outra formatação → nenhum WHATSAPP_ALTERADO e nenhuma chamada ao gancho', async () => {
    const carga = await cargaD03('LIBERADO');
    const p = await criarPacote({ cargaId: carga.id, codigo: AA, whatsappE164: '+5561991112222' });
    amb.llm.responder({ ...LLM_SEM_DM, whatsapp: { valor: '(61) 99111-2222' } });
    const r = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-sem-datamatrix' }), jpegDe('rotulo-sem-datamatrix'));
    expect(r.body.tipo).toBe('SALVO');
    expect(await eventos(p.id, 'WHATSAPP_ALTERADO')).toHaveLength(0);
    expect(gancho).not.toHaveBeenCalled();
  });

  // ——— Idempotência ——————————————————————————————————————————————————

  it('IT-061 duas capturas do mesmo código → um pacote; a segunda atualizado; /hoje conta pacotes', async () => {
    const a = await enviar(s.c1.token, meta(s.d03.id));
    const b = await enviar(s.c1.token, meta(s.d03.id));
    expect(a.body.atualizado).toBe(false);
    expect(b.body).toMatchObject({ tipo: 'SALVO', atualizado: true, pacoteId: a.body.pacoteId });
    const hoje = await api().get('/api/v1/captura/hoje').set(auth(s.c1.token));
    expect(hoje.body.contadores.capturados).toBe(1);
    expect(hoje.body.recentes).toHaveLength(1);
  });

  it('IT-062 o mesmo capturaId duas vezes → o mesmo corpo, sem chamar o LLM de novo', async () => {
    const m = meta(s.d03.id);
    const a = await enviar(s.c1.token, m);
    const b = await enviar(s.c1.token, m);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(amb.llm.chamadas).toBe(1);

    amb.llm.falhar('erro');
    const pend = meta(s.d03.id, { rotulo: 'rotulo-cep-unico' });
    const p1 = await enviar(s.c1.token, pend, jpegDe('rotulo-cep-unico'));
    const p2 = await enviar(s.c1.token, pend, jpegDe('rotulo-cep-unico'));
    expect(p2.body).toEqual(p1.body);
  });

  it('IT-063 reenvio durante o processamento → 409; PROCESSANDO há mais de 2 min → reprocessa', async () => {
    amb.llm.atrasar(1500);
    const m = meta(s.d03.id);
    const primeira = enviar(s.c1.token, m).then((r) => r);
    for (let i = 0; i < 50 && !(await prisma.captura.findUnique({ where: { id: m.capturaId } })); i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const segunda = await enviar(s.c1.token, m);
    expect(segunda.status).toBe(409);
    expect(segunda.body.details.code).toBe('captura_em_processamento');
    expect((await primeira).body.tipo).toBe('SALVO');
    amb.llm.atrasar(0);

    const presa = randomUUID();
    await prisma.captura.create({
      data: {
        id: presa, carteiroId: s.c1.carteiro.id, distritoId: s.d03.id, data: HOJE, resultado: 'PROCESSANDO',
        capturadoEm: AGORA, recebidoEm: new Date(AGORA.getTime() - 3 * 60_000),
      },
    });
    const re = await enviar(s.c1.token, meta(s.d03.id, { capturaId: presa, rotulo: 'rotulo-dm-sem-telefone' }), jpegDe('rotulo-dm-sem-telefone'));
    expect(re.status).toBe(200);
    expect(re.body.tipo).toBe('SALVO');
  });

  it('IT-064 campo pior lido não sobrescreve: número com dúvida → PARA_CONFERIR e o pacote mantém "17"', async () => {
    await enviar(s.c1.token, meta(s.d03.id));
    amb.llm.responder({ nome: { valor: 'ALINE RODRIGUES' }, numero: { valor: '1?', duvida: true }, whatsapp: { valor: '(61) 99340-1287' } });
    const r = await enviar(s.c1.token, meta(s.d03.id, { barcodes: { objeto: OY, cepLinear: '72115040', dataMatrixRaw: null, multiplos: false } }));
    expect(r.body.tipo).toBe('PARA_CONFERIR');
    expect(r.body.motivos).toContain('duvida:numero');
    expect((await pacote(OY))?.numero).toBe('17');
  });

  // ——— Depois da liberação ————————————————————————————————————————————

  it('IT-065 carga LIBERADO, pacote novo com WhatsApp → CAPTURA_CRIADO e gancho com [pacoteId]', async () => {
    await cargaD03('LIBERADO');
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body.tipo).toBe('SALVO');
    expect(await eventos(r.body.pacoteId, 'CAPTURA_CRIADO')).toHaveLength(1);
    expect(gancho).toHaveBeenCalledWith([r.body.pacoteId]);
  });

  it('IT-066 carga CARREGADO, pacote novo com WhatsApp → sem gancho; AGUARDANDO_LIBERACAO', async () => {
    await cargaD03('CARREGADO');
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(gancho).not.toHaveBeenCalled();
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: r.body.pacoteId } })).status).toBe('AGUARDANDO_LIBERACAO');
  });

  it('IT-067 carga LIBERADO, pacote novo sem WhatsApp → SEM_WHATSAPP e sem gancho', async () => {
    await cargaD03('LIBERADO');
    const r = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-dm-sem-telefone' }), jpegDe('rotulo-dm-sem-telefone'));
    expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: r.body.pacoteId } })).status).toBe('SEM_WHATSAPP');
    expect(gancho).not.toHaveBeenCalled();
  });

  // ——— Eventos e gancho ———————————————————————————————————————————————

  it('IT-109 eventos no mesmo commit; erro depois do update do pacote → rollback, sem eventos e sem gancho', async () => {
    const carga = await cargaD03('LIBERADO');
    const p = await criarPacote({ cargaId: carga.id, codigo: OY, nome: 'Aline R.', numero: '71', whatsappE164: '+5561991112222', complemento: 'CASA' });
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.body.tipo).toBe('SALVO');
    const evs = await eventos(p.id);
    expect(evs.map((e) => e.tipo).sort()).toEqual(['CAPTURA_ATUALIZADO', 'WHATSAPP_ALTERADO']);
    expect(gancho).toHaveBeenCalledTimes(1);

    gancho.mockClear();
    const outro = await criarPacote({ cargaId: carga.id, codigo: 'OY716488109BR', nome: 'Marcos L.', numero: '99', whatsappE164: null });
    const original = conciliacaoInternos.aposAtualizarPacote;
    conciliacaoInternos.aposAtualizarPacote = async () => { throw new Error('falha forçada'); };
    try {
      const falha = await enviar(s.c1.token, meta(s.d03.id, { rotulo: 'rotulo-dm-sem-telefone' }), jpegDe('rotulo-dm-sem-telefone'));
      expect(falha.status).toBe(500);
    } finally {
      conciliacaoInternos.aposAtualizarPacote = original;
    }
    expect(await eventos(outro.id)).toHaveLength(0);
    expect(await prisma.pacoteDia.findUniqueOrThrow({ where: { id: outro.id } })).toEqual(outro);
    expect(gancho).not.toHaveBeenCalled();
  });

  it('IT-111 o gancho lança erro numa carga LIBERADO → ainda SALVO, pacote persiste e a métrica incrementa', async () => {
    await cargaD03('LIBERADO');
    gancho.mockRejectedValue(new Error('monitoramento fora do ar'));
    const antes = await valorMetrica();
    const r = await enviar(s.c1.token, meta(s.d03.id));
    expect(r.status).toBe(200);
    expect(r.body.tipo).toBe('SALVO');
    expect(await prisma.pacoteDia.findUnique({ where: { id: r.body.pacoteId } })).not.toBeNull();
    expect(gancho).toHaveBeenCalledTimes(1);
    expect(await valorMetrica()).toBe(antes + 1);
  });
});
