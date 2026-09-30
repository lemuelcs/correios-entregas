import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import type { PrismaClient, Role, Usuario } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-32chars';
const ACCESS_TOKEN_EXPIRY = '15m';

/** Sessão longa do carteiro no app (ADR-004); os demais papéis mantêm 7 dias. */
export const REFRESH_TTL_DIAS_CARTEIRO = 30;
export const REFRESH_TTL_DIAS_PADRAO = 7;

export const MAX_TENTATIVAS_FALHAS = 5;
export const BLOQUEIO_MINUTOS = 15;

export const SENHA_MIN_CARACTERES = 8;
export const SENHA_MAX_CARACTERES = 72; // limite do bcrypt

export const MENSAGEM_CREDENCIAIS = 'Matrícula ou senha incorretas';

export function refreshTtlDias(role: Role): number {
  return role === 'CARTEIRO' ? REFRESH_TTL_DIAS_CARTEIRO : REFRESH_TTL_DIAS_PADRAO;
}

/** Política de senha (troca pelo carteiro e senha definida pelo supervisor). Fora dela → 400 `senha_fraca`. */
export function validarPoliticaSenha(senha: string): void {
  if (typeof senha !== 'string' || senha.length < SENHA_MIN_CARACTERES || senha.length > SENHA_MAX_CARACTERES) {
    throw new AppError(400, `A senha precisa ter de ${SENHA_MIN_CARACTERES} a ${SENHA_MAX_CARACTERES} caracteres`, {
      code: 'senha_fraca',
    });
  }
}

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

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  unidadeId?: string | null;
  senhaTemporaria: boolean;
}

type Db = Pick<PrismaClient, 'usuario' | 'refreshToken'>;

export interface AuthDeps {
  db?: Db;
  now?: () => Date;
}

function semSegredos<T extends Usuario>(usuario: T): Omit<T, 'senha' | 'tentativasFalhas' | 'bloqueadoAte'> {
  const { senha, tentativasFalhas, bloqueadoAte, ...resto } = usuario;
  void senha;
  void tentativasFalhas;
  void bloqueadoAte;
  return resto;
}

export class AuthService {
  private readonly db: Db;
  private readonly now: () => Date;

  constructor(deps: AuthDeps = {}) {
    this.db = deps.db ?? prisma;
    this.now = deps.now ?? (() => new Date());
  }

  async login(input: LoginInput) {
    const { cpf, email, matricula, senha } = input;

    const identifiers = [cpf, email, matricula].filter(Boolean);
    if (identifiers.length === 0) {
      throw new AppError(400, 'CPF, email ou matrícula é obrigatório');
    }
    if (identifiers.length > 1) {
      throw new AppError(400, 'Informe apenas um: CPF, email ou matrícula');
    }

    // Matrícula inexistente e senha errada dão a mesma resposta.
    const credenciaisInvalidas = () =>
      new AppError(401, matricula ? MENSAGEM_CREDENCIAIS : 'Credenciais inválidas', { code: 'credenciais_invalidas' });

    const usuario = await this.db.usuario.findFirst({
      where: matricula ? { matricula } : cpf ? { cpf } : { email },
      include: { unidade: true, carteiro: true },
    });
    if (!usuario) throw credenciaisInvalidas();

    const agora = this.now();
    if (usuario.bloqueadoAte && usuario.bloqueadoAte > agora) {
      throw new AppError(423, `Acesso bloqueado por ${BLOQUEIO_MINUTOS} minutos após tentativas seguidas`, {
        code: 'acesso_bloqueado',
        bloqueadoAte: usuario.bloqueadoAte.toISOString(),
      });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      await this.registrarFalha(usuario, agora);
      throw credenciaisInvalidas();
    }

    // Depois da senha: só quem sabe a senha descobre que o acesso foi desativado.
    if (!usuario.ativo) {
      throw new AppError(403, 'Acesso desativado. Procure o seu supervisor.', { code: 'acesso_desativado' });
    }

    if (usuario.tentativasFalhas !== 0 || usuario.bloqueadoAte !== null) {
      await this.db.usuario.update({
        where: { id: usuario.id },
        data: { tentativasFalhas: 0, bloqueadoAte: null },
      });
    }

    const tokens = await this.generateTokens(usuario);
    return { ...tokens, user: semSegredos(usuario) };
  }

  /**
   * Conta uma falha. Um bloqueio já vencido zera a contagem antes; a 5ª falha
   * seguida bloqueia por 15 minutos.
   */
  private async registrarFalha(usuario: Pick<Usuario, 'id' | 'tentativasFalhas' | 'bloqueadoAte'>, agora: Date) {
    const bloqueioVencido = usuario.bloqueadoAte !== null && usuario.bloqueadoAte <= agora;
    const atualizado = bloqueioVencido
      ? await this.db.usuario.update({
          where: { id: usuario.id },
          data: { tentativasFalhas: 1, bloqueadoAte: null },
        })
      : await this.db.usuario.update({
          where: { id: usuario.id },
          data: { tentativasFalhas: { increment: 1 } },
        });
    if (atualizado.tentativasFalhas >= MAX_TENTATIVAS_FALHAS) {
      await this.db.usuario.update({
        where: { id: usuario.id },
        data: { bloqueadoAte: new Date(agora.getTime() + BLOQUEIO_MINUTOS * 60_000) },
      });
    }
  }

  /** Rotação: o refresh usado é revogado e um novo par é emitido. Reusar o antigo → 401. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const invalido = () => new AppError(401, 'Refresh token inválido ou expirado', { code: 'refresh_invalido' });

    const stored = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true },
    });
    if (!stored || stored.revogado || stored.expiresAt < this.now()) throw invalido();

    // Revogação condicional: de dois refresh concorrentes com o mesmo token, só um passa.
    const { count } = await this.db.refreshToken.updateMany({
      where: { id: stored.id, revogado: false },
      data: { revogado: true },
    });
    if (count === 0) throw invalido();

    if (!stored.usuario.ativo) {
      throw new AppError(403, 'Acesso desativado. Procure o seu supervisor.', { code: 'acesso_desativado' });
    }

    return this.generateTokens(stored.usuario);
  }

  async logout(refreshToken: string) {
    await this.db.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revogado: true },
    });
  }

  /** Troca da senha pelo próprio usuário (obrigatória no 1º acesso do carteiro). */
  async trocarSenha(usuarioId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    validarPoliticaSenha(novaSenha);

    const usuario = await this.db.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || !usuario.ativo) {
      throw new AppError(403, 'Acesso desativado. Procure o seu supervisor.', { code: 'acesso_desativado' });
    }
    if (!(await bcrypt.compare(senhaAtual, usuario.senha))) {
      throw new AppError(400, 'Senha atual incorreta', { code: 'senha_atual_incorreta' });
    }
    if (senhaAtual === novaSenha) {
      throw new AppError(400, 'A nova senha precisa ser diferente da atual', { code: 'senha_igual' });
    }

    await this.db.usuario.update({
      where: { id: usuarioId },
      data: {
        senha: await bcrypt.hash(novaSenha, 10),
        senhaTemporaria: false,
        tentativasFalhas: 0,
        bloqueadoAte: null,
      },
    });
  }

  async me(userId: string) {
    const usuario = await this.db.usuario.findUnique({
      where: { id: userId },
      include: { unidade: true, carteiro: true },
    });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    return semSegredos(usuario);
  }

  private async generateTokens(
    usuario: Pick<Usuario, 'id' | 'role' | 'unidadeId' | 'senhaTemporaria'>,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = {
      sub: usuario.id,
      role: usuario.role,
      unidadeId: usuario.unidadeId,
      senhaTemporaria: usuario.senhaTemporaria,
    };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    const refreshTokenValue = uuid();
    const expiresAt = new Date(this.now().getTime() + refreshTtlDias(usuario.role) * 24 * 60 * 60 * 1000);

    await this.db.refreshToken.create({
      data: {
        token: refreshTokenValue,
        usuarioId: usuario.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }
}

export const authService = new AuthService();
