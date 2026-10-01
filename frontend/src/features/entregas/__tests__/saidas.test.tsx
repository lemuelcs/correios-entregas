/**
 * Monitoramento › Carregar Dados por saída (ADR-019): abas, importação direta,
 * "N aceitos, M descartados" com a lista das linhas recusadas, cartões das
 * rotas, liberação em lote, modal dos carteiros e escopo por unidade.
 * UT-106..UT-114.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { useEntregasQuadroStore } from '@/stores/entregas-quadro.store';
import type { CartaoRota, QuadroSaidas, SaidaDoDia } from '../entregas.types';
import { CarregarDadosPage } from '../pages/CarregarDadosPage';
import { abasDoDia, motivoDoDescarte, rotasLiberaveis } from '../saidas';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const T = { id: 'un1', nome: 'CDD Taguatinga' };
const A = { id: 'un2', nome: 'CDD Águas Claras' };
const SUPERVISOR = { id: 'u1', nome: 'Ana Ribeiro', role: 'UNIDADE', unidadeId: T.id, unidade: T };
const GESTOR = { id: 'g1', nome: 'Gestão Sede', role: 'GESTAO', unidadeId: null, unidade: null };

function rota(codigo: string, extra: Partial<CartaoRota> = {}): CartaoRota {
  return {
    distritoId: `d-${codigo}`,
    codigo,
    nome: `Rota ${codigo}`,
    ativo: true,
    cargaId: `c-${codigo}`,
    carteiro: { id: `k-${codigo}`, nome: `Carteiro ${codigo}` },
    semCarteiro: false,
    status: 'DADOS_CARREGADOS',
    total: 10,
    comWhatsapp: 8,
    porStatus: { AGUARDANDO_LIBERACAO: 8, SEM_WHATSAPP: 2 },
    escalonamentos: 0,
    liberadoEm: null,
    paraConferir: 0,
    transferencias: { entrada: [], saida: [] },
    saidaNumero: 1,
    unidade: T,
    ...extra,
  };
}

function saida(numero: number, extra: Partial<SaidaDoDia> = {}): SaidaDoDia {
  return {
    id: `s${numero}`, unidadeId: T.id, unidadeNome: T.nome, numero, horario: '10:00', arquivoNome: `saida-${numero}_30-09.xlsx`,
    importadaEm: '2026-09-30T11:47:00.000Z', aceitos: 37, descartados: 0, descartes: [], ...extra,
  };
}

function quadro(extra: Partial<QuadroSaidas> = {}): QuadroSaidas {
  return {
    data: '2026-09-30',
    somenteLeitura: false,
    agregado: false,
    unidade: T,
    saidas: [saida(1)],
    proximaSaida: 2,
    rotas: [
      rota('501', { status: 'EM_ENTREGA', porStatus: { ENTREGUE: 5, INSUCESSO: 1, ENVIADO: 2, SEM_WHATSAPP: 2 }, carteiro: { id: 'k1', nome: 'Marcos Paulo Lima' } }),
      rota('503', { total: 37, comWhatsapp: 28, carteiro: { id: 'k3', nome: 'Renato Alves Costa' }, nome: 'Águas Claras Sul' }),
      rota('505', { total: 31, comWhatsapp: 27, carteiro: { id: 'k5', nome: 'Diego Carvalho' } }),
      rota('506', { total: 29, comWhatsapp: 25, carteiro: null, semCarteiro: true }),
    ],
    ...extra,
  };
}

describe('saidas.ts — abas e regras', () => {
  it('UT-106 abas do dia: uma por saída importada, a próxima "Aguardando arquivo e horário" e "Sem saída" só quando existe', () => {
    const q = quadro({ saidas: [saida(1), saida(2, { horario: '14:00' })], proximaSaida: 3, rotas: [rota('501'), rota('502'), rota('509', { saidaNumero: 2 })] });
    expect(abasDoDia(q).map((a) => [a.aba, a.titulo, a.sub])).toEqual([
      [1, 'Saída 1 · 10:00', 'Importada às 08h47 · 2 rotas'],
      [2, 'Saída 2 · 14:00', 'Importada às 08h47 · 1 rota'],
      [3, 'Saída 3', 'Aguardando arquivo e horário'],
    ]);

    const comSemSaida = abasDoDia({ ...q, rotas: [...q.rotas, rota('900', { saidaNumero: null })] });
    expect(comSemSaida.at(-1)).toEqual(expect.objectContaining({ aba: 'sem', titulo: 'Sem saída', sub: '1 rota fora de uma saída' }));

    // Data passada: não há "próxima saída". Todas as unidades: uma aba por número, somando as unidades.
    expect(abasDoDia({ ...q, somenteLeitura: true }).map((a) => a.aba)).toEqual([1, 2]);
    const agregado = abasDoDia({ ...q, agregado: true, saidas: [saida(1), saida(1, { id: 'x', unidadeId: A.id, unidadeNome: A.nome, horario: '09:30' })], rotas: [rota('501'), rota('601', { unidade: A })] });
    expect(agregado[0]).toEqual(expect.objectContaining({ titulo: 'Saída 1', sub: '2 unidades · 2 rotas' }));
  });

  it('UT-107 liberação em lote só leva rota carregada, com carteiro e com alguém a avisar; motivos em palavras', () => {
    const rotas = [
      rota('1'),
      rota('2', { semCarteiro: true, carteiro: null }),
      rota('3', { status: 'LIBERADO' }),
      rota('4', { comWhatsapp: 0 }),
      rota('5'),
    ];
    expect(rotasLiberaveis(rotas).map((r) => r.codigo)).toEqual(['1', '5']);

    expect(motivoDoDescarte({ motivo: 'sem_ddd' })).toBe('WhatsApp sem DDD');
    expect(motivoDoDescarte({ motivo: 'ja_no_distrito', detalhe: '502' })).toBe('O pacote já está na rota 502 hoje');
    expect(motivoDoDescarte({ motivo: 'rota_em_outra_saida', detalhe: '1' })).toBe('A rota já foi carregada na Saída 1 hoje');
    expect(motivoDoDescarte({ motivo: 'rota_liberada' })).toContain('Rota já liberada');
  });
});

describe('Carregar Dados por saída', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
  let atual: QuadroSaidas;

  const chamadas = (trecho: string, metodo = 'GET') => fetchMock.mock.calls.filter(([u, i]) => u.includes(trecho) && (i?.method ?? 'GET') === metodo);

  beforeEach(() => {
    localStorage.setItem('accessToken', 'acesso');
    useAuthStore.setState({ user: SUPERVISOR as never, accessToken: 'acesso' });
    useEntregasQuadroStore.setState({ quadro: null });
    useEntregasContextoStore.setState({ unidadeGestaoId: null });
    useEntregasCadastroStore.setState({ unidades: null });
    atual = quadro();
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (metodo === 'GET' && url.includes('/entregas/saidas')) return json(200, atual);
      return json(404, { error: `inesperado ${metodo} ${url}` });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function abrir() {
    return render(
      <MemoryRouter initialEntries={['/entregas/carregar']}>
        <Routes>
          <Route path="/entregas/carregar" element={<CarregarDadosPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('UT-108 abas, resumo da saída, filtros e cartão da rota (código, carteiro, "N pacotes", status no feminino)', async () => {
    abrir();

    const aba1 = await screen.findByRole('tab', { name: /Saída 1 · 10:00/ });
    expect(aba1).toHaveAttribute('aria-selected', 'true');
    expect(aba1).toHaveTextContent('Importada às 08h47 · 4 rotas');
    expect(screen.getByRole('tab', { name: /Saída 2/ })).toHaveTextContent('Aguardando arquivo e horário');
    expect(screen.queryByRole('tab', { name: /Sem saída/ })).not.toBeInTheDocument();
    expect(screen.getByText('saida-1_30-09.xlsx')).toBeInTheDocument();

    const resumo = screen.getByRole('region', { name: 'Resumo da saída' });
    expect(resumo).toHaveTextContent('4rotas nesta saída');
    expect(resumo).toHaveTextContent('107pacotes');
    expect(resumo).toHaveTextContent('88com WhatsApp');
    expect(resumo).toHaveTextContent('5entregues');
    expect(resumo).toHaveTextContent('1insucessos');

    const filtros = within(screen.getByRole('group', { name: 'Filtrar rotas' })).getAllByRole('button').map((b) => b.textContent);
    expect(filtros).toEqual(['Todas 4', 'Carregada 3', 'Liberada 0', 'Em entrega 1', 'Concluída 0']);

    const r503 = screen.getByRole('article', { name: 'Rota 503' });
    expect(within(r503).getByRole('heading', { name: 'Renato Alves Costa' })).toBeInTheDocument();
    expect(r503).toHaveTextContent('37 pacotes · Águas Claras Sul');
    expect(r503).toHaveTextContent('Carregada');
    expect(r503).toHaveTextContent('28 de 37 pacotes com WhatsApp');
    expect(within(r503).getByRole('button', { name: 'Liberar rota' })).toBeEnabled();

    // Rota sem carteiro: título em destaque, sem "Liberar rota", com "Definir carteiro".
    const r506 = screen.getByRole('article', { name: 'Rota 506' });
    expect(within(r506).getByRole('heading', { name: 'Sem carteiro definido' })).toBeInTheDocument();
    expect(r506).toHaveTextContent('29 pacotes');
    expect(r506).not.toHaveTextContent('Rota 506 ·');
    expect(within(r506).queryByRole('button', { name: 'Liberar rota' })).not.toBeInTheDocument();
    expect(within(r506).getByRole('button', { name: 'Definir carteiro' })).toBeInTheDocument();

    expect(document.body).not.toHaveTextContent(/[Dd]istrito/);
    expect(document.body).not.toHaveTextContent('Pendente de upload');
    // Supervisor: sem seletor de unidade.
    expect(screen.queryByLabelText('Unidade')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Em entrega/ }));
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('data-rota'))).toEqual(['501']);

    // A saída seguinte: estado vazio do protótipo.
    await userEvent.click(screen.getByRole('tab', { name: /Saída 2/ }));
    expect(screen.getByRole('heading', { name: 'Saída 2 ainda não foi importada' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('UT-109 importar sem horário mostra "Confirme o horário da Saída N antes de importar." e não chama a API', async () => {
    abrir();
    const user = userEvent.setup();
    await screen.findByRole('tab', { name: /Saída 1/ });

    expect(screen.getByLabelText('Número da saída')).toHaveValue('2');
    expect(within(screen.getByLabelText('Número da saída')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Saída 1 (reimportar)', 'Saída 2']);
    await user.click(screen.getByRole('button', { name: 'Importar Saída 2' }));
    expect(screen.getByText('Confirme o horário da Saída 2 antes de importar.')).toBeInTheDocument();
    expect(screen.getByLabelText('Horário da saída')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Escolha o arquivo da Saída 2.')).toBeInTheDocument();
    expect(chamadas('/entregas/saidas/importar', 'POST')).toHaveLength(0);

    // Escolher uma saída já importada: horário dela e o aviso de reimportação.
    await user.selectOptions(screen.getByLabelText('Número da saída'), '1');
    expect(screen.getByLabelText('Horário da saída')).toHaveValue('10:00');
    expect(screen.getByText('A Saída 1 já foi importada às 08h47. Importar de novo substitui os dados das rotas que ainda não foram liberadas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar Saída 1' })).toBeInTheDocument();
  });

  it('UT-110 importação direta: envia número, horário e arquivo; mostra "N aceitos, M descartados" e a lista das linhas recusadas', async () => {
    const descartes = [
      { n: 7, rota: '509', codigo: 'AB123456789BR', motivo: 'digito_invalido' as const },
      { n: 8, rota: '509', codigo: 'OY526019005BR', motivo: 'sem_ddd' as const },
      { n: 9, rota: null, codigo: '', motivo: 'sem_rota' as const },
    ];
    const s2 = saida(2, { horario: '14:00', arquivoNome: 'saida-2.csv', importadaEm: '2026-09-30T16:12:00.000Z', aceitos: 5, descartados: 3, descartes });
    fetchMock.mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (metodo === 'POST' && url.includes('/entregas/saidas/importar')) {
        atual = quadro({ saidas: [saida(1), s2], proximaSaida: 3, rotas: [...quadro().rotas, rota('509', { saidaNumero: 2, total: 5, comWhatsapp: 5 })] });
        return json(201, {
          saida: s2, reimportacao: false, aceitos: 5, descartados: 3, descartes, rotas: 1,
          rotasCriadas: ['509'], rotasSemCarteiro: [], rotasLiberadas: [], carteirosNaoEncontrados: [{ rota: '509', valor: 'Fulano de Tal' }], avisos: [],
        });
      }
      if (metodo === 'GET' && url.includes('/entregas/saidas')) return json(200, atual);
      return json(404, { error: 'inesperado' });
    });
    abrir();
    const user = userEvent.setup();
    await screen.findByRole('tab', { name: /Saída 1/ });

    await user.type(screen.getByLabelText('Horário da saída'), '14:00');
    await user.upload(screen.getByLabelText(/Arquivo da saída/), new File(['rota;codigo;nome'], 'saida-2.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Importar Saída 2' }));

    const aba2 = await screen.findByRole('tab', { name: /Saída 2 · 14:00/ });
    await waitFor(() => expect(aba2).toHaveAttribute('aria-selected', 'true'));
    const [, init] = chamadas('/entregas/saidas/importar', 'POST')[0];
    const corpo = init!.body as FormData;
    expect([corpo.get('numero'), corpo.get('horario'), (corpo.get('arquivo') as File).name]).toEqual(['2', '14:00', 'saida-2.csv']);

    const resultado = screen.getByRole('region', { name: 'Resultado da importação' });
    expect(resultado).toHaveTextContent('5 aceitos, 3 descartados');
    await user.click(within(resultado).getByRole('button', { name: 'Ver linhas descartadas (3)' }));
    const linhas = within(resultado).getAllByRole('row').slice(1).map((l) => within(l).getAllByRole('cell').map((c) => c.textContent));
    expect(linhas).toEqual([
      ['7', '509', 'AB123456789BR', 'Dígito verificador do código não confere'],
      ['8', '509', 'OY526019005BR', 'WhatsApp sem DDD'],
      ['9', '—', '—', 'Linha sem rota'],
    ]);
    expect(screen.getByText(/criada no Cadastro/)).toHaveTextContent('Rota criada no Cadastro: 509.');
    expect(screen.getByText(/Fulano de Tal/)).toHaveTextContent('não foi encontrado entre os carteiros ativos');

    // O formulário volta para a próxima saída, sem horário nem arquivo.
    expect(screen.getByLabelText('Número da saída')).toHaveValue('3');
    expect(screen.getByLabelText('Horário da saída')).toHaveValue('');
    // Sem descartes, o resultado é uma linha discreta.
    await user.click(screen.getByRole('tab', { name: /Saída 1/ }));
    expect(screen.getByText('37 aceitos, nenhum descartado')).toBeInTheDocument();
  });

  it('UT-111 liberação em lote: diálogo com totais e a lista das rotas; envia só as carregadas com carteiro', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (metodo === 'POST' && url.includes('/entregas/saidas/liberar')) {
        return json(200, {
          resultados: [
            { rota: '503', cargaId: 'c-503', ok: true, avisosAgendados: 28, semWhatsapp: 9, descadastrados: 0 },
            { rota: '505', cargaId: 'c-505', ok: false, erro: 'canal_indisponivel' },
          ],
          liberadas: 1, falhas: 1, avisosAgendados: 28,
        });
      }
      if (metodo === 'GET' && url.includes('/entregas/saidas')) return json(200, atual);
      return json(404, { error: 'inesperado' });
    });
    abrir();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Liberar 2 rotas carregadas' }));
    const dialogo = screen.getByRole('dialog', { name: 'Liberar 2 rotas da Saída 1?' });
    expect(dialogo).toHaveTextContent('55 destinatários vão receber agora o aviso “sua encomenda já saiu para entrega”, com as opções de entrega.');
    expect(dialogo).toHaveTextContent('13 pacotes sem WhatsApp não serão avisados.');
    expect(dialogo).toHaveTextContent('Rotas 503, 505. Cada carteiro recebe no WhatsApp o resumo das orientações já conhecidas.');
    await user.click(within(dialogo).getByRole('button', { name: 'Liberar e enviar avisos' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [, init] = chamadas('/entregas/saidas/liberar', 'POST')[0];
    expect(JSON.parse(init!.body as string)).toEqual({ cargaIds: ['c-503', 'c-505'] });
  });

  it('UT-112 liberação de uma rota mantém o diálogo próprio ("Liberar rota 503 · Renato Alves Costa?")', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (metodo === 'POST' && url.includes('/entregas/cargas/c-503/liberar')) return json(202, { avisosAgendados: 28, semWhatsapp: 9, descadastrados: 0 });
      if (metodo === 'GET' && url.includes('/entregas/saidas')) return json(200, atual);
      return json(404, { error: 'inesperado' });
    });
    abrir();
    const user = userEvent.setup();

    await user.click(within(await screen.findByRole('article', { name: 'Rota 503' })).getByRole('button', { name: 'Liberar rota' }));
    const dialogo = screen.getByRole('dialog', { name: 'Liberar rota 503 · Renato Alves Costa?' });
    expect(dialogo).toHaveTextContent('28 destinatários vão receber agora o aviso');
    expect(dialogo).toHaveTextContent('9 pacotes sem WhatsApp não serão avisados.');
    expect(dialogo).toHaveTextContent('Ele(a) recebe no WhatsApp o resumo das orientações já conhecidas.');
    await user.click(within(dialogo).getByRole('button', { name: 'Liberar e enviar avisos' }));
    await waitFor(() => expect(chamadas('/entregas/cargas/c-503/liberar', 'POST')).toHaveLength(1));
  });

  it('UT-113 "Definir carteiro" abre o modal "Atribuir carteiros" com as rotas sem carteiro e grava o carteiro do dia (e o padrão, se marcado)', async () => {
    atual = quadro({ rotas: [...quadro().rotas, rota('507', { carteiro: null, semCarteiro: true, total: 12 })] });
    const pagina = (itens: unknown[]) => ({ itens, total: itens.length, pagina: 1, tamanho: 100, totalPaginas: 1 });
    const carteiro = (id: string, nome: string, ativo = true) => ({ id, unidadeId: T.id, nome, matricula: `8000000${id}`, whatsapp: null, ativo, possuiLogin: false, distritosPadrao: [], atualizadoEm: '2026-09-30T10:00:00.000Z' });
    fetchMock.mockImplementation(async (url, init) => {
      const metodo = init?.method ?? 'GET';
      if (metodo === 'PUT' && url.includes('/entregas/saidas/carteiros')) {
        return json(200, { resultados: [{ distritoId: 'd-507', rota: '507', ok: true, carteiro: { id: '2', nome: 'Fernanda Rocha' } }], atribuidas: 1, falhas: 0 });
      }
      if (url.includes('/entregas/cadastro/carteiros')) return json(200, pagina([carteiro('1', 'Marcos Paulo Lima'), carteiro('2', 'Fernanda Rocha'), carteiro('3', 'Desligado', false)]));
      if (metodo === 'GET' && url.includes('/entregas/saidas')) return json(200, atual);
      return json(404, { error: 'inesperado' });
    });
    abrir();
    const user = userEvent.setup();

    expect(await screen.findByRole('button', { name: 'Atribuir carteiros (2)' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('article', { name: 'Rota 507' })).getByRole('button', { name: 'Definir carteiro' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Atribuir carteiros' });
    const seletor = await within(dialogo).findByLabelText(/Carteiro da rota 507/);
    // A rota do cartão vem primeiro; só carteiros ativos; nada escolhido → não salva.
    expect(within(dialogo).getAllByRole('listitem').map((li) => li.getAttribute('data-atribuir'))).toEqual(['507', '506']);
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Escolha o carteiro', 'Marcos Paulo Lima', 'Fernanda Rocha']);
    expect(within(dialogo).getByRole('button', { name: 'Salvar carteiro' })).toBeDisabled();

    await user.selectOptions(seletor, 'Fernanda Rocha');
    await user.click(within(dialogo).getByLabelText('Definir também como carteiro padrão da rota 507'));
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar carteiro' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [, init] = chamadas('/entregas/saidas/carteiros', 'PUT')[0];
    expect(JSON.parse(init!.body as string)).toEqual({ atribuicoes: [{ distritoId: 'd-507', carteiroId: '2', definirPadrao: true }] });
  });

  it('UT-114 Gestão: seletor com "Todas as unidades" (só leitura, sem importar nem liberar) e a unidade escolhida para importar', async () => {
    useAuthStore.setState({ user: GESTOR as never, accessToken: 'acesso' });
    useEntregasCadastroStore.setState({ unidades: [T, A] as never });
    useEntregasContextoStore.setState({ unidadeGestaoId: T.id });
    const agregado = quadro({
      agregado: true,
      unidade: null,
      saidas: [saida(1, { descartes: undefined, descartados: 2 }), saida(1, { id: 'sA', unidadeId: A.id, unidadeNome: A.nome, horario: '09:30', descartes: undefined })],
      rotas: [...quadro().rotas, rota('601', { unidade: A }), rota('900', { unidade: A, saidaNumero: null })],
    });
    fetchMock.mockImplementation(async (url, init) => {
      if ((init?.method ?? 'GET') === 'GET' && url.includes('/entregas/saidas')) return json(200, url.includes('unidadeId=todas') ? agregado : atual);
      return json(404, { error: 'inesperado' });
    });
    abrir();
    const user = userEvent.setup();

    // Entra na unidade em foco: pode importar, não libera (a liberação é do supervisor).
    const seletor = await screen.findByLabelText('Unidade');
    expect(seletor).toHaveValue(T.id);
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas as unidades', 'CDD Taguatinga', 'CDD Águas Claras']);
    expect(await screen.findByRole('button', { name: 'Importar Saída 2' })).toBeEnabled();
    expect(chamadas('/entregas/saidas').at(-1)![0]).toContain(`unidadeId=${T.id}`);
    expect(screen.queryByRole('button', { name: 'Liberar rota' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atribuir carteiros (1)' })).toBeInTheDocument();

    await user.selectOptions(seletor, 'todas');
    const aba1 = await screen.findByRole('tab', { name: /Saída 1/ });
    await waitFor(() => expect(aba1).toHaveTextContent('2 unidades · 5 rotas'));
    expect(screen.getByRole('tab', { name: /Sem saída/ })).toHaveTextContent('1 rota fora de uma saída');
    expect(screen.getByRole('button', { name: /Importar Saída/ })).toBeDisabled();
    expect(screen.getByText(/Escolha uma unidade para importar/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Rota 601' })).toHaveTextContent('10 pacotes · CDD Águas Claras');
    expect(screen.getByRole('region', { name: 'Resultado da importação' })).toHaveTextContent('74 aceitos, 2 descartados');
    expect(screen.getByText('Escolha uma unidade para ver as linhas descartadas.')).toBeInTheDocument();
    for (const nome of ['Liberar rota', 'Definir carteiro', /Atribuir carteiros/, /Liberar \d+ rotas/]) {
      expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument();
    }
  });
});
