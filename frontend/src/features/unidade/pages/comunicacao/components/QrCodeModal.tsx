import { X, RefreshCw, Loader2 } from 'lucide-react';

interface QrCodeModalProps {
  open: boolean;
  qrCode: string;
  connecting: boolean;
  onRefreshQr: () => void;
  onClose: () => void;
}

export default function QrCodeModal({ open, qrCode, connecting, onRefreshQr, onClose }: QrCodeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Conectar WhatsApp</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col items-center gap-4">
          {qrCode ? (
            <img src={qrCode} alt="QR Code" className="w-64 h-64 rounded-lg" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          )}

          <p className="text-center text-sm text-gray-500">
            Abra o WhatsApp no celular, va em <strong>Aparelhos conectados</strong> e escaneie o QR Code.
          </p>

          <div className="flex gap-3 w-full">
            <button onClick={onRefreshQr} disabled={connecting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Atualizar QR
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
