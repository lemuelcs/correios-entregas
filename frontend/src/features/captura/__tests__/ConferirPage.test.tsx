import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCapturaStore } from '../captura.store';
import type { CamposLidos } from '../captureQueue';
import { ConferirPage } from '../pages/ConferirPage';
import { camposExemplo, fetchFalso, hojeExemplo, json, limparCaptura, logarCarteiro } from './telas.ajuda';

function Local() {
  const l = useLocation();
  return <p data-testid="local">{l.pathname + l.search}</p>;
}

function pendencia(campos: CamposLidos, over: Record<string, unknown> = {}) {
  return {
    capturaId: 'cap-1',
    tipo: 'PARA_CONFERIR',
    distritoId: 'distrito-1',
    data: hojeExemplo().data,
    codigo: campos.codigo.valor,
    capturadoEm: new Date().toISOString(),
    campos,
    motivos: [],
    distritoOrigem: null,
    temFoto: true,
    ...over,
  };
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/carteiro/captura/conferir/cap-1']}>
      <Routes>
        <Route path="/carteiro/captura/conferir/:capturaId" element={<ConferirPage />} />
        <Route path="/carteiro/captura/conferir" element={<Local />} />
        <Route path="/carteiro/captura/camera" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function abrir(campos: CamposLidos, rotas: Parameters<typeof fetchFalso>[0] = {}, over: Record<string, unknown> = {}) {
  const f = fetchFalso({ 'GET /captura/conferir': json(200, [pendencia(campos, over)]), ...rotas });
  const user = userEvent.setup();
  const r = renderizar();
  await screen.findByRole('heading', { name: 'Confira os dados' });
  return { ...f, user, ...r };
}

const salvar = () => screen.getByRole('button', { name: 'Salvar no D-03' });

describe('ConferirPage', () => {
  beforeEach(async () => {
    await limparCaptura();
    logarCarteiro();
    useCapturaStore.setState({ hoje: hojeExemplo() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('UT-091 telefone.duvida → o campo WhatsApp tem destaque e o texto explicativo', async () => {
    await abrir(camposExemplo({ whatsapp: { valor: '(61) 99340-1_87', duvida: true, fonte: 'LLM' } }));

    const campo = screen.getByLabelText('WhatsApp');
    expect(campo.closest('[data-campo]')).toHaveAttribute('data-duvida', 'true');
    expect(campo).toHaveAccessibleDescription(/Um dígito ficou ilegível\. Confira no rótulo ou deixe em branco\./);
    expect(screen.getByText('Um dígito ficou ilegível. Confira no rótulo ou deixe em branco.')).toBeInTheDocument();
    // Só o campo duvidoso é destacado.
    expect(screen.getByLabelText('Destinatário').closest('[data-campo]')).not.toHaveAttribute('data-duvida');
  });

  it('UT-092 nome apagado → "Salvar no D-03" desabilitado, com "Informe o nome do destinatário"', async () => {
    const { user } = await abrir(camposExemplo());
    expect(salvar()).toBeEnabled();

    await user.clear(screen.getByLabelText('Destinatário'));

    expect(salvar()).toBeDisabled();
    expect(screen.getByText('Informe o nome do destinatário')).toBeInTheDocument();
  });

  it('UT-093 número vazio → bloqueia; "S/N" → libera', async () => {
    const { user } = await abrir(camposExemplo());

    await user.clear(screen.getByLabelText('Número'));
    expect(salvar()).toBeDisabled();
    expect(screen.getByText('Informe o número (ou S/N)')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Número'), 'S/N');
    expect(salvar()).toBeEnabled();
  });

  it('UT-094 WhatsApp vazio → salva, e o payload leva whatsapp: null', async () => {
    const { user, chamadas } = await abrir(
      camposExemplo({ whatsapp: { valor: '(61) 99340-1_87', duvida: true, fonte: 'LLM' } }),
      { 'POST /captura/capturas/cap-1/confirmar': json(200, { tipo: 'SALVO', pacoteId: 'p1', atualizado: false }), 'GET /captura/hoje': json(200, hojeExemplo()) },
    );

    await user.clear(screen.getByLabelText('WhatsApp'));
    await user.click(salvar());

    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/carteiro/captura/conferir'));
    const envio = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/captura/capturas/cap-1/confirmar');
    expect(envio?.corpo).toMatchObject({ campos: { whatsapp: null } });
  });

  it('UT-095 WhatsApp "98876-1102" → "Número incompleto: corrija ou deixe em branco"', async () => {
    const { user } = await abrir(camposExemplo());

    await user.clear(screen.getByLabelText('WhatsApp'));
    await user.type(screen.getByLabelText('WhatsApp'), '98876-1102');

    expect(screen.getByText('Número incompleto: corrija ou deixe em branco')).toBeInTheDocument();
    expect(salvar()).toBeDisabled();
  });

  it('UT-096 CEP editado para 71919360 → consulta o CEP e preenche o endereço, mantendo o número', async () => {
    const { user, chamadas } = await abrir(camposExemplo(), {
      'GET /captura/cep/71919360': json(200, { cep: '71919360', logradouro: 'Rua 25 Norte', bairro: 'Águas Claras', cidade: 'Brasília', uf: 'DF' }),
    });

    await user.clear(screen.getByLabelText('CEP'));
    await user.type(screen.getByLabelText('CEP'), '71919360');

    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Rua 25 Norte'));
    expect(chamadas.some((c) => c.metodo === 'GET' && c.caminho === '/captura/cep/71919360')).toBe(true);
    expect(screen.getByLabelText('Bairro')).toHaveValue('Águas Claras');
    expect(screen.getByLabelText('Cidade')).toHaveValue('Brasília');
    expect(screen.getByLabelText('UF')).toHaveValue('DF');
    expect(screen.getByLabelText('Número')).toHaveValue('17');
  });

  it('UT-097 CEP 7191936 → "CEP deve ter 8 dígitos"', async () => {
    const { user, chamadas } = await abrir(camposExemplo());

    await user.clear(screen.getByLabelText('CEP'));
    await user.type(screen.getByLabelText('CEP'), '7191936');

    expect(screen.getByText('CEP deve ter 8 dígitos')).toBeInTheDocument();
    expect(salvar()).toBeDisabled();
    expect(chamadas.some((c) => c.caminho.startsWith('/captura/cep/'))).toBe(false);
  });

  it('UT-098 código editado para AA123456784BR → "Código não confere"', async () => {
    const { user } = await abrir(camposExemplo());
    expect(screen.getByText('Dígito verificador confere')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Código do objeto'));
    await user.type(screen.getByLabelText('Código do objeto'), 'AA123456784BR');

    expect(screen.getByText('Código não confere')).toBeInTheDocument();
    expect(screen.queryByText('Dígito verificador confere')).not.toBeInTheDocument();
    expect(salvar()).toBeDisabled();
  });

  it('UT-099 sair e voltar → as edições persistem (rascunho local por capturaId)', async () => {
    const { user, unmount } = await abrir(camposExemplo());
    await user.clear(screen.getByLabelText('Destinatário'));
    await user.type(screen.getByLabelText('Destinatário'), 'ALINE R. SOUZA');
    unmount();

    renderizar();
    await screen.findByRole('heading', { name: 'Confira os dados' });
    expect(screen.getByLabelText('Destinatário')).toHaveValue('ALINE R. SOUZA');
  });

  it('UT-100 "Refazer foto" → abre a câmera ligada à mesma pendência', async () => {
    const { user } = await abrir(camposExemplo());

    await user.click(screen.getByRole('button', { name: 'Refazer foto' }));

    expect(screen.getByTestId('local')).toHaveTextContent('/carteiro/captura/camera?substitui=cap-1');
  });

  it('transferência: "Este pacote está no D-01 hoje. Trazer para o D-03?" e confirma com confirmarTransferencia', async () => {
    const { user, chamadas } = await abrir(
      camposExemplo(),
      { 'POST /captura/capturas/cap-1/confirmar': json(200, { tipo: 'SALVO', pacoteId: 'p1', atualizado: false }), 'GET /captura/hoje': json(200, hojeExemplo()) },
      { tipo: 'TRANSFERENCIA_PENDENTE', distritoOrigem: 'D-01' },
    );

    await user.click(salvar());
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Este pacote está no D-01 hoje. Trazer para o D-03?');
    await user.click(screen.getByRole('button', { name: 'Trazer para o D-03' }));

    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/carteiro/captura/conferir'));
    const envio = chamadas.find((c) => c.caminho === '/captura/capturas/cap-1/confirmar');
    expect(envio?.corpo).toMatchObject({ confirmarTransferencia: true });
  });
});
