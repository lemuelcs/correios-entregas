import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import './index.css';

// Layouts
import { UnidadeShell } from './features/unidade/layout/UnidadeShell';
import { CarteiroShell } from './features/carteiro/layout/CarteiroShell';
import { DestinatarioShell } from './features/destinatario/layout/DestinatarioShell';
import { GestaoShell } from './features/gestao/layout/GestaoShell';

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
import { DashboardPage } from './features/unidade/pages/DashboardPage';
import { RecebimentoPage } from './features/unidade/pages/RecebimentoPage';
import { TriagemPage } from './features/unidade/pages/TriagemPage';
import { RoteirizacaoPage } from './features/unidade/pages/RoteirizacaoPage';
import { DespachoPage } from './features/unidade/pages/DespachoPage';
import { MonitoramentoPage } from './features/unidade/pages/MonitoramentoPage';
import { ReconciliacaoPage } from './features/unidade/pages/ReconciliacaoPage';
import { CadastrosConfigPage } from './features/unidade/pages/CadastrosConfigPage';
import { ComunicacaoPage } from './features/unidade/pages/comunicacao/ComunicacaoPage';
// Gestao (Sede) pages
import { GestaoUnidadesPage } from './features/gestao/pages/GestaoUnidadesPage';
import { GestaoSEsPage } from './features/gestao/pages/GestaoSEsPage';
import { GestaoUsuariosPage } from './features/gestao/pages/GestaoUsuariosPage';
import { GestaoAjustesPage } from './features/gestao/pages/GestaoAjustesPage';
import ComunicacaoConfigPage from './features/gestao/pages/ComunicacaoConfigPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Gestao (Sede / Corporativo) */}
        <Route path="/gestao" element={<GestaoShell />}>
          <Route index element={<GestaoUnidadesPage />} />
          <Route path="ses" element={<GestaoSEsPage />} />
          <Route path="usuarios" element={<GestaoUsuariosPage />} />
          <Route path="comunicacao" element={<ComunicacaoConfigPage />} />
          <Route path="ajustes" element={<GestaoAjustesPage />} />
          <Route path="*" element={<Navigate to="/gestao" replace />} />
        </Route>

        {/* Unidade (Gestao de uma unidade especifica) */}
        <Route path="/unidade" element={<UnidadeShell />}>
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
          <Route path="comunicacao" element={<ComunicacaoPage />} />
          <Route path="*" element={<Navigate to="/unidade" replace />} />
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

        {/* Destinatario */}
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
