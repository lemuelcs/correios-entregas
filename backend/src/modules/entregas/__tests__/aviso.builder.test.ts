/**
 * Aviso, resumo ao carteiro e regras puras da liberação:
 * UT-041–UT-048, UT-083, UT-097.
 */
import {
  atrasoNoturno,
  externalRefDoCaso,
  idJobFila,
  jobsDaLiberacao,
  montarAviso,
  montarResumoCarteiro,
  resumoDoCaso,
} from '../aviso.builder';
import {
  BOTOES_SIM_NAO,
  ROTULOS_MOTIVO,
  ROTULOS_OPCAO,
  botoesMotivos,
  botoesOrientacaoCarteiro,
  botoesSubLista,
  corpoSubLista,
  mensagemNaoTentarHoje,
  mensagemOrientacaoCarteiro,
  textoOrientacaoAmanha,
  textoOrientacaoPonto,
  textoOrientacaoVizinho,
  textosCarteiro,
  textosDestinatario,
  type PontoTexto,
} from '../textos';

const PACOTE = '5f2b8c1e-0000-4000-8000-000000000001';
const brasilia = (iso: string) => new Date(`${iso}-03:00`);

describe('Aviso ao destinatário', () => {
  it('UT-041 nome em maiúsculas → primeiro nome capitalizado e o texto do PRD', () => {
    const { body } = montarAviso({ pacoteId: PACOTE, nome: 'MARIA APARECIDA', codigo: 'OY526018152BR' });
    expect(body.startsWith('Olá, Maria, sua encomenda OY526018152BR já saiu para entrega.')).toBe(true);
    expect(body).toContain('Se tiver alguma dificuldade para receber sua encomenda, nos avise.');
  });

  it('UT-042 nome vazio → "Olá, sua encomenda"', () => {
    expect(montarAviso({ pacoteId: PACOTE, nome: '', codigo: 'OY526018152BR' }).body.startsWith('Olá, sua encomenda OY526018152BR')).toBe(true);
    expect(montarAviso({ pacoteId: PACOTE, nome: '   ', codigo: 'OY526018152BR' }).body.startsWith('Olá, sua encomenda')).toBe(true);
  });

  it('UT-043 unidade sem agência ativa → AMANHA, VIZINHO, LOCKER e OUTRA com ids CE_OP:<pacoteId>.<OPCAO>', () => {
    const { buttons } = montarAviso({ pacoteId: PACOTE, nome: 'Ana', codigo: 'OY526018152BR', pontosAtivos: { agencia: false, locker: true } });
    expect(buttons.map((b) => b.id)).toEqual([
      `CE_OP:${PACOTE}.AMANHA`,
      `CE_OP:${PACOTE}.VIZINHO`,
      `CE_OP:${PACOTE}.LOCKER`,
      `CE_OP:${PACOTE}.OUTRA`,
    ]);
    expect(buttons.map((b) => b.text)).toEqual([ROTULOS_OPCAO.AMANHA, ROTULOS_OPCAO.VIZINHO, ROTULOS_OPCAO.LOCKER, ROTULOS_OPCAO.OUTRA]);
    for (const b of buttons) {
      expect(b.text.length).toBeLessThanOrEqual(60);
      expect(b.id.length).toBeLessThanOrEqual(200);
    }
    const semNenhum = montarAviso({ pacoteId: PACOTE, nome: 'Ana', codigo: 'OY526018152BR', pontosAtivos: { agencia: false, locker: false } });
    expect(semNenhum.buttons.map((b) => b.id.split('.').pop())).toEqual(['AMANHA', 'VIZINHO', 'OUTRA']);
    const padrao = montarAviso({ pacoteId: PACOTE, nome: 'Ana', codigo: 'OY526018152BR' });
    expect(padrao.buttons).toHaveLength(5);
  });

  it('UT-044 com orientação guardada → "Vamos seguir sua orientação: …" e mantém as opções', () => {
    const { body, buttons } = montarAviso({ pacoteId: PACOTE, nome: 'Maria', codigo: 'OY526018152BR', orientacao: 'Deixar com Dona Célia, casa 47' });
    expect(body).toContain('Vamos seguir sua orientação: Deixar com Dona Célia, casa 47');
    expect(body).not.toContain('Se tiver alguma dificuldade');
    expect(buttons).toHaveLength(5);
  });

  const ponto: PontoTexto = { id: 'p1', tipo: 'AGENCIA', nome: 'AC Centro', endereco: 'QNA 30', horario: '9h às 17h' };
  const dia = new Date('2026-10-02T00:00:00.000Z');
  const textos: Array<[string, string]> = [
    ['aviso', montarAviso({ pacoteId: PACOTE, nome: 'Maria', codigo: 'OY526018152BR' }).body],
    ['aviso com orientação', montarAviso({ pacoteId: PACOTE, nome: 'Maria', codigo: 'OY526018152BR', orientacao: 'Deixar na agência AC Centro' }).body],
    ['botões do aviso', montarAviso({ pacoteId: PACOTE, nome: 'Maria', codigo: 'OY526018152BR' }).buttons.map((b) => b.text).join(' ')],
    ['resumo', montarResumoCarteiro([{ codigo: 'OY526018152BR', nomeDestinatario: 'Maria', texto: 'Deixar com Dona Célia, casa 47' }]).join('\n')],
    ['resumo da troca', montarResumoCarteiro([{ codigo: 'OY526018152BR', nomeDestinatario: 'Maria', texto: 'x' }], { troca: true }).join('\n')],
    ['orientação ao carteiro', mensagemOrientacaoCarteiro({ codigo: 'OY526018152BR', nomeDestinatario: 'Maria', texto: 'Deixar na agência', atualizada: true })],
    ['não tentar hoje', mensagemNaoTentarHoje({ codigo: 'OY526018152BR', nomeDestinatario: 'Maria', atualizada: false, dia })],
    ['sub-lista', corpoSubLista('AGENCIA', [ponto])],
    ['botões da sub-lista', botoesSubLista(PACOTE, [ponto]).map((b) => b.text).join(' ')],
    ['orientação de ponto', textoOrientacaoPonto(ponto)],
    ['orientação amanhã', textoOrientacaoAmanha(dia)],
    ['orientação vizinho', textoOrientacaoVizinho('Dona Célia', 'casa 47')],
    ['botões sim/não', BOTOES_SIM_NAO('o1').map((b) => b.text).join(' ')],
    ['botões do carteiro', [...botoesOrientacaoCarteiro('o1'), ...botoesMotivos('o1')].map((b) => b.text).join(' ')],
    ['motivos', Object.values(ROTULOS_MOTIVO).join(' ')],
    ...Object.entries(textosDestinatario).map(([k, v]): [string, string] => [
      `destinatário.${k}`,
      typeof v === 'function' ? (v as (...a: unknown[]) => string)(k.includes('Ponto') || k === 'confirmacaoPonto' ? ponto : k.startsWith('sem') || k.startsWith('sub') || k.startsWith('ponto') ? 'AGENCIA' : k === 'tentativaSemSucesso' ? '11:20' : k.includes('Amanha') || k.includes('guardada') ? dia : 'OY526018152BR', 'texto') : v,
    ]),
    ...Object.entries(textosCarteiro).map(([k, v]): [string, string] => [
      `carteiro.${k}`,
      typeof v === 'function' ? (v as (m: string) => string)('NAO_ATENDEU') : v,
    ]),
  ];

  it.each(textos)('UT-045 %s: sem link, pix ou pagamento', (_nome, texto) => {
    expect(typeof texto).toBe('string');
    expect(texto).not.toMatch(/http|pix|pagamento/i);
  });
});

describe('Agendamento e ids', () => {
  it('UT-046 liberação às 03:10 (Brasília) → atraso até 06:05 do mesmo dia', () => {
    const agora = brasilia('2026-09-30T03:10:00');
    const r = atrasoNoturno(agora);
    expect(r.agendadoPara?.toISOString()).toBe(brasilia('2026-09-30T06:05:00').toISOString());
    expect(r.atrasoMs).toBe((2 * 60 + 55) * 60_000);
    expect(atrasoNoturno(brasilia('2026-09-30T00:00:00')).agendadoPara?.toISOString()).toBe(brasilia('2026-09-30T06:05:00').toISOString());
    expect(atrasoNoturno(brasilia('2026-09-30T05:59:59')).atrasoMs).toBeGreaterThan(0);
  });

  it('UT-047 às 06:00 e às 23:59 → sem atraso', () => {
    expect(atrasoNoturno(brasilia('2026-09-30T06:00:00'))).toEqual({ atrasoMs: 0, agendadoPara: null });
    expect(atrasoNoturno(brasilia('2026-09-30T23:59:00'))).toEqual({ atrasoMs: 0, agendadoPara: null });
    expect(atrasoNoturno(brasilia('2026-09-30T12:00:00')).atrasoMs).toBe(0);
  });

  it('UT-048 jobsDaLiberacao gera aviso:<pacoteId> e resumo:<cargaId>:<carteiroId> estáveis', () => {
    const carga = { cargaId: 'c1', carteiroId: 'k1', pacoteIds: ['p1', 'p2'], orientacaoIds: ['o1'] };
    const a = jobsDaLiberacao(carga);
    const b = jobsDaLiberacao(carga);
    expect(a.map((j) => j.id)).toEqual(['aviso:p1', 'aviso:p2', 'resumo:c1:k1']);
    expect(b).toEqual(a);
    expect(a.map((j) => idJobFila(j.id))).toEqual(['aviso_p1', 'aviso_p2', 'resumo_c1_k1']);
    // Sem orientações conhecidas → sem resumo.
    expect(jobsDaLiberacao({ ...carga, orientacaoIds: [] }).map((j) => j.nome)).toEqual(['aviso', 'aviso']);
  });
});

describe('Resumo ao carteiro', () => {
  const itens = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ codigo: `AA${String(10000000 + i)}5BR`, nomeDestinatario: `MARIA ${i}`, texto: `Deixar na portaria ${i}` }));

  it('UT-083 20 → 1 mensagem; 25 → 2 (20 + 5) numeradas "1/2" e "2/2"; 0 → nenhuma', () => {
    expect(montarResumoCarteiro(itens(20))).toHaveLength(1);
    const duas = montarResumoCarteiro(itens(25));
    expect(duas).toHaveLength(2);
    expect(duas[0]).toContain('1/2');
    expect(duas[1]).toContain('2/2');
    expect(duas[0].split('\n')).toHaveLength(21);
    expect(duas[1].split('\n')).toHaveLength(6);
    expect(duas[1]).toContain('21. AA100000205BR · Maria: Deixar na portaria 20');
    expect(montarResumoCarteiro([])).toEqual([]);
  });
});

describe('Caso de mediação', () => {
  it('UT-097 externalRef por código e dia; outro dia → outro externalRef', () => {
    const d1 = new Date('2026-09-30T00:00:00.000Z');
    const d2 = new Date('2026-10-01T00:00:00.000Z');
    expect(externalRefDoCaso('OY526018152BR', d1)).toBe('OY526018152BR@2026-09-30');
    expect(externalRefDoCaso('OY526018152BR', d2)).toBe('OY526018152BR@2026-10-01');
    expect(externalRefDoCaso('OY526018152BR', d2)).not.toBe(externalRefDoCaso('OY526018152BR', d1));
    expect(resumoDoCaso({ nome: 'MARIA APARECIDA', logradouro: 'QNA 12', numero: 'Casa 45' })).toBe('Maria · QNA 12 Casa 45');
  });
});
