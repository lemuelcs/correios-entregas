import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { validateS10 } from '../../shared/utils/s10';

export class DestinatarioService {
  async getObjetos(userId: string) {
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'Usuario nao encontrado');
    }

    const objetos = await prisma.objeto.findMany({
      where: {
        OR: [
          ...(user.cpf ? [{ destinatarioCpf: user.cpf }] : []),
          ...(user.email ? [{ destinatarioEmail: user.email }] : []),
        ],
      },
      include: {
        eventos: {
          orderBy: { ocorridoEm: 'desc' },
          take: 1,
        },
      },
    });

    return objetos;
  }

  async vincularObjeto(userId: string, codigoRastreio: string) {
    const s10 = validateS10(codigoRastreio);
    if (!s10.valid) {
      throw new AppError(400, 'Codigo de rastreio invalido (S10)');
    }

    const user = await prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'Usuario nao encontrado');
    }

    const objeto = await prisma.objeto.findUnique({
      where: { codigoRastreio: codigoRastreio.toUpperCase().replace(/[\s-]/g, '') },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto nao encontrado');
    }

    const objetoAtualizado = await prisma.objeto.update({
      where: { id: objeto.id },
      data: {
        ...(user.cpf ? { destinatarioCpf: user.cpf } : {}),
        ...(user.email ? { destinatarioEmail: user.email } : {}),
      },
    });

    return objetoAtualizado;
  }

  async getObjetoDetalhe(codigoRastreio: string) {
    const objeto = await prisma.objeto.findUnique({
      where: { codigoRastreio: codigoRastreio.toUpperCase().replace(/[\s-]/g, '') },
      include: {
        eventos: {
          orderBy: { ocorridoEm: 'desc' },
        },
      },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto nao encontrado');
    }

    return objeto;
  }

  async criarInteracao(
    objetoId: string,
    destinatarioId: string,
    tipo: 'REAGENDAR' | 'AUTORIZAR_TERCEIRO' | 'REDIRECIONAR' | 'MANTER_AGENCIA' | 'CONTATAR_CARTEIRO',
    dados: any,
  ) {
    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto nao encontrado');
    }

    const user = await prisma.usuario.findUnique({
      where: { id: destinatarioId },
    });

    if (!user) {
      throw new AppError(404, 'Usuario nao encontrado');
    }

    // Validate object belongs to this destinatario
    const pertence =
      (user.cpf && objeto.destinatarioCpf === user.cpf) ||
      (user.email && objeto.destinatarioEmail === user.email);

    if (!pertence) {
      throw new AppError(403, 'Objeto nao pertence a este destinatario');
    }

    const interacao = await prisma.interacaoObjeto.create({
      data: {
        objetoId,
        destinatarioId,
        tipo,
        dados,
      },
    });

    return interacao;
  }

  async getInteracoes(objetoId: string) {
    const interacoes = await prisma.interacaoObjeto.findMany({
      where: { objetoId },
      orderBy: { criadoEm: 'desc' },
    });

    return interacoes;
  }

  async responderNps(
    objetoId: string,
    destinatarioId: string,
    nota: number,
    comentario?: string,
  ) {
    if (nota < 0 || nota > 10) {
      throw new AppError(400, 'Nota deve ser entre 0 e 10');
    }

    const objeto = await prisma.objeto.findUnique({
      where: { id: objetoId },
    });

    if (!objeto) {
      throw new AppError(404, 'Objeto nao encontrado');
    }

    if (objeto.statusAtual !== 'ENTREGUE') {
      throw new AppError(422, 'NPS so pode ser respondido para objetos entregues');
    }

    const npsExistente = await prisma.npsResposta.findUnique({
      where: { objetoId },
    });

    if (npsExistente) {
      throw new AppError(409, 'NPS ja foi respondido para este objeto');
    }

    let categoria: string;
    if (nota >= 9) {
      categoria = 'PROMOTOR';
    } else if (nota >= 7) {
      categoria = 'NEUTRO';
    } else {
      categoria = 'DETRATOR';
    }

    const nps = await prisma.npsResposta.create({
      data: {
        objetoId,
        destinatarioId,
        nota,
        categoria,
        comentario: comentario ?? null,
      },
    });

    return nps;
  }
}

export const destinatarioService = new DestinatarioService();
