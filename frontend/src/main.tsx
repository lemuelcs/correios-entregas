import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import './index.css';

// Layouts
import { GestaoLayout } from './components/gestao/GestaoLayout';
import { CarteiroLayout } from './components/carteiro/CarteiroLayout';
import { DestinatarioLayout } from './components/destinatario/DestinatarioLayout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/gestao/DashboardPage';
import { CarteiroHomePage } from './pages/carteiro/CarteiroHomePage';
import { ObjetosPage } from './pages/destinatario/ObjetosPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Gestão */}
        <Route path="/gestao" element={<GestaoLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>

        {/* Carteiro */}
        <Route path="/carteiro" element={<CarteiroLayout />}>
          <Route index element={<CarteiroHomePage />} />
        </Route>

        {/* Destinatário */}
        <Route path="/destinatario" element={<DestinatarioLayout />}>
          <Route index element={<ObjetosPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
