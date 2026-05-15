/**
 * chatwoot.routes.ts
 * Rotas autenticadas relacionadas ao Chatwoot (SSO etc).
 * Mantidas separadas do proxy /api/v1/comunicacao porque NAO devem cair
 * no catch-all que encaminha para ms-whatsapp.
 */
import { Router } from 'express';

import { authenticate } from '../../../shared/middleware/auth.middleware';
import { getSsoUrl } from '../controllers/chatwoot-sso.controller';

const router = Router();

router.use(authenticate);
router.get('/sso', getSsoUrl);

export { router as chatwootRoutes };
