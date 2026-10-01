import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FonteGetUserMedia, type FonteCamera } from '../camera';
import { obterCaptureQueue, type BarcodesLidos } from '../captureQueue';
import { obterCaptureSync } from '../captureSync';
import { useCapturaStore } from '../captura.store';
import { CameraPage } from '../pages/CameraPage';
import { fetchFalso, hojeExemplo, limparCaptura, logarCarteiro } from './telas.ajuda';

const { decodeFalso } = vi.hoisted(() => ({ decodeFalso: vi.fn<(jpeg: Blob) => Promise<BarcodesLidos>>() }));

vi.mock('../barcode', async (original) => ({
  ...(await original<typeof import('../barcode')>()),
  decode: decodeFalso,
}));

function Local() {
  const l = useLocation();
  return <p data-testid="local">{l.pathname + l.search}</p>;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
const fonteFalsa: FonteCamera = {
  previa: null,
  iniciar: async () => undefined,
  capturar: async () => new Blob([JPEG], { type: 'image/jpeg' }),
  parar: () => undefined,
};
const criarFonteFalsa = () => fonteFalsa;

function lidos(objeto: string | null): BarcodesLidos {
  return { objeto, cepLinear: '72115040', dataMatrixRaw: null, multiplos: false };
}

function renderizar(criarFonte: () => FonteCamera = criarFonteFalsa, caminho = '/carteiro/captura/camera') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/carteiro/captura/camera" element={<CameraPage criarFonte={criarFonte} />} />
        <Route path="/carteiro/captura" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CameraPage', () => {
  beforeEach(async () => {
    await limparCaptura();
    logarCarteiro();
    useCapturaStore.setState({ hoje: hojeExemplo({ contadores: { capturados: 13, paraConferir: 0 } }), aguardando: 0 });
    vi.spyOn(obterCaptureSync(), 'sincronizar').mockResolvedValue(undefined);
    decodeFalso.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('UT-106 disparo com decodificação válida → captureQueue.add e a câmera volta pronta com "pacote N+1"', async () => {
    decodeFalso.mockResolvedValue(lidos('OY716488072BR'));
    const add = vi.spyOn(obterCaptureQueue(), 'add');
    const user = userEvent.setup();
    renderizar();
    expect(screen.getByTestId('camera-titulo')).toHaveTextContent('D-03 · pacote 14');

    const disparador = await screen.findByRole('button', { name: 'Tirar foto' });
    await waitFor(() => expect(disparador).toBeEnabled());
    await user.click(disparador);

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect(add.mock.calls[0][0]).toMatchObject({
      distritoId: 'distrito-1',
      data: hojeExemplo().data,
      codigo: 'OY716488072BR',
      codigoDigitado: false,
      barcodes: lidos('OY716488072BR'),
    });
    expect(add.mock.calls[0][0].jpeg.type).toBe('image/jpeg');
    expect(await obterCaptureQueue().listar('aguardando')).toHaveLength(1);
    expect(screen.getByTestId('camera-titulo')).toHaveTextContent('D-03 · pacote 15');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeEnabled());
    expect(obterCaptureSync().sincronizar).toHaveBeenCalled();
  });

  it('UT-107 DV inválido → "Código não confere. Fotografe de novo ou digite." e nada é enfileirado', async () => {
    decodeFalso.mockResolvedValue(lidos('OY716488071BR'));
    const add = vi.spyOn(obterCaptureQueue(), 'add');
    const user = userEvent.setup();
    renderizar();

    const disparador = await screen.findByRole('button', { name: 'Tirar foto' });
    await waitFor(() => expect(disparador).toBeEnabled());
    await user.click(disparador);

    expect(await screen.findByText('Código não confere. Fotografe de novo ou digite.')).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Digitar código' })).toBeInTheDocument();
    expect(screen.getByTestId('camera-titulo')).toHaveTextContent('pacote 14');
  });

  it('UT-108 nenhum código lido → "Digitar código"; um código digitado válido → enfileira com codigoDigitado: true', async () => {
    decodeFalso.mockResolvedValue(lidos(null));
    const add = vi.spyOn(obterCaptureQueue(), 'add');
    const user = userEvent.setup();
    renderizar();

    const disparador = await screen.findByRole('button', { name: 'Tirar foto' });
    await waitFor(() => expect(disparador).toBeEnabled());
    await user.click(disparador);
    await user.click(await screen.findByRole('button', { name: 'Digitar código' }));

    await user.type(screen.getByLabelText('Código do objeto'), 'oy 716488072-br');
    await user.click(screen.getByRole('button', { name: 'Salvar código' }));

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect(add.mock.calls[0][0]).toMatchObject({ codigo: 'OY716488072BR', codigoDigitado: true });
    expect(await screen.findByRole('button', { name: 'Tirar foto' })).toBeInTheDocument();
    expect(screen.getByTestId('camera-titulo')).toHaveTextContent('pacote 15');
  });

  it('UT-109 getUserMedia rejeita com NotAllowedError → explicação para liberar e "Digitar código"', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('negado', 'NotAllowedError'));
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    const criarReal = () => new FonteGetUserMedia();
    try {
      renderizar(criarReal);

      expect(await screen.findByText('A câmera está bloqueada para o app.')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/escolha Permitir/);
      expect(screen.getByRole('button', { name: 'Digitar código' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tirar foto' })).not.toBeInTheDocument();
      expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    } finally {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }
  });

  it('UT-110 "Cancelar" → volta ao início, sem enfileirar', async () => {
    const add = vi.spyOn(obterCaptureQueue(), 'add');
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByTestId('local')).toHaveTextContent('/carteiro/captura');
    expect(add).not.toHaveBeenCalled();
    expect(decodeFalso).not.toHaveBeenCalled();
  });

  it('UT-100 a nova captura de "Refazer foto" descarta a pendência substituída', async () => {
    decodeFalso.mockResolvedValue(lidos('OY716488072BR'));
    const { chamadas } = fetchFalso({ 'POST /captura/capturas/cap-1/descartar': new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    renderizar(criarFonteFalsa, '/carteiro/captura/camera?substitui=cap-1');

    const disparador = await screen.findByRole('button', { name: 'Tirar foto' });
    await waitFor(() => expect(disparador).toBeEnabled());
    await user.click(disparador);

    await waitFor(() => expect(chamadas).toContainEqual({ metodo: 'POST', caminho: '/captura/capturas/cap-1/descartar', corpo: undefined }));
    expect(await obterCaptureQueue().listar('aguardando')).toHaveLength(1);
  });
});
