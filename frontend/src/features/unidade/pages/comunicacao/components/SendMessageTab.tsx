import { Send } from 'lucide-react';

interface SendMessageTabProps {
  phoneInput: string;
  setPhoneInput: (v: string) => void;
  mensagem: string;
  setMensagem: (v: string) => void;
  sending: boolean;
  handleEnviarNotificacao: () => void;
}

export default function SendMessageTab({
  phoneInput, setPhoneInput, mensagem, setMensagem, sending, handleEnviarNotificacao,
}: SendMessageTabProps) {
  return (
    <div className="max-w-lg">
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-6 flex flex-col gap-5">
        <h2 className="text-base font-semibold text-gray-900">Enviar Mensagem WhatsApp</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Numero de telefone</label>
          <input
            type="tel"
            placeholder="Ex: 5511999999999"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30"
          />
          <p className="text-xs text-gray-400">Formato internacional sem + (ex: 5511999999999)</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Mensagem</label>
          <textarea
            rows={4}
            placeholder="Digite a mensagem a ser enviada..."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30 resize-none"
          />
        </div>

        <button
          onClick={handleEnviarNotificacao}
          disabled={sending || !phoneInput.trim() || !mensagem.trim()}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#003399]/20 text-[#003399] font-medium text-sm hover:bg-[#003399]/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#003399]" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? 'Enviando...' : 'Enviar Mensagem'}
        </button>
      </div>
    </div>
  );
}
