import type { Application } from 'express';
import { comunicacaoRoutes } from './routes/comunicacao.routes';

export function register(app: Application): void {
  app.use('/api/v1/comunicacao', comunicacaoRoutes);
}
