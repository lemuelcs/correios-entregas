/**
 * Módulo `entregas` — montado em `app.ts` sob `/api/v1/entregas`.
 *
 * Cada área registra suas rotas por uma função própria (`registrarRotasX(router)`),
 * em arquivo próprio, para que as tasks 03, 05 e 06 só acrescentem linhas aqui.
 * - `rotasPublicas`: sem JWT (entrada do Prosio, ADR-014 — task_05).
 * - `rotasAutenticadas`: JWT obrigatório; o escopo por unidade fica em `escopo.ts`.
 */
import express, { Router, type Express } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { registrarRotasCarga } from './carga.routes';

import { registrarRotasAtendimento, registrarRotasCadastro } from './cadastro.routes';

// task_05 (orientações e entrada do Prosio):
import { registrarRotasOrientacao } from './orientacao.routes';
import { parserWebhookProsio, registrarRotasProsio, ROTA_WEBHOOK_PROSIO } from './prosio-entrada.routes';

// Captura do rótulo (ADR-014 da captura): supervisão em `/captura`.
import { registrarRotasCapturaSupervisao } from '../captura/captura-supervisao.routes';
// task_06 (liberação e avisos):
import { registrarRotasLiberacao } from './liberacao.controller';

const rotasPublicas = Router();
const rotasAutenticadas = Router();
rotasAutenticadas.use(authenticate);

// ——— Rotas sem JWT ———

registrarRotasProsio(rotasPublicas); // task_05: webhook e ações de botão (ADR-014)

// ——— Rotas com JWT ———

registrarRotasCarga(rotasAutenticadas);

registrarRotasCadastro(rotasAutenticadas);
registrarRotasAtendimento(rotasAutenticadas);

registrarRotasOrientacao(rotasAutenticadas); // task_05: orientação manual (US-026)

registrarRotasCapturaSupervisao(rotasAutenticadas); // captura: histórico, foto, remoção e senha do carteiro
registrarRotasLiberacao(rotasAutenticadas); // task_06: liberação do distrito (US-011)

export const entregasRoutes = Router();
entregasRoutes.use(rotasPublicas);
entregasRoutes.use(rotasAutenticadas);

/** Corpo JSON até 1 MB só na confirmação da carga (o `express.json()` global fica em 100 kb). */
const ROTA_JSON_GRANDE = /^\/api\/v1\/entregas\/cargas\/[^/]+\/confirmar\/?$/;

/**
 * Parsers de corpo específicos do módulo. Chamar em `app.ts` ANTES do
 * `express.json()` global: o body-parser marca o corpo como lido e o global
 * não o relê. O webhook do Prosio recebe o corpo CRU (Buffer, até 256 kb) para
 * o HMAC ser verificado sobre os bytes exatos (task_05, ADR-014).
 */
export function montarParsersEntregas(app: Express): void {
  app.use(ROTA_JSON_GRANDE, express.json({ limit: '1mb' }));
  app.use(ROTA_WEBHOOK_PROSIO, parserWebhookProsio);
}
