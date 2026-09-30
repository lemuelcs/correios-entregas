import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuthStore } from '@/stores/auth.store';
import { precarregarLeitor } from '../barcode';
import { obterCaptureSync, type Contadores } from '../captureSync';
import { AvisoEspaco } from '../components/AvisoEspaco';
import { BotaoSair } from '../components/BotaoSair';

/**
 * Destino provisório de `/carteiro/captura` (task_04): liga o sincronizador e
 * mostra a fila. As telas da captura (CapturaHomePage etc.) chegam na task_05.
 */
export function CapturaPlaceholderPage() {
  useAuthGuard('CARTEIRO');
  const navigate = useNavigate();
  const senhaTemporaria = useAuthStore((s) => s.user?.senhaTemporaria);
  const [contadores, setContadores] = useState<Contadores | null>(null);

  useEffect(() => {
    if (senhaTemporaria) navigate('/carteiro/criar-senha', { replace: true });
  }, [senhaTemporaria, navigate]);

  useEffect(() => {
    void precarregarLeitor();
  }, []);

  useEffect(() => {
    const sync = obterCaptureSync();
    const atualizar = () => void sync.contadores().then(setContadores);
    const desligar = sync.on(atualizar);
    sync.start();
    atualizar();
    return () => {
      desligar();
      sync.stop();
    };
  }, []);

  return (
    <div className="min-h-screen bg-correios-surface p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-correios-blue">Captura</h1>
        <BotaoSair />
      </header>
      <AvisoEspaco />
      {contadores && (
        <p className="text-sm text-gray-700">
          {contadores.aguardando} aguardando envio · {contadores.paraConferir} para conferir
        </p>
      )}
    </div>
  );
}
