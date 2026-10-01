import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { useEntregasPacotesStore } from '@/stores/entregas-pacotes.store';
import { useEntregasQuadroStore } from '@/stores/entregas-quadro.store';
import type { CartaoDistrito, ListaPacotes, PacoteDistrito, Quadro } from '../entregas.types';
import { CadastroPage } from '../pages/CadastroPage';
import { CarregarDadosPage } from '../pages/CarregarDadosPage';
import { DistritoPacotesPage } from '../pages/DistritoPacotesPage';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const SUPERVISOR = { id: 'u1', nome: 'Ana Ribeiro', role: 'UNIDADE', unidadeId: 'un1', unidade: { id: 'un1', nome: 'CDD Taguatinga' } };

function pacote(id: string, codigo: string, extra: Partial<PacoteDistrito>): PacoteDistrito {
  return {
    id,
    codigo,
    nome: `Destinatário ${codigo}`,
    whatsapp: '+5561998124412',
    endereco: { logradouro: 'QNA 1', numero: '10', complemento: null, bairro: 'Taguatinga Norte', cidade: 'Brasília', uf: 'DF', cep: '72110010', enderecoTexto: null, referencia: null },
    status: 'AGUARDANDO_LIBERACAO',
    rotulo: 'Lista pronta',
    naoEnviadoMotivo: null,
    escalonado: false,
    sinais: null,
    descadastrado: false,
    rastreio: null,
    orientacaoVigente: null,
    respostaCarteiro: null,
    ...extra,
  };
}

const LISTA: ListaPacotes = {
  cargaId: 'c1',
  data: '2026-09-30',
  somenteLeitura: false,
  distrito: { id: 'd1', codigo: 'D-01', nome: 'Taguatinga Norte' },
  statusCarga: 'DADOS_CARREGADOS',
  liberada: false,
  resumo: { total: 3, comWhatsapp: 3, porStatus: { AGUARDANDO_LIBERACAO: 3 } },
  pagina: 1,
  porPagina: 50,
  total: 3,
  totalPaginas: 1,
  pacotes: [
    pacote('p1', 'AA123456785BR', { origem: 'PLANILHA', codigoDigitado: false, temFoto: false }),
    pacote('p2', 'OY716488072BR', { origem: 'FOTO', codigoDigitado: true, temFoto: false }),
    pacote('p3', 'AB987654321BR', { origem: 'PLANILHA_FOTO', codigoDigitado: false, temFoto: true }),
  ],
};

function cartao(extra: Partial<CartaoDistrito>): CartaoDistrito {
  return {
    distritoId: 'd1',
    codigo: 'D-01',
    nome: 'Taguatinga Norte',
    ativo: true,
    cargaId: 'c1',
    carteiro: { id: 'k1', nome: 'Marcos Paulo Lima' },
    semCarteiro: false,
    status: 'DADOS_CARREGADOS',
    total: 10,
    comWhatsapp: 8,
    porStatus: { AGUARDANDO_LIBERACAO: 8, SEM_WHATSAPP: 2 },
    escalonamentos: 0,
    liberadoEm: null,
    ...extra,
  };
}

function quadro(distritos: CartaoDistrito[]): Quadro {
  return { data: '2026-09-30', somenteLeitura: false, semDistritos: false, distritos };
}

describe('Extensões do supervisor (captura, task_06)', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    localStorage.setItem('accessToken', 'acesso');
    useAuthStore.setState({ user: SUPERVISOR as never, accessToken: 'acesso' });
    useEntregasPacotesStore.setState({ lista: null, cargaId: null });
    useEntregasQuadroStore.setState({ quadro: null });
    fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function abrirPacotes() {
    return render(
      <MemoryRouter initialEntries={['/entregas/distritos/c1']}>
        <Routes>
          <Route path="/entregas/distritos/:cargaId" element={<DistritoPacotesPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function abrirQuadro() {
    return render(
      <MemoryRouter initialEntries={['/entregas/carregar']}>
        <Routes>
          <Route path="/entregas/carregar" element={<CarregarDadosPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('UT-121 a lista do distrito mostra os chips de origem "Planilha", "Foto" e "Planilha + foto", e o selo "código digitado"', async () => {
    fetchMock.mockImplementation(async (url) => (url.includes('/entregas/cargas/c1/pacotes') ? json(200, LISTA) : json(404, { error: 'nao_encontrado' })));
    abrirPacotes();

    const linha = (codigo: string) => screen.findByText(codigo).then((el) => el.closest('tr') as HTMLElement);
    const p1 = await linha('AA123456785BR');
    const p2 = await linha('OY716488072BR');
    const p3 = await linha('AB987654321BR');

    // a célula do código leva o chip de origem e, quando houver, o selo
    const codigo = (tr: HTMLElement) => (tr as HTMLTableRowElement).cells[0];
    expect(codigo(p1)).toHaveTextContent(/^AA123456785BROrigem: Planilha$/);
    expect(codigo(p2)).toHaveTextContent(/^OY716488072BROrigem: Fotocódigo digitado$/);
    expect(codigo(p3)).toHaveTextContent(/^AB987654321BROrigem: Planilha \+ foto$/);
    expect(within(codigo(p2)).getByText('código digitado')).toBeVisible();
    // a foto só é oferecida para pacote que veio da captura
    expect(within(p1).queryByRole('button', { name: /Foto do rótulo/ })).not.toBeInTheDocument();
    expect(within(p3).getByRole('button', { name: 'Foto do rótulo de AB987654321BR' })).toBeInTheDocument();
  });

  it('UT-121 (histórico) mostra as sobrescritas com o valor antes e depois', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.includes('/historico')) {
        return json(200, {
          pacoteId: 'p3',
          codigo: 'AB987654321BR',
          eventos: [{
            id: 'e1',
            tipo: 'CAPTURA_ATUALIZADO',
            em: '2026-09-30T11:05:00.000Z',
            carteiro: { id: 'k1', nome: 'Marcos Paulo Lima' },
            mudancas: [{ campo: 'bairro', antes: 'Centro', depois: 'Taguatinga Norte' }],
            dados: {},
          }],
        });
      }
      return json(200, LISTA);
    });
    abrirPacotes();

    await userEvent.click(await screen.findByRole('button', { name: 'Histórico de AB987654321BR' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Histórico de AB987654321BR' });
    expect(await within(dialogo).findByText('Dados atualizados pela foto')).toBeInTheDocument();
    const linha = within(dialogo).getByRole('row', { name: /Bairro/ });
    expect(within(linha).getByText('Centro')).toBeInTheDocument();
    expect(within(linha).getByText('Taguatinga Norte')).toBeInTheDocument();
  });

  it('UT-122 foto 410 → "Foto excluída em 30/10 (prazo de retenção)"', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.includes('/entregas/captura/pacotes/p3/foto')) {
        return json(410, { error: 'Foto excluída', details: { code: 'foto_excluida', fotoExcluidaEm: '2026-10-30T06:00:00.000Z' } });
      }
      return json(200, LISTA);
    });
    abrirPacotes();

    await userEvent.click(await screen.findByRole('button', { name: 'Foto do rótulo de AB987654321BR' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Foto do rótulo · AB987654321BR' });
    expect(await within(dialogo).findByText('Foto excluída em 30/10 (prazo de retenção)')).toBeInTheDocument();
    expect(within(dialogo).queryByRole('img')).not.toBeInTheDocument();
  });

  it('UT-123 o quadro lista as transferências com código, carteiro e hora', async () => {
    const q = quadro([
      cartao({
        transferencias: {
          entrada: [],
          saida: [{
            pacoteId: 'p9', codigo: 'OY716488072BR', distrito: 'D-03', distritoId: 'd3',
            carteiro: { id: 'k3', nome: 'Patrícia Nunes' }, carteiroAnterior: { id: 'k1', nome: 'Marcos Paulo Lima' },
            hora: '2026-09-30T12:40:00.000Z', origemLiberada: false,
          }],
        },
        paraConferir: 0,
      }),
      cartao({
        distritoId: 'd3', codigo: 'D-03', nome: 'Taguatinga Sul', cargaId: 'c3',
        transferencias: {
          entrada: [{
            pacoteId: 'p9', codigo: 'OY716488072BR', distrito: 'D-01', distritoId: 'd1',
            carteiro: { id: 'k3', nome: 'Patrícia Nunes' }, carteiroAnterior: { id: 'k1', nome: 'Marcos Paulo Lima' },
            hora: '2026-09-30T12:40:00.000Z', origemLiberada: false,
          }],
          saida: [],
        },
        paraConferir: 0,
      }),
    ]);
    fetchMock.mockImplementation(async () => json(200, q));
    abrirQuadro();

    const saida = await screen.findByRole('list', { name: 'Transferências do D-01' });
    expect(saida).toHaveTextContent('OY716488072BR foi para o D-03 · Patrícia Nunes · 09h40');
    const entrada = screen.getByRole('list', { name: 'Transferências do D-03' });
    expect(entrada).toHaveTextContent('OY716488072BR veio do D-01 · Patrícia Nunes · 09h40');
  });

  it('UT-124 paraConferir: 4 → "4 para conferir no app do carteiro"; 0 → nada', async () => {
    fetchMock.mockImplementation(async () => json(200, quadro([
      cartao({ paraConferir: 4, transferencias: { entrada: [], saida: [] } }),
      cartao({ distritoId: 'd2', codigo: 'D-02', nome: 'Ceilândia', cargaId: 'c2', paraConferir: 0, transferencias: { entrada: [], saida: [] } }),
    ])));
    abrirQuadro();

    const d01 = await screen.findByRole('article', { name: 'Taguatinga Norte' });
    const d02 = screen.getByRole('article', { name: 'Ceilândia' });
    expect(within(d01).getByText('4 para conferir no app do carteiro')).toBeInTheDocument();
    expect(within(d02).queryByText(/para conferir no app do carteiro/)).not.toBeInTheDocument();
    expect(within(d02).queryByText('Transferências')).not.toBeInTheDocument();
  });

  it('(task_06) "Definir senha" na aba Carteiros chama PUT /entregas/captura/carteiros/:id/senha', async () => {
    useEntregasCadastroStore.setState({ distritos: null, carteiros: null });
    const carteiro = {
      id: 'k1', unidadeId: 'un1', nome: 'Marcos Paulo Lima', matricula: '81234567', whatsapp: '+5561998124412',
      ativo: true, possuiLogin: false, distritosPadrao: [], atualizadoEm: '2026-09-30T10:00:00.000Z',
    };
    const pagina = (itens: unknown[]) => ({ itens, total: itens.length, pagina: 1, tamanho: 100, totalPaginas: 1 });
    fetchMock.mockImplementation(async (url, init) => {
      if (url.includes('/entregas/captura/carteiros/k1/senha')) return new Response(null, { status: 204 });
      if (url.includes('/entregas/cadastro/carteiros')) return json(200, pagina([carteiro]));
      if (url.includes('/entregas/cadastro/distritos')) return json(200, pagina([]));
      return json(404, { error: `inesperado ${init?.method} ${url}` });
    });
    render(
      <MemoryRouter initialEntries={['/entregas/cadastro?aba=carteiros']}>
        <Routes>
          <Route path="/entregas/cadastro" element={<CadastroPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Definir senha de Marcos Paulo Lima' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Definir senha · Marcos Paulo Lima' });
    await user.type(within(dialogo).getByLabelText('Senha temporária'), 'inicial123');
    await user.click(within(dialogo).getByRole('button', { name: 'Definir senha' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const chamada = fetchMock.mock.calls.find(([u]) => u.includes('/senha'));
    expect(chamada?.[0]).toBe('/api/v1/entregas/captura/carteiros/k1/senha');
    expect(chamada?.[1].method).toBe('PUT');
    expect(JSON.parse(chamada?.[1].body as string)).toEqual({ senha: 'inicial123' });
  });
});
