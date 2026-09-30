/**
 * App do carteiro: `/api/v1/captura` (TechSpec › API Endpoints › Carteiro).
 * JWT + papel CARTEIRO + senha definitiva (403 `troca_de_senha_obrigatoria`).
 */
import { Router } from 'express';
import { authenticate, requireRole, requireSenhaDefinitiva } from '../../shared/middleware/auth.middleware';
import { capturaController, uploadFoto } from './captura.controller';

export const capturaRoutes = Router();

capturaRoutes.use(authenticate, requireRole('CARTEIRO'), requireSenhaDefinitiva);

capturaRoutes.get('/hoje', capturaController.hoje);
capturaRoutes.put('/hoje/ativo', capturaController.definirAtivo);
capturaRoutes.post('/capturas', uploadFoto, capturaController.criar);
capturaRoutes.get('/conferir', capturaController.conferir);
capturaRoutes.get('/capturas/:id/foto', capturaController.foto);
capturaRoutes.post('/capturas/:id/confirmar', capturaController.confirmar);
capturaRoutes.post('/capturas/:id/descartar', capturaController.descartar);
capturaRoutes.post('/capturas/:id/desfazer', capturaController.desfazer);
capturaRoutes.patch('/pacotes/:id', capturaController.editarPacote);
capturaRoutes.delete('/pacotes/:id', capturaController.removerPacote);
capturaRoutes.get('/cep/:cep', capturaController.cep);
