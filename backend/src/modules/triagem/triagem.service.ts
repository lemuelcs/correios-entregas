import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { triagemSimulator, type SimulacaoResult } from './triagem.simulator';

interface ConfigTriagem {
  estruturas: number;
  posicoesPorEstrutura: number;
  throughputHora: number;
}

export class TriagemService {
  async configurarSessao(
    unidadeId: string,
    config: {
      modeloTriagem: string;
      estruturas: number;
      posicoesPorEstrutura: number;
      throughputHora?: number;
    },
  ) {
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade nao encontrada');
    }

    const configTriagem: ConfigTriagem = {
      estruturas: config.estruturas,
      posicoesPorEstrutura: config.posicoesPorEstrutura,
      throughputHora: config.throughputHora ?? 400,
    };

    const unidadeAtualizada = await prisma.unidade.update({
      where: { id: unidadeId },
      data: {
        modeloTriagem: config.modeloTriagem as any,
        configTriagem: configTriagem as any,
      },
    });

    return unidadeAtualizada;
  }

  async simular(
    unidadeId: string,
    quantidadeObjetos?: number,
    horaInicioTriagem?: string,
    deadlineDespacho?: string,
  ): Promise<SimulacaoResult> {
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade nao encontrada');
    }

    const config = unidade.configTriagem as unknown as ConfigTriagem;

    return triagemSimulator.simular({
      unidadeId,
      quantidadeObjetos,
      estruturas: config.estruturas ?? 1,
      posicoesPorEstrutura: config.posicoesPorEstrutura ?? 1,
      throughputHora: config.throughputHora ?? 400,
      horaInicioTriagem,
      deadlineDespacho,
    });
  }

  async getSortPlan(rotaId: string) {
    const sortPlan = await prisma.sortPlan.findUnique({
      where: { rotaId },
      include: {
        rota: {
          include: {
            paradas: {
              orderBy: { sequencia: 'asc' },
            },
            objetos: {
              orderBy: { stopSequence: 'asc' },
            },
          },
        },
      },
    });

    if (!sortPlan) {
      throw new AppError(404, 'Sort Plan nao encontrado para esta rota');
    }

    return sortPlan;
  }

  async validarSortPlan(rotaId: string, atorId: string) {
    const sortPlan = await prisma.sortPlan.findUnique({
      where: { rotaId },
      include: {
        rota: {
          include: {
            objetos: true,
            unidade: { select: { id: true, nome: true, modeloTriagem: true } },
          },
        },
      },
    });

    if (!sortPlan) {
      throw new AppError(404, 'Sort Plan nao encontrado para esta rota');
    }

    // If the unidade (or the sort plan itself) uses PTL or ADTA model, generate assignments first
    const modelo = sortPlan.modelo ?? sortPlan.rota.unidade.modeloTriagem;
    if (modelo === 'PTL') {
      await this.generatePtlAssignments(rotaId, sortPlan.rota.unidade.id);
    } else if (modelo === 'ADTA') {
      await this.generateAdtaAssignments(rotaId, sortPlan.rota.unidade.id);
    }

    const agora = new Date();
    const objetoIds = sortPlan.rota.objetos.map((o) => o.id);
    const nomeUnidade = sortPlan.rota.unidade.nome;

    const resultado = await prisma.$transaction(async (tx) => {
      // Mark sort plan as validated
      const sortPlanAtualizado = await tx.sortPlan.update({
        where: { rotaId },
        data: { validado: true },
      });

      // Update all objects in the route to TRIADO
      if (objetoIds.length > 0) {
        await tx.objeto.updateMany({
          where: { id: { in: objetoIds } },
          data: { statusAtual: 'TRIADO' },
        });

        // Create ObjetoEvento for each object
        const descricao =
          modelo === 'PTL'
            ? 'Objeto triado via PTL conforme Sort Plan'
            : modelo === 'ADTA'
              ? 'Objeto triado via ADTA conforme Sort Plan'
              : 'Objeto triado conforme Sort Plan';

        await tx.objetoEvento.createMany({
          data: objetoIds.map((objetoId) => ({
            objetoId,
            tipo: 'TRIADO',
            descricao,
            ocorridoEm: agora,
            localDescricao: nomeUnidade,
            atorTipo: 'GESTOR' as const,
            atorId,
          })),
        });
      }

      return sortPlanAtualizado;
    });

    return resultado;
  }

  /**
   * Generates PTL (Put-To-Light) position assignments for a route's sort plan.
   *
   * Each object is assigned a wall position in the format "W{wall}-L{lane}-P{position}"
   * based on the route's stop sequence and the unidade's wall grid configuration.
   *
   * The wall grid is defined by `configTriagem.estruturas` (number of walls) and
   * `configTriagem.posicoesPorEstrutura` (positions per wall, laid out as lanes x positions).
   */
  async generatePtlAssignments(rotaId: string, unidadeId: string) {
    // 1. Fetch the SortPlan with its route's objects
    const sortPlan = await prisma.sortPlan.findUnique({
      where: { rotaId },
      include: {
        rota: {
          include: {
            objetos: {
              orderBy: { stopSequence: 'asc' },
            },
          },
        },
      },
    });

    if (!sortPlan) {
      throw new AppError(404, 'Sort Plan nao encontrado para esta rota');
    }

    // 2. Get unidade config for wall dimensions
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade nao encontrada');
    }

    const config = unidade.configTriagem as unknown as ConfigTriagem;
    const numWalls = config.estruturas ?? 1;
    const posicoesPorEstrutura = config.posicoesPorEstrutura ?? 1;

    // Derive lane/position grid from posicoesPorEstrutura.
    // We use a square-ish layout: lanes = ceil(sqrt(positions)), positions per lane = ceil(total / lanes)
    const lanesPerWall = Math.ceil(Math.sqrt(posicoesPorEstrutura));
    const positionsPerLane = Math.ceil(posicoesPorEstrutura / lanesPerWall);
    const totalSlots = numWalls * lanesPerWall * positionsPerLane;

    const objetos = sortPlan.rota.objetos;

    if (objetos.length === 0) {
      return sortPlan;
    }

    // 3. Group objects by stop sequence to cluster them at the same wall position
    //    Objects going to the same stop share the same position.
    const stopGroups = new Map<number, typeof objetos>();
    for (const obj of objetos) {
      const seq = obj.stopSequence ?? 0;
      if (!stopGroups.has(seq)) {
        stopGroups.set(seq, []);
      }
      stopGroups.get(seq)!.push(obj);
    }

    // Sort stop groups by sequence
    const sortedStops = Array.from(stopGroups.entries()).sort(
      (a, b) => a[0] - b[0],
    );

    // 4. Assign each stop group to a wall position, cycling through walls
    let slotIndex = 0;
    const assignments: Array<{
      objetoId: string;
      codigoRastreio: string;
      stopSequence: number | null;
      posicaoTriagem: string;
    }> = [];

    for (const [stopSeq, objs] of sortedStops) {
      // Derive wall, lane, position from slotIndex
      const wall = Math.floor(slotIndex / (lanesPerWall * positionsPerLane)) + 1;
      const withinWall = slotIndex % (lanesPerWall * positionsPerLane);
      const lane = Math.floor(withinWall / positionsPerLane) + 1;
      const position = (withinWall % positionsPerLane) + 1;

      // Format: W{wall}-L{lane}-P{position}
      const posicaoTriagem = `W${wall}-L${lane}-P${position}`;

      for (const obj of objs) {
        assignments.push({
          objetoId: obj.id,
          codigoRastreio: obj.codigoRastreio,
          stopSequence: obj.stopSequence,
          posicaoTriagem,
        });
      }

      slotIndex++;
      // Wrap around if we exceed total slots (overflow scenario)
      if (slotIndex >= totalSlots) {
        slotIndex = 0;
      }
    }

    // 5. Persist the updated assignments on the SortPlan
    const updated = await prisma.sortPlan.update({
      where: { rotaId },
      data: {
        modelo: 'PTL',
        assignments: assignments as any,
      },
    });

    return updated;
  }

  /**
   * Generates ADTA (Auto Divert to Aisle) position assignments for a route's sort plan.
   *
   * ADTA is a sorter-based triage system where objects move on a conveyor belt and are
   * automatically diverted to specific aisles/lanes. Each lane corresponds to a route
   * or group of routes.
   *
   * Position format: ADTA-L{line}-D{divert} (e.g., "ADTA-L1-D5")
   * - `configTriagem.estruturas` = number of conveyor lines
   * - `configTriagem.posicoesPorEstrutura` = number of divert positions per line
   *
   * Objects are grouped by route: all objects within the same route go to the same
   * divert position. If there are more routes than available positions, overflow
   * routes share the last positions.
   */
  async generateAdtaAssignments(rotaId: string, unidadeId: string) {
    // 1. Fetch the SortPlan with its route's objects
    const sortPlan = await prisma.sortPlan.findUnique({
      where: { rotaId },
      include: {
        rota: {
          include: {
            objetos: {
              orderBy: { stopSequence: 'asc' },
            },
          },
        },
      },
    });

    if (!sortPlan) {
      throw new AppError(404, 'Sort Plan nao encontrado para esta rota');
    }

    // 2. Get unidade config for ADTA dimensions
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade nao encontrada');
    }

    const config = unidade.configTriagem as unknown as ConfigTriagem;
    const numLines = config.estruturas ?? 1;
    const divertsPerLine = config.posicoesPorEstrutura ?? 1;
    const totalDiverts = numLines * divertsPerLine;

    const objetos = sortPlan.rota.objetos;

    if (objetos.length === 0) {
      return sortPlan;
    }

    // 3. Group objects by route (rotaId) — since all objects here belong to
    //    the same rota, we group by stopSequence to assign distinct stops
    //    to distinct divert positions (each stop ~ a micro-route segment).
    const stopGroups = new Map<number, typeof objetos>();
    for (const obj of objetos) {
      const seq = obj.stopSequence ?? 0;
      if (!stopGroups.has(seq)) {
        stopGroups.set(seq, []);
      }
      stopGroups.get(seq)!.push(obj);
    }

    // Sort stop groups by sequence
    const sortedStops = Array.from(stopGroups.entries()).sort(
      (a, b) => a[0] - b[0],
    );

    // 4. Assign each stop group to a divert position
    const assignments: Array<{
      objetoId: string;
      codigoRastreio: string;
      stopSequence: number | null;
      posicaoTriagem: string;
    }> = [];

    for (let i = 0; i < sortedStops.length; i++) {
      const [stopSeq, objs] = sortedStops[i];

      // Map index to a divert position; overflow routes share the last position
      const divertIndex = i < totalDiverts ? i : totalDiverts - 1;

      const line = Math.floor(divertIndex / divertsPerLine) + 1;
      const divert = (divertIndex % divertsPerLine) + 1;

      // Format: ADTA-L{line}-D{divert}
      const posicaoTriagem = `ADTA-L${line}-D${divert}`;

      for (const obj of objs) {
        assignments.push({
          objetoId: obj.id,
          codigoRastreio: obj.codigoRastreio,
          stopSequence: obj.stopSequence,
          posicaoTriagem,
        });
      }
    }

    // 5. Persist the updated assignments on the SortPlan
    const updated = await prisma.sortPlan.update({
      where: { rotaId },
      data: {
        modelo: 'ADTA',
        assignments: assignments as any,
      },
    });

    return updated;
  }

  async imprimirEtiquetas(rotaId: string) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      include: {
        paradas: {
          orderBy: { sequencia: 'asc' },
        },
        objetos: {
          orderBy: { stopSequence: 'desc' }, // LIFO: last delivery first in printing
        },
      },
    });

    if (!rota) {
      throw new AppError(404, 'Rota nao encontrada');
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;  // A4
    const pageHeight = 841.89; // A4
    const margin = 40;
    const labelHeight = 140;
    const labelWidth = pageWidth - margin * 2;
    const labelsPerPage = Math.floor((pageHeight - margin * 2) / (labelHeight + 10));

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let labelIndex = 0;

    for (const objeto of rota.objetos) {
      if (labelIndex >= labelsPerPage) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        labelIndex = 0;
      }

      const yTop = pageHeight - margin - labelIndex * (labelHeight + 10);
      const yBase = yTop - labelHeight;

      // Label border
      currentPage.drawRectangle({
        x: margin,
        y: yBase,
        width: labelWidth,
        height: labelHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      const textX = margin + 10;
      let textY = yTop - 20;

      // Route code and stop sequence
      currentPage.drawText(`Rota: ${rota.codigo}`, {
        x: textX,
        y: textY,
        size: 12,
        font: fontBold,
      });

      currentPage.drawText(`Parada: ${objeto.stopSequence ?? '-'}`, {
        x: textX + 250,
        y: textY,
        size: 12,
        font: fontBold,
      });

      textY -= 20;

      // S10 code (barcode text)
      currentPage.drawText(`Codigo: ${objeto.codigoRastreio}`, {
        x: textX,
        y: textY,
        size: 14,
        font: fontBold,
      });

      textY -= 18;

      // Destinatario
      const nomeDestinatario = objeto.destinatarioNome.length > 50
        ? objeto.destinatarioNome.substring(0, 50) + '...'
        : objeto.destinatarioNome;
      currentPage.drawText(`Dest: ${nomeDestinatario}`, {
        x: textX,
        y: textY,
        size: 10,
        font,
      });

      textY -= 16;

      // Address
      const endereco = `${objeto.logradouro}, ${objeto.numero}${objeto.complemento ? ' - ' + objeto.complemento : ''}`;
      const enderecoTruncado = endereco.length > 65
        ? endereco.substring(0, 65) + '...'
        : endereco;
      currentPage.drawText(enderecoTruncado, {
        x: textX,
        y: textY,
        size: 10,
        font,
      });

      textY -= 16;

      // Bairro, Cidade, UF, CEP
      const localidade = `${objeto.bairro} - ${objeto.cidade}/${objeto.uf} - CEP: ${objeto.cepDestino}`;
      const localidadeTruncada = localidade.length > 65
        ? localidade.substring(0, 65) + '...'
        : localidade;
      currentPage.drawText(localidadeTruncada, {
        x: textX,
        y: textY,
        size: 10,
        font,
      });

      textY -= 16;

      // Distrito code if available
      if (objeto.distritoCodigo) {
        currentPage.drawText(`Distrito: ${objeto.distritoCodigo}`, {
          x: textX,
          y: textY,
          size: 9,
          font,
        });
      }

      labelIndex++;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async getStatus(unidadeId: string) {
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade nao encontrada');
    }

    const [recebidoUnidade, emConferencia, triado, sortPlansTotal, sortPlansValidados] =
      await Promise.all([
        prisma.objeto.count({
          where: { unidadeId, statusAtual: 'RECEBIDO_UNIDADE' },
        }),
        prisma.objeto.count({
          where: { unidadeId, statusAtual: 'EM_CONFERENCIA' },
        }),
        prisma.objeto.count({
          where: { unidadeId, statusAtual: 'TRIADO' },
        }),
        prisma.sortPlan.count({
          where: { unidadeId },
        }),
        prisma.sortPlan.count({
          where: { unidadeId, validado: true },
        }),
      ]);

    const totalPendentes = recebidoUnidade + emConferencia;
    const totalProcessados = triado;
    const percentualConcluido = totalPendentes + totalProcessados > 0
      ? Math.round((totalProcessados / (totalPendentes + totalProcessados)) * 100)
      : 0;

    return {
      objetos: {
        recebidoUnidade,
        emConferencia,
        triado,
        totalPendentes,
        totalProcessados,
        percentualConcluido,
      },
      sortPlans: {
        total: sortPlansTotal,
        validados: sortPlansValidados,
        pendentes: sortPlansTotal - sortPlansValidados,
      },
    };
  }
}

export const triagemService = new TriagemService();
