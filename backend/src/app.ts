import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './shared/middleware/error-handler.middleware';
import { metricsHandler, metricsMiddleware } from './shared/middleware/metrics.middleware';
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
import { gestaoRoutes } from './modules/gestao/gestao.routes';
import { comunicacaoRoutes } from './modules/communication/communication.module';
import { sseManager } from './modules/monitoramento/sse.manager';
import { authenticate } from './shared/middleware/auth.middleware';
import { sgodExporter } from './integrations/sgod/sgod.exporter';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(metricsMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', metricsHandler);

// SSE endpoint
app.get('/events', authenticate, (req, res) => {
  const unidadeId = req.user?.unidadeId;
  if (!unidadeId) {
    res.status(400).json({ error: 'Unidade nao definida' });
    return;
  }
  sseManager.addClient(unidadeId, res);
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
app.use('/api/v1/gestao', gestaoRoutes);
app.use('/api/v1/comunicacao', comunicacaoRoutes);

// SGOD export
app.get('/api/v1/sgod/export/:unidadeId', authenticate, async (req, res, next) => {
  try {
    const data = await sgodExporter.exportar(req.params.unidadeId as string, req.query.data as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Error handler (must be last)
app.use(errorHandler);

export { app };
