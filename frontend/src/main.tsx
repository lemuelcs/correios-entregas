import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import './index.css';

// Layouts
import { UnidadeShell } from './features/unidade/layout/UnidadeShell';
import { CarteiroShell } from './features/carteiro/layout/CarteiroShell';
import { DestinatarioShell } from './features/destinatario/layout/DestinatarioShell';
import { GestaoShell } from './features/gestao/layout/GestaoShell';
import { EntregasShell } from './features/entregas/layout/EntregasShell';

// Pages
import { LoginPage } from './pages/LoginPage';
import { CriarSenhaPage } from './pages/CriarSenhaPage';
import { CapturaApp } from './features/captura/pages/CapturaApp';
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
import { GestaoTerminologiaPage } from './features/gestao/pages/GestaoTerminologiaPage';
import { gestaoWhatsAppSections, unidadeWhatsAppSections } from './pages/whatsapp/whatsappConsole.config';
import { WhatsAppConsoleHostPage, WhatsAppFlowEditorHostPage } from './pages/whatsapp/WhatsAppConsoleHostPage';
// Entregas mediadas (Cadastro, Atendimento e Monitoramento — ADR-009/010/015)
import { CarregarDadosPage } from './features/entregas/pages/CarregarDadosPage';
import { CargaDistritoPage } from './features/entregas/pages/CargaDistritoPage';
import { DistritoPacotesPage } from './features/entregas/pages/DistritoPacotesPage';
import { CadastroPage } from './features/entregas/pages/CadastroPage';
import { AtendimentoPage } from './features/entregas/pages/AtendimentoPage';
import { RotasEmBrevePage } from './features/entregas/pages/RotasEmBrevePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Entregas mediadas: supervisor (UNIDADE) e Gestão. As telas antigas ficam em "SGPD v2". */}
        <Route path="/entregas" element={<EntregasShell />}>
          <Route index element={<Navigate to="/entregas/carregar" replace />} />
          <Route path="carregar" element={<CarregarDadosPage />} />
          <Route path="carregar/:distritoId" element={<CargaDistritoPage />} />
          <Route path="distritos/:cargaId" element={<DistritoPacotesPage />} />
          <Route path="cadastro" element={<CadastroPage />} />
          <Route path="atendimento" element={<AtendimentoPage />} />
          <Route path="rotas" element={<RotasEmBrevePage />} />
          <Route path="*" element={<Navigate to="/entregas/carregar" replace />} />
        </Route>

        {/* Gestao (Sede / Corporativo) */}
        <Route path="/gestao" element={<GestaoShell />}>
          <Route index element={<GestaoUnidadesPage />} />
          <Route path="ses" element={<GestaoSEsPage />} />
          <Route path="usuarios" element={<GestaoUsuariosPage />} />
          <Route path="comunicacao" element={<Navigate to="/gestao/whatsapp/configuracoes" replace />} />
          <Route path="whatsapp" element={<Navigate to="/gestao/whatsapp/configuracoes" replace />} />
          {gestaoWhatsAppSections.map((section) => (
            <Route
              key={section.path}
              path={section.path.replace('/gestao/', '')}
              element={<WhatsAppConsoleHostPage initialPath={section.consolePath} platformAdmin />}
            />
          ))}
          <Route path="whatsapp/flows/:flowId/edit" element={<WhatsAppFlowEditorHostPage platformAdmin />} />
          <Route path="terminologia" element={<GestaoTerminologiaPage />} />
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
          <Route path="comunicacao" element={<Navigate to="/unidade/whatsapp/conversas" replace />} />
          <Route path="whatsapp" element={<Navigate to="/unidade/whatsapp/conversas" replace />} />
          {unidadeWhatsAppSections.map((section) => (
            <Route
              key={section.path}
              path={section.path.replace('/unidade/', '')}
              element={<WhatsAppConsoleHostPage initialPath={section.consolePath} />}
            />
          ))}
          <Route path="whatsapp/flows/:flowId/edit" element={<WhatsAppFlowEditorHostPage />} />
          <Route path="comunicacao-legado" element={<ComunicacaoPage />} />
          <Route path="*" element={<Navigate to="/unidade" replace />} />
        </Route>

        {/* App do carteiro (captura): tela cheia, fora do CarteiroShell legado */}
        <Route path="/carteiro/criar-senha" element={<CriarSenhaPage />} />
        <Route path="/carteiro/captura/*" element={<CapturaApp />} />

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
