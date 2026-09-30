import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import type { Prisma, TipoCanal, TipoUnidade } from '@prisma/client';
import { validarCanalDaUnidade } from '../entregas/cadastro.validacao';

interface CreateUnidadeInput {
  codigo: string;
  mcu?: string;
  nome: string;
  tipo: TipoUnidade;
  seId?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude: number;
  longitude: number;
  faixasCep?: Array<{ inicio: string; fim: string; distritoCodigo?: string }>;
  // Entregas mediadas (ADR-012)
  canalProsioId?: string | null;
  canal?: TipoCanal | null;
  prosioUnidadeRef?: string | null;
  mediacaoAtiva?: boolean;
}

interface UpdateUnidadeInput extends Partial<CreateUnidadeInput> {
  ativa?: boolean;
  atualizadoEm?: string;
}

/** Canal sem segredos, para as respostas da Gestão. */
const canalPublico = { select: { id: true, nome: true, tipo: true, compartilhado: true, ativo: true } } as const;

/** Supervisores ativos (US-002.EC-4: unidade sem nenhum → `semSupervisor`). */
const supervisoresAtivos = { where: { role: 'UNIDADE', ativo: true } } satisfies Prisma.Unidade$usuariosArgs;

export class UnidadesGestaoService {
  async list(filters: { seId?: string; uf?: string; ativa?: boolean }) {
    const where: Prisma.UnidadeWhereInput = {};
    if (filters.seId) where.seId = filters.seId;
    if (filters.uf) where.uf = filters.uf;
    if (filters.ativa !== undefined) where.ativa = filters.ativa;

    const unidades = await prisma.unidade.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: {
        se: { select: { id: true, nome: true, sigla: true } },
        canalProsio: canalPublico,
        _count: { select: { usuarios: supervisoresAtivos } },
      },
    });
    return unidades.map(({ _count, ...u }) => ({
      ...u,
      supervisoresAtivos: _count.usuarios,
      semSupervisor: _count.usuarios === 0,
    }));
  }

  async getById(id: string) {
    const unidade = await prisma.unidade.findUnique({
      where: { id },
      include: {
        se: true,
        canalProsio: canalPublico,
        _count: { select: { usuarios: true, carteiros: true } },
      },
    });
    if (!unidade) throw new AppError(404, 'Unidade não encontrada');
    const supervisores = await prisma.usuario.count({ where: { unidadeId: id, role: 'UNIDADE', ativo: true } });
    return { ...unidade, supervisoresAtivos: supervisores, semSupervisor: supervisores === 0 };
  }

  /**
   * Canal da unidade: existente, ativo e do tipo pedido; `prosioUnidadeRef`
   * obrigatória em canal compartilhado e única dentro dele.
   */
  private async validarCanal(
    unidadeId: string | null,
    pedido: { canalProsioId?: string | null; canal?: TipoCanal | null; prosioUnidadeRef?: string | null },
  ) {
    const canal = pedido.canalProsioId
      ? await prisma.canalProsio.findUnique({ where: { id: pedido.canalProsioId } })
      : null;
    if (pedido.canalProsioId && !canal) {
      validarCanalDaUnidade(null, { canal: pedido.canal ?? 'WAHA' });
    }
    validarCanalDaUnidade(canal, pedido);
    if (canal?.compartilhado && pedido.prosioUnidadeRef) {
      const outra = await prisma.unidade.findFirst({
        where: {
          canalProsioId: canal.id,
          prosioUnidadeRef: pedido.prosioUnidadeRef,
          ...(unidadeId ? { id: { not: unidadeId } } : {}),
        },
        select: { nome: true },
      });
      if (outra) {
        throw new AppError(409, 'unidade_ref_em_uso', { campo: 'prosioUnidadeRef', unidade: outra.nome });
      }
    }
  }

  async create(data: CreateUnidadeInput) {
    const exists = await prisma.unidade.findUnique({ where: { codigo: data.codigo } });
    if (exists) throw new AppError(409, 'Código de unidade já cadastrado');

    if (data.mcu) {
      const mcuExists = await prisma.unidade.findUnique({ where: { mcu: data.mcu } });
      if (mcuExists) throw new AppError(409, 'MCU já cadastrado');
    }

    const { canal, ...dados } = data;
    await this.validarCanal(null, { canalProsioId: dados.canalProsioId, canal, prosioUnidadeRef: dados.prosioUnidadeRef });

    const criada = await prisma.unidade.create({
      data: {
        ...dados,
        faixasCep: data.faixasCep ?? [],
      },
    });
    return this.getById(criada.id);
  }

  /**
   * Edição com concorrência otimista: com `atualizadoEm` diferente do atual
   * (outra gravação no meio) → 409 `alterado_por_outro` com os dados atuais.
   */
  async update(id: string, data: UpdateUnidadeInput) {
    const atual = await prisma.unidade.findUnique({ where: { id } });
    if (!atual) throw new AppError(404, 'Unidade não encontrada');

    const { canal, atualizadoEm, ...dados } = data;
    if (atualizadoEm !== undefined && new Date(atualizadoEm).getTime() !== atual.atualizadoEm.getTime()) {
      throw new AppError(409, 'alterado_por_outro', { atual: await this.getById(id) });
    }

    const mexeNoCanal = dados.canalProsioId !== undefined || dados.prosioUnidadeRef !== undefined || canal !== undefined;
    if (mexeNoCanal) {
      await this.validarCanal(id, {
        canalProsioId: dados.canalProsioId !== undefined ? dados.canalProsioId : atual.canalProsioId,
        canal,
        prosioUnidadeRef: dados.prosioUnidadeRef !== undefined ? dados.prosioUnidadeRef : atual.prosioUnidadeRef,
      });
    }

    const updateData: Prisma.UnidadeUncheckedUpdateManyInput = { ...dados };
    if (data.faixasCep !== undefined) {
      updateData.faixasCep = data.faixasCep;
    }

    // Condiciona a gravação à versão lida: duas edições simultâneas não se sobrescrevem.
    const r = await prisma.unidade.updateMany({
      where: { id, atualizadoEm: atual.atualizadoEm },
      data: updateData,
    });
    if (r.count === 0) throw new AppError(409, 'alterado_por_outro', { atual: await this.getById(id) });
    return this.getById(id);
  }
}

export const unidadesGestaoService = new UnidadesGestaoService();
