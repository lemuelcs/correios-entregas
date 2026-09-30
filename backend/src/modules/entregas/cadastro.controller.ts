/**
 * Controller do cadastro da unidade: valida a entrada (Zod), resolve o escopo
 * por unidade (`escopo.ts`) e delega ao `cadastro.service`.
 */
import type { NextFunction, Request, Response } from 'express';
import { distritoNoEscopo, garantirUnidade, resolverUnidade } from './escopo';
import { lerData } from './datas';
import {
  criarCarteiroSchema,
  criarDistritoSchema,
  criarPontoSchema,
  editarCarteiroSchema,
  editarDistritoSchema,
  editarPontoSchema,
  escalaSchema,
  listagemPontosSchema,
  listagemSchema,
} from './cadastro.schemas';
import {
  carteiroNaUnidade,
  criarCarteiro,
  criarDistrito,
  criarPonto,
  definirEscala,
  editarCarteiro,
  editarDistrito,
  editarPonto,
  listarCarteiros,
  listarDistritos,
  listarPontos,
  obterCarteiro,
  obterDistrito,
  pontoNaUnidade,
} from './cadastro.service';

type Handler = (req: Request, res: Response) => Promise<void>;
const rota = (fn: Handler) => (req: Request, res: Response, next: NextFunction): void => {
  fn(req, res).catch(next);
};

const escopoDe = (req: Request) => (unidadeId: string) => garantirUnidade(req, unidadeId);

export const cadastroController = {
  // ——— Distritos ———
  listarDistritos: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    res.json(await listarDistritos(unidadeId, listagemSchema.parse(req.query)));
  }),

  obterDistrito: rota(async (req, res) => {
    const d = await distritoNoEscopo(req, String(req.params.id));
    res.json(await obterDistrito(d.id));
  }),

  criarDistrito: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    const dados = criarDistritoSchema.parse(req.body ?? {});
    res.status(201).json(await criarDistrito(unidadeId, dados));
  }),

  editarDistrito: rota(async (req, res) => {
    const d = await distritoNoEscopo(req, String(req.params.id));
    res.json(await editarDistrito(d, editarDistritoSchema.parse(req.body ?? {})));
  }),

  definirEscala: rota(async (req, res) => {
    const d = await distritoNoEscopo(req, String(req.params.id));
    const data = lerData(String(req.params.data));
    const { carteiroId } = escalaSchema.parse(req.body ?? {});
    res.json(await definirEscala(d, data, carteiroId));
  }),

  // ——— Carteiros ———
  listarCarteiros: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    res.json(await listarCarteiros(unidadeId, listagemSchema.parse(req.query)));
  }),

  obterCarteiro: rota(async (req, res) => {
    const c = await carteiroNaUnidade(String(req.params.id), escopoDe(req));
    res.json(await obterCarteiro(c.id));
  }),

  criarCarteiro: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    const dados = criarCarteiroSchema.parse(req.body ?? {});
    res.status(201).json(await criarCarteiro(unidadeId, dados));
  }),

  editarCarteiro: rota(async (req, res) => {
    const c = await carteiroNaUnidade(String(req.params.id), escopoDe(req));
    res.json(await editarCarteiro(c, editarCarteiroSchema.parse(req.body ?? {})));
  }),

  // ——— Pontos de retirada ———
  listarPontos: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    res.json(await listarPontos(unidadeId, listagemPontosSchema.parse(req.query)));
  }),

  criarPonto: rota(async (req, res) => {
    const unidadeId = await resolverUnidade(req);
    const dados = criarPontoSchema.parse(req.body ?? {});
    res.status(201).json(await criarPonto(unidadeId, dados));
  }),

  editarPonto: rota(async (req, res) => {
    const p = await pontoNaUnidade(String(req.params.id), escopoDe(req));
    res.json(await editarPonto(p, editarPontoSchema.parse(req.body ?? {})));
  }),
};
