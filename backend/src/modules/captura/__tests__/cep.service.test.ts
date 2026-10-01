import { AppError } from '../../../shared/middleware/error-handler.middleware';
import { TTL_CEP_ENCONTRADO_S, TTL_CEP_NAO_ENCONTRADO_S, ViaCepService, type CacheCep, type CepCws } from '../cep.service';

class CacheFalso implements CacheCep {
  dados = new Map<string, { valor: string; ttl: number }>();
  async get(chave: string) {
    return this.dados.get(chave)?.valor ?? null;
  }
  async set(chave: string, valor: string, _modo: 'EX', segundos: number) {
    this.dados.set(chave, { valor, ttl: segundos });
    return 'OK';
  }
}

function resposta(corpo: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

const VIACEP_QNC = { cep: '72115-040', logradouro: 'QNC 4', bairro: 'Taguatinga Norte', localidade: 'Brasília', uf: 'DF' };

/** fetch que só termina quando o sinal aborta. */
function fetchPendurado() {
  return jest.fn((_url: string, init?: { signal?: AbortSignal }) => new Promise<never>((_, rejeitar) => {
    init?.signal?.addEventListener('abort', () => rejeitar(new Error('aborted')));
  }));
}

describe('CepService (ViaCEP + CWS + cache)', () => {
  afterEach(() => jest.useRealTimers());

  it('UT-034 ViaCEP 200 → CepInfo normalizado e cache de 30 dias', async () => {
    const cache = new CacheFalso();
    const fetch = jest.fn(async () => resposta(VIACEP_QNC));
    const svc = new ViaCepService({ fetch, cache: () => cache, cws: null, viaCepUrl: 'http://viacep.teste/ws' });
    await expect(svc.lookup('72115040')).resolves.toEqual({ cep: '72115040', logradouro: 'QNC 4', bairro: 'Taguatinga Norte', cidade: 'Brasília', uf: 'DF' });
    expect(fetch).toHaveBeenCalledWith('http://viacep.teste/ws/72115040/json/', expect.anything());
    expect(cache.dados.get('cep:72115040')?.ttl).toBe(TTL_CEP_ENCONTRADO_S);
    expect(TTL_CEP_ENCONTRADO_S).toBe(30 * 24 * 3600);
  });

  it('UT-035 com cache presente não chama o fetch', async () => {
    const cache = new CacheFalso();
    const fetch = jest.fn(async () => resposta(VIACEP_QNC));
    const svc = new ViaCepService({ fetch, cache: () => cache, cws: null });
    await svc.lookup('72115040');
    fetch.mockClear();
    await expect(svc.lookup('72115-040')).resolves.toMatchObject({ logradouro: 'QNC 4' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('UT-036 ViaCEP { erro: true } sem CWS → NAO_ENCONTRADO, cache de 1 dia', async () => {
    const cache = new CacheFalso();
    const svc = new ViaCepService({ fetch: async () => resposta({ erro: true }), cache: () => cache, cws: null });
    await expect(svc.lookup('00000000')).resolves.toBe('NAO_ENCONTRADO');
    expect(cache.dados.get('cep:00000000')?.ttl).toBe(TTL_CEP_NAO_ENCONTRADO_S);
    expect(TTL_CEP_NAO_ENCONTRADO_S).toBe(24 * 3600);
  });

  it('UT-037 ViaCEP com timeout de 3 s sem CWS → INDISPONIVEL, sem cache', async () => {
    jest.useFakeTimers();
    const cache = new CacheFalso();
    const fetch = fetchPendurado();
    const svc = new ViaCepService({ fetch, cache: () => cache, cws: null });
    let resultado: unknown = 'pendente';
    const p = svc.lookup('72115040').then((r) => { resultado = r; });
    await jest.advanceTimersByTimeAsync(2999);
    expect(resultado).toBe('pendente');
    await jest.advanceTimersByTimeAsync(1);
    await p;
    expect(resultado).toBe('INDISPONIVEL');
    expect(cache.dados.size).toBe(0);
  });

  it('UT-038 ViaCEP com timeout e CWS configurado com 200 → CepInfo do CWS', async () => {
    jest.useFakeTimers();
    const cws = jest.fn(async (): Promise<CepCws> => ({ cep: '72115040', logradouro: 'QNC 4', bairro: 'Taguatinga', localidade: 'Brasília', uf: 'df' }));
    const svc = new ViaCepService({ fetch: fetchPendurado(), cache: () => null, cws });
    const p = svc.lookup('72115040');
    await jest.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toEqual({ cep: '72115040', logradouro: 'QNC 4', bairro: 'Taguatinga', cidade: 'Brasília', uf: 'DF' });
    expect(cws).toHaveBeenCalledTimes(1);
  });

  it('UT-039 CEP de cidade (logradouro vazio) → logradouro null e cidade preenchida', async () => {
    const svc = new ViaCepService({
      fetch: async () => resposta({ cep: '73800-000', logradouro: '', bairro: '', localidade: 'Formosa', uf: 'GO' }),
      cache: () => null,
      cws: null,
    });
    await expect(svc.lookup('73800000')).resolves.toEqual({ cep: '73800000', logradouro: null, bairro: null, cidade: 'Formosa', uf: 'GO' });
  });

  it('UT-040 lookup("123") lança AppError(400) sem chamar a rede', async () => {
    const fetch = jest.fn();
    const svc = new ViaCepService({ fetch, cache: () => null, cws: null });
    await expect(svc.lookup('123')).rejects.toBeInstanceOf(AppError);
    await expect(svc.lookup('123')).rejects.toMatchObject({ statusCode: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('UT-041 Redis indisponível → consulta direta, sem falhar', async () => {
    const quebrado: CacheCep = {
      get: async () => { throw new Error('ECONNREFUSED'); },
      set: async () => { throw new Error('ECONNREFUSED'); },
    };
    const fetch = jest.fn(async () => resposta(VIACEP_QNC));
    const svc = new ViaCepService({ fetch, cache: () => quebrado, cws: null });
    await expect(svc.lookup('72115040')).resolves.toMatchObject({ cidade: 'Brasília' });
    const semCliente = new ViaCepService({ fetch, cache: () => { throw new Error('sem redis'); }, cws: null });
    await expect(semCliente.lookup('72115040')).resolves.toMatchObject({ uf: 'DF' });
  });
});
