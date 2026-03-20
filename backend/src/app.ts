import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './shared/middleware/error-handler.middleware';
import { authRoutes } from './modules/auth/auth.routes';
import { unidadeRoutes } from './modules/unidade/unidade.routes';
import { recebimentoRoutes } from './modules/recebimento/recebimento.routes';
import { triagemRoutes } from './modules/triagem/triagem.routes';
import { unitizadorRoutes } from './modules/unitizadores/unitizador.routes';
import { roteirizacaoRoutes } from './modules/roteirizacao/roteirizacao.routes';
import { despachoRoutes } from './modules/despacho/despacho.routes';
import { carteiroRoutes } from './modules/carteiro/carteiro.routes';
import { destinatarioRoutes } from './modules/destinatario/destinatario.routes';
import { monitoramentoRoutes } from './modules/monitoramento/monitoramento.routes';
import { reconciliacaoRoutes } from './modules/reconciliacao/reconciliacao.routes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/unidades', unidadeRoutes);
app.use('/api/v1/recebimento', recebimentoRoutes);
app.use('/api/v1/triagem', triagemRoutes);
app.use('/api/v1/unitizadores', unitizadorRoutes);
app.use('/api/v1/roteirizacao', roteirizacaoRoutes);
app.use('/api/v1/despacho', despachoRoutes);
app.use('/api/v1/carteiro', carteiroRoutes);
app.use('/api/v1/destinatario', destinatarioRoutes);
app.use('/api/v1/monitoramento', monitoramentoRoutes);
app.use('/api/v1/reconciliacao', reconciliacaoRoutes);

// Error handler (must be last)
app.use(errorHandler);

export { app };
