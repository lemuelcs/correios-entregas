import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filaIsolada, novaCaptura } from '@/features/captura/__tests__/fabricas';
import { BotaoSair } from '@/features/captura/components/BotaoSair';
import { useAuthStore } from '@/stores/auth.store';
import { CriarSenhaPage } from '../CriarSenhaPage';
import { LoginPage } from '../LoginPage';

function json(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const CARTEIRO = { id: 'u1', nome: 'Carteiro Teste', role: 'CARTEIRO', unidadeId: 'un1', unidade: null };

function renderizar(inicial: string | { pathname: string; state?: unknown }, extra?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/carteiro/criar-senha" element={<CriarSenhaPage />} />
        <Route path="/carteiro/captura" element={<p>tela da captura</p>} />
        <Route path="/unidade" element={<p>tela da unidade</p>} />
        <Route path="/entregas/carregar" element={<p>tela carregar dados</p>} />
        <Route path="/entregas/cadastro" element={<p>tela cadastro</p>} />
        <Route path="/entregas/distritos/:cargaId" element={<p>tela pacotes do distrito</p>} />
        <Route path="/sair" element={extra} />
      </Routes>
    </MemoryRouter>,
  );
}

async function entrarComMatricula(matricula: string, senha: string) {
  const user = userEvent.setup();
  if (matricula) await user.type(screen.getByLabelText('Matrícula'), matricula);
  if (senha) await user.type(screen.getByLabelText('Senha'), senha);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  return user;
}

describe('LoginPage e troca de senha', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.setState({ user: null, accessToken: null, unidadeId: null, unidadeNome: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('UT-115 login com senhaTemporaria → redireciona para "Crie sua senha"', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { accessToken: 'a1', refreshToken: 'r1', user: { ...CARTEIRO, senhaTemporaria: true } }),
    );
    renderizar('/login');

    await entrarComMatricula('12345678', 'inicial123');

    expect(await screen.findByRole('heading', { name: 'Crie sua senha' })).toBeInTheDocument();
    // a senha do login vai em memória para a troca: o carteiro não a digita de novo
    expect(screen.queryByLabelText('Senha que o supervisor passou')).not.toBeInTheDocument();
  });

  it('UT-115 (sem senha temporária) CARTEIRO vai direto para /carteiro/captura', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { accessToken: 'a1', refreshToken: 'r1', user: { ...CARTEIRO, senhaTemporaria: false } }),
    );
    renderizar('/login');

    await entrarComMatricula('12345678', 'minhasenha1');

    expect(await screen.findByText('tela da captura')).toBeInTheDocument();
  });

  it('(merge captura × entregas) UNIDADE → /entregas/carregar e GESTAO → /entregas/cadastro', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { accessToken: 'a1', refreshToken: 'r1', user: { ...CARTEIRO, role: 'UNIDADE' } }),
    );
    const { unmount } = renderizar('/login');
    await entrarComMatricula('12345678', 'minhasenha1');
    expect(await screen.findByText('tela carregar dados')).toBeInTheDocument();
    unmount();

    useAuthStore.setState({ user: null, accessToken: null, unidadeId: null, unidadeNome: null });
    fetchMock.mockResolvedValueOnce(
      json(200, { accessToken: 'a2', refreshToken: 'r2', user: { ...CARTEIRO, role: 'GESTAO', unidadeId: null } }),
    );
    renderizar('/login');
    await entrarComMatricula('12345678', 'minhasenha1');
    expect(await screen.findByText('tela cadastro')).toBeInTheDocument();
  });

  it('(merge captura × entregas) ?voltar= da área do papel é respeitado; o de outra área, não', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { accessToken: 'a1', refreshToken: 'r1', user: { ...CARTEIRO, role: 'UNIDADE' } }),
    );
    const { unmount } = renderizar(`/login?voltar=${encodeURIComponent('/entregas/distritos/c1')}`);
    await entrarComMatricula('12345678', 'minhasenha1');
    expect(await screen.findByText('tela pacotes do distrito')).toBeInTheDocument();
    unmount();

    useAuthStore.setState({ user: null, accessToken: null, unidadeId: null, unidadeNome: null });
    fetchMock.mockResolvedValueOnce(
      json(200, { accessToken: 'a2', refreshToken: 'r2', user: { ...CARTEIRO, senhaTemporaria: false } }),
    );
    renderizar(`/login?voltar=${encodeURIComponent('/entregas/carregar')}`);
    await entrarComMatricula('12345678', 'minhasenha1');
    expect(await screen.findByText('tela da captura')).toBeInTheDocument();
  });

  it('UT-116 depois da troca → redireciona para /carteiro/captura', async () => {
    localStorage.setItem('accessToken', 'a1');
    useAuthStore.setState({ accessToken: 'a1', user: { ...CARTEIRO, role: 'CARTEIRO', senhaTemporaria: true } });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderizar({ pathname: '/carteiro/criar-senha', state: { senhaAtual: 'inicial123' } });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nova senha'), 'minhaSenha2026');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'minhaSenha2026');
    await user.click(screen.getByRole('button', { name: 'Salvar e entrar' }));

    expect(await screen.findByText('tela da captura')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/auth/trocar-senha');
    expect(JSON.parse(init.body as string)).toEqual({ senhaAtual: 'inicial123', novaSenha: 'minhaSenha2026' });
    expect(useAuthStore.getState().user?.senhaTemporaria).toBe(false);
  });

  it('UT-116 (política) senha curta ou diferente na repetição não chama a API', async () => {
    localStorage.setItem('accessToken', 'a1');
    useAuthStore.setState({ accessToken: 'a1' });
    renderizar({ pathname: '/carteiro/criar-senha', state: { senhaAtual: 'inicial123' } });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nova senha'), 'curta');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'curta');
    await user.click(screen.getByRole('button', { name: 'Salvar e entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('de 8 a 72 caracteres');

    await user.clear(screen.getByLabelText('Nova senha'));
    await user.type(screen.getByLabelText('Nova senha'), 'minhaSenha2026');
    await user.click(screen.getByRole('button', { name: 'Salvar e entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('não são iguais');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a tela só oferece matrícula e senha: sem abas de CPF ou email', async () => {
    renderizar('/login');
    expect(screen.getByLabelText('Matrícula')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'CPF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Matrícula' })).not.toBeInTheDocument();
  });

  it('UT-117 Entrar com os campos vazios → não envia e destaca os campos', async () => {
    renderizar('/login');

    await entrarComMatricula('', '');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Matrícula')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Informe a matrícula.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
  });

  it('UT-118 offline no primeiro login (sem tokens) → "Sem conexão. O primeiro acesso precisa de internet."', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderizar('/login');

    await entrarComMatricula('12345678', 'inicial123');

    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão. O primeiro acesso precisa de internet.');
    expect(fetchMock).not.toHaveBeenCalled();

    // navigator.onLine mente às vezes: a falha de rede do fetch dá a mesma mensagem
    onLine.mockReturnValue(true);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão. O primeiro acesso precisa de internet.'),
    );
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('UT-119 "Sair" com 3 itens aguardando → diálogo; cancelar mantém a sessão', async () => {
    const fila = filaIsolada();
    for (let i = 0; i < 3; i++) await fila.add(novaCaptura());
    localStorage.setItem('accessToken', 'a1');
    localStorage.setItem('refreshToken', 'r1');
    useAuthStore.setState({ accessToken: 'a1', user: { ...CARTEIRO, role: 'CARTEIRO' } });
    renderizar('/sair', <BotaoSair fila={fila} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('3 pacotes ainda não foram enviados. Sair vai perdê-los?');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('a1');
    expect(localStorage.getItem('refreshToken')).toBe('r1');
    expect(await fila.contar('aguardando')).toBe(3);
    expect(fetchMock).not.toHaveBeenCalled(); // nem logout no servidor
  });

  it('UT-119 (confirmar) "Sair mesmo assim" encerra a sessão e apaga a fila', async () => {
    const fila = filaIsolada();
    await fila.add(novaCaptura());
    localStorage.setItem('accessToken', 'a1');
    localStorage.setItem('refreshToken', 'r1');
    useAuthStore.setState({ accessToken: 'a1' });
    fetchMock.mockResolvedValue(json(200, { message: 'ok' }));
    renderizar('/sair', <BotaoSair fila={fila} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('1 pacote ainda não foi enviado. Sair vai perdê-lo?');
    await user.click(screen.getByRole('button', { name: 'Sair mesmo assim' }));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(await fila.listar()).toEqual([]);
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});
