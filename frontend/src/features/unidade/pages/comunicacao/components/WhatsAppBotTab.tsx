import { useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle, Loader2, RefreshCcw, Save, ShieldAlert, ShieldCheck,
  Trash2, Webhook, Wifi, WifiOff, XCircle, RotateCcw, QrCode, Plus,
} from 'lucide-react';
import { api } from '@/services/api';
import type { AdminConfig, WhatsAppBotFormData, SetWppPilotFormData, InstanceCheckResult } from '@/types/comunicacao.types';

interface WhatsAppBotTabProps {
  wppPilot: AdminConfig | null;
  wppPilotForm: WhatsAppBotFormData;
  setWppPilotForm: SetWppPilotFormData;
  wppPilotSaving: boolean;
  wppPilotConfiguringWebhook: boolean;
  creatingInstance: boolean;
  connecting: boolean;
  restarting: boolean;
  deleting: boolean;
  onRefresh: () => void;
  onSave: () => void;
  onReconfigureWebhook: () => void;
  onCreateInstance: () => void;
  onConnectInstance: () => void;
  onRestartInstance: () => void;
  onDeleteInstance: () => void;
}

function formatDT(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

export default function WhatsAppBotTab({
  wppPilot, wppPilotForm, setWppPilotForm, wppPilotSaving, wppPilotConfiguringWebhook,
  creatingInstance, connecting, restarting, deleting,
  onRefresh, onSave, onReconfigureWebhook, onCreateInstance, onConnectInstance, onRestartInstance, onDeleteInstance,
}: WhatsAppBotTabProps) {
  const [instanceCheck, setInstanceCheck] = useState<InstanceCheckResult | null>(null);
  const [instanceChecking, setInstanceChecking] = useState(false);
  const [evolutionInstances, setEvolutionInstances] = useState<{ name: string; connectionStatus?: string }[] | null>(null);
  const [loadingInstances, setLoadingInstances] = useState(false);

  const handleLoadInstances = async () => {
    try {
      setLoadingInstances(true);
      const result = await api.get<{ instances: { name: string; connectionStatus?: string }[] }>('/comunicacao/admin/instance/listar');
      setEvolutionInstances(result.instances ?? []);
    } catch {
      setEvolutionInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleInstanceNameBlur = async () => {
    const name = wppPilotForm.instanceName.trim();
    if (!name) { setInstanceCheck(null); return; }
    if (wppPilot?.configured && wppPilot.instanceName === name) { setInstanceCheck(null); return; }
    try {
      setInstanceChecking(true);
      const result = await api.get<InstanceCheckResult>(`/comunicacao/admin/check-instance?instanceName=${encodeURIComponent(name)}`);
      setInstanceCheck(result);
    } catch {
      setInstanceCheck(null);
    } finally {
      setInstanceChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Status do Bot WPP-PILOT</h3>
          </div>
          <button onClick={onRefresh} className="text-gray-400 hover:text-gray-600"><RefreshCcw className="w-4 h-4" /></button>
        </div>

        {!wppPilot?.configured ? (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-sm">Nenhuma instancia configurada. Preencha o formulario abaixo para ativar o bot.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Conexao</p>
              <div className="flex items-center gap-1.5">
                {wppPilot.connected ? (<><Wifi className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">Conectado</span></>) : (<><WifiOff className="w-4 h-4 text-gray-400" /><span className="text-sm font-medium text-gray-500">Desconectado</span></>)}
              </div>
              {wppPilot.connectedAt && <p className="text-xs text-gray-400 mt-1">Desde {formatDT(wppPilot.connectedAt)}</p>}
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Webhook Evolution API</p>
              <div className="flex items-center gap-1.5">
                {wppPilot.webhook?.ok ? (<><ShieldCheck className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">Configurado</span></>) : (<><ShieldAlert className="w-4 h-4 text-red-500" /><span className="text-sm font-medium text-red-600">Desconfigurado</span></>)}
              </div>
              {wppPilot.webhook?.current?.url && <p className="text-xs text-gray-400 mt-1 truncate" title={wppPilot.webhook.current.url}>{wppPilot.webhook.current.url}</p>}
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Ultimo evento recebido</p>
              <p className="text-sm font-medium text-gray-700">{wppPilot.lastWebhookAt ? formatDT(wppPilot.lastWebhookAt) : '\u2014'}</p>
            </div>
          </div>
        )}

        {wppPilot?.configured && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
              <Webhook className="w-3.5 h-3.5" />Eventos registrados na Evolution API
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(wppPilot.webhook?.current?.events ?? []).map((ev) => (
                <span key={ev} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">{ev}</span>
              ))}
              {(wppPilot.webhook?.current?.events ?? []).length === 0 && <span className="text-xs text-blue-500 italic">Nenhum evento registrado</span>}
            </div>
          </div>
        )}
      </div>

      {/* Config form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuracao da Instancia</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da instancia (Evolution API) <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type="text" value={wppPilotForm.instanceName} onChange={(e) => { setWppPilotForm((p) => ({ ...p, instanceName: e.target.value })); setInstanceCheck(null); }} onBlur={handleInstanceNameBlur} placeholder="nome_instancia_evolution" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#003399]/30 focus:border-[#003399] text-sm pr-8 ${instanceCheck?.takenByOther ? 'border-red-400' : 'border-gray-300'}`} />
              {instanceChecking && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-gray-400" />}
            </div>
            {instanceCheck && !instanceChecking && (
              <div className="mt-1.5">
                {instanceCheck.takenByOther && <p className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3.5 h-3.5 shrink-0" />Esta instancia ja esta em uso por outro tenant.</p>}
                {!instanceCheck.takenByOther && instanceCheck.instanceExists && (
                  <p className={`flex items-center gap-1 text-xs ${instanceCheck.isConnected ? 'text-amber-600' : 'text-gray-500'}`}>
                    {instanceCheck.isConnected ? <><Wifi className="w-3.5 h-3.5 shrink-0" />Instancia encontrada e conectada.</> : <><WifiOff className="w-3.5 h-3.5 shrink-0" />Instancia encontrada, mas desconectada.</>}
                  </p>
                )}
                {!instanceCheck.takenByOther && !instanceCheck.instanceExists && <p className="flex items-center gap-1 text-xs text-gray-400"><CheckCircle className="w-3.5 h-3.5 shrink-0" />Instancia disponivel.</p>}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Nome exato da instancia criada no painel Evolution API</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numero WhatsApp (com DDI)</label>
            <input type="text" value={wppPilotForm.phoneNumber} onChange={(e) => setWppPilotForm((p) => ({ ...p, phoneNumber: e.target.value }))} placeholder="5561996522173" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003399]/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do tenant (exibido no bot)</label>
            <input type="text" value={wppPilotForm.unidadeNome} onChange={(e) => setWppPilotForm((p) => ({ ...p, unidadeNome: e.target.value }))} placeholder="Correios Entregas" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003399]/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Idioma do bot</label>
            <select value={wppPilotForm.locale} onChange={(e) => setWppPilotForm((p) => ({ ...p, locale: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003399]/30 text-sm">
              <option value="pt_BR">Portugues (Brasil)</option>
              <option value="en_US">English (US)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuso horario</label>
            <input type="text" value={wppPilotForm.timezone} onChange={(e) => setWppPilotForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="America/Sao_Paulo" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003399]/30 text-sm" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={wppPilotForm.botEnabled} onChange={(e) => setWppPilotForm((p) => ({ ...p, botEnabled: e.target.checked }))} className="rounded text-[#003399]" />
            <div><p className="text-sm font-medium text-gray-700">Bot automatico ativo</p><p className="text-xs text-gray-400">Responde automaticamente a carteiros e destinatarios</p></div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={wppPilotForm.proxyEnabled} onChange={(e) => setWppPilotForm((p) => ({ ...p, proxyEnabled: e.target.checked }))} className="rounded text-[#003399]" />
            <div><p className="text-sm font-medium text-gray-700">Canal proxy ativo</p><p className="text-xs text-gray-400">Permite comunicacao anonima carteiro &harr; destinatario</p></div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={wppPilotForm.llmEnabled} onChange={(e) => setWppPilotForm((p) => ({ ...p, llmEnabled: e.target.checked }))} className="rounded text-purple-600" />
            <div><p className="text-sm font-medium text-gray-700">IA / LLM ativo</p><p className="text-xs text-gray-400">Usa inteligencia artificial para responder mensagens nao reconhecidas pelo bot</p></div>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onSave} disabled={wppPilotSaving || !wppPilotForm.instanceName.trim() || !!instanceCheck?.takenByOther} className="flex items-center gap-2 px-4 py-2 bg-[#003399] text-white rounded-lg hover:bg-[#002266] disabled:opacity-50 text-sm font-medium">
            {wppPilotSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar e configurar webhook
          </button>
          {wppPilot?.configured && (
            <button onClick={onReconfigureWebhook} disabled={wppPilotConfiguringWebhook || wppPilot.instanceExists === false} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium">
              {wppPilotConfiguringWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}Reconfigurar webhook
            </button>
          )}
        </div>
      </div>

      {/* Instance management */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Gerenciamento da Instancia Baileys</h3>
        <p className="text-sm text-gray-500 mb-4">Crie, conecte, reinicie ou exclua a instancia Baileys (WhatsApp Web via QR Code) na Evolution API.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={onCreateInstance} disabled={creatingInstance || !wppPilotForm.instanceName.trim()} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
            {creatingInstance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{wppPilot?.connected ? 'Recriar Instancia' : 'Criar Instancia'}
          </button>
          {wppPilot?.configured && (
            <>
              <button onClick={onConnectInstance} disabled={connecting} className="flex items-center gap-2 px-4 py-2 bg-[#003399] text-white rounded-lg hover:bg-[#002266] disabled:opacity-50 text-sm font-medium">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}{wppPilot.connected ? 'Ver QR Code' : 'Conectar / QR Code'}
              </button>
              <button onClick={onRestartInstance} disabled={restarting} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium">
                {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}Reiniciar
              </button>
              <button onClick={onDeleteInstance} disabled={deleting} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Excluir Instancia
              </button>
            </>
          )}
        </div>
        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500"><strong>Criar:</strong> cria a instancia Baileys na Evolution API e exibe o QR Code para escanear com o celular. <strong>Conectar:</strong> exibe o QR Code de uma instancia ja existente. <strong>Reiniciar:</strong> reinicia a conexao sem excluir a instancia. <strong>Excluir:</strong> remove permanentemente a instancia da Evolution API.</p>
        </div>
        <div className="mt-4">
          <button onClick={handleLoadInstances} disabled={loadingInstances} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {loadingInstances ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}Verificar instancias na Evolution API
          </button>
          {evolutionInstances !== null && (
            <div className="mt-3 rounded-lg border border-gray-200 divide-y divide-gray-100">
              {evolutionInstances.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3 italic">Nenhuma instancia encontrada na Evolution API.</p>
              ) : (
                evolutionInstances.map((inst) => {
                  const isCurrent = inst.name === wppPilot?.instanceName;
                  const isOpen = inst.connectionStatus === 'open';
                  return (
                    <div key={inst.name} className={`flex items-center justify-between px-4 py-2.5 ${isCurrent ? 'bg-blue-50' : 'bg-white'}`}>
                      <div className="flex items-center gap-2">
                        {isCurrent && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">atual</span>}
                        <span className="text-sm font-mono text-gray-800">{inst.name}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOpen ? 'bg-green-100 text-green-700' : inst.connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                        {inst.connectionStatus ?? 'desconhecido'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
        {wppPilot?.webhook?.expected && (
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-medium text-gray-600 mb-2">URL esperada do webhook</p>
            <code className="text-xs text-gray-700 break-all">{wppPilot.webhook.expected.url}</code>
            <p className="text-xs font-medium text-gray-600 mt-2 mb-1">Eventos esperados</p>
            <div className="flex flex-wrap gap-1">
              {wppPilot.webhook.expected.events.map((ev) => {
                const active = (wppPilot.webhook?.current?.events ?? []).includes(ev);
                return (
                  <span key={ev} className={`text-xs px-2 py-0.5 rounded-full font-mono ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {active ? <ShieldCheck className="w-3 h-3 inline mr-0.5" /> : <XCircle className="w-3 h-3 inline mr-0.5" />}{ev}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
