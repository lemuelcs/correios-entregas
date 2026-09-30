import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import {
  AuthService,
  MENSAGEM_CREDENCIAIS,
  refreshTtlDias,
} from '../auth.service';
import { AppError } from '../../../shared/middleware/error-handler.middleware';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface UsuarioFake {
  id: string;
  matricula: string;
  senha: string;
  role: Role;
  unidadeId: string | null;
  ativo: boolean;
  senhaTemporaria: boolean;
  tentativasFalhas: number;
  bloqueadoAte: Date | null;
}
interface RefreshFake { id: string; token: string; usuarioId: string; expiresAt: Date; revogado: boolean }

/** Banco em memória com só as operações que o AuthService usa. */
function fakeDb() {
  const usuarios: UsuarioFake[] = [];
  const refreshTokens: RefreshFake[] = [];
  const aplicar = (u: UsuarioFake, data: any) => {
    for (const [k, v] of Object.entries(data)) {
      (u as any)[k] = v && typeof v === 'object' && 'increment' in (v as any) ? (u as any)[k] + (v as any).increment : v;
    }
    return { ...u };
  };
  const db: any = {
    usuario: {
      findFirst: async ({ where }: any) => {
        const u = usuarios.find((x) => x.matricula === where.matricula);
        return u ? { ...u, unidade: null, carteiro: null } : null;
      },
      findUnique: async ({ where }: any) => {
        const u = usuarios.find((x) => x.id === where.id);
        return u ? { ...u, unidade: null, carteiro: null } : null;
      },
      update: async ({ where, data }: any) => aplicar(usuarios.find((x) => x.id === where.id)!, data),
    },
    refreshToken: {
      create: async ({ data }: any) => {
        const r = { id: `rt-${refreshTokens.length + 1}`, revogado: false, ...data };
        refreshTokens.push(r);
        return r;
      },
      findUnique: async ({ where }: any) => {
        const r = refreshTokens.find((x) => x.token === where.token);
        return r ? { ...r, usuario: usuarios.find((u) => u.id === r.usuarioId) } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const alvo = refreshTokens.filter((x) =>
          (where.id === undefined || x.id === where.id)
          && (where.token === undefined || x.token === where.token)
          && (where.revogado === undefined || x.revogado === where.revogado));
        alvo.forEach((x) => Object.assign(x, data));
        return { count: alvo.length };
      },
    },
  };
  return { db, usuarios, refreshTokens };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const SENHA = 'senha-certa-123';
let hash: string;
beforeAll(async () => {
  hash = await bcrypt.hash(SENHA, 4);
});

function montar(over: Partial<UsuarioFake> = {}, inicio = new Date('2026-09-30T12:00:00Z')) {
  const f = fakeDb();
  let agora = inicio;
  const usuario: UsuarioFake = {
    id: 'u1', matricula: '12345678', senha: hash, role: 'CARTEIRO', unidadeId: 'U1',
    ativo: true, senhaTemporaria: false, tentativasFalhas: 0, bloqueadoAte: null, ...over,
  };
  f.usuarios.push(usuario);
  const service = new AuthService({ db: f.db, now: () => agora });
  return {
    ...f, usuario, service,
    avancar(ms: number) { agora = new Date(agora.getTime() + ms); },
    agora: () => agora,
  };
}

async function erroDe(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    return err as AppError;
  }
  throw new Error('esperava erro');
}

describe('AuthService', () => {
  it('UT-062 login de usuário com senha temporária emite o claim senhaTemporaria: true', async () => {
    const { service } = montar({ senhaTemporaria: true });

    const r = await service.login({ matricula: '12345678', senha: SENHA });

    const payload = jwt.decode(r.accessToken) as jwt.JwtPayload;
    expect(payload).toEqual(expect.objectContaining({ sub: 'u1', role: 'CARTEIRO', senhaTemporaria: true }));
    expect(r.refreshToken).toEqual(expect.any(String));
    expect(r.user).not.toHaveProperty('senha');
    expect(r.user).toEqual(expect.objectContaining({ senhaTemporaria: true }));
  });

  it('UT-063 refresh devolve um novo refreshToken e revoga o anterior', async () => {
    const { service, refreshTokens } = montar();
    const { refreshToken: primeiro } = await service.login({ matricula: '12345678', senha: SENHA });

    const r = await service.refresh(primeiro);

    expect(r.accessToken).toEqual(expect.any(String));
    expect(r.refreshToken).not.toBe(primeiro);
    expect(refreshTokens.find((t) => t.token === primeiro)?.revogado).toBe(true);
    expect(refreshTokens.find((t) => t.token === r.refreshToken)?.revogado).toBe(false);
    expect((await erroDe(service.refresh(primeiro))).statusCode).toBe(401);
  });

  it('UT-064 matrícula inexistente e senha errada dão a mesma mensagem', async () => {
    const { service } = montar();

    const inexistente = await erroDe(service.login({ matricula: '99999999', senha: SENHA }));
    const senhaErrada = await erroDe(service.login({ matricula: '12345678', senha: 'errada-000' }));

    expect(inexistente.statusCode).toBe(401);
    expect(inexistente.message).toBe(MENSAGEM_CREDENCIAIS);
    expect(MENSAGEM_CREDENCIAIS).toBe('Matrícula ou senha incorretas');
    expect(senhaErrada.statusCode).toBe(inexistente.statusCode);
    expect(senhaErrada.message).toBe(inexistente.message);
    expect(senhaErrada.details).toEqual(inexistente.details);
  });

  it('UT-065 a 5ª falha seguida bloqueia por 15 minutos', async () => {
    const m = montar();
    for (let i = 1; i <= 4; i += 1) {
      await erroDe(m.service.login({ matricula: '12345678', senha: 'errada-000' }));
      expect(m.usuario.bloqueadoAte).toBeNull();
    }

    await erroDe(m.service.login({ matricula: '12345678', senha: 'errada-000' }));

    expect(m.usuario.tentativasFalhas).toBe(5);
    expect(m.usuario.bloqueadoAte).toEqual(new Date(m.agora().getTime() + 15 * 60_000));
  });

  it('UT-066 login correto durante o bloqueio dá 423; depois do bloqueio, o sucesso zera as falhas', async () => {
    const m = montar();
    for (let i = 0; i < 5; i += 1) await erroDe(m.service.login({ matricula: '12345678', senha: 'errada-000' }));

    m.avancar(14 * 60_000);
    const bloqueado = await erroDe(m.service.login({ matricula: '12345678', senha: SENHA }));
    expect(bloqueado.statusCode).toBe(423);
    expect(bloqueado.details).toEqual(expect.objectContaining({ code: 'acesso_bloqueado' }));

    m.avancar(2 * 60_000);
    await m.service.login({ matricula: '12345678', senha: SENHA });
    expect(m.usuario.tentativasFalhas).toBe(0);
    expect(m.usuario.bloqueadoAte).toBeNull();
  });

  it('UT-067 usuário inativo dá 403 acesso_desativado', async () => {
    const { service } = montar({ ativo: false });

    const err = await erroDe(service.login({ matricula: '12345678', senha: SENHA }));

    expect(err.statusCode).toBe(403);
    expect(err.details).toEqual({ code: 'acesso_desativado' });
  });

  it('UT-068 trocarSenha com senha nova de menos de 8 caracteres dá 400', async () => {
    const { service, usuario } = montar({ senhaTemporaria: true });

    const err = await erroDe(service.trocarSenha('u1', SENHA, 'curta7c'));

    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ code: 'senha_fraca' });
    expect(usuario.senha).toBe(hash);
    expect(usuario.senhaTemporaria).toBe(true);
  });

  it('UT-069 trocarSenha válido grava a senha nova e senhaTemporaria=false', async () => {
    const { service, usuario } = montar({ senhaTemporaria: true });

    await service.trocarSenha('u1', SENHA, 'nova-senha-2026');

    expect(usuario.senhaTemporaria).toBe(false);
    expect(await bcrypt.compare('nova-senha-2026', usuario.senha)).toBe(true);
    expect((await erroDe(service.trocarSenha('u1', 'errada-000', 'outra-senha-2026'))).details)
      .toEqual({ code: 'senha_atual_incorreta' });
  });

  it('UT-070 refresh do CARTEIRO vale 30 dias; o dos outros papéis, 7', async () => {
    expect(refreshTtlDias('CARTEIRO')).toBe(30);
    for (const role of ['GESTAO', 'UNIDADE', 'DESTINATARIO'] as const) expect(refreshTtlDias(role)).toBe(7);

    const dia = 24 * 60 * 60 * 1000;
    const carteiro = montar({ role: 'CARTEIRO' });
    await carteiro.service.login({ matricula: '12345678', senha: SENHA });
    expect(carteiro.refreshTokens[0].expiresAt.getTime() - carteiro.agora().getTime()).toBe(30 * dia);

    const supervisor = montar({ role: 'UNIDADE' });
    await supervisor.service.login({ matricula: '12345678', senha: SENHA });
    expect(supervisor.refreshTokens[0].expiresAt.getTime() - supervisor.agora().getTime()).toBe(7 * dia);
  });
});
