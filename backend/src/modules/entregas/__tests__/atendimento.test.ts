/** Papel e unidadeRef da sessão de atendimento: UT-089. */
import { AppError } from '../../../shared/middleware/error-handler.middleware';
import { dominioAtendimento, perfilAtendimento } from '../atendimento.service';

describe('UT-089 perfil da sessão de atendimento', () => {
  const compartilhado = { prosioUnidadeRef: 'cdd-taguatinga', canal: { compartilhado: true } };
  const exclusivo = { prosioUnidadeRef: 'cdd-taguatinga', canal: { compartilhado: false } };

  it('GESTAO → administrador sem unidadeRef', () => {
    expect(perfilAtendimento('GESTAO', compartilhado)).toEqual({ papel: 'administrador' });
    expect(perfilAtendimento('GESTAO', null)).toEqual({ papel: 'administrador' });
  });

  it('UNIDADE em canal compartilhado → agente com a unidadeRef da unidade', () => {
    expect(perfilAtendimento('UNIDADE', compartilhado)).toEqual({ papel: 'agente', unidadeRef: 'cdd-taguatinga' });
  });

  it('UNIDADE em canal exclusivo → agente sem unidadeRef', () => {
    expect(perfilAtendimento('UNIDADE', exclusivo)).toEqual({ papel: 'agente' });
  });

  it('outros papéis → 403', () => {
    expect(() => perfilAtendimento('CARTEIRO', exclusivo)).toThrow(AppError);
  });
});

describe('domínio da sessão de atendimento (ATENDIMENTO_DOMINIO)', () => {
  it('sem a variável, ou vazia, não há domínio', () => {
    expect(dominioAtendimento({})).toBeUndefined();
    expect(dominioAtendimento({ ATENDIMENTO_DOMINIO: '' })).toBeUndefined();
    expect(dominioAtendimento({ ATENDIMENTO_DOMINIO: '   ' })).toBeUndefined();
  });

  it('devolve o host como configurado', () => {
    expect(dominioAtendimento({ ATENDIMENTO_DOMINIO: 'correiosdev.com' })).toBe('correiosdev.com');
    expect(dominioAtendimento({ ATENDIMENTO_DOMINIO: ' atendimento.correiosdev.com ' })).toBe('atendimento.correiosdev.com');
  });

  it('tolera esquema, barra final e maiúsculas', () => {
    expect(dominioAtendimento({ ATENDIMENTO_DOMINIO: 'https://CorreiosDev.com/' })).toBe('correiosdev.com');
    expect(dominioAtendimento({ ATENDIMENTO_DOMINIO: 'http://correiosdev.com/entregas?x=1' })).toBe('correiosdev.com');
  });
});
