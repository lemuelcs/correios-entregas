import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCapturaStore, type RecenteServidor, type StatusCarga } from '../captura.store';
import { PacotePage } from '../pages/PacotePage';
import { D03, fetchFalso, hojeExemplo, json, limparCaptura, logarCarteiro } from './telas.ajuda';

function Local() {
  const l = useLocation();
  return <p data-testid="local">{l.pathname}</p>;
}

const RECENTE: RecenteServidor = {
  capturaId: 'cap-1',
  pacoteId: 'p1',
  distritoId: D03.distritoId,
  codigo: 'OY716488072BR',
  nome: 'ALINE RODRIGUES',
  semWhatsapp: false,
  codigoDigitado: false,
  origem: 'FOTO',
  atualizado: false,
  processadoEm: new Date().toISOString(),
};

function comCarga(cargaStatus: StatusCarga | null) {
  useCapturaStore.setState({
    hoje: hojeExemplo({ distritos: [{ ...D03, cargaStatus }], recentes: [RECENTE], contadores: { capturados: 1, paraConferir: 0 } }),
  });
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/carteiro/captura/pacote/p1']}>
      <Routes>
        <Route path="/carteiro/captura/pacote/:pacoteId" element={<PacotePage />} />
        <Route path="/carteiro/captura" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PacotePage', () => {
  beforeEach(async () => {
    await limparCaptura();
    logarCarteiro();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('UT-120 pacote meu num distrito ABERTO → Remover; num LIBERADO → sem Remover e "Para remover, fale com o supervisor"', async () => {
    comCarga('CARREGADO');
    const { chamadas } = fetchFalso({
      'DELETE /captura/pacotes/p1': new Response(null, { status: 204 }),
      'GET /captura/hoje': json(200, hojeExemplo()),
    });
    const user = userEvent.setup();
    const { unmount } = renderizar();

    expect(screen.getByRole('heading', { name: 'OY716488072BR' })).toBeInTheDocument();
    expect(screen.queryByText('Para remover, fale com o supervisor.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    await user.click(screen.getAllByRole('button', { name: 'Remover' }).at(-1)!);
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/carteiro/captura'));
    expect(chamadas).toContainEqual({ metodo: 'DELETE', caminho: '/captura/pacotes/p1', corpo: undefined });
    unmount();

    comCarga('LIBERADO');
    renderizar();

    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    expect(screen.getByText('Para remover, fale com o supervisor.')).toBeInTheDocument();
    // Editar continua permitido depois da liberação (US-017 AC-2).
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  });

  it('edição envia só os campos alterados (PATCH /captura/pacotes/:id)', async () => {
    comCarga('CARREGADO');
    const { chamadas } = fetchFalso({
      'PATCH /captura/pacotes/p1': json(200, { id: 'p1' }),
      'GET /captura/hoje': json(200, hojeExemplo()),
    });
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText('Complemento'), 'APTO 1203');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Pacote atualizado.')).toBeInTheDocument();
    expect(chamadas.find((c) => c.metodo === 'PATCH')?.corpo).toEqual({ complemento: 'APTO 1203' });
  });
});
