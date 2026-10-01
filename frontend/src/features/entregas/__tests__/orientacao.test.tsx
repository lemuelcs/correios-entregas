/** Orientação manual na lista do distrito (US-026): ação por pacote, diálogo, contador e erros da API. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasPacotesStore } from '@/stores/entregas-pacotes.store';
import { tamanhoOrientacao } from '../components/DialogoOrientacao';
import type { ListaPacotes, PacoteDistrito } from '../entregas.types';
import { DistritoPacotesPage } from '../pages/DistritoPacotesPage';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const SUPERVISOR = { id: 'u1', nome: 'Ana Ribeiro', role: 'UNIDADE', unidadeId: 'un1', unidade: { id: 'un1', nome: 'CDD Taguatinga' } };

function pacote(id: string, codigo: string, extra: Partial<PacoteDistrito> = {}): PacoteDistrito {
  return {
    id,
    codigo,
    nome: `Destinatário ${codigo}`,
    whatsapp: '+5561998124412',
    endereco: { logradouro: 'QNA 1', numero: '10', complemento: null, bairro: 'Taguatinga Norte', cidade: 'Brasília', uf: 'DF', cep: '72110010', enderecoTexto: null, referencia: null },
    status: 'ENVIADO',
    rotulo: 'Enviado',
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

function lista(extra: Partial<ListaPacotes> = {}): ListaPacotes {
  return {
    cargaId: 'c1',
    data: '2026-09-30',
    somenteLeitura: false,
    distrito: { id: 'd1', codigo: 'D-01', nome: 'Taguatinga Norte' },
    statusCarga: 'EM_ENTREGA',
    liberada: true,
    resumo: { total: 2, comWhatsapp: 2, porStatus: { ENVIADO: 1, ENTREGUE: 1 } },
    pagina: 1,
    porPagina: 50,
    total: 2,
    totalPaginas: 1,
    pacotes: [
      pacote('p1', 'AA123456785BR'),
      pacote('p2', 'OY716488072BR', { status: 'ENTREGUE', rotulo: 'Entregue' }),
    ],
    ...extra,
  };
}

const ORIENTADA = lista({
  pacotes: [
    pacote('p1', 'AA123456785BR', {
      status: 'INTERAGINDO',
      rotulo: 'Interagindo',
      orientacaoVigente: { id: 'o1', tipo: 'MANUAL', texto: 'Deixar com o porteiro do bloco B', estado: 'ENVIADA', origem: 'SUPERVISOR', valeAPartirDe: null, pontoDesativado: false },
    }),
    pacote('p2', 'OY716488072BR', { status: 'ENTREGUE', rotulo: 'Entregue' }),
  ],
});

describe('Orientação manual do supervisor (US-026)', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    localStorage.setItem('accessToken', 'acesso');
    useAuthStore.setState({ user: SUPERVISOR as never, accessToken: 'acesso' });
    useEntregasPacotesStore.setState({ lista: null, cargaId: null });
    fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function abrir() {
    return render(
      <MemoryRouter initialEntries={['/entregas/distritos/c1']}>
        <Routes>
          <Route path="/entregas/distritos/:cargaId" element={<DistritoPacotesPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const envios = () => fetchMock.mock.calls.filter(([url, init]) => url.includes('/orientacao') && init?.method === 'POST');

  async function abrirDialogo() {
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar orientação para AA123456785BR' }));
    return screen.findByRole('dialog', { name: 'Registrar orientação' });
  }

  it('o tamanho contado é o do servidor: espaços e quebras de linha valem um', () => {
    expect(tamanhoOrientacao('')).toBe(0);
    expect(tamanhoOrientacao('  \n ')).toBe(0);
    expect(tamanhoOrientacao(' deixar   com\no porteiro ')).toBe('deixar com o porteiro'.length);
  });

  it('a ação aparece em cada pacote ainda não entregue, e some em data só de consulta', async () => {
    fetchMock.mockImplementation(async () => json(200, lista()));
    const { unmount } = abrir();
    expect(await screen.findByRole('button', { name: 'Registrar orientação para AA123456785BR' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar orientação para OY716488072BR' })).not.toBeInTheDocument();
    unmount();

    useEntregasPacotesStore.setState({ lista: null, cargaId: null });
    fetchMock.mockImplementation(async () => json(200, lista({ somenteLeitura: true })));
    abrir();
    await screen.findByText('AA123456785BR');
    expect(screen.queryByRole('button', { name: /Registrar orientação/ })).not.toBeInTheDocument();
  });

  it('registra com o texto e "vale também para amanhã", fecha o diálogo e recarrega a linha', async () => {
    let registrada = false;
    fetchMock.mockImplementation(async (url, init) => {
      if (url.includes('/entregas/pacotes/p1/orientacao') && init?.method === 'POST') {
        registrada = true;
        return json(201, { data: { id: 'o1' } });
      }
      return json(200, registrada ? ORIENTADA : lista());
    });
    abrir();
    const dialogo = await abrirDialogo();

    const campo = within(dialogo).getByLabelText('Orientação para o carteiro');
    expect(campo).toHaveFocus();
    expect(campo).toHaveAccessibleDescription(/0 de 300 caracteres/);
    await userEvent.type(campo, 'Deixar com o porteiro do bloco B');
    expect(campo).toHaveAccessibleDescription(/32 de 300 caracteres/);
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: /Vale também para amanhã/ }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar orientação' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(envios()).toHaveLength(1);
    expect(JSON.parse(String(envios()[0][1].body))).toEqual({ texto: 'Deixar com o porteiro do bloco B', valeParaAmanha: true });
    const linha = (await screen.findByText('Deixar com o porteiro do bloco B')).closest('tr') as HTMLElement;
    expect(within(linha).getByText('AA123456785BR')).toBeInTheDocument();
    expect(within(linha).getByText('Interagindo')).toBeInTheDocument();
  });

  it('vazia ou acima de 300 caracteres: avisa no diálogo sem chamar a API', async () => {
    fetchMock.mockImplementation(async () => json(200, lista()));
    abrir();
    const dialogo = await abrirDialogo();
    const enviar = within(dialogo).getByRole('button', { name: 'Registrar orientação' });

    await userEvent.click(enviar);
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Escreva a orientação para o carteiro.');

    const campo = within(dialogo).getByLabelText('Orientação para o carteiro');
    await userEvent.click(campo);
    await userEvent.paste('a'.repeat(301));
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument();
    expect(campo).toHaveAccessibleDescription(/301 de 300 caracteres/);
    expect(campo).toBeInvalid();
    await userEvent.click(enviar);
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('A orientação passa de 300 caracteres');
    expect(envios()).toHaveLength(0);
  });

  it.each([
    [409, 'pacote_entregue', 'Este pacote já consta como entregue: não cabe nova orientação.'],
    [400, 'orientacao_longa', 'A orientação passa de 300 caracteres depois da troca de CPF, telefone ou e-mail por “[removido]”. Encurte o texto.'],
    [400, 'orientacao_vazia', 'Escreva a orientação para o carteiro.'],
  ])('erro %i %s da API aparece no diálogo, que continua aberto', async (status, codigo, mensagem) => {
    fetchMock.mockImplementation(async (url, init) =>
      (url.includes('/orientacao') && init?.method === 'POST' ? json(status, { error: codigo }) : json(200, lista())));
    abrir();
    const dialogo = await abrirDialogo();
    await userEvent.type(within(dialogo).getByLabelText('Orientação para o carteiro'), 'Entregar na portaria');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar orientação' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem);
    expect(envios()).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Registrar orientação' })).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Orientação para o carteiro')).toHaveValue('Entregar na portaria');
  });

  it('Cancelar fecha sem enviar', async () => {
    fetchMock.mockImplementation(async () => json(200, lista()));
    abrir();
    const dialogo = await abrirDialogo();
    await userEvent.type(within(dialogo).getByLabelText('Orientação para o carteiro'), 'Entregar na portaria');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(envios()).toHaveLength(0);
  });
});
