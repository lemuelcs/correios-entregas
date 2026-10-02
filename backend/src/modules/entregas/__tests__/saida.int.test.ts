/**
 * Integração das saídas do dia (ADR-019): importação direta, descartes,
 * reimportação, criação de rota, carteiro da rota, escopo por unidade,
 * liberação em lote e listagem. IT-074..IT-086.
 */
import request from 'supertest';
import type { Unidade, Usuario } from '@prisma/client';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';
import { authHeader } from '../../../__tests__/helpers/login';
import { entregasAvisoQueue } from '../../../__tests__/helpers/avisos';
import {
  codigoS10,
  criarCanal,
  criarCarga,
  criarCarteiro,
  criarDistrito,
  criarGestor,
  criarPacote,
  criarSupervisor,
  criarUnidade,
  limparBanco,
  pacoteCapturado,
} from '../../../__tests__/fixtures/entregas';
import { formatarData, hojeBrasilia, somarDias } from '../datas';

const hoje = hojeBrasilia();
const ontem = somarDias(hoje, -1);

interface Cenario {
  unidade: Unidade;
  supervisor: Usuario;
  auth: { Authorization: string };
}

async function cenario(): Promise<Cenario> {
  const canal = await criarCanal();
  const unidade = await criarUnidade({ canalProsioId: canal.canal.id });
  const supervisor = await criarSupervisor({ unidadeId: unidade.id });
  return { unidade, supervisor, auth: authHeader(supervisor) };
}

interface Linha {
  rota: string;
  codigo?: string;
  nome?: string;
  whatsapp?: string;
  carteiro?: string;
}

let seqFone = 0;
const fone = () => `(61) 9${String(81_000_000 + (seqFone += 1))}`;

/** Linha válida da rota, com WhatsApp. */
const linha = (rota: string, over: Partial<Linha> = {}): Linha => ({ rota, codigo: codigoS10(), nome: 'Pessoa Teste', whatsapp: fone(), ...over });

function csv(linhas: Linha[], comCarteiro = linhas.some((l) => l.carteiro !== undefined)): string {
  const cab = ['rota', ...(comCarteiro ? ['carteiro'] : []), 'codigo', 'nome', 'whatsapp', 'endereco'];
  const corpo = linhas.map((l) => [l.rota, ...(comCarteiro ? [l.carteiro ?? ''] : []), l.codigo ?? '', l.nome ?? '', l.whatsapp ?? '', 'QNA 12 Casa 1'].join(';'));
  return [cab.join(';'), ...corpo].join('\n');
}

const get = (url: string, auth: Record<string, string>) => request(app).get(url).set('Connection', 'close').set(auth);

function importar(
  c: { auth: Record<string, string> },
  conteudo: string,
  campos: { numero?: number; horario?: string | null; data?: string; unidadeId?: string; nome?: string } = {},
) {
  const r = request(app)
    .post(`/api/v1/entregas/saidas/importar${campos.unidadeId ? `?unidadeId=${campos.unidadeId}` : ''}`)
    .set('Connection', 'close')
    .set(c.auth)
    .field('numero', String(campos.numero ?? 1));
  if (campos.horario !== null) r.field('horario', campos.horario ?? '10:00');
  if (campos.data) r.field('data', campos.data);
  return r.attach('arquivo', Buffer.from(conteudo), { filename: campos.nome ?? 'saida-1.csv', contentType: 'text/csv' });
}

const pacotesDaRota = (unidadeId: string, codigo: string) =>
  prisma.pacoteDia.findMany({ where: { data: hoje, carga: { distrito: { unidadeId, codigo } } }, orderBy: { codigo: 'asc' } });

describe('entregas — saídas do dia', () => {
  beforeAll(async () => {
    await limparBanco();
    await entregasAvisoQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await entregasAvisoQueue.obliterate({ force: true });
    await encerrarRecursos();
  });

  describe('importação direta', () => {
    it('IT-074 grava as linhas válidas sem prévia e devolve "N aceitos, M descartados" com a lista das recusadas; WhatsApp malformado entra sem WhatsApp, sinalizado', async () => {
      const c = await cenario();
      const carteiro = await criarCarteiro({ unidadeId: c.unidade.id });
      await criarDistrito({ unidadeId: c.unidade.id, codigo: '501', carteiroPadraoId: carteiro.id });
      await criarDistrito({ unidadeId: c.unidade.id, codigo: '502', carteiroPadraoId: carteiro.id });
      const repetido = codigoS10();
      const linhas: Linha[] = [
        linha('501'), // linha 2
        linha('501', { whatsapp: '' }), // 3: sem WhatsApp, aceita
        linha('502'), // 4
        linha('502', { codigo: repetido }), // 5
        linha('502', { codigo: repetido, nome: 'Duplicada da Silva' }), // 6: duplicada
        linha('501', { codigo: 'AB123456789BR' }), // 7: dígito
        linha('501', { whatsapp: '98876-1102', nome: 'Sem DDD de Souza' }), // 8: WhatsApp sem DDD → aceita, sem WhatsApp
        linha('', { nome: 'Sem Rota Pereira' }), // 9: sem rota
        linha('502', { nome: '' }), // 10: faltam campos
      ];

      const res = await importar(c, csv(linhas), { nome: 'saida-1_30-09.csv' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({ aceitos: 5, descartados: 4, whatsappInvalidos: 1, reimportacao: false, rotas: 2, rotasCriadas: [], rotasSemCarteiro: [] }));
      expect(res.body.saida).toEqual(expect.objectContaining({ numero: 1, horario: '10:00', arquivoNome: 'saida-1_30-09.csv', aceitos: 5, descartados: 4 }));
      expect(res.body.descartes).toEqual([
        { n: 6, rota: '502', codigo: repetido, motivo: 'duplicado_planilha' },
        { n: 7, rota: '501', codigo: 'AB123456789BR', motivo: 'digito_invalido' },
        { n: 9, rota: null, codigo: linhas[7].codigo, motivo: 'sem_rota' },
        { n: 10, rota: '502', codigo: linhas[8].codigo, motivo: 'faltam_campos' },
      ]);

      // Gravado de fato, com o status de cada pacote.
      const p501 = await pacotesDaRota(c.unidade.id, '501');
      expect(p501.map((p) => p.status).sort()).toEqual(['AGUARDANDO_LIBERACAO', 'SEM_WHATSAPP', 'SEM_WHATSAPP']);
      // O pacote do número malformado ficou sem WhatsApp e com o sinal; o de WhatsApp vazio, sem sinal.
      const malformado = p501.find((p) => p.nome === 'Sem DDD de Souza')!;
      expect(malformado).toEqual(expect.objectContaining({ whatsappE164: null, status: 'SEM_WHATSAPP', sinais: ['whatsapp_invalido'] }));
      expect(p501.filter((p) => p.sinais.includes('whatsapp_invalido'))).toHaveLength(1);

      // Reimportar com o número corrigido tira o sinal e devolve o pacote à fila do aviso.
      const corrigidas = linhas.map((l, i) => (i === 6 ? { ...l, whatsapp: '(61) 98876-1102' } : l));
      const de_novo = await importar(c, csv(corrigidas), { nome: 'saida-1_30-09.csv' });
      expect(de_novo.body).toEqual(expect.objectContaining({ reimportacao: true, aceitos: 5, descartados: 4, whatsappInvalidos: 0 }));
      const depois = (await pacotesDaRota(c.unidade.id, '501')).find((p) => p.id === malformado.id)!;
      expect(depois).toEqual(expect.objectContaining({ status: 'AGUARDANDO_LIBERACAO', sinais: [] }));
      expect(depois.whatsappE164).toContain('61988761102');

      // O arquivo original de volta: o mesmo pacote perde o número e ganha o sinal de novo (sem repetir).
      await importar(c, csv(linhas), { nome: 'saida-1_30-09.csv' });
      const voltou = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: malformado.id } });
      expect(voltou).toEqual(expect.objectContaining({ whatsappE164: null, status: 'SEM_WHATSAPP', sinais: ['whatsapp_invalido'] }));

      // O supervisor corrige pela lista da rota: o sinal some.
      const edicao = await request(app).patch(`/api/v1/entregas/pacotes/${malformado.id}`).set('Connection', 'close').set(c.auth).send({ whatsapp: '(61) 98876-1102' });
      expect(edicao.status).toBe(200);
      const editado = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: malformado.id } });
      expect(editado).toEqual(expect.objectContaining({ status: 'AGUARDANDO_LIBERACAO', sinais: [] }));
      await importar(c, csv(linhas), { nome: 'saida-1_30-09.csv' });
      expect(await pacotesDaRota(c.unidade.id, '502')).toHaveLength(2);

      // O resumo persistido não guarda nome nem telefone.
      const saida = await prisma.saida.findFirstOrThrow({ where: { unidadeId: c.unidade.id, data: hoje, numero: 1 } });
      expect(saida).toEqual(expect.objectContaining({ aceitos: 5, descartados: 4, importadaPorId: c.supervisor.id }));
      const bruto = JSON.stringify(saida.descartes);
      expect(saida.descartes).toEqual(res.body.descartes);
      for (const proibido of ['Duplicada', 'Sem DDD', 'Sem Rota', '98876']) expect(bruto).not.toContain(proibido);
      for (const d of saida.descartes as Array<Record<string, unknown>>) {
        expect(Object.keys(d).every((k) => ['n', 'rota', 'codigo', 'motivo', 'detalhe'].includes(k))).toBe(true);
      }
    });

    it('IT-075 horário, arquivo, coluna `rota`, ordem das saídas e data passada são exigidos', async () => {
      const c = await cenario();
      const conteudo = csv([linha('601')]);

      const semHorario = await importar(c, conteudo, { horario: null });
      expect(semHorario.status).toBe(400);
      expect(semHorario.body).toEqual({ error: 'horario_obrigatorio', details: { mensagem: 'Confirme o horário da Saída 1 antes de importar.' } });
      const horarioRuim = await importar(c, conteudo, { horario: '25:00' });
      expect(horarioRuim.body.error).toBe('horario_obrigatorio');

      const semArquivo = await request(app).post('/api/v1/entregas/saidas/importar').set(c.auth).field('numero', '1').field('horario', '10:00');
      expect(semArquivo.status).toBe(400);
      expect(semArquivo.body.error).toBe('arquivo_ausente');

      const semRota = await importar(c, `codigo;nome\n${codigoS10()};Maria`);
      expect(semRota.status).toBe(400);
      expect(semRota.body).toEqual({ error: 'coluna_ausente', details: { coluna: 'rota' } });

      const pdf = await request(app).post('/api/v1/entregas/saidas/importar').set(c.auth).field('numero', '1').field('horario', '10:00')
        .attach('arquivo', Buffer.from('%PDF-1.4'), { filename: 'saida.pdf', contentType: 'application/pdf' });
      expect(pdf.status).toBe(415);

      const pulou = await importar(c, conteudo, { numero: 2 });
      expect(pulou.status).toBe(409);
      expect(pulou.body).toEqual({ error: 'saida_fora_de_ordem', details: { proxima: 1 } });

      const passado = await importar(c, conteudo, { data: formatarData(ontem) });
      expect(passado.status).toBe(409);
      expect(passado.body.error).toBe('somente_leitura');

      expect(await prisma.saida.count({ where: { unidadeId: c.unidade.id } })).toBe(0);
      expect(await prisma.distrito.count({ where: { unidadeId: c.unidade.id } })).toBe(0);
    });

    it('IT-076 rota do arquivo que não existe no Cadastro é criada ("Rota <código>"), sem carteiro', async () => {
      const c = await cenario();
      const res = await importar(c, csv([linha('701'), linha('701'), linha('d-9')]));
      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({ aceitos: 3, descartados: 0, rotasCriadas: ['701', 'D-9'], rotasSemCarteiro: ['701', 'D-9'] }));

      const rotas = await prisma.distrito.findMany({ where: { unidadeId: c.unidade.id }, orderBy: { codigo: 'asc' } });
      expect(rotas.map((r) => [r.codigo, r.nome, r.ativo, r.carteiroPadraoId])).toEqual([
        ['701', 'Rota 701', true, null],
        ['D-9', 'Rota D-9', true, null],
      ]);

      // Rota desativada no Cadastro não recebe pacote nem é recriada.
      await prisma.distrito.update({ where: { id: rotas[0].id }, data: { ativo: false } });
      const c2 = await importar(c, csv([linha('701'), linha('702')]), { numero: 2, horario: '14:00' });
      expect(c2.body).toEqual(expect.objectContaining({ aceitos: 1, descartados: 1 }));
      expect(c2.body.descartes[0]).toEqual(expect.objectContaining({ rota: '701', motivo: 'rota_inativa' }));
    });

    it('IT-077 carteiro da rota em três níveis: coluna `carteiro` → padrão do Cadastro → sem carteiro', async () => {
      const c = await cenario();
      const padrao = await criarCarteiro({ unidadeId: c.unidade.id, nome: 'Renato Alves Costa' });
      const doArquivo = await criarCarteiro({ unidadeId: c.unidade.id, nome: 'Patrícia Nunes', matricula: '83015520' });
      const porNome = await criarCarteiro({ unidadeId: c.unidade.id, nome: 'Diego Carvalho' });
      const deOutraUnidade = await criarCarteiro({ unidadeId: (await criarUnidade()).id, nome: 'Fora da Unidade' });
      const r801 = await criarDistrito({ unidadeId: c.unidade.id, codigo: '801', carteiroPadraoId: padrao.id });
      const r802 = await criarDistrito({ unidadeId: c.unidade.id, codigo: '802', carteiroPadraoId: padrao.id });
      const r803 = await criarDistrito({ unidadeId: c.unidade.id, codigo: '803', carteiroPadraoId: padrao.id });

      const res = await importar(c, csv([
        linha('801', { carteiro: '8.301.552-0' }), // matrícula com máscara
        linha('802', { carteiro: '' }), // sem valor: fica o padrão
        linha('803', { carteiro: deOutraUnidade.nome! }), // não casa: fica o padrão e avisa
        linha('804', { carteiro: 'diego carvalho' }), // rota nova, casada pelo nome
        linha('805', { carteiro: '' }), // rota nova, sem carteiro
      ]));
      expect(res.status).toBe(201);
      expect(res.body.rotasSemCarteiro).toEqual(['805']);
      expect(res.body.carteirosNaoEncontrados).toEqual([{ rota: '803', valor: 'Fora da Unidade' }]);

      const escalas = await prisma.escalaDistrito.findMany({ where: { data: hoje, distrito: { unidadeId: c.unidade.id } }, include: { distrito: true } });
      expect(escalas.map((e) => [e.distrito.codigo, e.carteiroId]).sort()).toEqual([['801', doArquivo.id], ['804', porNome.id]]);
      // O padrão do Cadastro não muda.
      for (const d of [r801, r802, r803]) {
        expect((await prisma.distrito.findUniqueOrThrow({ where: { id: d.id } })).carteiroPadraoId).toBe(padrao.id);
      }

      const lista = await get('/api/v1/entregas/saidas', c.auth);
      const carteiroDe = Object.fromEntries(lista.body.rotas.map((r: { codigo: string; carteiro: { nome: string } | null; semCarteiro: boolean }) => [r.codigo, r.carteiro?.nome ?? null]));
      expect(carteiroDe).toEqual({ 801: 'Patrícia Nunes', 802: 'Renato Alves Costa', 803: 'Renato Alves Costa', 804: 'Diego Carvalho', 805: null });
    });
  });

  describe('reimportação', () => {
    it('IT-078 substitui só as rotas não liberadas; a liberada fica intocada e as linhas dela são recusadas', async () => {
      const c = await cenario();
      const carteiro = await criarCarteiro({ unidadeId: c.unidade.id });
      for (const codigo of ['901', '902', '903']) await criarDistrito({ unidadeId: c.unidade.id, codigo, carteiroPadraoId: carteiro.id });
      const fica = linha('901', { nome: 'Fica Igual' });
      const muda = linha('901', { nome: 'Nome Antigo', whatsapp: '' });
      const sai = linha('901', { nome: 'Sai do Arquivo' });
      const migra = linha('903', { nome: 'Muda de Rota' });
      const liberada = [linha('902'), linha('902')];
      const primeira = await importar(c, csv([fica, muda, sai, migra, ...liberada]), { horario: '10:00' });
      expect(primeira.body).toEqual(expect.objectContaining({ aceitos: 6, descartados: 0, rotas: 3 }));

      const antes901 = await pacotesDaRota(c.unidade.id, '901');
      const idDe = (codigo: string) => antes901.find((p) => p.codigo === codigo)!.id;
      // Uma orientação presa ao pacote sobrevive à reimportação (o pacote é atualizado, não recriado).
      await prisma.orientacao.create({ data: { codigo: fica.codigo!, pacoteId: idDe(fica.codigo!), tipo: 'MANUAL', texto: 'Tocar o interfone', estado: 'GUARDADA', origem: 'SUPERVISOR' } });

      const carga902 = await prisma.cargaDistrito.findFirstOrThrow({ where: { data: hoje, distrito: { unidadeId: c.unidade.id, codigo: '902' } } });
      const lib = await request(app).post(`/api/v1/entregas/cargas/${carga902.id}/liberar`).set(c.auth).send({});
      expect(lib.status).toBe(202);
      const antes902 = await pacotesDaRota(c.unidade.id, '902');

      const nova = linha('901', { nome: 'Nova da Reimportação' });
      const res = await importar(c, csv([
        fica,
        { ...muda, nome: 'Nome Novo', whatsapp: '(61) 99812-4412' },
        nova,
        { ...migra, rota: '901' },
        linha('902', { nome: 'Tentativa na Liberada' }),
        liberada[0],
      ]), { horario: '11:30', nome: 'saida-1-v2.csv' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({ reimportacao: true, aceitos: 4, descartados: 2, rotasLiberadas: ['902'] }));
      expect(res.body.descartes).toEqual([
        expect.objectContaining({ n: 6, rota: '902', motivo: 'rota_liberada' }),
        expect.objectContaining({ n: 7, rota: '902', motivo: 'rota_liberada', codigo: liberada[0].codigo }),
      ]);
      expect(res.body.saida).toEqual(expect.objectContaining({ horario: '11:30', arquivoNome: 'saida-1-v2.csv' }));
      expect(await prisma.saida.count({ where: { unidadeId: c.unidade.id, data: hoje } })).toBe(1);

      const depois901 = await pacotesDaRota(c.unidade.id, '901');
      expect(depois901.map((p) => p.codigo).sort()).toEqual([fica.codigo, muda.codigo, nova.codigo, migra.codigo].sort());
      const mudou = depois901.find((p) => p.codigo === muda.codigo)!;
      expect(mudou).toEqual(expect.objectContaining({ id: idDe(muda.codigo!), nome: 'Nome Novo', whatsappE164: '+5561998124412', status: 'AGUARDANDO_LIBERACAO' }));
      expect(depois901.find((p) => p.codigo === fica.codigo)!.id).toBe(idDe(fica.codigo!));
      expect(await prisma.orientacao.count({ where: { pacoteId: idDe(fica.codigo!) } })).toBe(1);
      expect(await prisma.pacoteDia.count({ where: { codigo: sai.codigo!, data: hoje } })).toBe(0);
      // A rota 903 ficou sem pacote e saiu da saída.
      expect(await prisma.cargaDistrito.count({ where: { data: hoje, distrito: { unidadeId: c.unidade.id, codigo: '903' } } })).toBe(0);

      // A rota liberada não mudou em nada.
      const depois902 = await pacotesDaRota(c.unidade.id, '902');
      expect(depois902.map((p) => [p.id, p.nome, p.status])).toEqual(antes902.map((p) => [p.id, p.nome, p.status]));
      expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: carga902.id } })).status).toBe('LIBERADO');
    });

    it('IT-079 rota já carregada em outra saída do dia e rota com mais de 500 linhas: linhas recusadas com o motivo', async () => {
      const c = await cenario();
      await importar(c, csv([linha('1001'), linha('1002')]));

      const segunda = await importar(c, csv([linha('1001'), linha('1003')]), { numero: 2, horario: '14:00' });
      expect(segunda.status).toBe(201);
      expect(segunda.body).toEqual(expect.objectContaining({ aceitos: 1, descartados: 1, rotas: 1 }));
      expect(segunda.body.descartes).toEqual([expect.objectContaining({ n: 2, rota: '1001', motivo: 'rota_em_outra_saida', detalhe: '1' })]);
      expect(await pacotesDaRota(c.unidade.id, '1001')).toHaveLength(1);

      const d = await cenario();
      const muitas = Array.from({ length: 502 }, () => linha('2001'));
      const res = await importar(d, csv([...muitas, linha('2002')]));
      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({ aceitos: 501, descartados: 2 }));
      expect(res.body.descartes.map((x: { n: number; motivo: string; rota: string }) => [x.n, x.rota, x.motivo])).toEqual([
        [502, '2001', 'limite_rota'],
        [503, '2001', 'limite_rota'],
      ]);
      expect(await pacotesDaRota(d.unidade.id, '2001')).toHaveLength(500);
    }, 30_000);

    it('IT-080 carga sem saída (captura do rótulo) é adotada pela saída; o pacote conferido pela foto é mantido', async () => {
      const c = await cenario();
      const carteiro = await criarCarteiro({ unidadeId: c.unidade.id });
      const rota = await criarDistrito({ unidadeId: c.unidade.id, codigo: '3001', carteiroPadraoId: carteiro.id });
      const outra = await criarDistrito({ unidadeId: c.unidade.id, codigo: '3002', carteiroPadraoId: carteiro.id });
      const carga = await criarCarga({ distritoId: rota.id, data: hoje });
      const cargaOutra = await criarCarga({ distritoId: outra.id, data: hoje });
      const foto = await pacoteCapturado({ cargaId: carga.id, capturadoPorId: carteiro.id, nome: 'Lido do Rótulo' });
      const fotoOutra = await pacoteCapturado({ cargaId: cargaOutra.id, capturadoPorId: carteiro.id });

      // Antes da importação: aparece na aba "Sem saída".
      const antes = await get('/api/v1/entregas/saidas', c.auth);
      expect(antes.body.saidas).toEqual([]);
      expect(antes.body.proximaSaida).toBe(1);
      expect(antes.body.rotas.map((r: { codigo: string; saidaNumero: number | null }) => [r.codigo, r.saidaNumero])).toEqual([['3001', null], ['3002', null]]);

      const res = await importar(c, csv([
        linha('3001', { codigo: foto.codigo, nome: 'Nome da Planilha' }),
        linha('3001'),
        linha('3001', { codigo: fotoOutra.codigo }),
      ]));
      expect(res.body).toEqual(expect.objectContaining({ aceitos: 2, descartados: 1 }));
      expect(res.body.descartes).toEqual([{ n: 4, rota: '3001', codigo: fotoOutra.codigo, motivo: 'ja_no_distrito', detalhe: '3002' }]);

      const adotada = await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: carga.id }, include: { saida: true } });
      expect(adotada.saida?.numero).toBe(1);
      const mantido = await prisma.pacoteDia.findUniqueOrThrow({ where: { id: foto.id } });
      expect(mantido).toEqual(expect.objectContaining({ nome: 'Lido do Rótulo', origem: 'FOTO', cargaId: carga.id }));

      const depois = await get('/api/v1/entregas/saidas', c.auth);
      expect(depois.body.rotas.map((r: { codigo: string; saidaNumero: number | null; total: number }) => [r.codigo, r.saidaNumero, r.total])).toEqual([['3001', 1, 2], ['3002', null, 1]]);
    });
  });

  describe('escopo por unidade', () => {
    it('IT-081 supervisor fica na própria unidade; a Gestão escolhe uma unidade para importar', async () => {
      const a = await cenario();
      const b = await cenario();
      const gestor = { auth: authHeader(await criarGestor()) };
      const conteudo = () => csv([linha('4001')]);

      // Supervisor: outra unidade → 404, nada gravado; a própria (explícita ou não) → 201.
      const alheia = await importar(a, conteudo(), { unidadeId: b.unidade.id });
      expect(alheia.status).toBe(404);
      expect(await prisma.saida.count({ where: { unidadeId: b.unidade.id } })).toBe(0);
      expect((await importar(a, conteudo(), { unidadeId: a.unidade.id })).status).toBe(201);

      // Gestão: sem unidade (ou "todas") não importa; com a unidade, importa nela.
      const semUnidade = await importar(gestor, conteudo());
      expect(semUnidade.status).toBe(400);
      expect(semUnidade.body.error).toBe('unidade_obrigatoria');
      expect((await importar(gestor, conteudo(), { unidadeId: 'todas' })).body.error).toBe('unidade_obrigatoria');
      const naB = await importar(gestor, conteudo(), { unidadeId: b.unidade.id });
      expect(naB.status).toBe(201);
      expect(naB.body.saida.unidadeId).toBe(b.unidade.id);
      expect(await prisma.distrito.count({ where: { unidadeId: b.unidade.id, codigo: '4001' } })).toBe(1);

      // Outros papéis não entram.
      const carteiro = await prisma.usuario.create({ data: { nome: 'Carteiro', role: 'CARTEIRO', senha: 'x', unidadeId: a.unidade.id } });
      expect((await importar({ auth: authHeader(carteiro) }, conteudo())).status).toBe(403);
      expect((await get('/api/v1/entregas/saidas', authHeader(carteiro))).status).toBe(403);
    });

    it('IT-082 listagem: supervisor vê só a sua unidade (com os descartes); Gestão vê todas juntas, sem os descartes', async () => {
      await limparBanco();
      const a = await cenario();
      const b = await cenario();
      const gestor = authHeader(await criarGestor());
      await importar(a, csv([linha('5001'), linha('5002'), linha('5002', { nome: '' })]), { horario: '10:00' });
      await importar(a, csv([linha('5003')]), { numero: 2, horario: '14:00' });
      await importar(b, csv([linha('5001')]), { horario: '09:30' });
      // Rota do Cadastro sem carga no dia não aparece.
      await criarDistrito({ unidadeId: a.unidade.id, codigo: '5999' });

      const daA = await get('/api/v1/entregas/saidas', a.auth);
      expect(daA.status).toBe(200);
      expect(daA.body).toEqual(expect.objectContaining({ data: formatarData(hoje), somenteLeitura: false, agregado: false, proximaSaida: 3 }));
      expect(daA.body.unidade).toEqual({ id: a.unidade.id, nome: a.unidade.nome });
      expect(daA.body.saidas.map((s: { numero: number; horario: string; aceitos: number; descartados: number }) => [s.numero, s.horario, s.aceitos, s.descartados])).toEqual([[1, '10:00', 2, 1], [2, '14:00', 1, 0]]);
      expect(daA.body.saidas[0].descartes).toEqual([expect.objectContaining({ n: 4, rota: '5002', motivo: 'faltam_campos' })]);
      expect(daA.body.rotas.map((r: { codigo: string; saidaNumero: number; status: string; total: number; comWhatsapp: number }) => [r.codigo, r.saidaNumero, r.status, r.total, r.comWhatsapp])).toEqual([
        ['5001', 1, 'DADOS_CARREGADOS', 1, 1],
        ['5002', 1, 'DADOS_CARREGADOS', 1, 1],
        ['5003', 2, 'DADOS_CARREGADOS', 1, 1],
      ]);
      expect(daA.body.rotas.every((r: { unidade: { id: string } }) => r.unidade.id === a.unidade.id)).toBe(true);

      // Supervisor pedindo outra unidade (ou "todas") → 404.
      expect((await get(`/api/v1/entregas/saidas?unidadeId=${b.unidade.id}`, a.auth)).status).toBe(404);
      expect((await get('/api/v1/entregas/saidas?unidadeId=todas', a.auth)).status).toBe(404);

      for (const url of ['/api/v1/entregas/saidas', '/api/v1/entregas/saidas?unidadeId=todas']) {
        const todas = await get(url, gestor);
        expect(todas.status).toBe(200);
        expect(todas.body).toEqual(expect.objectContaining({ agregado: true, unidade: null, proximaSaida: 3 }));
        expect(todas.body.saidas).toHaveLength(3);
        expect(todas.body.saidas.every((s: Record<string, unknown>) => !('descartes' in s))).toBe(true);
        expect(todas.body.rotas).toHaveLength(4);
        expect(new Set(todas.body.rotas.map((r: { unidade: { id: string } }) => r.unidade.id))).toEqual(new Set([a.unidade.id, b.unidade.id]));
      }

      const soB = await get(`/api/v1/entregas/saidas?unidadeId=${b.unidade.id}`, gestor);
      expect(soB.body).toEqual(expect.objectContaining({ agregado: false, proximaSaida: 2 }));
      expect(soB.body.rotas).toHaveLength(1);

      // Data anterior: só consulta.
      const passado = await get(`/api/v1/entregas/saidas?data=${formatarData(ontem)}`, a.auth);
      expect(passado.body).toEqual(expect.objectContaining({ somenteLeitura: true, saidas: [], rotas: [], proximaSaida: 1 }));
    });
  });

  describe('liberação em lote', () => {
    it('IT-083 libera as rotas pedidas uma a uma e devolve o resultado de cada; repetir não reenvia', async () => {
      const c = await cenario();
      const outra = await cenario();
      const carteiro = await criarCarteiro({ unidadeId: c.unidade.id });
      await criarDistrito({ unidadeId: c.unidade.id, codigo: '6001', carteiroPadraoId: carteiro.id });
      await criarDistrito({ unidadeId: c.unidade.id, codigo: '6002', carteiroPadraoId: carteiro.id });
      await criarDistrito({ unidadeId: c.unidade.id, codigo: '6004', carteiroPadraoId: carteiro.id });
      await importar(c, csv([
        linha('6001'), linha('6001'), linha('6001', { whatsapp: '' }),
        linha('6002'),
        linha('6003'), // rota nova: sem carteiro
        linha('6004', { whatsapp: '' }), // ninguém a avisar: exige a confirmação individual
      ]));
      const deOutra = await criarCarga({ distritoId: (await criarDistrito({ unidadeId: outra.unidade.id })).id, data: hoje });
      await criarPacote({ cargaId: deOutra.id });

      const cargas = await prisma.cargaDistrito.findMany({ where: { data: hoje, distrito: { unidadeId: c.unidade.id } }, include: { distrito: true } });
      const idDe = Object.fromEntries(cargas.map((x) => [x.distrito.codigo, x.id]));
      const liberar = (auth: Record<string, string>, cargaIds: string[]) =>
        request(app).post('/api/v1/entregas/saidas/liberar').set('Connection', 'close').set(auth).send({ cargaIds });

      const res = await liberar(c.auth, [idDe['6001'], idDe['6002'], idDe['6003'], idDe['6004'], deOutra.id]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ liberadas: 2, falhas: 3, avisosAgendados: 3 }));
      expect(res.body.resultados).toEqual([
        expect.objectContaining({ rota: '6001', cargaId: idDe['6001'], ok: true, avisosAgendados: 2, semWhatsapp: 1 }),
        expect.objectContaining({ rota: '6002', ok: true, avisosAgendados: 1 }),
        { rota: '6003', cargaId: idDe['6003'], ok: false, erro: 'sem_carteiro' },
        { rota: '6004', cargaId: idDe['6004'], ok: false, erro: 'nenhum_destinatario' },
        { rota: null, cargaId: deOutra.id, ok: false, erro: 'nao_encontrado' },
      ]);

      const status = async (codigo: string) => (await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: idDe[codigo] } })).status;
      expect([await status('6001'), await status('6002'), await status('6003'), await status('6004')]).toEqual(['LIBERADO', 'LIBERADO', 'CARREGADO', 'CARREGADO']);
      expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: deOutra.id } })).status).toBe('CARREGADO');
      expect((await prisma.cargaDistrito.findUniqueOrThrow({ where: { id: idDe['6001'] } }))).toEqual(expect.objectContaining({ carteiroId: carteiro.id, liberadoPorId: c.supervisor.id }));
      expect(await prisma.pacoteDia.count({ where: { cargaId: { in: [idDe['6001'], idDe['6002']] }, status: 'AGENDADO' } })).toBe(3);

      // Idempotente: de novo, nada é enfileirado outra vez.
      const jobsAntes = await entregasAvisoQueue.getJobCountByTypes('waiting', 'delayed', 'active', 'completed');
      const denovo = await liberar(c.auth, [idDe['6001'], idDe['6002']]);
      expect(denovo.body).toEqual(expect.objectContaining({ liberadas: 2, falhas: 0, avisosAgendados: 0 }));
      expect(denovo.body.resultados.every((r: { jaLiberada?: boolean }) => r.jaLiberada === true)).toBe(true);
      expect(await entregasAvisoQueue.getJobCountByTypes('waiting', 'delayed', 'active', 'completed')).toBe(jobsAntes);

      // Só o supervisor libera; corpo inválido → 400.
      expect((await liberar(authHeader(await criarGestor()), [idDe['6003']])).status).toBe(403);
      expect((await liberar(c.auth, [])).status).toBe(400);
    });
  });

  describe('carteiros das rotas', () => {
    it('IT-084 PUT /saidas/carteiros define o carteiro do dia e, se pedido, o padrão da rota', async () => {
      const c = await cenario();
      const ana = await criarCarteiro({ unidadeId: c.unidade.id, nome: 'Ana Dias' });
      const beto = await criarCarteiro({ unidadeId: c.unidade.id, nome: 'Beto Reis' });
      const inativo = await criarCarteiro({ unidadeId: c.unidade.id, ativo: false });
      const res0 = await importar(c, csv([linha('7001'), linha('7002'), linha('7003')]));
      expect(res0.body.rotasSemCarteiro).toEqual(['7001', '7002', '7003']);
      const rotas = await prisma.distrito.findMany({ where: { unidadeId: c.unidade.id } });
      const idDe = Object.fromEntries(rotas.map((r) => [r.codigo, r.id]));
      const alheia = await criarDistrito({ unidadeId: (await criarUnidade()).id });

      const res = await request(app).put('/api/v1/entregas/saidas/carteiros').set(c.auth).send({
        atribuicoes: [
          { distritoId: idDe['7001'], carteiroId: ana.id },
          { distritoId: idDe['7002'], carteiroId: beto.id, definirPadrao: true },
          { distritoId: idDe['7003'], carteiroId: inativo.id },
          { distritoId: alheia.id, carteiroId: ana.id },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ atribuidas: 2, falhas: 2 }));
      expect(res.body.resultados).toEqual([
        { distritoId: idDe['7001'], rota: '7001', ok: true, carteiro: { id: ana.id, nome: 'Ana Dias' } },
        { distritoId: idDe['7002'], rota: '7002', ok: true, carteiro: { id: beto.id, nome: 'Beto Reis' } },
        { distritoId: idDe['7003'], rota: '7003', ok: false, erro: 'carteiro_inativo' },
        { distritoId: alheia.id, rota: null, ok: false, erro: 'nao_encontrado' },
      ]);

      const depois = await prisma.distrito.findMany({ where: { unidadeId: c.unidade.id }, orderBy: { codigo: 'asc' }, include: { escalas: { where: { data: hoje } } } });
      expect(depois.map((d) => [d.codigo, d.carteiroPadraoId, d.escalas[0]?.carteiroId ?? null])).toEqual([
        ['7001', null, ana.id],
        ['7002', beto.id, beto.id],
        ['7003', null, null],
      ]);
      const lista = await get('/api/v1/entregas/saidas', c.auth);
      expect(lista.body.rotas.map((r: { codigo: string; semCarteiro: boolean }) => [r.codigo, r.semCarteiro])).toEqual([['7001', false], ['7002', false], ['7003', true]]);

      // Gestão atribui na unidade escolhida; sem unidade → 400.
      const gestor = authHeader(await criarGestor());
      const corpo = { atribuicoes: [{ distritoId: idDe['7003'], carteiroId: ana.id }] };
      expect((await request(app).put('/api/v1/entregas/saidas/carteiros').set(gestor).send(corpo)).status).toBe(400);
      const comUnidade = await request(app).put(`/api/v1/entregas/saidas/carteiros?unidadeId=${c.unidade.id}`).set(gestor).send(corpo);
      expect(comUnidade.body).toEqual(expect.objectContaining({ atribuidas: 1, falhas: 0 }));
    });
  });

  describe('compatibilidade', () => {
    it('IT-085 a lista por rota (prévia/confirmar) e o quadro antigo continuam funcionando ao lado das saídas', async () => {
      const c = await cenario();
      const carteiro = await criarCarteiro({ unidadeId: c.unidade.id });
      const rota = await criarDistrito({ unidadeId: c.unidade.id, codigo: '8001', carteiroPadraoId: carteiro.id });
      await importar(c, csv([linha('8001')]));

      const confirmar = await request(app).post(`/api/v1/entregas/cargas/${rota.id}/confirmar`).set(c.auth)
        .send({ linhas: [{ n: 1, codigo: codigoS10(), nome: 'Adicionado na Rota', whatsapp: '(61) 99812-0001' }] });
      expect(confirmar.status).toBe(200);
      expect(confirmar.body).toEqual(expect.objectContaining({ aceitos: 1, descartados: 0 }));

      const quadro = await get('/api/v1/entregas/quadro', c.auth);
      expect(quadro.status).toBe(200);
      expect(quadro.body.distritos).toHaveLength(1);
      expect(quadro.body.distritos[0]).toEqual(expect.objectContaining({ codigo: '8001', total: 2, status: 'DADOS_CARREGADOS' }));
      expect(quadro.body.distritos[0]).not.toHaveProperty('saidaNumero');

      const lista = await get('/api/v1/entregas/saidas', c.auth);
      expect(lista.body.rotas[0]).toEqual(expect.objectContaining({ codigo: '8001', saidaNumero: 1, total: 2 }));
    });

    it('IT-086 duas importações simultâneas da mesma saída não duplicam a saída nem os pacotes', async () => {
      const c = await cenario();
      const linhas = Array.from({ length: 30 }, () => linha('9001'));
      const [a, b] = await Promise.all([importar(c, csv(linhas)), importar(c, csv(linhas))]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect([a.body.reimportacao, b.body.reimportacao].sort()).toEqual([false, true]);
      expect(await prisma.saida.count({ where: { unidadeId: c.unidade.id, data: hoje } })).toBe(1);
      expect(await pacotesDaRota(c.unidade.id, '9001')).toHaveLength(30);
      expect(await prisma.cargaDistrito.count({ where: { data: hoje, distrito: { unidadeId: c.unidade.id } } })).toBe(1);
    });
  });
});
