/** Papel e unidadeRef da sessão de atendimento: UT-089. */
import { AppError } from '../../../shared/middleware/error-handler.middleware';
import { perfilAtendimento } from '../atendimento.service';

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
