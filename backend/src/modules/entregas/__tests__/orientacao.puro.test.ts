/**
 * Unitários sem banco: calendário (UT-061, UT-062), mapeamento do desfecho
 * (UT-071–UT-074, UT-093, UT-096), textos (UT-094 e a regra "sem link/pix/
 * pagamento"), decisões das ações (UT-063–UT-070) e seleção do rastreio (UT-099).
 */
import { formatarDiaDeEntrega, formatarHora, proximoDiaDeEntrega } from '../calendario';
import { mapearDesfecho } from '../desfecho.mapper';
import {
  BOTOES_SIM_NAO,
  botoesMotivos,
  botoesOrientacaoCarteiro,
  botoesSubLista,
  corpoSubLista,
  limitarTexto,
  mensagemNaoTentarHoje,
  mensagemOrientacaoCarteiro,
  removerDadosSensiveis,
  textoOrientacaoAmanha,
  textoOrientacaoPonto,
  textoOrientacaoVizinho,
  textosCarteiro,
  textosDestinatario,
  type PontoTexto,
} from '../textos';
import { decidirOpcao, decidirPonto, decidirRespostaTardia, type EntradaOpcao } from '../acoes.service';
import { deveConsultar, selecionarParaConsulta } from '../rastreio.service';
import type { ResultadoRastreio } from '../../../integrations/seu-rastreio/rastreio.client';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Instante a partir da hora de Brasília (UTC−3). */
const brasilia = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00.000-03:00`);

const LOCKER: PontoTexto = { id: '11111111-1111-4111-8111-111111111111', tipo: 'LOCKER', nome: 'Locker Shopping', endereco: 'SCS Q. 1, loja 10', horario: '8h às 22h' };
const AGENCIA: PontoTexto = { id: '22222222-2222-4222-8222-222222222222', tipo: 'AGENCIA', nome: 'AC Taguatinga', endereco: 'QNA 30, lote 5', horario: '9h às 17h' };

describe('Calendário', () => {
  it('UT-061 sexta 2026-10-02 → segunda 2026-10-05', () => {
    expect(proximoDiaDeEntrega(dia('2026-10-02')).toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('UT-062 quinta 2026-10-01 → 2026-10-02', () => {
    expect(proximoDiaDeEntrega(dia('2026-10-01')).toISOString().slice(0, 10)).toBe('2026-10-02');
    expect(formatarDiaDeEntrega(dia('2026-10-02'))).toBe('sexta-feira (02/10)');
  });

  it('formata a hora de Brasília', () => {
    expect(formatarHora(brasilia('2026-09-30', '11:20'))).toBe('11h20');
    expect(formatarHora(brasilia('2026-09-30', '10:05'))).toBe('10h05');
    expect(formatarHora(new Date('2026-09-30T21:00:00Z'))).toBe('18h');
  });
});

describe('Mapeamento do desfecho da mediação', () => {
  const agora = brasilia('2026-09-30', '14:00');

  it('UT-071 entrega_indireta com local → VIZINHO "Deixar com Dona Célia, casa 47"', () => {
    const r = mapearDesfecho({ disposition: 'decidido', outcome: { motivo: 'entrega_indireta', condicao: { local: 'Dona Célia, casa 47' } } as never }, agora);
    expect(r).toEqual({
      acao: 'orientacao',
      orientacao: expect.objectContaining({ tipo: 'VIZINHO', texto: 'Deixar com Dona Célia, casa 47', origem: 'MEDIACAO', vizinhoNome: 'Dona Célia', vizinhoCasa: 'casa 47' }),
    });
  });

  it('UT-072 outro com local e "até" hoje → OUTRA "Deixar na portaria com o Seu João; até 18h"', () => {
    const r = mapearDesfecho({ disposition: 'decidido', outcome: { motivo: 'outro', condicao: { local: 'portaria com o Seu João', ate: '2026-09-30T21:00:00Z' } } as never }, agora);
    expect(r).toEqual({ acao: 'orientacao', orientacao: expect.objectContaining({ tipo: 'OUTRA', texto: 'Deixar na portaria com o Seu João; até 18h' }) });
  });

  it('UT-073 disposition proposto → nenhuma orientação', () => {
    expect(mapearDesfecho({ disposition: 'proposto', outcome: { motivo: 'entrega_indireta', condicao: { local: 'Zé' } } as never }, agora)).toEqual({ acao: 'proposto' });
  });

  it('UT-074 motivo desconhecido "cachorro" → OUTRA', () => {
    const r = mapearDesfecho({ disposition: 'decidido', outcome: { motivo: 'cachorro', condicao: { local: 'com o porteiro Zé' } } as never }, agora);
    expect(r).toEqual({ acao: 'orientacao', orientacao: expect.objectContaining({ tipo: 'OUTRA', texto: 'Deixar com o porteiro Zé' }) });
  });

  it('reagendamento → OUTRA; destinatario_ausente com "até" de outro dia → AMANHA guardada', () => {
    const r1 = mapearDesfecho({ disposition: 'decidido', outcome: { motivo: 'reagendamento', condicao: {} } as never }, agora);
    expect(r1).toEqual({ acao: 'orientacao', orientacao: expect.objectContaining({ tipo: 'OUTRA' }) });
    const r2 = mapearDesfecho({ disposition: 'decidido', outcome: { motivo: 'destinatario_ausente', condicao: { ate: '2026-10-01T15:00:00Z' } } as never }, agora);
    expect(r2).toEqual({ acao: 'orientacao', orientacao: expect.objectContaining({ tipo: 'AMANHA', valeParaAmanha: true }) });
  });

  it.each([
    ['CPF 123.456.789-09', 'Dona Célia, casa 47, CPF 123.456.789-09'],
    ['telefone 61 99999-0000', 'Dona Célia, casa 47, fone 61 99999-0000'],
  ])('UT-093 %s no local → texto ao carteiro com [removido]', (_nome, local) => {
    const r = mapearDesfecho({ disposition: 'decidido', outcome: { motivo: 'entrega_indireta', condicao: { local } } as never }, agora);
    if (r.acao !== 'orientacao') throw new Error('esperava orientação');
    expect(r.orientacao.texto).toContain('[removido]');
    expect(r.orientacao.texto).not.toMatch(/123\.456|99999/);
    expect(removerDadosSensiveis('ligue (61) 98812-4412 ou 61999990000, mail a@b.com')).toBe('ligue [removido] ou [removido], mail [removido]');
    expect(textoOrientacaoVizinho('Zé', 'apto 302, CPF 12345678909')).toBe('Deixar com Zé, apto 302, CPF [removido]');
  });

  it('UT-096 desfecho com 1200 caracteres → orientação com 300, terminando em reticências', () => {
    const local = `portaria ${'muito longa '.repeat(100)}`.slice(0, 1200);
    const r = mapearDesfecho({ disposition: 'decidido', outcome: { motivo: 'outro', condicao: { local } } as never }, agora);
    if (r.acao !== 'orientacao') throw new Error('esperava orientação');
    expect(r.orientacao.texto).toHaveLength(300);
    expect(r.orientacao.texto.endsWith('…')).toBe(true);
    expect(limitarTexto('curto')).toBe('curto');
  });
});

describe('Textos', () => {
  it('UT-094 orientação LOCKER → confirmação ao destinatário com nome, endereço e horário', () => {
    const t = textosDestinatario.confirmacaoPonto(LOCKER);
    expect(t).toContain('Locker Shopping');
    expect(t).toContain('SCS Q. 1, loja 10');
    expect(t).toContain('8h às 22h');
    expect(textoOrientacaoPonto(LOCKER)).toBe('Deixar no locker Locker Shopping (SCS Q. 1, loja 10)');
  });

  it('mensagem ao carteiro: código, primeiro nome, orientação e "ATUALIZADA:" quando substitui', () => {
    const m = mensagemOrientacaoCarteiro({ codigo: 'OY526018152BR', nomeDestinatario: 'MARIA DA SILVA', texto: 'Deixar com Zé', atualizada: true });
    expect(m.startsWith('ATUALIZADA:')).toBe(true);
    expect(m).toContain('OY526018152BR');
    expect(m).toContain('Maria');
    expect(m).not.toContain('SILVA');
    expect(botoesOrientacaoCarteiro('x').map((b) => b.id)).toEqual(['CE_CT:x.VI', 'CE_CT:x.FEITO', 'CE_CT:x.NAO']);
  });

  const geradores: Array<[string, string]> = [
    ['aviso amanhã', textosDestinatario.confirmacaoAmanha(dia('2026-10-02'))],
    ['limite', textosDestinatario.limiteTentativas('OY526018152BR')],
    ['atendimento', textosDestinatario.atendimentoHumano],
    ['vizinho', textosDestinatario.perguntaVizinho],
    ['outra', textosDestinatario.perguntaOutra],
    ['sub-lista', corpoSubLista('AGENCIA', [AGENCIA, { ...AGENCIA, nome: 'AC Centro' }])],
    ['ponto único', textosDestinatario.confirmarPontoUnico(AGENCIA)],
    ['confirmação ponto', textosDestinatario.confirmacaoPonto(LOCKER)],
    ['tardia', textosDestinatario.tentativaSemSucesso('11h20', 'Deixar com Zé')],
    ['guardada', textosDestinatario.guardadaParaAmanha(dia('2026-10-02'))],
    ['entregue', textosDestinatario.entregueAs('10h05')],
    ['locker fechado', textosDestinatario.lockerFechado('OY526018152BR', 'Locker Shopping')],
    ['neutra', textosDestinatario.neutra],
    ['ponto indisponível', textosDestinatario.pontoIndisponivel('LOCKER')],
    ['carteiro', mensagemOrientacaoCarteiro({ codigo: 'OY526018152BR', nomeDestinatario: 'Ana', texto: 'x', atualizada: false })],
    ['não tentar hoje', mensagemNaoTentarHoje({ codigo: 'OY526018152BR', nomeDestinatario: 'Ana', atualizada: false, dia: dia('2026-10-02') })],
    ['amanhã (texto)', textoOrientacaoAmanha(dia('2026-10-02'))],
    ['motivo', textosCarteiro.naoFoiPossivel('FECHADO')],
    ...(Object.entries(textosCarteiro) as Array<[string, unknown]>).filter((e): e is [string, string] => typeof e[1] === 'string'),
  ];

  it.each(geradores)('nenhum texto gerado (%s) contém http, pix ou pagamento', (_nome, texto) => {
    expect(texto.toLowerCase()).not.toMatch(/http|pix|pagamento/);
  });

  it('botões dentro dos limites do Prosio (id ≤ 200, texto ≤ 60, até 10)', () => {
    const botoes = [
      ...botoesSubLista('33333333-3333-4333-8333-333333333333', Array.from({ length: 12 }, (_, i) => ({ ...AGENCIA, id: `${AGENCIA.id.slice(0, -2)}${String(i).padStart(2, '0')}` }))),
      ...botoesMotivos('33333333-3333-4333-8333-333333333333'),
      ...BOTOES_SIM_NAO('33333333-3333-4333-8333-333333333333'),
    ];
    for (const b of botoes) {
      expect(b.id.length).toBeLessThanOrEqual(200);
      expect(b.text.length).toBeLessThanOrEqual(60);
    }
    expect(botoesSubLista('p', Array.from({ length: 12 }, () => AGENCIA))).toHaveLength(10);
  });
});

describe('Decisões das ações de botão', () => {
  const base: EntradaOpcao = {
    opcao: 'AMANHA',
    codigo: 'OY526018152BR',
    pacoteStatus: 'ENVIADO',
    insucessosAnteriores: 0,
    mediacaoAtiva: false,
    temCaso: false,
  };

  it('UT-063 AMANHA com 2 dias anteriores em INSUCESSO → "ficará disponível na unidade" e escalonar, sem orientação', () => {
    const d = decidirOpcao({ ...base, insucessosAnteriores: 2 });
    expect(d.acao).toBe('limite_tentativas');
    expect(d.escalonar).toBe(true);
    expect('mensagem' in d && d.mensagem).toContain('ficará disponível na unidade');
    expect(decidirOpcao({ ...base, insucessosAnteriores: 1 }).acao).toBe('amanha');
  });

  const rastreio = (descricao: string, data: Date, classificacao: 'ENTREGUE' | 'INSUCESSO' | null): { ok: true; resultado: ResultadoRastreio } => ({
    ok: true,
    resultado: { codigo: base.codigo, status: descricao, classificacao, eventoMaisRecente: { data: data.toISOString(), local: null, destino: null, descricao } },
  });
  const agora = brasilia('2026-09-30', '15:00');

  it('UT-064 rastreio "Carteiro não atendido" hoje às 11:20 → "Hoje já tentamos entregar às 11h20, sem sucesso." + botões CE_SN', () => {
    const d = decidirRespostaTardia({ rastreio: rastreio('Carteiro não atendido', brasilia('2026-09-30', '11:20'), 'INSUCESSO'), ultimaRespostaCarteiro: null, agora });
    expect(d).toEqual({ acao: 'guardar', hora: '11h20', fonte: 'rastreio' });
    expect(textosDestinatario.tentativaSemSucesso('11h20', 'Deixar com Zé')).toMatch(/^Hoje já tentamos entregar às 11h20, sem sucesso\. /);
    expect(BOTOES_SIM_NAO('o1').map((b) => b.id)).toEqual(['CE_SN:o1.SIM', 'CE_SN:o1.NAO']);
  });

  it('UT-065 rastreio "Objeto entregue ao destinatário" às 10:05 → "Sua encomenda foi entregue às 10h05", sem orientação', () => {
    const d = decidirRespostaTardia({ rastreio: rastreio('Objeto entregue ao destinatário', brasilia('2026-09-30', '10:05'), 'ENTREGUE'), ultimaRespostaCarteiro: null, agora });
    expect(d).toEqual({ acao: 'entregue', hora: '10h05' });
    expect(textosDestinatario.entregueAs('10h05')).toContain('Sua encomenda foi entregue às 10h05');
  });

  it('UT-066 rastreio esgotado + última resposta do carteiro NAO_ATENDEU → tentativa sem sucesso', () => {
    const d = decidirRespostaTardia({
      rastreio: { ok: false, erro: 'timeout' },
      ultimaRespostaCarteiro: { resposta: 'NAO_ATENDEU', em: brasilia('2026-09-30', '11:20') },
      agora,
    });
    expect(d).toEqual({ acao: 'guardar', hora: '11h20', fonte: 'carteiro' });
  });

  it('UT-067 rastreio esgotado e sem resposta do carteiro → repassa na hora', () => {
    expect(decidirRespostaTardia({ rastreio: { ok: false, erro: 'timeout' }, ultimaRespostaCarteiro: null, agora })).toEqual({ acao: 'repassar' });
    // resposta do carteiro de ontem não vale hoje
    expect(decidirRespostaTardia({
      rastreio: { ok: false, erro: 'timeout' },
      ultimaRespostaCarteiro: { resposta: 'NAO_ATENDEU', em: brasilia('2026-09-29', '11:20') },
      agora,
    })).toEqual({ acao: 'repassar' });
  });

  it('UT-068 rastreio "entregue" e carteiro NAO_FOI_POSSIVEL → transferência', () => {
    const d = decidirRespostaTardia({
      rastreio: rastreio('Objeto entregue ao destinatário', brasilia('2026-09-30', '10:05'), 'ENTREGUE'),
      ultimaRespostaCarteiro: { resposta: 'ENDERECO', em: brasilia('2026-09-30', '11:00') },
      agora,
    });
    expect(d).toEqual({ acao: 'transferir', motivo: 'divergencia' });
  });

  it('UT-069 CE_PT com ponto desativado → "não está mais disponível" e sub-lista só com os ativos', () => {
    const outro = { ...AGENCIA, id: '44444444-4444-4444-8444-444444444444', nome: 'AC Centro' };
    const d = decidirPonto({ ...AGENCIA, ativo: false }, 'AGENCIA', [outro, LOCKER]);
    expect(d).toEqual({ acao: 'indisponivel', mensagem: expect.stringContaining('Essa agência não está mais disponível'), pontos: [outro] });
    expect(decidirPonto({ ...AGENCIA, ativo: true }, 'AGENCIA', [])).toEqual({ acao: 'escolher', ponto: expect.objectContaining({ id: AGENCIA.id }) });
  });

  it('UT-070 AGENCIA com uma única agência ativa → confirmação CE_SN com o nome, sem sub-lista', () => {
    const d = decidirOpcao({ ...base, opcao: 'AGENCIA', pontosAtivos: [AGENCIA] });
    expect(d).toEqual({ acao: 'confirmar_ponto', ponto: AGENCIA, escalonar: false });
    expect(textosDestinatario.confirmarPontoUnico(AGENCIA)).toContain('AC Taguatinga');
    expect(decidirOpcao({ ...base, opcao: 'AGENCIA', pontosAtivos: [AGENCIA, { ...AGENCIA, id: 'b' }] }).acao).toBe('sublista');
  });

  it('VIZINHO/OUTRA: com mediação e caso → fatos do caso; sem mediação → atendimento humano', () => {
    expect(decidirOpcao({ ...base, opcao: 'VIZINHO', mediacaoAtiva: true, temCaso: true })).toEqual(
      expect.objectContaining({ acao: 'mediacao', motivoRelatado: 'entrega_indireta', pergunta: 'Qual o nome do vizinho e o número da casa ou apartamento?' }),
    );
    expect(decidirOpcao({ ...base, opcao: 'OUTRA', mediacaoAtiva: false })).toEqual(expect.objectContaining({ acao: 'atendimento_humano', escalonar: true }));
    expect(decidirOpcao({ ...base, pacoteStatus: 'ENTREGUE' }).acao).toBe('ja_entregue');
  });
});

describe('Rastreio adaptativo', () => {
  const hoje = dia('2026-09-30');
  const ontem = dia('2026-09-29');
  const p = (status: string, cargaStatus = 'LIBERADO', data = hoje) => ({ status: status as never, data, carga: { status: cargaStatus, data } });

  it('UT-099 às 14h: só LIDO/INTERAGINDO do dia de cargas liberadas; às 20h (varredura): todos os não finais', () => {
    const pacotes = {
      lido: p('LIDO'),
      interagindo: p('INTERAGINDO'),
      enviado: p('ENVIADO'),
      semWhatsapp: p('SEM_WHATSAPP'),
      entregue: p('ENTREGUE'),
      insucesso: p('INSUCESSO'),
      naoLiberada: p('LIDO', 'CARREGADO'),
      deOntem: p('LIDO', 'LIBERADO', ontem),
    };
    const as14 = Object.entries(pacotes).filter(([, x]) => deveConsultar(x, { hora: 14 }, hoje)).map(([k]) => k);
    expect(as14).toEqual(['lido', 'interagindo']);
    const as20 = Object.entries(pacotes).filter(([, x]) => deveConsultar(x, { hora: 20, varredura: true }, hoje)).map(([k]) => k);
    expect(as20).toEqual(['lido', 'interagindo', 'enviado', 'semWhatsapp']);
    expect(deveConsultar(pacotes.lido, { hora: 6 }, hoje)).toBe(false);

    expect(selecionarParaConsulta({ hora: 14 }, hoje)).toEqual(expect.objectContaining({ status: { in: ['LIDO', 'INTERAGINDO'] } }));
    expect(selecionarParaConsulta({ hora: 20, varredura: true }, hoje)).toEqual(expect.objectContaining({ status: { notIn: ['ENTREGUE', 'INSUCESSO'] } }));
    expect(selecionarParaConsulta({ hora: 22 }, hoje)).toBeNull();
  });
});
