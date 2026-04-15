import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-32chars';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface LoginInput {
  cpf?: string;
  email?: string;
  matricula?: string;
  senha: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async login(input: LoginInput) {
    const { cpf, email, matricula, senha } = input;

    const identifiers = [cpf, email, matricula].filter(Boolean);
    if (identifiers.length === 0) {
      throw new AppError(400, 'CPF, email ou matrícula é obrigatório');
    }
    if (identifiers.length > 1) {
      throw new AppError(400, 'Informe apenas um: CPF, email ou matrícula');
    }

    const usuario = await prisma.usuario.findFirst({
      where: matricula ? { matricula } : cpf ? { cpf } : { email },
      include: { unidade: true, carteiro: true },
    });

    if (!usuario || !usuario.ativo) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    const tokens = await this.generateTokens(usuario.id, usuario.role, usuario.unidadeId);

    const { senha: senhaHash, ...userWithoutPassword } = usuario;
    void senhaHash;
    return { ...tokens, user: userWithoutPassword };
  }

  async refresh(refreshToken: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true },
    });

    if (!stored || stored.revogado || stored.expiresAt < new Date()) {
      throw new AppError(401, 'Refresh token inválido ou expirado');
    }

    // Revoke used token (rotation)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revogado: true },
    });

    const tokens = await this.generateTokens(
      stored.usuario.id,
      stored.usuario.role,
      stored.usuario.unidadeId,
    );

    return { accessToken: tokens.accessToken };
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revogado: true },
    });
  }

  async me(userId: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { unidade: true, carteiro: true },
    });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    const { senha: senhaHash, ...userWithoutPassword } = usuario;
    void senhaHash;
    return userWithoutPassword;
  }

  private async generateTokens(userId: string, role: string, unidadeId?: string | null): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: userId, role, unidadeId },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const refreshTokenValue = uuid();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        usuarioId: userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }
}

export const authService = new AuthService();
