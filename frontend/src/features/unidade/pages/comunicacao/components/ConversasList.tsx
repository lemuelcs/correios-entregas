import { MessageSquare, Phone } from 'lucide-react';
import type { Conversa } from '@/types/comunicacao.types';

const stateColors: Record<string, string> = {
  BOT_ACTIVE: 'bg-green-100 text-green-700',
  DISPATCHER_ACTIVE: 'bg-purple-100 text-purple-700',
  PROXY_ACTIVE: 'bg-blue-100 text-blue-700',
  OPTED_OUT: 'bg-gray-100 text-gray-500',
};

const stateLabels: Record<string, string> = {
  BOT_ACTIVE: 'Bot ativo',
  DISPATCHER_ACTIVE: 'Humano',
  PROXY_ACTIVE: 'Proxy',
  OPTED_OUT: 'Opt-out',
};

const participantLabels: Record<string, string> = {
  MOTORISTA: 'Carteiro',
  DESTINATARIO: 'Destinatario',
  UNKNOWN: 'Desconhecido',
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface ConversasListProps {
  conversas: Conversa[];
  selectedId: string | null;
  loadingConversas: boolean;
  showMobileDetail: boolean;
  onSelect: (id: string) => void;
}

export default function ConversasList({ conversas, selectedId, loadingConversas, showMobileDetail, onSelect }: ConversasListProps) {
  return (
    <div className={`w-full lg:w-80 xl:w-96 shrink-0 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {conversas.length} conversa{conversas.length !== 1 ? 's' : ''}
        </p>
      </div>
      {loadingConversas && conversas.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003399]" />
        </div>
      ) : conversas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 p-6 text-center">
          <MessageSquare className="w-10 h-10 opacity-30" />
          <p className="text-sm">Nenhuma conversa ativa</p>
          <p className="text-xs">As conversas aparecerao aqui quando houver mensagens nas ultimas 24h</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
          {conversas.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedId === c.id ? 'bg-blue-50 border-l-4 border-l-[#003399]' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-gray-900">{c.phoneDisplay}</span>
                    <span className="text-xs text-gray-500 shrink-0">{formatTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gray-500">{participantLabels[c.participantType] ?? c.participantType}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stateColors[c.state] ?? 'bg-gray-100 text-gray-600'}`}>
                      {stateLabels[c.state] ?? c.state}
                    </span>
                  </div>
                  {c.ultimasMensagens[0] && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {c.ultimasMensagens[0].direction === 'OUTBOUND' ? '-> ' : '<- '}
                      {c.ultimasMensagens[0].content}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
