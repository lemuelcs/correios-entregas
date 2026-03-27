import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        role: Role;
        unidadeId?: string;
      };
    }
  }
}

export {};
