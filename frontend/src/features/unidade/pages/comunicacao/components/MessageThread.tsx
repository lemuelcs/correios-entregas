import type { KeyboardEvent, RefObject } from 'react';
import { MessageSquare, Phone, ChevronLeft, User, Bot, Send, LogIn, LogOut, Clock, Check, CheckCheck } from 'lucide-react';
import type { Conversa, Mensagem } from '@/types/comunicacao.types';

const stateLabels: Record<string, string> = { BOT_ACTIVE: 'Bot ativo', DISPATCHER_ACTIVE: 'Humano', PROXY_ACTIVE: 'Proxy', OPTED_OUT: 'Opt-out' };
const participantLabels: Record<string, string> = { MOTORISTA: 'Carteiro', DESTINATARIO: 'Destinatario', UNKNOWN: 'Desconhecido' };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function DeliveryIcon({ status }: { status: Mensagem['deliveryStatus'] }) {
  if (status === 'READ') return <CheckCheck className="w-3 h-3 text-blue-300 inline ml-1" />;
  if (status === 'DELIVERED') return <CheckCheck className="w-3 h-3 opacity-60 inline ml-1" />;
  if (status === 'FAILED') return <Check className="w-3 h-3 text-red-300 inline ml-1" />;
  return <Check className="w-3 h-3 opacity-50 inline ml-1" />;
}

interface MessageThreadProps {
  selectedConversa: Conversa | null;
  mensagens: Mensagem[];
  loadingMsgs: boolean;
  showMobileDetail: boolean;
  setShowMobileDetail: (v: boolean) => void;
  msgsEndRef: RefObject<HTMLDivElement | null>;
  dispatcherNome: string;
  setDispatcherNome: (v: string) => void;
  mensagemInput: string;
  setMensagemInput: (v: string) => void;
  sendingMsg: boolean;
  joiningChat: boolean;
  leavingChat: boolean;
  handleEntrar: () => void;
  handleSair: () => void;
  handleEnviarMensagem: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
}

export default function MessageThread({
  selectedConversa, mensagens, loadingMsgs, showMobileDetail, setShowMobileDetail, msgsEndRef,
  dispatcherNome, setDispatcherNome, mensagemInput, setMensagemInput,
  sendingMsg, joiningChat, leavingChat, handleEntrar, handleSair, handleEnviarMensagem, handleKeyDown,
}: MessageThreadProps) {
  return (
    <div className={`flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${showMobileDetail ? 'flex' : 'hidden lg:flex'}`}>
      {!selectedConversa ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500">
          <MessageSquare className="w-12 h-12 opacity-20" />
          <p className="text-sm">Selecione uma conversa</p>
        </div>
      ) : (
        <>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
            <button className="lg:hidden p-1 text-gray-500 hover:text-gray-900" onClick={() => setShowMobileDetail(false)}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">{selectedConversa.phoneDisplay}</p>
              <p className="text-xs text-gray-500">
                {participantLabels[selectedConversa.participantType] ?? selectedConversa.participantType}
                {' \u00b7 '}
                <span className={`font-medium ${selectedConversa.dispatcherAtivo ? 'text-purple-600' : 'text-green-600'}`}>
                  {stateLabels[selectedConversa.state] ?? selectedConversa.state}
                </span>
                {selectedConversa.dispatcherNome && <> &middot; {selectedConversa.dispatcherNome}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedConversa.dispatcherAtivo && selectedConversa.dispatcherSessionId ? (
                <button onClick={handleSair} disabled={leavingChat} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50">
                  <LogOut className="w-4 h-4" />Sair
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Seu nome" value={dispatcherNome} onChange={(e) => setDispatcherNome(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
                  <button onClick={handleEntrar} disabled={joiningChat || !dispatcherNome.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#003399] text-white hover:bg-[#002266] transition disabled:opacity-50">
                    <LogIn className="w-4 h-4" />Entrar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
            {loadingMsgs && mensagens.length === 0 ? (
              <div className="flex justify-center pt-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#003399]" /></div>
            ) : mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 h-full text-gray-500">
                <Clock className="w-8 h-8 opacity-30" /><p className="text-sm">Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.direction === 'INBOUND' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                    m.direction === 'INBOUND'
                      ? 'bg-white border border-gray-200'
                      : m.tipo === 'DISPATCHER'
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#003399] text-white'
                  }`}>
                    {m.tipo === 'DISPATCHER' && m.direction === 'OUTBOUND' && (
                      <p className="text-xs font-semibold mb-1 opacity-80 flex items-center gap-1"><User className="w-3 h-3" />{m.remetente}</p>
                    )}
                    {m.tipo === 'BOT' && m.direction === 'OUTBOUND' && (
                      <p className="text-xs font-semibold mb-1 opacity-70 flex items-center gap-1"><Bot className="w-3 h-3" />Bot</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-xs mt-1 flex items-center gap-0.5 ${m.direction === 'INBOUND' ? 'text-gray-500' : 'opacity-60'}`}>
                      {formatDateTime(m.createdAt)}
                      {m.direction === 'OUTBOUND' && <DeliveryIcon status={m.deliveryStatus} />}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={msgsEndRef} />
          </div>

          {/* Input area */}
          {selectedConversa.dispatcherAtivo && selectedConversa.dispatcherSessionId && (
            <div className="border-t border-gray-200 bg-white p-3">
              <div className="flex gap-2">
                <textarea rows={2} placeholder="Digite uma mensagem... (Enter para enviar)" value={mensagemInput} onChange={(e) => setMensagemInput(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
                <button onClick={handleEnviarMensagem} disabled={sendingMsg || !mensagemInput.trim()} className="px-4 py-2 bg-[#003399] text-white rounded-lg hover:bg-[#002266] transition disabled:opacity-50 flex items-center justify-center" title="Enviar (Enter)">
                  {sendingMsg ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Mensagem enviada como <strong>{selectedConversa.dispatcherNome}</strong></p>
            </div>
          )}

          {!selectedConversa.dispatcherAtivo && (
            <div className="border-t border-gray-200 bg-blue-50 px-4 py-2">
              <p className="text-xs text-blue-700 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" />O bot esta atendendo esta conversa. Entre na conversa para assumir o atendimento.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
