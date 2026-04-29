import { useEffect, useState } from 'react';
import { useComunicacaoStore } from '../../../stores/comunicacao.store';
import { Panel } from '../../../shared/ui/Panel';
import { AlertBanner } from '../../../shared/ui/AlertBanner';
import { Badge } from '../../../shared/ui/Badge';
import { 
  QrCode, 
  Settings, 
  MessageSquare, 
  Terminal, 
  Trash2, 
  RefreshCcw, 
  Plus, 
  Save,
  Bot
} from 'lucide-react';

export default function ComunicacaoConfigPage() {
  const store = useComunicacaoStore();
  const [activeTab, setActiveTab] = useState<'instance' | 'flow' | 'whitelabel'>('instance');
  const [qrcode, setQrCode] = useState<string | null>(null);
  const [localFlow, setFlow] = useState<Record<string, Record<number, { type?: string; payload?: string }>>>({});
  const [localTerminology, setTerminology] = useState<Record<string, string>>({
    unit: 'Estação',
    agent: 'Motorista',
    pack: 'Encomenda',
    customer: 'Cliente',
    route: 'Rota'
  });

  useEffect(() => {
    store.fetchAdminConfig();
  }, []);

  useEffect(() => {
    if (store.adminConfig) {
      setFlow((store.adminConfig.flowDefinition as Record<string, Record<number, { type?: string; payload?: string }>>) || {});
      setTerminology(store.adminConfig.terminology || {});
    }
  }, [store.adminConfig]);

  const handleCreateInstance = async () => {
    const name = window.prompt('Digite um nome para sua instância (ex: empresa-zap):');
    if (name) {
      const res = await store.criarInstancia({ instanceName: name });
      if (res.qrcode) setQrCode(res.qrcode);
      store.fetchAdminConfig();
    }
  };

  const handleConnect = async () => {
    try {
      const res = await store.conectarInstancia();
      if (res.qrcode) setQrCode(res.qrcode);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveWhiteLabel = async () => {
    await store.saveAdminConfig({
      ...store.adminConfig,
      terminology: localTerminology,
      flowDefinition: localFlow
    });
    alert('Configurações salvas com sucesso!');
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Comunicação</h1>
          <p className="text-gray-500">Configure seu WhatsApp, Bot e Identidade Visual</p>
        </div>
        <div className="flex gap-2">
          {store.adminConfig?.configured && (
            <Badge variant={store.adminConfig.connected ? 'success' : 'warning'}>
              {store.adminConfig.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          )}
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('instance')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'instance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          <QrCode size={18} /> Instância API
        </button>
        <button 
          onClick={() => setActiveTab('flow')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'flow' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          <Bot size={18} /> Fluxo do Bot
        </button>
        <button 
          onClick={() => setActiveTab('whitelabel')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'whitelabel' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          <Settings size={18} /> White-Label
        </button>
      </div>

      <main className="min-h-[400px]">
        {/* TAB: INSTANCE */}
        {activeTab === 'instance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Panel title="Configuração da Instância" icon={<Terminal size={20}/>}>
              {!store.adminConfig?.configured ? (
                <div className="text-center py-12">
                  <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 mb-6">Nenhuma instância configurada para este Tenant.</p>
                  <button 
                    onClick={handleCreateInstance}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 mx-auto hover:bg-blue-700"
                  >
                    <Plus size={18} /> Criar Instância Agora
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 border">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Nome da Instância</p>
                    <p className="text-lg font-mono font-bold text-blue-700">{store.adminConfig.instanceName}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleConnect}
                      className="bg-green-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700"
                    >
                      <RefreshCcw size={18} /> Obter QR Code
                    </button>
                    <button 
                      onClick={() => store.excluirInstancia()}
                      className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-red-100"
                    >
                      <Trash2 size={18} /> Excluir Instância
                    </button>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Conexão WhatsApp" icon={<QrCode size={20}/>}>
              {qrcode ? (
                <div className="flex flex-col items-center">
                  <img src={qrcode} alt="QR Code WhatsApp" className="w-64 h-64 border-4 border-gray-100 rounded-xl" />
                  <p className="mt-4 text-sm text-gray-500 text-center px-8">
                    Escaneie este código com seu WhatsApp para ativar a comunicação automatizada.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-50 border-2 border-dashed rounded-xl">
                  {store.adminConfig?.connected ? (
                    <>
                      <Badge variant="success" className="mb-2">ONLINE</Badge>
                      <p className="text-gray-500">Seu número está conectado.</p>
                    </>
                  ) : (
                    <p className="text-gray-400 italic">Clique em "Obter QR Code" para conectar.</p>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* TAB: FLOW */}
        {activeTab === 'flow' && (
          <Panel title="Editor de Fluxo do Chatbot" icon={<Bot size={20}/>}>
            <div className="space-y-6">
              <AlertBanner title="Menu do Destinatário (Exemplo)">
                Defina o que acontece quando o cliente digita cada número.
              </AlertBanner>
              
              <div className="space-y-4">
                {[1, 2, 3].map((num) => (
                  <div key={num} className="flex gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <span className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
                      {num}
                    </span>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <select 
                        className="bg-white border rounded p-2"
                        value={localFlow?.ADDRESSEE?.[num]?.type || 'text'}
                        onChange={(e) => {
                          const newFlow = { ...localFlow };
                          if (!newFlow.ADDRESSEE) newFlow.ADDRESSEE = {};
                          if (!newFlow.ADDRESSEE[num]) newFlow.ADDRESSEE[num] = {};
                          newFlow.ADDRESSEE[num].type = e.target.value;
                          setFlow(newFlow);
                        }}
                      >
                        <option value="text">Enviar Texto</option>
                        <option value="status_check">Verificar Status</option>
                        <option value="handoff">Chamar Humano</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="Chave da mensagem ou Payload"
                        className="bg-white border rounded p-2"
                        value={localFlow?.ADDRESSEE?.[num]?.payload || ''}
                        onChange={(e) => {
                          const newFlow = { ...localFlow };
                          if (!newFlow.ADDRESSEE) newFlow.ADDRESSEE = {};
                          if (!newFlow.ADDRESSEE[num]) newFlow.ADDRESSEE[num] = {};
                          newFlow.ADDRESSEE[num].payload = e.target.value;
                          setFlow(newFlow);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSaveWhiteLabel}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg"
                >
                  <Save size={18} /> Salvar Fluxo
                </button>
              </div>
            </div>
          </Panel>
        )}

        {/* TAB: WHITE LABEL */}
        {activeTab === 'whitelabel' && (
          <Panel title="Personalização White-Label" icon={<Settings size={20}/>}>
            <div className="space-y-8">
              <div>
                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Taxonomia do Sistema</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Nome da Unidade/Estação</label>
                    <input 
                      type="text" 
                      className="w-full bg-gray-50 border rounded p-2"
                      value={localTerminology.unit}
                      onChange={(e) => setTerminology({...localTerminology, unit: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Nome do Agente/Motorista</label>
                    <input 
                      type="text" 
                      className="w-full bg-gray-50 border rounded p-2"
                      value={localTerminology.agent}
                      onChange={(e) => setTerminology({...localTerminology, agent: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Nome da Encomenda/Pacote</label>
                    <input 
                      type="text" 
                      className="w-full bg-gray-50 border rounded p-2"
                      value={localTerminology.pack}
                      onChange={(e) => setTerminology({...localTerminology, pack: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">IA e Inteligência</h3>
                <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex-1">
                    <p className="font-medium text-blue-800">IA Generativa (Nível 3)</p>
                    <p className="text-sm text-blue-600">Ativa o fallback para o LLM quando o bot não entende a mensagem.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    className="w-6 h-6 rounded text-blue-600"
                    checked={store.adminConfig?.llmEnabled}
                    onChange={(e) => store.saveAdminConfig({ ...store.adminConfig, llmEnabled: e.target.checked })}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSaveWhiteLabel}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg"
                >
                  <Save size={18} /> Salvar Taxonomia
                </button>
              </div>
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}
