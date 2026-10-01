import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';

const loginSchema = z.object({
  cpf: z.string().length(11).optional(),
  email: z.string().email().optional(),
  // Com ou sem máscara (`8.301.552-0` → `83015520`), como no cadastro: sempre 8 caracteres.
  matricula: z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(/[\s.\-/]/g, '').toUpperCase() : v),
    z.string().length(8),
  ).optional(),
  senha: z.string().min(6),
}).refine(data => {
  const identifiers = [data.cpf, data.email, data.matricula].filter(Boolean);
  return identifiers.length === 1;
}, {
  message: 'Informe exatamente um: CPF, email ou matrícula',
});

const refreshSchema = z.object({
  refreshToken: z.string().uuid(),
});

// A política da senha nova (tamanho) é do service: 400 `senha_fraca`.
const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string(),
});

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login({
        cpf: data.cpf,
        email: data.email,
        matricula: data.matricula,
        senha: data.senha!,
      });
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

  async trocarSenha(req: Request, res: Response, next: NextFunction) {
    try {
      const { senhaAtual, novaSenha } = trocarSenhaSchema.parse(req.body);
      await authService.trocarSenha(req.user!.sub, senhaAtual, novaSenha);
      res.status(204).end();
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
