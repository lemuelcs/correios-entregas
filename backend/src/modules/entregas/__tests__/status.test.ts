import type { StatusPacote } from '@prisma/client';
import { avancarStatusPacote, derivarStatusCarga, resumirPacotes, rotuloStatusPacote } from '../status';

const DIA = new Date('2026-09-30T00:00:00.000Z');
const MEIO_DIA = new Date('2026-09-30T15:00:00.000Z'); // 12h em Brasília
const NOITE = new Date('2026-09-30T23:30:00.000Z'); // 20h30 em Brasília

describe('status — derivação do quadro', () => {
  it('UT-033 distrito sem carga (ou carga sem pacotes) → PENDENTE_UPLOAD', () => {
    expect(derivarStatusCarga({ carga: null, porStatus: {}, agora: MEIO_DIA })).toBe('PENDENTE_UPLOAD');
    expect(derivarStatusCarga({ carga: { status: 'CARREGADO', data: DIA }, porStatus: {}, agora: MEIO_DIA })).toBe('PENDENTE_UPLOAD');
  });

  it('UT-034 carga CARREGADO → DADOS_CARREGADOS; pacotes exibidos como "Lista pronta"', () => {
    expect(derivarStatusCarga({
      carga: { status: 'CARREGADO', data: DIA },
      porStatus: { AGUARDANDO_LIBERACAO: 3, SEM_WHATSAPP: 1 },
      agora: MEIO_DIA,
    })).toBe('DADOS_CARREGADOS');
    expect(rotuloStatusPacote('AGUARDANDO_LIBERACAO', false)).toBe('Lista pronta');
    expect(rotuloStatusPacote('SEM_WHATSAPP', false)).toBe('Lista pronta');
    expect(rotuloStatusPacote('SEM_WHATSAPP', true)).toBe('Sem WhatsApp');
  });

  it('UT-035 carga liberada com todos os pacotes AGENDADO → LIBERADO', () => {
    expect(derivarStatusCarga({ carga: { status: 'LIBERADO', data: DIA }, porStatus: { AGENDADO: 5 }, agora: MEIO_DIA }))
      .toBe('LIBERADO');
  });

  it('UT-036 carga liberada com 1 pacote ENVIADO → EM_ENTREGA', () => {
    expect(derivarStatusCarga({
      carga: { status: 'LIBERADO', data: DIA },
      porStatus: { AGENDADO: 4, ENVIADO: 1 },
      agora: MEIO_DIA,
    })).toBe('EM_ENTREGA');
  });

  it('UT-037 todos ENTREGUE ou INSUCESSO → CONCLUIDO; NAO_ENVIADO só conta depois das 20h', () => {
    expect(derivarStatusCarga({
      carga: { status: 'EM_ENTREGA', data: DIA },
      porStatus: { ENTREGUE: 3, INSUCESSO: 2 },
      agora: MEIO_DIA,
    })).toBe('CONCLUIDO');

    const comNaoEnviado = { carga: { status: 'EM_ENTREGA' as const, data: DIA }, porStatus: { ENTREGUE: 3, NAO_ENVIADO: 1 } };
    expect(derivarStatusCarga({ ...comNaoEnviado, agora: MEIO_DIA })).toBe('EM_ENTREGA');
    expect(derivarStatusCarga({ ...comNaoEnviado, agora: NOITE })).toBe('CONCLUIDO');

    // SEM_WHATSAPP pendente de rastreio ainda não conclui
    expect(derivarStatusCarga({
      carga: { status: 'EM_ENTREGA', data: DIA },
      porStatus: { ENTREGUE: 3, SEM_WHATSAPP: 1 },
      agora: NOITE,
    })).toBe('EM_ENTREGA');
  });

  it('UT-038 pacote só avança: read depois de INTERAGINDO não regride; ENTREGUE não regride com delivered', () => {
    expect(avancarStatusPacote('INTERAGINDO', { tipo: 'read' })).toEqual({ status: 'INTERAGINDO', mudou: false });
    expect(avancarStatusPacote('ENTREGUE', { tipo: 'delivered' })).toEqual({ status: 'ENTREGUE', mudou: false });
    expect(avancarStatusPacote('ENTREGUE', { tipo: 'rastreio', resultado: 'INSUCESSO' })).toEqual({ status: 'ENTREGUE', mudou: false });
    expect(avancarStatusPacote('LIDO', { tipo: 'delivered' }).status).toBe('LIDO');

    const sequencia: Array<[StatusPacote, Parameters<typeof avancarStatusPacote>[1], StatusPacote]> = [
      ['AGUARDANDO_LIBERACAO', { tipo: 'agendado' }, 'AGENDADO'],
      ['AGENDADO', { tipo: 'sent' }, 'ENVIADO'],
      ['NAO_ENVIADO', { tipo: 'sent' }, 'ENVIADO'],
      ['ENVIADO', { tipo: 'read' }, 'LIDO'],
      ['LIDO', { tipo: 'interacao' }, 'INTERAGINDO'],
      ['INTERAGINDO', { tipo: 'rastreio', resultado: 'INSUCESSO' }, 'INSUCESSO'],
      ['INSUCESSO', { tipo: 'rastreio', resultado: 'ENTREGUE' }, 'ENTREGUE'],
      ['SEM_WHATSAPP', { tipo: 'rastreio', resultado: 'ENTREGUE' }, 'ENTREGUE'],
    ];
    for (const [de, evento, para] of sequencia) {
      expect(avancarStatusPacote(de, evento)).toEqual(expect.objectContaining({ status: para, mudou: true }));
    }
    expect(avancarStatusPacote('SEM_WHATSAPP', { tipo: 'sent' }).mudou).toBe(false);
    expect(avancarStatusPacote('ENVIADO', { tipo: 'failed', failureReason: 'daily_cap' }).status).toBe('ENVIADO');
  });

  it('UT-039 failed com daily_cap → NAO_ENVIADO, limite_canal e reenfileirar', () => {
    expect(avancarStatusPacote('AGENDADO', { tipo: 'failed', failureReason: 'daily_cap' })).toEqual({
      status: 'NAO_ENVIADO',
      mudou: true,
      naoEnviadoMotivo: 'limite_canal',
      reenfileirar: true,
    });
    expect(avancarStatusPacote('AGENDADO', { tipo: 'failed', failureReason: 'invalid_number' })).toEqual(expect.objectContaining({
      naoEnviadoMotivo: 'falha_envio',
      reenfileirar: false,
    }));
  });

  it('UT-040 37 pacotes, 28 com WhatsApp → { total: 37, comWhatsapp: 28 }', () => {
    const pacotes = [
      ...Array.from({ length: 28 }, () => ({ status: 'AGUARDANDO_LIBERACAO' as StatusPacote, whatsappE164: '+5561998124412' })),
      ...Array.from({ length: 9 }, () => ({ status: 'SEM_WHATSAPP' as StatusPacote, whatsappE164: null })),
    ];
    const resumo = resumirPacotes(pacotes);
    expect(resumo).toEqual(expect.objectContaining({ total: 37, comWhatsapp: 28 }));
    expect(resumo.porStatus).toEqual({ AGUARDANDO_LIBERACAO: 28, SEM_WHATSAPP: 9 });
  });
});
