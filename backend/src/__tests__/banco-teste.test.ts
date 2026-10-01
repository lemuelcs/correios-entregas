import { resolverBancoTeste, urlComSchema } from './setup/banco-teste';

describe('trava do banco de testes', () => {
  it('aceita banco terminado em _test e lê o schema', () => {
    expect(resolverBancoTeste('postgresql://u:p@127.0.0.1:5432/correiosentregas_test?schema=x_1')).toEqual(
      expect.objectContaining({ banco: 'correiosentregas_test', schema: 'x_1' }),
    );
  });

  it.each([
    [undefined],
    ['postgresql://u:p@127.0.0.1:5432/correiosentregas_db'],
    ['postgresql://u:p@127.0.0.1:5432/correiosentregas_test_copia'],
    ['postgresql://u:p@127.0.0.1:5432/'],
    ['mysql://u:p@127.0.0.1:3306/x_test'],
    ['postgresql://u:p@127.0.0.1:5432/x_test?schema=a;drop'],
  ])('recusa %s', (url) => {
    expect(() => resolverBancoTeste(url)).toThrow();
  });

  it('troca o schema da URL', () => {
    expect(urlComSchema('postgresql://u:p@h:1/x_test?schema=public', 'outro')).toContain('schema=outro');
  });
});
