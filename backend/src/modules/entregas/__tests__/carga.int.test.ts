/**
 * Integração da carga do dia: prévia, confirmação, quadro, lista e edição de pacote.
 * IT-016..IT-023, IT-049, IT-050 (+ PATCH /pacotes/:id e o gancho da task_06).
 */
import request from 'supertest';
import type { Distrito, Unidade, Usuario } from '@prisma/client';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { authHeader } from '../../../__tests__/helpers/login';
import {
  codigoS10,
  criarCarteiro,
  criarDistrito,
  criarGestor,
  criarSupervisor,
  criarUnidade,
  limparBanco,
  whatsappUnico,
} from '../../../__tests__/fixtures/entregas';
import { hojeBrasilia, somarDias, formatarData } from '../datas';
import { cargaInternos } from '../carga.service';
import { registrarGanchoPacotesEmCargaLiberada } from '../ganchos';

const hoje = hojeBrasilia();
const ontem = somarDias(hoje, -1);

interface Cenario {
  unidade: Unidade;
  supervisor: Usuario;
  auth: { Authorization: string };
}

async function cenario(): Promise<Cenario> {
  const unidade = await criarUnidade();
  const supervisor = await criarSupervisor({ unidadeId: unidade.id });
  return { unidade, supervisor, auth: authHeader(supervisor) };
}

async function distrito(c: Cenario, codigo?: string, comCarteiro = true): Promise<Distrito> {
  const carteiro = comCarteiro ? await criarCarteiro({ unidadeId: c.unidade.id }) : null;
  return criarDistrito({ unidadeId: c.unidade.id, carteiroPadraoId: carteiro?.id ?? null, ...(codigo ? { codigo } : {}) });
}

/** Linha no formato do corpo de `confirmar`/`previa {linhas}`. */
function linha(n: number, codigo = codigoS10(), whatsapp: string | null = '(61) 9' + String(80000000 + n).slice(-8)) {
  return { n, codigo, nome: `Pessoa ${n}`, whatsapp, logradouro: 'QNA 12', numero: String(n), bairro: 'Taguatinga', cidade: 'Brasília', uf: 'DF', cep: '72110120' };
}

function csv(qtd: number): string {
  const linhas = ['rastreio;destinatario;celular;endereco'];
  for (let i = 0; i < qtd; i += 1) linhas.push(`${codigoS10()};Pessoa ${i};(61) 99812-${String(1000 + i).slice(-4)};QNA ${i} Casa 1`);
  return linhas.join('\n');
}

const post = (url: string, auth: Record<string, string>) => request(app).post(url).set('Connection', 'close').set(auth);
const get = (url: string, auth: Record<string, string>) => request(app).get(url).set('Connection', 'close').set(auth);

async function contagens() {
  return { pacotes: await prisma.pacoteDia.count(), cargas: await prisma.cargaDistrito.count() };
}

async function criarCargaComPacotes(distritoId: string, opcoes: {
  data?: Date;
  status?: 'CARREGADO' | 'LIBERADO' | 'EM_ENTREGA';
  pacotes: Array<{ status: string; whatsapp?: boolean; escalonado?: boolean }>;
}) {
  const data = opcoes.data ?? hoje;
  const carga = await prisma.cargaDistrito.create({
    data: { distritoId, data, status: opcoes.status ?? 'CARREGADO', liberadoEm: opcoes.status && opcoes.status !== 'CARREGADO' ? new Date() : null },
  });
  await prisma.pacoteDia.createMany({
    data: opcoes.pacotes.map((p, i) => ({
      cargaId: carga.id,
      data,
      codigo: codigoS10(),
      nome: `Pessoa ${i}`,
      whatsappE164: p.whatsapp === false ? null : whatsappUnico(),
      status: p.status as never,
      escalonado: p.escalonado ?? false,
    })),
  });
  return carga;
}

describe('entregas — carga do dia', () => {
  beforeAll(async () => {
    await limparBanco();
  });

  afterAll(async () => {
    registrarGanchoPacotesEmCargaLiberada(null);
    await encerrarRecursos();
  });

  describe('prévia', () => {
    it('IT-016 multipart: CSV de 40 linhas → 200 classificado; PDF → 415; 501 linhas → 413; 500 linhas em até 5 s', async () => {
      const c = await cenario();
      const d = await distrito(c);
      const url = `/api/v1/entregas/cargas/${d.id}/previa`;

      const ok = await post(url, c.auth).attach('arquivo', Buffer.from(csv(40)), { filename: 'lista.csv', contentType: 'text/csv' });
      expect(ok.status).toBe(200);
      expect(ok.body.linhas).toHaveLength(40);
      expect(ok.body.linhas.every((l: { situacao: string }) => l.situacao === 'valida')).toBe(true);
      expect(ok.body.linhas[0]).toEqual(expect.objectContaining({ n: 2, whatsapp: '+5561998121000', enderecoTexto: 'QNA 0 Casa 1' }));
      expect(ok.body.resumo).toEqual(expect.objectContaining({ total: 40, validas: 40, invalidas: 0 }));
      expect(ok.body.data).toBe(formatarData(hoje));

      const pdf = await post(url, c.auth).attach('arquivo', Buffer.from('%PDF-1.4\n...'), { filename: 'lista.pdf', contentType: 'application/pdf' });
      expect(pdf.status).toBe(415);
      expect(pdf.body.error).toBe('formato_nao_suportado');

      const grande = await post(url, c.auth).attach('arquivo', Buffer.from(csv(501)), { filename: 'lista.csv', contentType: 'text/csv' });
      expect(grande.status).toBe(413);
      expect(grande.body).toEqual({ error: 'limite_linhas', details: { max: 500 } });

      const semCodigo = await post(url, c.auth).attach('arquivo', Buffer.from('nome;whatsapp\nMaria;61998124412'), { filename: 'lista.csv', contentType: 'text/csv' });
      expect(semCodigo.status).toBe(400);
      expect(semCodigo.body).toEqual({ error: 'coluna_ausente', details: { coluna: 'codigo' } });

      const inicio = Date.now();
      const quinhentas = await post(url, c.auth).attach('arquivo', Buffer.from(csv(500)), { filename: 'lista.csv', contentType: 'text/csv' });
      expect(quinhentas.status).toBe(200);
      expect(quinhentas.body.linhas).toHaveLength(500);
      expect(Date.now() - inicio).toBeLessThan(5000);
    });

    it('IT-017 {texto}: 2 linhas → 200; 501 linhas → 413', async () => {
      const c = await cenario();
      const d = await distrito(c);
      const url = `/api/v1/entregas/cargas/${d.id}/previa`;

      const dois = await post(url, c.auth).send({ texto: `${codigoS10()}\tMaria Souza\t61 99812-4412\tQNA 12 Casa 45\n${codigoS10()}\tJoão\t` });
      expect(dois.status).toBe(200);
      expect(dois.body.linhas.map((l: { situacao: string }) => l.situacao)).toEqual(['valida', 'sem_whatsapp']);
      expect(dois.body.linhas[0].enderecoTexto).toBe('QNA 12 Casa 45');

      const texto = Array.from({ length: 501 }, (_, i) => `${codigoS10()}\tPessoa ${i}`).join('\n');
      const muitas = await post(url, c.auth).send({ texto });
      expect(muitas.status).toBe(413);
      expect(muitas.body.error).toBe('limite_linhas');
    });

    it('IT-018 prévia não grava nada; confirmação interrompida no meio não deixa pacote', async () => {
      const c = await cenario();
      const d = await distrito(c);
      const antes = await contagens();

      const previa = await post(`/api/v1/entregas/cargas/${d.id}/previa`, c.auth)
        .attach('arquivo', Buffer.from(csv(10)), { filename: 'lista.csv', contentType: 'text/csv' });
      expect(previa.status).toBe(200);
      expect(await contagens()).toEqual(antes);

      const falha = jest.spyOn(cargaInternos, 'vincularOrientacoesGuardadas').mockRejectedValueOnce(new Error('queda simulada'));
      const linhas = [linha(1), linha(2), linha(3)];
      const interrompida = await post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ linhas });
      expect(falha).toHaveBeenCalled();
      expect(interrompida.status).toBe(500);
      expect(await contagens()).toEqual(antes);
      falha.mockRestore();

      // reenviar depois da queda funciona
      const reenvio = await post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ linhas });
      expect(reenvio.status).toBe(200);
      expect(reenvio.body.aceitos).toBe(3);
    });
  });

  describe('confirmação', () => {
    it('IT-019 36 válidas (9 sem WhatsApp) + 1 para corrigir + 3 inválidas → 37 aceitos, 3 descartados; quadro 28 de 37', async () => {
      const c = await cenario();
      const d = await distrito(c);
      const repetido = codigoS10();
      const comWhats = Array.from({ length: 27 }, (_, i) => linha(i + 1));
      comWhats[0] = { ...comWhats[0], codigo: repetido };
      const semWhats = Array.from({ length: 9 }, (_, i) => linha(28 + i, codigoS10(), i % 2 ? '' : null));
      const corrigir = { ...linha(37), whatsapp: '98876-1102' };
      const invalidas = [
        { ...linha(38), codigo: 'AB123456789BR' },
        { ...linha(39), nome: '  ' },
        { ...linha(40), codigo: repetido },
      ];
      const todas = [...comWhats, ...semWhats, corrigir, ...invalidas];

      const previa = await post(`/api/v1/entregas/cargas/${d.id}/previa`, c.auth).send({ linhas: todas });
      expect(previa.status).toBe(200);
      expect(previa.body.resumo).toEqual(expect.objectContaining({ validas: 27, semWhatsapp: 9, corrigir: 1, invalidas: 3, aceitaveis: 37 }));
      expect(previa.body.linhas.slice(-3).map((l: { motivo: string }) => l.motivo)).toEqual(['digito_invalido', 'faltam_campos', 'duplicado_planilha']);

      // o supervisor corrige o WhatsApp sem DDD antes de confirmar
      const corrigidas = todas.map((l) => (l.n === 37 ? { ...l, whatsapp: '61 98876-1102' } : l));
      const res = await post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ data: formatarData(hoje), linhas: corrigidas });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ aceitos: 37, descartados: 3, cargaId: expect.any(String) }));
      expect(res.body.descartes.map((x: { n: number; motivo: string }) => [x.n, x.motivo])).toEqual([
        [38, 'digito_invalido'], [39, 'faltam_campos'], [40, 'duplicado_planilha'],
      ]);

      const quadro = await get('/api/v1/entregas/quadro', c.auth);
      expect(quadro.status).toBe(200);
      const cartao = quadro.body.distritos.find((x: { distritoId: string }) => x.distritoId === d.id);
      expect(cartao).toEqual(expect.objectContaining({ status: 'DADOS_CARREGADOS', total: 37, comWhatsapp: 28, cargaId: res.body.cargaId }));
      expect(cartao.porStatus).toEqual({ AGUARDANDO_LIBERACAO: 28, SEM_WHATSAPP: 9 });

      // sem correção, a linha "corrigir" entra como sem WhatsApp (UT-029) e soma à lista existente (US-007 AC-3)
      const outra = { ...linha(1), whatsapp: '98876-1102' };
      const extra = await post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ linhas: [outra] });
      expect(extra.body).toEqual(expect.objectContaining({ aceitos: 1, descartados: 0, cargaId: res.body.cargaId }));
      const pacote = await prisma.pacoteDia.findUniqueOrThrow({ where: { codigo_data: { codigo: outra.codigo, data: hoje } } });
      expect(pacote).toEqual(expect.objectContaining({ status: 'SEM_WHATSAPP', whatsappE164: null }));
    });

    it('IT-020 confirmações concorrentes com códigos sobrepostos → união sem duplicatas, nenhum 500', async () => {
      const c = await cenario();
      const d = await distrito(c);
      const codigos = Array.from({ length: 50 }, () => codigoS10());
      const a = codigos.slice(0, 30).map((cod, i) => linha(i + 1, cod));
      const b = codigos.slice(20).map((cod, i) => linha(i + 1, cod));

      // Segura a 1ª transação aberta por 300 ms: a 2ª valida sem ver os códigos
      // (ainda não commitados) e cai na unicidade (codigo, data) ao gravar.
      const original = cargaInternos.vincularOrientacoesGuardadas;
      const atraso = jest.spyOn(cargaInternos, 'vincularOrientacoesGuardadas').mockImplementationOnce(async (...args) => {
        await new Promise((r) => setTimeout(r, 300));
        return original(...args);
      });
      const [ra, rb] = await Promise.all([
        post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ linhas: a }),
        new Promise((r) => setTimeout(r, 100)).then(() => post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ linhas: b })),
      ]);
      atraso.mockRestore();
      expect(rb.body.descartes).toHaveLength(10);
      expect(rb.body.descartes.every((x: { motivo: string; detalhe: string }) => x.motivo === 'ja_no_distrito' && x.detalhe === d.codigo)).toBe(true);
      expect([ra.status, rb.status]).toEqual([200, 200]);
      expect(ra.body.aceitos + rb.body.aceitos).toBe(50);
      expect(ra.body.descartados + rb.body.descartados).toBe(10);
      expect(ra.body.cargaId).toBe(rb.body.cargaId);
      const gravados = await prisma.pacoteDia.findMany({ where: { cargaId: ra.body.cargaId }, select: { codigo: true } });
      expect(new Set(gravados.map((p) => p.codigo))).toEqual(new Set(codigos));
      expect(await prisma.cargaDistrito.count({ where: { distritoId: d.id } })).toBe(1);
    });

    it('IT-021 código já no D-01 hoje, confirmado no D-02 → descartado com ja_no_distrito', async () => {
      const c = await cenario();
      const d1 = await distrito(c, 'D-01');
      const d2 = await distrito(c, 'D-02');
      const cod = codigoS10();
      expect((await post(`/api/v1/entregas/cargas/${d1.id}/confirmar`, c.auth).send({ linhas: [linha(1, cod)] })).body.aceitos).toBe(1);

      const res = await post(`/api/v1/entregas/cargas/${d2.id}/confirmar`, c.auth).send({ linhas: [linha(1, cod), linha(2)] });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ aceitos: 1, descartados: 1 }));
      expect(res.body.descartes).toEqual([{ n: 1, codigo: cod, motivo: 'ja_no_distrito', detalhe: 'D-01' }]);

      const previa = await post(`/api/v1/entregas/cargas/${d2.id}/previa`, c.auth).send({ texto: `${cod}\tMaria` });
      expect(previa.body.linhas[0]).toEqual(expect.objectContaining({ situacao: 'invalida', motivo: 'ja_no_distrito', detalhe: 'D-01' }));
    });

    it('IT-022 confirmar (ou prévia) em distrito de outra unidade → 404', async () => {
      const c = await cenario();
      const outra = await cenario();
      const alheio = await distrito(outra);

      const conf = await post(`/api/v1/entregas/cargas/${alheio.id}/confirmar`, c.auth).send({ linhas: [linha(1)] });
      expect(conf.status).toBe(404);
      const prev = await post(`/api/v1/entregas/cargas/${alheio.id}/previa`, c.auth).send({ texto: `${codigoS10()}\tMaria` });
      expect(prev.status).toBe(404);
      expect(await prisma.cargaDistrito.count({ where: { distritoId: alheio.id } })).toBe(0);

      const semToken = await request(app).post(`/api/v1/entregas/cargas/${alheio.id}/confirmar`).set('Connection', 'close').send({ linhas: [] });
      expect(semToken.status).toBe(401);
    });

    it('IT-023 orientação GUARDADA de ontem acompanha o código confirmado hoje em outro distrito', async () => {
      const c = await cenario();
      const dOntem = await distrito(c);
      const dHoje = await distrito(c);
      const cod = 'QB908301669BR';
      const cargaOntem = await prisma.cargaDistrito.create({ data: { distritoId: dOntem.id, data: ontem, status: 'LIBERADO' } });
      const pacoteOntem = await prisma.pacoteDia.create({
        data: { cargaId: cargaOntem.id, data: ontem, codigo: cod, nome: 'Maria', whatsappE164: whatsappUnico(), status: 'INSUCESSO' },
      });
      const orientacao = await prisma.orientacao.create({
        data: {
          codigo: cod, pacoteId: pacoteOntem.id, tipo: 'VIZINHO', texto: 'Deixar com vizinho: Maria, apto 302',
          vizinhoNome: 'Maria', vizinhoCasa: 'apto 302', estado: 'GUARDADA', origem: 'BOTAO', valeAPartirDe: hoje,
        },
      });

      const previa = await post(`/api/v1/entregas/cargas/${dHoje.id}/previa`, c.auth).send({ texto: `${cod}\tMaria\t61 99812-4412` });
      expect(previa.body.linhas[0].orientacaoGuardada).toEqual({ tipo: 'VIZINHO', texto: 'Deixar com vizinho: Maria, apto 302' });

      const conf = await post(`/api/v1/entregas/cargas/${dHoje.id}/confirmar`, c.auth).send({ linhas: [linha(1, cod)] });
      expect(conf.body.aceitos).toBe(1);

      const lista = await get(`/api/v1/entregas/cargas/${conf.body.cargaId}/pacotes`, c.auth);
      expect(lista.status).toBe(200);
      expect(lista.body.pacotes[0].orientacaoVigente).toEqual(expect.objectContaining({ id: orientacao.id, tipo: 'VIZINHO', estado: 'GUARDADA' }));
      const novo = await prisma.pacoteDia.findUniqueOrThrow({ where: { codigo_data: { codigo: cod, data: hoje } } });
      expect((await prisma.orientacao.findUniqueOrThrow({ where: { id: orientacao.id } })).pacoteId).toBe(novo.id);
    });

    it('confirmação aceita corpo JSON acima de 100 kb (até 1 MB) e rejeita data passada', async () => {
      const c = await cenario();
      const d = await distrito(c);
      const longo = 'Quadra '.repeat(40);
      const linhas = Array.from({ length: 500 }, (_, i) => ({ ...linha(i + 1), enderecoTexto: `${longo}${i}` }));
      expect(Buffer.byteLength(JSON.stringify({ linhas }))).toBeGreaterThan(100 * 1024);

      const res = await post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ linhas });
      expect(res.status).toBe(200);
      expect(res.body.aceitos).toBe(500);

      const passada = await post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth).send({ data: formatarData(ontem), linhas: [linha(1)] });
      expect(passada.status).toBe(409);
      expect(passada.body.error).toBe('somente_leitura');

      const d2 = await distrito(c);
      const demais = await post(`/api/v1/entregas/cargas/${d2.id}/confirmar`, c.auth).send({ linhas: Array.from({ length: 501 }, (_, i) => linha(i + 1)) });
      expect(demais.status).toBe(413);
    });

    it('confirmação em carga já liberada chama o gancho com os pacotes novos com WhatsApp', async () => {
      const gancho = jest.fn().mockResolvedValue(undefined);
      registrarGanchoPacotesEmCargaLiberada(gancho);
      try {
        const c = await cenario();
        const d = await distrito(c);
        await criarCargaComPacotes(d.id, { status: 'LIBERADO', pacotes: [{ status: 'AGENDADO' }] });

        const res = await post(`/api/v1/entregas/cargas/${d.id}/confirmar`, c.auth)
          .send({ linhas: [linha(1), linha(2, codigoS10(), null)] });
        expect(res.body).toEqual(expect.objectContaining({ aceitos: 2, avisadosNaHora: 1 }));
        expect(gancho).toHaveBeenCalledTimes(1);
        const [ids] = gancho.mock.calls[0];
        expect(ids).toHaveLength(1);
        expect((await prisma.pacoteDia.findUniqueOrThrow({ where: { id: ids[0] } })).whatsappE164).not.toBeNull();
      } finally {
        registrarGanchoPacotesEmCargaLiberada(null);
      }
    });
  });

  describe('quadro e lista', () => {
    it('IT-049 GET /quadro: contagens, sem distritos, sem carteiro, data anterior, filtros e escopo', async () => {
      const c = await cenario();
      const d1 = await distrito(c, 'D-01');
      const d2 = await distrito(c, 'D-02');
      const d3 = await distrito(c, 'D-03', false);
      await criarCargaComPacotes(d1.id, { pacotes: [{ status: 'AGUARDANDO_LIBERACAO' }, { status: 'AGUARDANDO_LIBERACAO' }, { status: 'SEM_WHATSAPP', whatsapp: false }] });
      await criarCargaComPacotes(d2.id, {
        status: 'LIBERADO',
        pacotes: [{ status: 'ENVIADO' }, { status: 'AGENDADO' }, { status: 'LIDO', escalonado: true }, { status: 'SEM_WHATSAPP', whatsapp: false }],
      });
      await criarCargaComPacotes(d3.id, { data: ontem, status: 'LIBERADO', pacotes: [{ status: 'ENTREGUE' }, { status: 'INSUCESSO' }] });

      const res = await get('/api/v1/entregas/quadro', c.auth);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ data: formatarData(hoje), somenteLeitura: false, semDistritos: false }));
      const porCodigo = Object.fromEntries(res.body.distritos.map((x: { codigo: string }) => [x.codigo, x]));
      expect(Object.keys(porCodigo)).toEqual(['D-01', 'D-02', 'D-03']);
      expect(porCodigo['D-01']).toEqual(expect.objectContaining({
        status: 'DADOS_CARREGADOS', total: 3, comWhatsapp: 2, porStatus: { AGUARDANDO_LIBERACAO: 2, SEM_WHATSAPP: 1 }, semCarteiro: false,
      }));
      expect(porCodigo['D-02']).toEqual(expect.objectContaining({
        status: 'EM_ENTREGA', total: 4, comWhatsapp: 3, escalonamentos: 1, porStatus: { ENVIADO: 1, AGENDADO: 1, LIDO: 1, SEM_WHATSAPP: 1 },
      }));
      expect(porCodigo['D-03']).toEqual(expect.objectContaining({ status: 'PENDENTE_UPLOAD', total: 0, cargaId: null, semCarteiro: true, carteiro: null }));

      // escala do dia define o carteiro
      const substituto = await criarCarteiro({ unidadeId: c.unidade.id, nome: 'Substituto' });
      await prisma.escalaDistrito.create({ data: { distritoId: d3.id, data: hoje, carteiroId: substituto.id } });
      const comEscala = await get('/api/v1/entregas/quadro', c.auth);
      const d3Hoje = comEscala.body.distritos.find((x: { codigo: string }) => x.codigo === 'D-03');
      expect(d3Hoje).toEqual(expect.objectContaining({ semCarteiro: false, carteiro: { id: substituto.id, nome: 'Substituto' } }));

      const passado = await get(`/api/v1/entregas/quadro?data=${formatarData(ontem)}`, c.auth);
      expect(passado.body).toEqual(expect.objectContaining({ data: formatarData(ontem), somenteLeitura: true }));
      const d3Ontem = passado.body.distritos.find((x: { codigo: string }) => x.codigo === 'D-03');
      expect(d3Ontem).toEqual(expect.objectContaining({ status: 'CONCLUIDO', total: 2 }));

      const filtrado = await get('/api/v1/entregas/quadro?status=CARREGADO&busca=D-0', c.auth);
      expect(filtrado.body.distritos.map((x: { codigo: string }) => x.codigo)).toEqual(['D-01']);
      const busca = await get('/api/v1/entregas/quadro?busca=d-02', c.auth);
      expect(busca.body.distritos.map((x: { codigo: string }) => x.codigo)).toEqual(['D-02']);

      const vazia = await cenario();
      const semDistritos = await get('/api/v1/entregas/quadro', vazia.auth);
      expect(semDistritos.status).toBe(200);
      expect(semDistritos.body).toEqual(expect.objectContaining({ distritos: [], semDistritos: true }));

      const alheia = await get(`/api/v1/entregas/quadro?unidadeId=${vazia.unidade.id}`, c.auth);
      expect(alheia.status).toBe(404);

      const gestor = authHeader(await criarGestor());
      expect((await get('/api/v1/entregas/quadro', gestor)).status).toBe(400);
      const doGestor = await get(`/api/v1/entregas/quadro?unidadeId=${c.unidade.id}`, gestor);
      expect(doGestor.status).toBe(200);
      expect(doGestor.body.distritos).toHaveLength(3);

      expect((await get('/api/v1/entregas/quadro?data=2026-02-30', c.auth)).status).toBe(400);
    });

    it('IT-050 GET /cargas/:id/pacotes: paginação de 50, filtro, "Lista pronta" e escopo', async () => {
      const c = await cenario();
      const d = await distrito(c);
      const grande = await criarCargaComPacotes(d.id, {
        status: 'LIBERADO',
        pacotes: Array.from({ length: 500 }, (_, i) => ({ status: i < 7 ? 'LIDO' : 'ENVIADO' })),
      });

      const p1 = await get(`/api/v1/entregas/cargas/${grande.id}/pacotes`, c.auth);
      expect(p1.status).toBe(200);
      expect(p1.body).toEqual(expect.objectContaining({ total: 500, pagina: 1, porPagina: 50, totalPaginas: 10, liberada: true, statusCarga: 'EM_ENTREGA' }));
      expect(p1.body.pacotes).toHaveLength(50);
      expect(p1.body.resumo).toEqual({ total: 500, comWhatsapp: 500, porStatus: { LIDO: 7, ENVIADO: 493 } });
      const p10 = await get(`/api/v1/entregas/cargas/${grande.id}/pacotes?pagina=10`, c.auth);
      expect(p10.body.pacotes).toHaveLength(50);
      expect(new Set([...p1.body.pacotes, ...p10.body.pacotes].map((p: { id: string }) => p.id)).size).toBe(100);

      const lidos = await get(`/api/v1/entregas/cargas/${grande.id}/pacotes?status=LIDO`, c.auth);
      expect(lidos.body.total).toBe(7);
      expect(lidos.body.pacotes.every((p: { status: string; rotulo: string }) => p.status === 'LIDO' && p.rotulo === 'Lido/recebido')).toBe(true);

      const alvo = p1.body.pacotes[3];
      const porCodigo = await get(`/api/v1/entregas/cargas/${grande.id}/pacotes?busca=${alvo.codigo.toLowerCase()}`, c.auth);
      expect(porCodigo.body.pacotes.map((p: { id: string }) => p.id)).toEqual([alvo.id]);

      const d2 = await distrito(c);
      const pronta = await criarCargaComPacotes(d2.id, { pacotes: [{ status: 'AGUARDANDO_LIBERACAO' }, { status: 'SEM_WHATSAPP', whatsapp: false }] });
      const listaPronta = await get(`/api/v1/entregas/cargas/${pronta.id}/pacotes`, c.auth);
      expect(listaPronta.body.liberada).toBe(false);
      expect(listaPronta.body.pacotes.map((p: { rotulo: string }) => p.rotulo)).toEqual(['Lista pronta', 'Lista pronta']);

      const outra = await cenario();
      expect((await get(`/api/v1/entregas/cargas/${grande.id}/pacotes`, outra.auth)).status).toBe(404);
      expect((await get(`/api/v1/entregas/cargas/${grande.id}/pacotes?status=XPTO`, c.auth)).status).toBe(400);
    });
  });

  describe('PATCH /pacotes/:id', () => {
    it('adicionar WhatsApp em carga liberada chama o gancho; em carga não liberada, não', async () => {
      const gancho = jest.fn().mockResolvedValue(undefined);
      registrarGanchoPacotesEmCargaLiberada(gancho);
      try {
        const c = await cenario();
        const d = await distrito(c);
        const liberada = await criarCargaComPacotes(d.id, { status: 'LIBERADO', pacotes: [{ status: 'SEM_WHATSAPP', whatsapp: false }] });
        const [p] = await prisma.pacoteDia.findMany({ where: { cargaId: liberada.id } });

        const res = await request(app).patch(`/api/v1/entregas/pacotes/${p.id}`).set('Connection', 'close').set(c.auth)
          .send({ whatsapp: '(61) 99812-7777', endereco: { logradouro: '  QNA 12 ', cep: '72110-120' } });
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ whatsapp: '+5561998127777', status: 'AGUARDANDO_LIBERACAO', avisoSolicitado: true }));
        expect(res.body.endereco).toEqual(expect.objectContaining({ logradouro: 'QNA 12', cep: '72110120' }));
        expect(gancho).toHaveBeenCalledWith([p.id]);

        const d2 = await distrito(c);
        const naoLiberada = await criarCargaComPacotes(d2.id, { pacotes: [{ status: 'SEM_WHATSAPP', whatsapp: false }] });
        const [q] = await prisma.pacoteDia.findMany({ where: { cargaId: naoLiberada.id } });
        const res2 = await request(app).patch(`/api/v1/entregas/pacotes/${q.id}`).set('Connection', 'close').set(c.auth).send({ whatsapp: '61 99812-8888' });
        expect(res2.body).toEqual(expect.objectContaining({ status: 'AGUARDANDO_LIBERACAO', avisoSolicitado: false }));
        expect(gancho).toHaveBeenCalledTimes(1);

        const removido = await request(app).patch(`/api/v1/entregas/pacotes/${q.id}`).set('Connection', 'close').set(c.auth).send({ whatsapp: null });
        expect(removido.body).toEqual(expect.objectContaining({ status: 'SEM_WHATSAPP', whatsapp: null }));

        const invalido = await request(app).patch(`/api/v1/entregas/pacotes/${q.id}`).set('Connection', 'close').set(c.auth).send({ whatsapp: '98876-1102' });
        expect(invalido.status).toBe(400);
        expect(invalido.body).toEqual({ error: 'whatsapp_invalido', details: { motivo: 'sem_ddd' } });

        const outra = await cenario();
        const alheio = await request(app).patch(`/api/v1/entregas/pacotes/${q.id}`).set('Connection', 'close').set(outra.auth).send({ whatsapp: '61 99812-8888' });
        expect(alheio.status).toBe(404);
      } finally {
        registrarGanchoPacotesEmCargaLiberada(null);
      }
    });
  });
});
