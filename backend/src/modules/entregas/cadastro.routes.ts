/**
 * Rotas do cadastro da unidade e do atendimento (task_03). Registradas no
 * roteador autenticado de `entregas.routes.ts`. Leitura: UNIDADE e GESTAO
 * (`?unidadeId=`); escrita: UNIDADE, sempre na própria unidade.
 */
import type { Router } from 'express';
import { requireRole } from '../../shared/middleware/auth.middleware';
import { cadastroController as c } from './cadastro.controller';
import { atendimentoController } from './atendimento.controller';

export function registrarRotasCadastro(router: Router): void {
  const leitura = requireRole('UNIDADE', 'GESTAO');
  const escrita = requireRole('UNIDADE');

  router.get('/cadastro/distritos', leitura, c.listarDistritos);
  router.post('/cadastro/distritos', escrita, c.criarDistrito);
  router.get('/cadastro/distritos/:id', leitura, c.obterDistrito);
  router.put('/cadastro/distritos/:id', escrita, c.editarDistrito);
  router.put('/cadastro/distritos/:id/escala/:data', escrita, c.definirEscala);

  router.get('/cadastro/carteiros', leitura, c.listarCarteiros);
  router.post('/cadastro/carteiros', escrita, c.criarCarteiro);
  router.get('/cadastro/carteiros/:id', leitura, c.obterCarteiro);
  router.put('/cadastro/carteiros/:id', escrita, c.editarCarteiro);

  router.get('/cadastro/pontos', leitura, c.listarPontos);
  router.post('/cadastro/pontos', escrita, c.criarPonto);
  router.put('/cadastro/pontos/:id', escrita, c.editarPonto);
}

export function registrarRotasAtendimento(router: Router): void {
  router.post('/atendimento/sessao', requireRole('UNIDADE', 'GESTAO'), atendimentoController.sessao);
}
