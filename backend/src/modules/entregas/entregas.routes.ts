/**
 * Módulo `entregas` — montado em `app.ts` sob `/api/v1/entregas`.
 *
 * Cada área registra suas rotas por uma função própria (`registrarRotasX(router)`),
 * em arquivo próprio, para que as tasks 03, 05 e 06 só acrescentem linhas aqui.
 * - `rotasPublicas`: sem JWT (entrada do Prosio, ADR-014 — task_06).
 * - `rotasAutenticadas`: JWT obrigatório; o escopo por unidade fica em `escopo.ts`.
 */
import express, { Router, type Express } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { registrarRotasCarga } from './carga.routes';

// task_03 (cadastro): import { registrarRotasCadastro } from './cadastro.routes';

// task_05: import { registrarRotas… } from './….routes';

// task_06 (liberação/orientação/Prosio): import { registrarRotas… } from './….routes';

const rotasPublicas = Router();
const rotasAutenticadas = Router();
rotasAutenticadas.use(authenticate);

// ——— Rotas sem JWT ———

// task_06: registrarRotasProsio(rotasPublicas);

// ——— Rotas com JWT ———

registrarRotasCarga(rotasAutenticadas);

// task_03: registrarRotasCadastro(rotasAutenticadas);

// task_05: registrarRotas…(rotasAutenticadas);

// task_06: registrarRotas…(rotasAutenticadas);

export const entregasRoutes = Router();
entregasRoutes.use(rotasPublicas);
entregasRoutes.use(rotasAutenticadas);

/** Corpo JSON até 1 MB só na confirmação da carga (o `express.json()` global fica em 100 kb). */
const ROTA_JSON_GRANDE = /^\/api\/v1\/entregas\/cargas\/[^/]+\/confirmar\/?$/;

/**
 * Parsers de corpo específicos do módulo. Chamar em `app.ts` ANTES do
 * `express.json()` global: o body-parser marca o corpo como lido e o global
 * não o relê. A task_06 acrescenta aqui o corpo cru do webhook (HMAC).
 */
export function montarParsersEntregas(app: Express): void {
  app.use(ROTA_JSON_GRANDE, express.json({ limit: '1mb' }));
}
