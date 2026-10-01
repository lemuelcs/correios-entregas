import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuthStore } from '@/stores/auth.store';
import { precarregarLeitor } from '../barcode';
import { registrarImagemE2E } from '../camera';
import { obterCaptureQueue } from '../captureQueue';
import { obterCaptureSync } from '../captureSync';
import { useCapturaStore } from '../captura.store';
import { AvisosCaptura } from '../components/AvisosCaptura';
import { CameraPage } from './CameraPage';
import { CapturaHomePage } from './CapturaHomePage';
import { ConferirListPage } from './ConferirListPage';
import { ConferirPage } from './ConferirPage';
import { PacotePage } from './PacotePage';

/**
 * App do carteiro em `/carteiro/captura/*`: tela cheia, fora do `CarteiroShell`.
 * Protege o papel CARTEIRO, manda para "Crie sua senha" enquanto a senha é a
 * temporária, liga o sincronizador da fila e acompanha a conexão.
 */
export function CapturaApp() {
  useAuthGuard('CARTEIRO');
  const navigate = useNavigate();
  const location = useLocation();
  const senhaTemporaria = useAuthStore((s) => s.user?.senhaTemporaria);
  const carregarHoje = useCapturaStore((s) => s.carregarHoje);
  const atualizarFila = useCapturaStore((s) => s.atualizarFila);
  const receberResultado = useCapturaStore((s) => s.receberResultado);
  const definirOnline = useCapturaStore((s) => s.definirOnline);

  useEffect(() => {
    registrarImagemE2E(location.search);
  }, [location.search]);

  useEffect(() => {
    if (senhaTemporaria) navigate('/carteiro/criar-senha', { replace: true });
  }, [senhaTemporaria, navigate]);

  useEffect(() => {
    void precarregarLeitor();
  }, []);

  useEffect(() => {
    if (senhaTemporaria) return;
    const sync = obterCaptureSync();
    let recarga: ReturnType<typeof setTimeout> | undefined;
    const recarregarHoje = () => {
      clearTimeout(recarga);
      recarga = setTimeout(() => void carregarHoje(), 300);
    };
    const desligarSync = sync.on((e) => {
      if (e.tipo === 'resultado') {
        void receberResultado(e.capturaId, e.resultado);
        recarregarHoje();
      }
      void atualizarFila();
    });
    const desligarFila = obterCaptureQueue().on(() => void atualizarFila());
    const aoFicarOnline = () => {
      definirOnline(true);
      recarregarHoje();
    };
    const aoFicarOffline = () => definirOnline(false);
    window.addEventListener('online', aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    definirOnline(navigator.onLine !== false);
    sync.start();
    void carregarHoje();
    void atualizarFila();
    return () => {
      clearTimeout(recarga);
      desligarSync();
      desligarFila();
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
      sync.stop();
    };
  }, [senhaTemporaria, carregarHoje, atualizarFila, receberResultado, definirOnline]);

  return (
    <div className="min-h-dvh bg-[#F4F6F9] text-[#1B2230]">
      <Routes>
        <Route index element={<CapturaHomePage />} />
        <Route path="camera" element={<CameraPage />} />
        <Route path="conferir" element={<ConferirListPage />} />
        <Route path="conferir/:capturaId" element={<ConferirPage />} />
        <Route path="pacote/:pacoteId" element={<PacotePage />} />
        <Route path="*" element={<Navigate to="/carteiro/captura" replace />} />
      </Routes>
      <AvisosCaptura />
    </div>
  );
}
