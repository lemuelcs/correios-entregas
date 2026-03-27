import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import './index.css';

// Layouts
import { GestaoShell } from './features/gestao/layout/GestaoShell';
import { CarteiroShell } from './features/carteiro/layout/CarteiroShell';
import { DestinatarioShell } from './features/destinatario/layout/DestinatarioShell';

// Pages
import { LoginPage } from './pages/LoginPage';
import { CarteiroHomePage } from './features/carteiro/pages/CarteiroHomePage';
import { ColetaPage } from './features/carteiro/pages/ColetaPage';
import { RotaPage } from './features/carteiro/pages/RotaPage';
import { EntregaPage } from './features/carteiro/pages/EntregaPage';
import { EntregaOkPage } from './features/carteiro/pages/EntregaOkPage';
import { InsucessoPage } from './features/carteiro/pages/InsucessoPage';
import { ResumoPage } from './features/carteiro/pages/ResumoPage';
import { HistoricoPage } from './features/carteiro/pages/HistoricoPage';
import { DestinatarioLoginPage } from './features/destinatario/pages/DestinatarioLoginPage';
import { ObjetosPage } from './features/destinatario/pages/ObjetosPage';
import { DetalhePage } from './features/destinatario/pages/DetalhePage';
import { InteracaoPage } from './features/destinatario/pages/InteracaoPage';
import { ReagendarPage } from './features/destinatario/pages/ReagendarPage';
import { NpsPage } from './features/destinatario/pages/NpsPage';
import { AjudaPage } from './features/destinatario/pages/AjudaPage';
import { ContaPage } from './features/destinatario/pages/ContaPage';
import { DashboardPage } from './features/gestao/pages/DashboardPage';
import { RecebimentoPage } from './features/gestao/pages/RecebimentoPage';
import { TriagemPage } from './features/gestao/pages/TriagemPage';
import { RoteirizacaoPage } from './features/gestao/pages/RoteirizacaoPage';
import { DespachoPage } from './features/gestao/pages/DespachoPage';
import { MonitoramentoPage } from './features/gestao/pages/MonitoramentoPage';
import { ReconciliacaoPage } from './features/gestao/pages/ReconciliacaoPage';
import { CadastrosConfigPage } from './features/gestao/pages/CadastrosConfigPage';
import { ComunicacaoDashboardPage } from './features/gestao/pages/comunicacao/ComunicacaoDashboardPage';
import { ConfiguracaoWhatsappPage } from './features/gestao/pages/comunicacao/ConfiguracaoWhatsappPage';
import { ConversasPage, ConversaDetalhePage } from './features/gestao/pages/comunicacao/ConversasPage';
import { ProxySessionsPage } from './features/gestao/pages/comunicacao/ProxySessionsPage';
import { TemplatesPage } from './features/gestao/pages/comunicacao/TemplatesPage';
import { AnalyticsPage } from './features/gestao/pages/comunicacao/AnalyticsPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Gestão */}
        <Route path="/gestao" element={<GestaoShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="recebimento" element={<RecebimentoPage />} />
          <Route path="triagem" element={<TriagemPage />} />
          <Route path="roteirizacao" element={<RoteirizacaoPage />} />
          <Route path="despacho" element={<DespachoPage />} />
          <Route path="monitoramento" element={<MonitoramentoPage />} />
          <Route path="reconciliacao" element={<ReconciliacaoPage />} />
          <Route path="previsao" element={<CadastrosConfigPage section="previsao" />} />
          <Route path="unitizadores" element={<CadastrosConfigPage section="unitizadores" />} />
          <Route path="veiculos" element={<CadastrosConfigPage section="veiculos" />} />
          <Route path="carteiros" element={<CadastrosConfigPage section="carteiros" />} />
          <Route path="ponto" element={<CadastrosConfigPage section="ponto" />} />
          <Route path="configuracoes" element={<CadastrosConfigPage section="configuracoes" />} />
          <Route path="comunicacao" element={<ComunicacaoDashboardPage />} />
          <Route path="comunicacao/configuracao" element={<ConfiguracaoWhatsappPage />} />
          <Route path="comunicacao/conversas" element={<ConversasPage />} />
          <Route path="comunicacao/conversas/:conversaId" element={<ConversaDetalhePage />} />
          <Route path="comunicacao/proxy" element={<ProxySessionsPage />} />
          <Route path="comunicacao/templates" element={<TemplatesPage />} />
          <Route path="comunicacao/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/gestao" replace />} />
        </Route>

        {/* Carteiro */}
        <Route path="/carteiro" element={<CarteiroShell />}>
          <Route index element={<CarteiroHomePage />} />
          <Route path="coleta" element={<ColetaPage />} />
          <Route path="rota" element={<RotaPage />} />
          <Route path="entrega" element={<EntregaPage />} />
          <Route path="entrega-ok" element={<EntregaOkPage />} />
          <Route path="insucesso" element={<InsucessoPage />} />
          <Route path="resumo" element={<ResumoPage />} />
          <Route path="historico" element={<HistoricoPage />} />
          <Route path="*" element={<Navigate to="/carteiro" replace />} />
        </Route>

        {/* Destinatário */}
        <Route path="/destinatario" element={<DestinatarioShell />}>
          <Route index element={<ObjetosPage />} />
          <Route path="login" element={<DestinatarioLoginPage />} />
          <Route path="rastrear" element={<DestinatarioLoginPage initialTab="rastrear" />} />
          <Route path="detalhe" element={<DetalhePage />} />
          <Route path="interacao" element={<InteracaoPage />} />
          <Route path="reagendar" element={<ReagendarPage />} />
          <Route path="nps" element={<NpsPage />} />
          <Route path="ajuda" element={<AjudaPage />} />
          <Route path="conta" element={<ContaPage />} />
          <Route path="*" element={<Navigate to="/destinatario" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
