import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        role: Role;
        unidadeId?: string;
        /** Claim do login: o carteiro ainda precisa trocar a senha temporária. */
        senhaTemporaria?: boolean;
      };
    }
  }
}

export {};
