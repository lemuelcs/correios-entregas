import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({
  prefix: 'correios_entrega_',
  register,
});

const httpRequestsTotal = new client.Counter({
  name: 'correios_entrega_http_requests_total',
  help: 'Total HTTP requests processed by Correios Entrega backend',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'correios_entrega_http_request_duration_seconds',
  help: 'HTTP request duration in seconds for Correios Entrega backend',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

function normalizeRoute(req: Request): string {
  const routePath = req.route?.path;
  const baseUrl = req.baseUrl || '';

  if (typeof routePath === 'string') {
    return `${baseUrl}${routePath}` || req.path;
  }

  return (req.originalUrl || req.url)
    .split('?')[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d{2,}/g, '/:id');
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: normalizeRoute(req),
      status_code: String(res.statusCode),
    };

    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
