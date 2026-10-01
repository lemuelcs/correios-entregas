import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obterCaptureQueue } from '../captureQueue';
import { CapturaApp } from '../pages/CapturaApp';
import { novaCaptura } from './fabricas';
import { D03, fetchFalso, hojeExemplo, json, limparCaptura, logarCarteiro } from './telas.ajuda';

vi.mock('../barcode', async (original) => ({
  ...(await original<typeof import('../barcode')>()),
  precarregarLeitor: vi.fn(async () => undefined),
}));

function renderizar(caminho = '/carteiro/captura') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/carteiro/captura/*" element={<CapturaApp />} />
        <Route path="/carteiro/criar-senha" element={<p>crie sua senha</p>} />
        <Route path="/login" element={<p>login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function dataCurta(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

describe('CapturaHomePage', () => {
  beforeEach(async () => {
    await limparCaptura();
    logarCarteiro();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('UT-101 mostra "D-03 · Águas Claras Sul", a data de hoje, o contador de capturados e os contadores', async () => {
    const hoje = hojeExemplo({ contadores: { capturados: 12, paraConferir: 2 } });
    fetchFalso({
      'GET /captura/hoje': json(200, hoje),
      // Sem sinal: o envio falha na rede e as fotos seguem na fila.
      'POST /captura/capturas': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await obterCaptureQueue().add(novaCaptura());
    await obterCaptureQueue().add(novaCaptura());
    await obterCaptureQueue().add(novaCaptura());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    renderizar();

    expect(await screen.findByRole('heading', { name: 'D-03 · Águas Claras Sul' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Hoje, ${dataCurta(hoje.data)}`))).toBeInTheDocument();
    expect(screen.getByTestId('contador-capturados')).toHaveTextContent('12');
    expect(screen.getByTestId('contador-conferir')).toHaveTextContent('Para conferir: 2');
    await waitFor(() => expect(screen.getByTestId('contador-aguardando')).toHaveTextContent('Aguardando envio: 3'));
    expect(screen.getByText(/Sem conexão/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fotografar rótulo' })).toBeEnabled();
  });

  it('UT-102 sem distrito → "Você não tem distrito hoje. Fale com o supervisor." e sem o botão da câmera', async () => {
    fetchFalso({ 'GET /captura/hoje': json(200, hojeExemplo({ distritos: [], ativo: null })) });

    renderizar();

    expect(await screen.findByText('Você não tem distrito hoje. Fale com o supervisor.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fotografar rótulo' })).not.toBeInTheDocument();
  });

  it('UT-103 dois distritos → um seletor antes do botão da câmera', async () => {
    const d05 = { distritoId: 'distrito-2', codigo: 'D-05', nome: 'Vicente Pires', cargaStatus: null };
    const { chamadas } = fetchFalso({
      'GET /captura/hoje': json(200, hojeExemplo({ distritos: [D03, d05], ativo: null })),
      'PUT /captura/hoje/ativo': new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();

    renderizar();

    const seletor = await screen.findByLabelText('Distrito em que os pacotes entram');
    const botao = screen.getByRole('button', { name: 'Fotografar rótulo' });
    expect(seletor.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(seletor).getByRole('option', { name: 'D-05 · Vicente Pires' })).toBeInTheDocument();
    expect(botao).toBeDisabled();

    await user.selectOptions(seletor, 'distrito-2');

    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PUT' && c.caminho === '/captura/hoje/ativo')).toBe(true));
    expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({ distritoId: 'distrito-2' });
  });

  it('UT-104 0 capturados → "Nenhum pacote ainda"', async () => {
    fetchFalso({ 'GET /captura/hoje': json(200, hojeExemplo()) });

    renderizar();

    expect(await screen.findByText('Nenhum pacote ainda')).toBeInTheDocument();
    expect(screen.getByTestId('contador-capturados')).toHaveTextContent('0');
  });

  it('UT-105 resultado SALVO → o aviso "Pacote … salvo no D-03 · desfazer"; o desfazer chama só aquele id', async () => {
    const a = novaCaptura({ codigo: 'OY716488072BR' });
    const b = novaCaptura({ codigo: 'AA123456785BR', barcodes: { objeto: 'AA123456785BR', cepLinear: null, dataMatrixRaw: null, multiplos: false } });
    await obterCaptureQueue().add(a);
    await obterCaptureQueue().add(b);
    const { chamadas } = fetchFalso({
      'GET /captura/hoje': json(200, hojeExemplo()),
      'POST /captura/capturas': json(200, { tipo: 'SALVO', pacoteId: 'p1', atualizado: false }),
      [`POST /captura/capturas/${a.capturaId}/desfazer`]: new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();

    renderizar();

    const avisoA = await screen.findByText(/Pacote OY716488072BR salvo no D-03/);
    expect(await screen.findByText(/Pacote AA123456785BR salvo no D-03/)).toBeInTheDocument();
    expect(avisoA.closest('[role="status"]')).toHaveTextContent('Pacote OY716488072BR salvo no D-03 · desfazer');

    await user.click(within(avisoA.closest('[role="status"]') as HTMLElement).getByRole('button', { name: 'desfazer' }));

    await waitFor(() => expect(chamadas.some((c) => c.caminho.endsWith('/desfazer'))).toBe(true));
    const desfeitos = chamadas.filter((c) => c.caminho.endsWith('/desfazer'));
    expect(desfeitos).toEqual([{ metodo: 'POST', caminho: `/captura/capturas/${a.capturaId}/desfazer`, corpo: undefined }]);
    expect(screen.queryByText(/Pacote OY716488072BR salvo/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pacote AA123456785BR salvo no D-03/)).toBeInTheDocument();
  });
});
