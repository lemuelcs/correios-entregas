/** Auditoria do shell: menu em tela estreita como diálogo, Atendimento da Gestão sem unidade, guarda da carga e do `/auth/me`. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { EntregasShell } from '../layout/EntregasShell';
import { AtendimentoPage } from '../pages/AtendimentoPage';
import { CargaDistritoPage } from '../pages/CargaDistritoPage';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const SUPERVISOR = { id: 'u1', nome: 'Ana Ribeiro', role: 'UNIDADE', unidadeId: 'un1', unidade: { id: 'un1', nome: 'CDD Taguatinga' } };
const GESTOR = { id: 'g1', nome: 'Gestão Sede', role: 'GESTAO' };

function app(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/login" element={<p>tela de login</p>} />
        <Route path="/entregas" element={<EntregasShell />}>
          <Route path="carregar" element={<h1>Quadro</h1>} />
          <Route path="carregar/:distritoId" element={<CargaDistritoPage />} />
          <Route path="cadastro" element={<h1>Cadastro</h1>} />
          <Route path="atendimento" element={<AtendimentoPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Shell da área Entregas (auditoria)', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    localStorage.setItem('accessToken', 'acesso');
    useAuthStore.setState({ user: SUPERVISOR as never, accessToken: 'acesso' });
    useEntregasContextoStore.setState({ unidadeGestaoId: null });
    useEntregasCadastroStore.setState({ unidades: null });
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url, init) => json(404, { error: `inesperado ${init?.method} ${url}` }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('menu em tela estreita: abre como diálogo modal, leva o foco para dentro, prende o Tab e fecha no Esc', async () => {
    const user = userEvent.setup();
    app('/entregas/cadastro');
    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await user.click(botao);

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-modal', 'true');
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    // Foco no item da página atual.
    expect(within(menu).getByRole('link', { name: 'Cadastro' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    // O Tab dá a volta dentro do menu: do último ("Sair") ao primeiro ("Fechar menu").
    within(menu).getByRole('button', { name: 'Sair' }).focus();
    await user.tab();
    expect(within(menu).getByRole('button', { name: 'Fechar menu' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(menu).getByRole('button', { name: 'Sair' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('Gestão sem unidade em foco: o Atendimento abre quando há um único canal ativo', async () => {
    useAuthStore.setState({ user: GESTOR as never });
    fetchMock.mockImplementation(async (url, init) => {
      if (url.includes('/gestao/unidades')) return json(200, []);
      if (url.includes('/entregas/atendimento/sessao')) return json(200, { url: 'https://chat.exemplo/app?sso_token=abc', expiraEm: '2026-09-30T12:00:00.000Z' });
      return json(404, { error: `inesperado ${init?.method} ${url}` });
    });
    app('/entregas/atendimento');

    expect(await screen.findByTitle('Chatwoot — conversas da unidade')).toHaveAttribute('src', 'https://chat.exemplo/app?sso_token=abc');
    const sessao = fetchMock.mock.calls.find(([u]) => u.includes('/atendimento/sessao'));
    expect(JSON.parse(sessao?.[1]?.body as string)).toEqual({});
    expect(screen.queryByText('Escolha a unidade em foco no menu para ver os dados.')).not.toBeInTheDocument();
  });

  it('Gestão sem unidade e vários canais: a tela pede a unidade, sem culpar o Chatwoot', async () => {
    useAuthStore.setState({ user: GESTOR as never });
    fetchMock.mockImplementation(async (url) => {
      if (url.includes('/gestao/unidades')) return json(200, []);
      return json(400, { error: 'unidade_obrigatoria', details: { mensagem: 'Escolha a unidade para abrir o atendimento' } });
    });
    app('/entregas/atendimento');

    const alerta = await screen.findByRole('alert', { name: 'Escolha a unidade' });
    expect(alerta).toHaveTextContent('Há mais de um canal de WhatsApp ativo');
    expect(screen.queryByText(/O Chatwoot não respondeu/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Abrir em nova aba/ })).not.toBeInTheDocument();
  });

  it('Gestão que abre /entregas/carregar/:id pela URL vê a explicação, não o formulário de envio', async () => {
    useAuthStore.setState({ user: GESTOR as never });
    useEntregasContextoStore.setState({ unidadeGestaoId: 'un1' });
    fetchMock.mockImplementation(async (url) => (url.includes('/gestao/unidades') ? json(200, [{ id: 'un1', nome: 'CDD Taguatinga' }]) : json(404, { error: 'nao_encontrado' })));
    app('/entregas/carregar/d1');

    expect(await screen.findByRole('heading', { name: 'O carregamento é feito pelo supervisor da unidade' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao quadro de rotas' })).toHaveAttribute('href', '/entregas/carregar');
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Enviar planilha' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => u.includes('/entregas/quadro'))).toBe(false);
  });

  it('o supervisor continua vendo o formulário de envio', async () => {
    fetchMock.mockImplementation(async (url) => (url.includes('/entregas/quadro')
      ? json(200, { data: '2026-09-30', somenteLeitura: false, semDistritos: false, distritos: [{ distritoId: 'd1', codigo: 'D-01', nome: 'Taguatinga Norte', ativo: true, cargaId: 'c1', carteiro: { id: 'k1', nome: 'Marcos' }, semCarteiro: false, status: 'DADOS_CARREGADOS', total: 3, comWhatsapp: 2, porStatus: {}, escalonamentos: 0, liberadoEm: null }] })
      : json(404, { error: 'nao_encontrado' })));
    app('/entregas/carregar/d1');

    expect(await screen.findByRole('heading', { name: 'Taguatinga Norte' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Enviar planilha' })).toBeInTheDocument();
    for (const nome of ['← Voltar ao quadro de rotas', 'trocar só hoje', 'Ver pacotes já carregados (3)']) {
      expect(screen.getByRole('link', { name: nome })).toHaveClass('min-h-11');
    }
  });
});

describe('useAuthGuard: só o 401 de /auth/me encerra a sessão', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'acesso');
    localStorage.setItem('refreshToken', 'renovacao');
    useAuthStore.setState({ user: null, accessToken: 'acesso' });
    useEntregasContextoStore.setState({ unidadeGestaoId: null });
    vi.stubGlobal('fetch', vi.fn(async () => json(404, { error: 'nao_encontrado' })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('500 em /auth/me: mantém os tokens, não vai ao login e tenta de novo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const me = vi.spyOn(api, 'get')
      .mockRejectedValueOnce(new ApiError(500, 'Erro interno do servidor'))
      .mockResolvedValueOnce({ user: SUPERVISOR });
    app('/entregas/cadastro');

    await waitFor(() => expect(me).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument();
    expect(localStorage.getItem('accessToken')).toBe('acesso');
    expect(localStorage.getItem('refreshToken')).toBe('renovacao');
    expect(useAuthStore.getState().accessToken).toBe('acesso');

    await vi.advanceTimersByTimeAsync(2_100);
    expect(await screen.findByRole('heading', { name: 'Cadastro' })).toBeInTheDocument();
    expect(me).toHaveBeenCalledTimes(2);
  });

  it('falha de rede em /auth/me: a sessão fica (app do carteiro offline)', async () => {
    const me = vi.spyOn(api, 'get').mockRejectedValue(new TypeError('Failed to fetch'));
    app('/entregas/cadastro');

    await waitFor(() => expect(me).toHaveBeenCalled());
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument();
    expect(localStorage.getItem('accessToken')).toBe('acesso');
  });

  it('401 em /auth/me: limpa os tokens e leva ao login com o caminho de volta', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError(401, 'sessao_expirada'));
    app('/entregas/cadastro');

    expect(await screen.findByText('tela de login')).toBeInTheDocument();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
