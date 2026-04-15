import { StatusObjeto } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { validateS10 } from '../../shared/utils/s10';

export class ReconciliacaoService {
  async scanRetorno(codigoRastreio: string, atorId: string) {
    const s10 = validateS10(codigoRastreio);
    if (!s10.valid) {
      throw new AppError(400, 'Código de rastreio S10 inválido');
    }

    const objeto = await prisma.objeto.findUnique({
      where: { codigoRastreio },
      include: { unidade: { select: { nome: true } } },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto não encontrado');
    }

    const statusPermitidos: StatusObjeto[] = ['TENTATIVA_SEM_ATENDIMENTO', 'EM_ROTA', 'COLETADO_CARTEIRO'];
    if (!statusPermitidos.includes(objeto.statusAtual)) {
      throw new AppError(
        422,
        `Status atual "${objeto.statusAtual}" não permite scan de retorno. Esperado: ${statusPermitidos.join(', ')}`,
      );
    }

    const agora = new Date();
    const nomeUnidade = objeto.unidade.nome;

    const resultado = await prisma.$transaction(async (tx) => {
      const objetoAtualizado = await tx.objeto.update({
        where: { id: objeto.id },
        data: { statusAtual: 'DEVOLVIDO_UNIDADE' },
      });

      const evento = await tx.objetoEvento.create({
        data: {
          objetoId: objeto.id,
          tipo: 'FC_45',
          descricao: 'Objeto recebido na unidade após insucesso',
          ocorridoEm: agora,
          localDescricao: nomeUnidade,
          atorTipo: 'GESTOR',
          atorId,
        },
      });

      return { ...objetoAtualizado, evento };
    });

    return resultado;
  }

  async getPendentes(rotaId: string) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      select: { id: true, codigo: true, statusAtual: true },
    });

    if (!rota) {
      throw new AppError(404, 'Rota não encontrada');
    }

    const statusReconciliados: StatusObjeto[] = [
      'ENTREGUE',
      'DEVOLVIDO_UNIDADE',
      'DEVOLVIDO_REMETENTE',
      'AGUARDANDO_RETIRADA',
    ];

    const objetos = await prisma.objeto.findMany({
      where: {
        rotaId,
        statusAtual: { notIn: statusReconciliados },
      },
      select: {
        id: true,
        codigoRastreio: true,
        statusAtual: true,
        destinatarioNome: true,
        cepDestino: true,
        logradouro: true,
        numero: true,
        tentativasEntrega: true,
        maxTentativas: true,
      },
      orderBy: { stopSequence: 'asc' },
    });

    return {
      rotaId: rota.id,
      rotaCodigo: rota.codigo,
      rotaStatus: rota.statusAtual,
      totalPendentes: objetos.length,
      objetos,
    };
  }

  async finalizarRota(rotaId: string, _atorId: string) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      include: {
        objetos: {
          select: { id: true, codigoRastreio: true, statusAtual: true },
        },
      },
    });

    if (!rota) {
      throw new AppError(404, 'Rota não encontrada');
    }

    if (rota.statusAtual !== 'CONCLUIDA') {
      throw new AppError(422, 'Só é possível finalizar rotas com status CONCLUIDA');
    }

    const statusReconciliados: StatusObjeto[] = [
      'ENTREGUE',
      'DEVOLVIDO_UNIDADE',
      'DEVOLVIDO_REMETENTE',
      'AGUARDANDO_RETIRADA',
    ];

    const naoReconciliados = rota.objetos.filter(
      (obj) => !statusReconciliados.includes(obj.statusAtual),
    );

    if (naoReconciliados.length > 0) {
      throw new AppError(400, 'Existem objetos não reconciliados na rota', {
        totalNaoReconciliados: naoReconciliados.length,
        objetos: naoReconciliados.map((obj) => ({
          id: obj.id,
          codigoRastreio: obj.codigoRastreio,
          statusAtual: obj.statusAtual,
        })),
      });
    }

    const agora = new Date();
    const unitizadorIds = (rota.unitizadorIds as string[]) ?? [];

    const resultado = await prisma.$transaction(async (tx) => {
      const rotaFinalizada = await tx.rota.update({
        where: { id: rotaId },
        data: {
          statusAtual: 'FINALIZADA',
          finalizadoEm: agora,
        },
        include: {
          carteiro: {
            include: {
              usuario: { select: { id: true, nome: true } },
            },
          },
          veiculo: {
            select: { id: true, codigo: true, tipo: true, placa: true, modal: true },
          },
          _count: { select: { paradas: true, objetos: true } },
        },
      });

      // Release vehicle
      await tx.unitizador.update({
        where: { id: rota.veiculoId },
        data: {
          statusVeiculo: 'DISPONIVEL',
          rotaAtualId: null,
        },
      });

      // Release unitizadores
      for (const unitizadorId of unitizadorIds) {
        await tx.unitizador.update({
          where: { id: unitizadorId },
          data: {
            statusAtual: 'DISPONIVEL',
            rotaAtualId: null,
          },
        });
      }

      return rotaFinalizada;
    });

    return resultado;
  }

  async agendarNovaTentativa(objetoId: string, dataAgendada: string | null, atorId: string) {
    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
      include: { unidade: { select: { nome: true } } },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto não encontrado');
    }

    if (objeto.statusAtual !== 'DEVOLVIDO_UNIDADE') {
      throw new AppError(422, 'Objeto precisa estar com status DEVOLVIDO_UNIDADE para reagendar');
    }

    if (objeto.tentativasEntrega >= objeto.maxTentativas) {
      throw new AppError(
        422,
        `Objeto já atingiu o máximo de tentativas (${objeto.maxTentativas})`,
      );
    }

    const agora = new Date();
    const nomeUnidade = objeto.unidade.nome;

    const resultado = await prisma.$transaction(async (tx) => {
      const objetoAtualizado = await tx.objeto.update({
        where: { id: objetoId },
        data: {
          statusAtual: 'RECEBIDO_UNIDADE',
          rotaId: null,
          stopSequence: null,
        },
      });

      await tx.objetoEvento.create({
        data: {
          objetoId,
          tipo: 'REAGENDADO',
          descricao: 'Objeto agendado para nova tentativa',
          ocorridoEm: agora,
          localDescricao: nomeUnidade,
          atorTipo: 'GESTOR',
          atorId,
          metadata: dataAgendada ? { dataAgendada } : undefined,
        },
      });

      return objetoAtualizado;
    });

    return resultado;
  }

  async encaminharAgencia(objetoId: string, atorId: string) {
    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
      include: { unidade: { select: { nome: true } } },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto não encontrado');
    }

    if (objeto.statusAtual !== 'DEVOLVIDO_UNIDADE') {
      throw new AppError(
        422,
        'Objeto precisa estar com status DEVOLVIDO_UNIDADE para encaminhar à agência',
      );
    }

    const diasGuardaMap: Record<string, number> = {
      DG: 7, DL: 7, DX: 7,
      PB: 7, PC: 7,
      RB: 20,
    };
    const diasGuarda = diasGuardaMap[objeto.servicoCodigo] ?? 7;

    const dataLimiteGuarda = new Date();
    dataLimiteGuarda.setDate(dataLimiteGuarda.getDate() + diasGuarda);

    const agora = new Date();
    const nomeUnidade = objeto.unidade.nome;

    const resultado = await prisma.$transaction(async (tx) => {
      const objetoAtualizado = await tx.objeto.update({
        where: { id: objetoId },
        data: {
          statusAtual: 'AGUARDANDO_RETIRADA',
          dataLimiteGuarda,
          rotaId: null,
          stopSequence: null,
        },
      });

      await tx.objetoEvento.create({
        data: {
          objetoId,
          tipo: 'ENCAMINHADO_AGENCIA',
          descricao: 'Objeto encaminhado para retirada na agência',
          ocorridoEm: agora,
          localDescricao: nomeUnidade,
          atorTipo: 'GESTOR',
          atorId,
          metadata: { diasGuarda, dataLimiteGuarda: dataLimiteGuarda.toISOString() },
        },
      });

      return objetoAtualizado;
    });

    return resultado;
  }
}

export const reconciliacaoService = new ReconciliacaoService();
