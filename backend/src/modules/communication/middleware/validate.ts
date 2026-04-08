/**
 * validate.ts
 * Middleware de validação Zod para endpoints do módulo de comunicação.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Middleware factory que valida req[target] contra um schema Zod.
 * Em caso de erro, retorna 400 com detalhes de validação.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      _res.status(400).json({
        status: 'error',
        message: 'Dados inválidos',
        details,
      });
      return;
    }
    // Replace parsed data (with defaults/coercion applied) back onto request
    (req as any)[target] = result.data;
    next();
  };
}
