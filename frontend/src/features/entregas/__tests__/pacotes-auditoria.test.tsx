/** Auditoria da lista de pacotes da rota: edição, sinais, cabeçalho, troca de unidade e "desatualizado". */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Toaster } from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { useEntregasPacotesStore } from '@/stores/entregas-pacotes.store';
import type { ListaPacotes, PacoteDistrito } from '../entregas.types';
import { DistritoPacotesPage } from '../pages/DistritoPacotesPage';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const SUPERVISOR = { id: 'u1', nome: 'Ana Ribeiro', role: 'UNIDADE', unidadeId: 'un1', unidade: { id: 'un1', nome: 'CDD Taguatinga' } };
const GESTOR = { id: 'g1', nome: 'Gestão Sede', role: 'GESTAO' };

const ENDERECO = { logradouro: 'QNA 1', numero: '10', complemento: null, bairro: 'Taguatinga Norte', cidade: 'Brasília', uf: 'DF', cep: '72110010', enderecoTexto: null, referencia: null };

function pacote(id: string, codigo: string, extra: Partial<PacoteDistrito> = {}): PacoteDistrito {
  return {
    id, codigo, nome: `Destinatário ${codigo}`, whatsapp: '+5561998124412', endereco: ENDERECO,
    status: 'ENVIADO', rotulo: 'Enviado', naoEnviadoMotivo: null, escalonado: false, sinais: [], descadastrado: false,
    rastreio: null, orientacaoVigente: null, respostaCarteiro: null, ...extra,
  };
}

function lista(extra: Partial<ListaPacotes> = {}): ListaPacotes {
  return {
    cargaId: 'c1', data: '2026-09-30', somenteLeitura: false,
    distrito: { id: 'd1', codigo: 'D-01', nome: 'Taguatinga Norte' },
    statusCarga: 'EM_ENTREGA', liberada: true,
    resumo: { total: 2, comWhatsapp: 1, porStatus: { ENVIADO: 1, SEM_WHATSAPP: 1 } },
    pagina: 1, porPagina: 50, total: 2, totalPaginas: 1,
    pacotes: [
      pacote('p1', 'AA123456785BR', { sinais: ['divergencia', 'caso_recusado:opt_out'] }),
      pacote('p2', 'OY716488072BR', { whatsapp: null, status: 'SEM_WHATSAPP', rotulo: 'Sem WhatsApp' }),
    ],
    ...extra,
  };
}

const QUADRO = {
  data: '2026-09-30', somenteLeitura: false, semDistritos: false,
  distritos: [{
    distritoId: 'd1', codigo: 'D-01', nome: 'Taguatinga Norte', ativo: true, cargaId: 'c1',
    carteiro: { id: 'k1', nome: 'Marcos Paulo Lima' }, semCarteiro: false, status: 'EM_ENTREGA',
    total: 2, comWhatsapp: 1, porStatus: {}, escalonamentos: 0, liberadoEm: '2026-09-30T11:12:00.000Z',
  }],
};

describe('Lista de pacotes da rota (auditoria)', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
  let pacotesFalham = false;

  beforeEach(() => {
    pacotesFalham = false;
    localStorage.setItem('accessToken', 'acesso');
    useAuthStore.setState({ user: SUPERVISOR as never, accessToken: 'acesso' });
    useEntregasPacotesStore.getState().limpar();
    useEntregasContextoStore.setState({ unidadeGestaoId: null });
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url, init) => {
      if (url.includes('/entregas/quadro')) return json(200, QUADRO);
      if (url.includes('/entregas/cargas/c1/pacotes')) return pacotesFalham ? json(500, { error: 'Erro interno do servidor' }) : json(200, lista());
      return json(404, { error: `inesperado ${init?.method} ${url}` });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function abrir() {
    return render(
      <MemoryRouter initialEntries={['/entregas/distritos/c1']}>
        <Toaster />
        <Routes>
          <Route path="/entregas/distritos/:cargaId" element={<DistritoPacotesPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const edicoes = () => fetchMock.mock.calls.filter(([url, init]) => /\/entregas\/pacotes\/[^/]+$/.test(url) && init?.method === 'PATCH');

  it('mostra os sinais da API como selos com rótulo, e a tela fala "rota"', async () => {
    abrir();
    const selos = await screen.findByRole('list', { name: 'Sinalizações de AA123456785BR' });
    expect(within(selos).getByText('Divergência')).toBeInTheDocument();
    expect(within(selos).getByText('Mediação recusada')).toBeInTheDocument();
    expect(selos.querySelector('[data-sinal="caso_recusado:opt_out"]')).toHaveAttribute('title', expect.stringContaining('pediu para não receber'));
    expect(screen.queryByRole('list', { name: 'Sinalizações de OY716488072BR' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Voltar ao quadro de rotas' })).toHaveClass('min-h-11');
    expect(document.body).not.toHaveTextContent(/distrito/i);
  });

  it('o cabeçalho traz o carteiro e a hora da liberação (do quadro do dia)', async () => {
    abrir();
    await waitFor(() => expect(document.querySelector('[data-cabecalho-rota]')).toHaveTextContent('Carteiro: Marcos Paulo Lima · liberada às 08:12'));
    const chamada = fetchMock.mock.calls.find(([url]) => url.includes('/entregas/quadro'));
    expect(chamada?.[0]).toBe('/api/v1/entregas/quadro?data=2026-09-30');
  });

  it('edição: avisa antes que o WhatsApp novo dispara o aviso, manda só o que mudou e confirma o envio', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url, init) => {
      if (url.includes('/entregas/quadro')) return json(200, QUADRO);
      if (init?.method === 'PATCH') {
        return json(200, { id: 'p2', codigo: 'OY716488072BR', whatsapp: '+5561984607712', status: 'AGUARDANDO_LIBERACAO', rotulo: 'Agendado', descadastrado: false, avisoSolicitado: true, endereco: ENDERECO });
      }
      return json(200, lista());
    });
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Editar OY716488072BR' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar OY716488072BR' });
    const whatsapp = within(dialogo).getByLabelText('WhatsApp do destinatário');
    expect(whatsapp).toHaveFocus();
    expect(dialogo.querySelector('[data-aviso-imediato]')).toBeNull();

    await user.type(whatsapp, '(61) 98460-7712');
    expect(dialogo.querySelector('[data-aviso-imediato]')).toHaveTextContent('ao salvar, o destinatário recebe o aviso de entrega na hora');
    const complemento = within(dialogo).getByLabelText('Complemento');
    await user.type(complemento, 'Casa 2');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(edicoes()).toHaveLength(1);
    expect(edicoes()[0][0]).toBe('/api/v1/entregas/pacotes/p2');
    expect(JSON.parse(edicoes()[0][1]?.body as string)).toEqual({ whatsapp: '(61) 98460-7712', endereco: { complemento: 'Casa 2' } });
    expect(await screen.findByText(/o aviso ao destinatário foi enviado agora/)).toBeInTheDocument();
  });

  it('edição sem mudança não chama a API; WhatsApp inválido fica no campo e o diálogo continua aberto', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url, init) => {
      if (url.includes('/entregas/quadro')) return json(200, QUADRO);
      if (init?.method === 'PATCH') return json(400, { error: 'whatsapp_invalido', details: { motivo: 'sem_ddd' } });
      return json(200, lista());
    });
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Editar AA123456785BR' }));
    let dialogo = await screen.findByRole('dialog', { name: 'Editar AA123456785BR' });
    expect(within(dialogo).getByLabelText('WhatsApp do destinatário')).toHaveValue('(61) 99812-4412');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(edicoes()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Editar AA123456785BR' }));
    dialogo = await screen.findByRole('dialog', { name: 'Editar AA123456785BR' });
    const whatsapp = within(dialogo).getByLabelText('WhatsApp do destinatário');
    await user.clear(whatsapp);
    await user.type(whatsapp, '98876-1102');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByText('Informe o DDD do WhatsApp.')).toBeInTheDocument();
    expect(whatsapp).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog', { name: 'Editar AA123456785BR' })).toBeInTheDocument();
  });

  it('a Gestão não edita pacote (a API é do supervisor), nem o supervisor em data só de consulta', async () => {
    useAuthStore.setState({ user: GESTOR as never });
    useEntregasContextoStore.setState({ unidadeGestaoId: 'un1' });
    const { unmount } = abrir();
    expect(await screen.findByRole('button', { name: 'Registrar orientação para AA123456785BR' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument();
    unmount();

    useAuthStore.setState({ user: SUPERVISOR as never });
    useEntregasPacotesStore.getState().limpar();
    fetchMock.mockImplementation(async (url) => (url.includes('/entregas/quadro') ? json(200, QUADRO) : json(200, lista({ somenteLeitura: true }))));
    abrir();
    expect(await screen.findByText('Destinatário AA123456785BR')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument();
  });

  it('a Gestão troca a unidade em foco: a lista da outra unidade some e a tela explica', async () => {
    useAuthStore.setState({ user: GESTOR as never });
    useEntregasContextoStore.setState({ unidadeGestaoId: 'un1' });
    fetchMock.mockImplementation(async (url) => {
      if (url.includes('/entregas/quadro')) return json(200, QUADRO);
      if (url.includes('unidadeId=un2')) return json(404, { error: 'nao_encontrado' });
      return json(200, lista());
    });
    abrir();
    expect(await screen.findByText('Destinatário AA123456785BR')).toBeInTheDocument();

    act(() => useEntregasContextoStore.setState({ unidadeGestaoId: 'un2' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta rota não é da unidade em foco');
    expect(screen.queryByText('Destinatário AA123456785BR')).not.toBeInTheDocument();
  });

  it('a atualização automática falhando duas vezes marca a tela como desatualizada; voltando, o aviso some', async () => {
    abrir();
    expect(await screen.findByText('Destinatário AA123456785BR')).toBeInTheDocument();
    expect(document.querySelector('[data-desatualizado]')).toBeNull();
    const atualizarSozinho = () => act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    pacotesFalham = true;
    await atualizarSozinho();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u.includes('/pacotes')).length).toBe(2));
    expect(document.querySelector('[data-desatualizado]')).toBeNull();
    await atualizarSozinho();
    await waitFor(() => expect(document.querySelector('[data-desatualizado]')).toHaveTextContent(/Desatualizado · última atualização às \d{2}:\d{2}/));
    // Os dados antigos continuam na tela, sem toast de erro a cada tentativa.
    expect(screen.getByText('Destinatário AA123456785BR')).toBeInTheDocument();

    pacotesFalham = false;
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await waitFor(() => expect(document.querySelector('[data-desatualizado]')).toBeNull());
  });
});
