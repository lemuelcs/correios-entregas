import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { obterCaptureQueue, type CaptureQueue } from '../captureQueue';
import { CHAVE_HOJE } from '../captura.store';

export function mensagemSaidaComFila(n: number): string {
  return n === 1
    ? '1 pacote ainda não foi enviado. Sair vai perdê-lo?'
    : `${n} pacotes ainda não foram enviados. Sair vai perdê-los?`;
}

/**
 * "Sair" do app do carteiro (US-013.EC-2): com fila pendente, pede confirmação.
 * Sair confirmado apaga a fila do aparelho (as fotos são do carteiro que sai).
 */
export function BotaoSair({ fila = obterCaptureQueue(), className }: { fila?: CaptureQueue; className?: string }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [pendentes, setPendentes] = useState<number | null>(null);

  async function sair() {
    await fila.limpar();
    localStorage.removeItem(CHAVE_HOJE);
    logout();
    navigate('/login', { replace: true });
  }

  async function aoClicar() {
    const [aguardando, enviando] = await Promise.all([fila.contar('aguardando'), fila.contar('enviando')]);
    const n = aguardando + enviando;
    if (n === 0) await sair();
    else setPendentes(n);
  }

  return (
    <>
      <button type="button" onClick={() => void aoClicar()} className={className ?? 'text-sm font-semibold underline'}>
        Sair
      </button>
      {pendentes !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sair-titulo"
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
          >
            <p id="sair-titulo" className="text-base font-semibold text-gray-900">
              {mensagemSaidaComFila(pendentes)}
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setPendentes(null)}
                className="px-4 py-2 rounded-lg bg-correios-blue text-white font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void sair()}
                className="px-4 py-2 rounded-lg border border-red-300 text-red-700 font-semibold"
              >
                Sair mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
