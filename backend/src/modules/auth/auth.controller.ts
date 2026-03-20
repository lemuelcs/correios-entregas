import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';

const loginSchema = z.object({
  cpf: z.string().length(11).optional(),
  email: z.string().email().optional(),
  senha: z.string().min(6),
}).refine(data => data.cpf || data.email, {
  message: 'CPF ou email é obrigatório',
});

const refreshSchema = z.object({
  refreshToken: z.string().uuid(),
});

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await authService.refresh(refreshToken);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      await authService.logout(refreshToken);
      res.json({ message: 'Logout realizado com sucesso' });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.user!.sub);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
