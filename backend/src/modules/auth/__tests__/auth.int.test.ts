import express from 'express';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../shared/utils/prisma';
import { authenticate, requireSenhaDefinitiva } from '../../../shared/middleware/auth.middleware';
import { errorHandler } from '../../../shared/middleware/error-handler.middleware';
import {
  criarCarteiroComLogin,
  criarUnidade,
  limparBanco,
  SENHA_PADRAO,
} from '../../../__tests__/fixtures/entregas';
import { encerrarRecursos } from '../../../__tests__/helpers/recursos';

function login(matricula: string, senha: string) {
  return request(app).post('/api/v1/auth/login').set('Connection', 'close').send({ matricula, senha });
}

function refresh(refreshToken: string) {
  return request(app).post('/api/v1/auth/refresh').set('Connection', 'close').send({ refreshToken });
}

describe('auth (HTTP)', () => {
  let unidadeId: string;

  beforeAll(async () => {
    await limparBanco();
    unidadeId = (await criarUnidade()).id;
  });

  afterAll(async () => {
    await limparBanco();
    await encerrarRecursos();
  });

  it('IT-042 dois refresh seguidos com o token devolvido dão 200; reusar o primeiro dá 401', async () => {
    const { usuario } = await criarCarteiroComLogin({ unidadeId });
    const entrada = await login(usuario.matricula!, SENHA_PADRAO);
    expect(entrada.status).toBe(200);
    const primeiro: string = entrada.body.refreshToken;

    const r1 = await refresh(primeiro);
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(r1.body.refreshToken).not.toBe(primeiro);

    const r2 = await refresh(r1.body.refreshToken);
    expect(r2.status).toBe(200);
    expect(r2.body.refreshToken).not.toBe(r1.body.refreshToken);

    const reuso = await refresh(primeiro);
    expect(reuso.status).toBe(401);

    // O refresh do carteiro vale 30 dias.
    const ultimo = await prisma.refreshToken.findUniqueOrThrow({ where: { token: r2.body.refreshToken } });
    const dias = (ultimo.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(29.9);
    expect(dias).toBeLessThanOrEqual(30);
  });

  it('IT-043 matrícula inexistente e senha errada dão a mesma resposta 401', async () => {
    const { usuario } = await criarCarteiroComLogin({ unidadeId });

    const inexistente = await login('00000000', SENHA_PADRAO);
    const senhaErrada = await login(usuario.matricula!, 'senha-errada');

    expect(inexistente.status).toBe(401);
    expect(inexistente.body.error).toBe('Matrícula ou senha incorretas');
    expect(senhaErrada.status).toBe(401);
    expect(senhaErrada.body).toEqual(inexistente.body);
  });

  it('IT-044 cinco senhas erradas: a 6ª tentativa, mesmo correta, dá 423 acesso_bloqueado', async () => {
    const { usuario } = await criarCarteiroComLogin({ unidadeId });

    for (let i = 0; i < 5; i += 1) {
      expect((await login(usuario.matricula!, 'senha-errada')).status).toBe(401);
    }
    const sexta = await login(usuario.matricula!, SENHA_PADRAO);

    expect(sexta.status).toBe(423);
    expect(sexta.body.details).toEqual(expect.objectContaining({ code: 'acesso_bloqueado' }));
    const salvo = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(salvo.tentativasFalhas).toBe(5);
    expect(salvo.bloqueadoAte!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
  });

  it('IT-045 ativo=false → login 403 acesso_desativado', async () => {
    const { usuario } = await criarCarteiroComLogin({ unidadeId, ativo: false });

    const r = await login(usuario.matricula!, SENHA_PADRAO);

    expect(r.status).toBe(403);
    expect(r.body.details).toEqual({ code: 'acesso_desativado' });
  });

  // A recusa de um access token já emitido é do `authenticate`, que a task_03 do
  // monitoramento-entregas-whatsapp faz recusar usuário inativo; ela ainda não está
  // mergeada nesta branch. Habilitar quando chegar.
  it.todo('IT-045 ativo=false → um access token já emitido dá 403 na próxima chamada (depende da task_03 do monitoramento)');

  describe('troca de senha e requireSenhaDefinitiva', () => {
    // App mínimo: a rota /captura (com requireSenhaDefinitiva) é da task_02.
    const protegido = express();
    protegido.get('/protegido', authenticate, requireSenhaDefinitiva, (_req, res) => {
      res.json({ ok: true });
    });
    protegido.use(errorHandler);

    it('senha temporária bloqueia com 403 troca_de_senha_obrigatoria até POST /auth/trocar-senha', async () => {
      const { usuario } = await criarCarteiroComLogin({ unidadeId, senhaTemporaria: true });
      const { accessToken } = (await login(usuario.matricula!, SENHA_PADRAO)).body;
      const auth = { Authorization: `Bearer ${accessToken}` };

      const antes = await request(protegido).get('/protegido').set(auth).set('Connection', 'close');
      expect(antes.status).toBe(403);
      expect(antes.body.details).toEqual({ code: 'troca_de_senha_obrigatoria' });

      const curta = await request(app).post('/api/v1/auth/trocar-senha').set(auth).set('Connection', 'close')
        .send({ senhaAtual: SENHA_PADRAO, novaSenha: '123' });
      expect(curta.status).toBe(400);
      expect(curta.body.details).toEqual({ code: 'senha_fraca' });

      const troca = await request(app).post('/api/v1/auth/trocar-senha').set(auth).set('Connection', 'close')
        .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha-2026' });
      expect(troca.status).toBe(204);

      const depois = await request(protegido).get('/protegido').set(auth).set('Connection', 'close');
      expect(depois.status).toBe(200);

      const novoLogin = await login(usuario.matricula!, 'nova-senha-2026');
      expect(novoLogin.status).toBe(200);
      expect(novoLogin.body.user.senhaTemporaria).toBe(false);
    });
  });
});
