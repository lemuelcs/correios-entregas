/** Auditoria do Cadastro: canais (token), supervisores, unidade (409), busca/páginas, avisos e erros por campo. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Toaster } from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import type { PontoRetirada } from '../entregas.types';
import { CadastroPage, TAMANHO_PAGINA_CADASTRO, paginarPontos } from '../pages/CadastroPage';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const GESTOR = { id: 'g1', nome: 'Gestão Sede', role: 'GESTAO' };
const SUPERVISOR = { id: 'u1', nome: 'Ana Ribeiro', role: 'UNIDADE', unidadeId: 'un1', unidade: { id: 'un1', nome: 'CDD Taguatinga' } };

const CANAL = { id: 'cn1', nome: 'Canal Taguatinga', baseUrl: 'https://prosio.exemplo', tipo: 'WAHA', compartilhado: false, ativo: true, unidades: 2, atualizadoEm: '2026-09-30T10:00:00.000Z' };
const UNIDADE = {
  id: 'un1', codigo: 'CDD-TAG-01', nome: 'CDD Taguatinga', tipo: 'CDD', logradouro: 'QNA 1 Lote 10', numero: '10', complemento: null,
  bairro: 'Taguatinga Norte', cidade: 'Brasília', uf: 'DF', cep: '72110010', latitude: '-15.8335', longitude: '-48.0566', ativa: true,
  canalProsioId: 'cn1', prosioUnidadeRef: null, mediacaoAtiva: false,
  canalProsio: { id: 'cn1', nome: 'Canal Taguatinga', tipo: 'WAHA', compartilhado: false, ativo: true },
  supervisoresAtivos: 1, semSupervisor: false, atualizadoEm: '2026-09-30T10:00:00.000Z',
};
const OUTRA = { ...UNIDADE, id: 'un2', codigo: 'CEE-AGC-01', nome: 'CEE Águas Claras', tipo: 'CEE' };
const SUP = { id: 's1', nome: 'Rogério Pacheco', email: 'rogerio@e2e.local', matricula: '83910047', role: 'UNIDADE', unidadeId: 'un1', unidade: { id: 'un1', nome: 'CDD Taguatinga', codigo: 'CDD-TAG-01' }, telefoneCelular: '+5561988220917', ativo: true };

const pagina = (itens: unknown[], extra: Record<string, unknown> = {}) => ({ itens, total: itens.length, pagina: 1, tamanho: 20, totalPaginas: 1, ...extra });

type Rota = (url: string, init?: RequestInit) => Response | undefined;

describe('Cadastro (auditoria)', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
  let rotas: Rota;

  beforeEach(() => {
    localStorage.setItem('accessToken', 'acesso');
    useAuthStore.setState({ user: GESTOR as never, accessToken: 'acesso' });
    useEntregasContextoStore.setState({ unidadeGestaoId: 'un1' });
    useEntregasCadastroStore.setState({ distritos: null, carteiros: null, pontos: null, canais: null, unidades: null, supervisores: null });
    rotas = () => undefined;
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url, init) => {
      const especifica = rotas(url, init);
      if (especifica) return especifica;
      const metodo = init?.method ?? 'GET';
      if (metodo === 'GET' && url.includes('/gestao/canais-prosio')) return json(200, [CANAL]);
      if (metodo === 'GET' && url.includes('/gestao/unidades')) return json(200, [UNIDADE, OUTRA]);
      if (metodo === 'GET' && url.includes('/gestao/usuarios')) return json(200, [SUP]);
      return json(404, { error: `inesperado ${metodo} ${url}` });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function abrir(aba: string) {
    return render(
      <MemoryRouter initialEntries={[`/entregas/cadastro?aba=${aba}`]}>
        <Toaster />
        <Routes>
          <Route path="/entregas/cadastro" element={<CadastroPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const chamadas = (metodo: string, trecho: string) => fetchMock.mock.calls.filter(([url, init]) => url.includes(trecho) && (init?.method ?? 'GET') === metodo);
  const corpo = (chamada: [string, RequestInit?]) => JSON.parse(chamada[1]?.body as string) as Record<string, unknown>;

  it('canal: gerar novo token pede confirmação, mostra o token uma vez, não fecha com Esc e tem "Copiar"', async () => {
    const user = userEvent.setup();
    const copiar = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copiar } });
    rotas = (url, init) => (init?.method === 'PUT' && url.includes('/gestao/canais-prosio/cn1') ? json(200, { ...CANAL, tokenEntrada: 'cet_novo_token_123' }) : undefined);
    abrir('canais');

    await user.click(await screen.findByRole('button', { name: 'Gerar novo token de Canal Taguatinga' }));
    const confirmacao = await screen.findByRole('dialog', { name: 'Gerar novo token de Canal Taguatinga?' });
    expect(confirmacao).toHaveTextContent('O token atual deixa de valer na hora');
    expect(chamadas('PUT', '/gestao/canais-prosio')).toHaveLength(0);
    await user.click(within(confirmacao).getByRole('button', { name: 'Gerar novo token' }));

    const dToken = await screen.findByRole('dialog', { name: 'Novo token de entrada' });
    expect(corpo(chamadas('PUT', '/gestao/canais-prosio/cn1')[0])).toEqual({ regenerarTokenEntrada: true });
    expect(within(dToken).getByLabelText('Token de entrada')).toHaveValue('cet_novo_token_123');
    expect(dToken).toHaveTextContent('Ele é exibido só esta vez.');
    expect(within(dToken).queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Novo token de entrada' })).toBeInTheDocument();

    await user.click(within(dToken).getByRole('button', { name: 'Copiar' }));
    expect(copiar).toHaveBeenCalledWith('cet_novo_token_123');
    expect(await within(dToken).findByText('Token copiado para a área de transferência.')).toBeInTheDocument();
    expect(within(dToken).getByRole('button', { name: 'Copiado' })).toBeInTheDocument();

    await user.click(within(dToken).getByRole('button', { name: 'Já copiei o token' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body).not.toHaveTextContent('cet_novo_token_123');
  });

  it('canal: editar manda a versão lida e não manda segredo em branco; desativar pede confirmação', async () => {
    const user = userEvent.setup();
    rotas = (url, init) => (init?.method === 'PUT' && url.includes('/gestao/canais-prosio/cn1') ? json(200, { ...CANAL, ...JSON.parse(init.body as string) }) : undefined);
    abrir('canais');

    await user.click(await screen.findByRole('button', { name: 'Editar Canal Taguatinga' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar Canal Taguatinga' });
    const nome = within(dialogo).getByLabelText('Nome');
    await user.clear(nome);
    await user.type(nome, 'Canal Tag Norte');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(corpo(chamadas('PUT', '/gestao/canais-prosio/cn1')[0])).toEqual({
      nome: 'Canal Tag Norte', baseUrl: 'https://prosio.exemplo', tipo: 'WAHA', compartilhado: false, ativo: true, atualizadoEm: CANAL.atualizadoEm,
    });

    await user.click(screen.getByRole('button', { name: 'Desativar Canal Taguatinga' }));
    const confirmar = await screen.findByRole('dialog', { name: 'Desativar Canal Taguatinga?' });
    expect(confirmar).toHaveTextContent('2 unidades usam este canal');
    await user.click(within(confirmar).getByRole('button', { name: 'Desativar canal' }));
    await waitFor(() => expect(chamadas('PUT', '/gestao/canais-prosio/cn1')).toHaveLength(2));
    expect(corpo(chamadas('PUT', '/gestao/canais-prosio/cn1')[1])).toEqual({ ativo: false, atualizadoEm: CANAL.atualizadoEm });
  });

  it('supervisor: editar situação, unidade e celular pelas rotas da Gestão', async () => {
    const user = userEvent.setup();
    rotas = (url, init) => (init?.method === 'PUT' && url.includes('/gestao/usuarios/s1') ? json(200, SUP) : undefined);
    abrir('supervisores');

    await user.click(await screen.findByRole('button', { name: 'Editar Rogério Pacheco' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar Rogério Pacheco' });
    expect(within(dialogo).getByLabelText('WhatsApp')).toHaveValue('(61) 98822-0917');
    await user.selectOptions(within(dialogo).getByLabelText('Unidade'), 'CEE Águas Claras');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Supervisor ativo' }));
    expect(dialogo).toHaveTextContent('perde o acesso na próxima ação');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [chamada] = chamadas('PUT', '/gestao/usuarios/s1');
    // O celular não mudou: não vai no pedido.
    expect(corpo(chamada)).toEqual({ nome: 'Rogério Pacheco', ativo: false, unidadeId: 'un2' });
  });

  it('unidade: 409 alterado_por_outro recarrega o registro, mantém o diálogo e a nova gravação usa a versão atual', async () => {
    const user = userEvent.setup();
    const ATUAL = { ...UNIDADE, nome: 'CDD Taguatinga Centro', ativa: true, atualizadoEm: '2026-09-30T12:30:00.000Z' };
    let tentativas = 0;
    rotas = (url, init) => {
      if (init?.method !== 'PUT' || !url.includes('/gestao/unidades/un1')) return undefined;
      tentativas += 1;
      return tentativas === 1 ? json(409, { error: 'alterado_por_outro', details: { atual: ATUAL } }) : json(200, { ...ATUAL, tipo: 'HIBRIDA' });
    };
    abrir('unidades');

    await user.click(await screen.findByRole('button', { name: 'Editar CDD Taguatinga' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar CDD Taguatinga' });
    expect(within(dialogo).getByLabelText('CEP')).toHaveValue('72110010');
    expect(within(dialogo).getByLabelText('Latitude')).toHaveValue('-15.8335');
    await user.selectOptions(within(dialogo).getByLabelText('Tipo'), 'HIBRIDA');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Unidade ativa' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Outra pessoa alterou este registro enquanto você editava');
    expect(alerta).toHaveAttribute('data-conflito', 'true');
    const recarregado = screen.getByRole('dialog', { name: 'Editar CDD Taguatinga Centro' });
    expect(within(recarregado).getByLabelText('Nome')).toHaveValue('CDD Taguatinga Centro');
    expect(within(recarregado).getByLabelText('Tipo')).toHaveValue('CDD');
    expect(within(recarregado).getByRole('checkbox', { name: 'Unidade ativa' })).toBeChecked();
    const primeira = corpo(chamadas('PUT', '/gestao/unidades/un1')[0]);
    expect(primeira).toMatchObject({ tipo: 'HIBRIDA', ativa: false, cep: '72110010', latitude: -15.8335, atualizadoEm: UNIDADE.atualizadoEm });

    await user.selectOptions(within(recarregado).getByLabelText('Tipo'), 'HIBRIDA');
    await user.click(within(recarregado).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(corpo(chamadas('PUT', '/gestao/unidades/un1')[1])).toMatchObject({ nome: 'CDD Taguatinga Centro', tipo: 'HIBRIDA', ativa: true, atualizadoEm: ATUAL.atualizadoEm });
  });

  it('erros da API vão ao campo (Zod e details.campo) e o diálogo continua aberto', async () => {
    const user = userEvent.setup();
    let resposta = json(400, { error: 'Dados inválidos', details: [{ code: 'too_small', minimum: 3, type: 'string', path: ['nome'], message: 'String must contain at least 3 character(s)' }] });
    rotas = (url, init) => (init?.method === 'PUT' && url.includes('/gestao/usuarios/s1') ? resposta.clone() : undefined);
    abrir('supervisores');

    await user.click(await screen.findByRole('button', { name: 'Editar Rogério Pacheco' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar Rogério Pacheco' });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByText('Use ao menos 3 caracteres.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Confira os campos destacados.')).toBeInTheDocument();

    resposta = json(400, { error: 'telefone_invalido', details: { campo: 'telefoneCelular', motivo: 'sem_ddd' } });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(within(dialogo).getAllByText('WhatsApp inválido. Use DDD + número, ex.: (61) 99812-4412.').length).toBeGreaterThan(0));
    expect(within(dialogo).queryByText('Use ao menos 3 caracteres.')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Editar Rogério Pacheco' })).toBeInTheDocument();
  });

  it('rotas: a aba se chama "Rotas", a busca e a página vão para a API', async () => {
    useAuthStore.setState({ user: SUPERVISOR as never });
    const user = userEvent.setup();
    const rota = (n: number) => ({ id: `d${n}`, unidadeId: 'un1', codigo: `D-${String(n).padStart(2, '0')}`, nome: `Rota ${n}`, ativo: true, carteiroPadrao: null, atualizadoEm: '2026-09-30T10:00:00.000Z' });
    rotas = (url, init) => {
      if ((init?.method ?? 'GET') !== 'GET') return undefined;
      if (url.includes('/entregas/quadro')) return json(200, { data: '2026-09-30', somenteLeitura: false, semDistritos: false, distritos: [] });
      if (url.includes('/entregas/cadastro/carteiros')) return json(200, pagina([]));
      if (url.includes('/entregas/cadastro/distritos')) {
        const q = new URL(url, 'http://x').searchParams;
        if (q.get('tamanho') === '100') return json(200, pagina([rota(1)]));
        if (q.get('busca')) return json(200, pagina([rota(7)]));
        return json(200, pagina([rota(q.get('pagina') === '2' ? 21 : 1)], { total: 21, pagina: Number(q.get('pagina') ?? 1), totalPaginas: 2 }));
      }
      return undefined;
    };
    abrir('distritos');

    expect(await screen.findByRole('tab', { name: 'Rotas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Nova rota' })).toBeInTheDocument();
    const tabela = await screen.findByRole('region', { name: 'Rotas' });
    expect(await within(tabela).findByText('Rota 1')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/distrito/i);
    expect(screen.getByText('Página 1 de 2 · 21 registros')).toBeInTheDocument();
    expect(chamadas('GET', '/entregas/cadastro/distritos').some(([u]) => u.includes(`tamanho=${TAMANHO_PAGINA_CADASTRO}`) && u.includes('pagina=1'))).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await within(tabela).findByText('Rota 21')).toBeInTheDocument();
    expect(chamadas('GET', '/entregas/cadastro/distritos').some(([u]) => u.includes('pagina=2'))).toBe(true);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar rota por código ou nome' }), 'sete');
    expect(await within(tabela).findByText('Rota 7')).toBeInTheDocument();
    const comBusca = chamadas('GET', '/entregas/cadastro/distritos').find(([u]) => u.includes('busca=sete'));
    // A busca volta à primeira página.
    expect(comBusca?.[0]).toContain('pagina=1');
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });

  it('carteiro do dia: avisa quando a API devolve carteiro_em_dois_distritos', async () => {
    useAuthStore.setState({ user: SUPERVISOR as never });
    const user = userEvent.setup();
    const carteiro = { id: 'k2', unidadeId: 'un1', nome: 'Renato Alves Costa', matricula: '81234568', whatsapp: '+5561998124413', ativo: true, possuiLogin: false, distritosPadrao: [], atualizadoEm: '2026-09-30T10:00:00.000Z' };
    const d6 = { id: 'd6', unidadeId: 'un1', codigo: 'D-06', nome: 'Ceilândia Sul', ativo: true, carteiroPadrao: null, atualizadoEm: '2026-09-30T10:00:00.000Z' };
    rotas = (url, init) => {
      if (init?.method === 'PUT' && url.includes('/escala/')) return json(200, { distritoId: 'd6', data: '2026-09-30', carteiro: { id: 'k2', nome: 'Renato Alves Costa' }, trocado: true, avisos: ['carteiro_em_dois_distritos'] });
      if (url.includes('/entregas/quadro')) {
        return json(200, { data: '2026-09-30', somenteLeitura: false, semDistritos: false, distritos: [{ distritoId: 'd6', codigo: 'D-06', nome: 'Ceilândia Sul', ativo: true, cargaId: null, carteiro: null, semCarteiro: true, status: 'PENDENTE_UPLOAD', total: 0, comWhatsapp: 0, porStatus: {}, escalonamentos: 0, liberadoEm: null }] });
      }
      if (url.includes('/entregas/cadastro/carteiros')) return json(200, pagina([carteiro]));
      if (url.includes('/entregas/cadastro/distritos')) return json(200, pagina([d6]));
      return undefined;
    };
    abrir('distritos');

    await user.selectOptions(await screen.findByLabelText('D-06 · Ceilândia Sul'), 'Renato Alves Costa');
    expect(await screen.findByText('Carteiro de hoje da rota D-06 atualizado.')).toBeInTheDocument();
    expect(await screen.findByText('Atenção: este carteiro está em mais de uma rota hoje.')).toBeInTheDocument();
    expect(chamadas('PUT', '/escala/2026-09-30')).toHaveLength(1);
  });
});

describe('paginarPontos', () => {
  const ponto = (n: number, nome = `AC Ponto ${n}`): PontoRetirada => ({ id: `p${n}`, unidadeId: 'un1', tipo: 'AGENCIA', nome, endereco: `Rua ${n}`, horario: '9h–17h', ativo: true, atualizadoEm: '2026-09-30T10:00:00.000Z' });
  const pontos = [...Array.from({ length: 24 }, (_, i) => ponto(i + 1)), ponto(25, 'Locker Águas Claras')];

  it('pagina no cliente e limita a página pedida ao total', () => {
    expect(paginarPontos(pontos, '', 1)).toMatchObject({ total: 25, pagina: 1, totalPaginas: 2 });
    expect(paginarPontos(pontos, '', 1).itens).toHaveLength(20);
    expect(paginarPontos(pontos, '', 2).itens).toHaveLength(5);
    expect(paginarPontos(pontos, '', 9).pagina).toBe(2);
  });

  it('busca por nome ou endereço, sem diferenciar acentos nem maiúsculas', () => {
    expect(paginarPontos(pontos, 'aguas', 1).itens.map((p) => p.id)).toEqual(['p25']);
    expect(paginarPontos(pontos, 'RUA 12', 1).itens.map((p) => p.id)).toEqual(['p12']);
    expect(paginarPontos(pontos, 'nada disso', 3)).toMatchObject({ total: 0, pagina: 1, totalPaginas: 1, itens: [] });
  });
});
