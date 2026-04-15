import { prisma } from '../../shared/utils/prisma';
import { AppError } from '../../shared/middleware/error-handler.middleware';
import { vroomQueue, pyvrpQueue } from '../../queue';
import { ModoOtimizacao, SolverUsado, ModeloTriagem } from '@prisma/client';
import type { VroomInput, VroomResult, VroomRoute } from '../../integrations/vroom/vroom.client';
import type { PyvrpInput, PyvrpResult, PyvrpRoute } from '../../integrations/pyvrp/pyvrp.client';

interface ObjectMapping {
  index: number;
  objetoId: string;
  codigoRastreio: string;
  cep: string;
  logradouro: string;
  latitude: number;
  longitude: number;
  cubagem: number;
}

interface VehicleMapping {
  index: number;
  carteiroId: string;
  veiculoId: string;
  matricula: string;
  veiculoCodigo: string;
  capacidade: number;
  modal: string | null;
}

interface JobMetadata {
  unidadeId: string;
  modo: string;
  solver: string;
  objectMapping: ObjectMapping[];
  vehicleMapping: VehicleMapping[];
}

interface VroomJobResultPayload {
  vroomResult: VroomResult;
  metadata: JobMetadata;
}

interface PyvrpJobResultPayload {
  pyvrpResult: PyvrpResult;
  metadata: JobMetadata;
}

type JobResultPayload = VroomJobResultPayload | PyvrpJobResultPayload;

export class RoteirizacaoService {
  /** Large vehicle modal types that get cost preference in LARGE_VAN mode */
  private static LARGE_VEHICLE_MODALS = new Set(['FURGAO', 'VAN', 'SPRINTER']);

  /**
   * Build solver input from available resources and enqueue a solver job.
   * Supports VROOM and PyVRP solvers with ABSOLUTO, LARGE_VAN, and BALANCEADO modes.
   */
  async executar(
    unidadeId: string,
    modo: ModoOtimizacao = 'ABSOLUTO',
    solver: SolverUsado = 'VROOM',
    _atorId: string,
  ) {
    // 1. Fetch geocoded objects ready for routing
    const objetos = await prisma.objeto.findMany({
      where: {
        unidadeId,
        statusAtual: { in: ['RECEBIDO_UNIDADE', 'EM_CONFERENCIA', 'TRIADO'] },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        codigoRastreio: true,
        cepDestino: true,
        logradouro: true,
        latitude: true,
        longitude: true,
        cubagem: true,
      },
    });

    if (objetos.length === 0) {
      throw new AppError(422, 'Nenhum objeto geocodificado disponível para roteirização');
    }

    // 2. Fetch present carteiros for today
    const today = this.todayUTC();
    const carteiros = await prisma.carteiro.findMany({
      where: {
        unidadeId,
        ativo: true,
        pontos: {
          some: {
            data: today,
            presente: true,
          },
        },
      },
      include: {
        usuario: { select: { nome: true } },
      },
    });

    if (carteiros.length === 0) {
      throw new AppError(422, 'Nenhum carteiro presente registrado para hoje');
    }

    // 3. Fetch available vehicles
    const veiculos = await prisma.unitizador.findMany({
      where: {
        unidadeId,
        tipo: 'VEICULO',
        statusVeiculo: 'DISPONIVEL',
        ativo: true,
      },
    });

    if (veiculos.length === 0) {
      throw new AppError(422, 'Nenhum veículo disponível na unidade');
    }

    // 4. Get unidade coordinates for vehicle start/end
    const unidade = await prisma.unidade.findUnique({
      where: { id: unidadeId },
      select: { latitude: true, longitude: true },
    });

    if (!unidade) {
      throw new AppError(404, 'Unidade não encontrada');
    }

    const unidadeCoords: [number, number] = [
      Number(unidade.longitude),
      Number(unidade.latitude),
    ];

    // 5. Pair carteiros with vehicles (min of both counts)
    const pairCount = Math.min(carteiros.length, veiculos.length);

    // BALANCEADO mode: calculate max tasks per vehicle
    const maxTasksPerVehicle = modo === 'BALANCEADO'
      ? Math.ceil(objetos.length / pairCount)
      : undefined;

    // Build vehicle mapping
    const vehicleMapping: VehicleMapping[] = [];

    for (let i = 0; i < pairCount; i++) {
      const carteiro = carteiros[i];
      const veiculo = veiculos[i];
      const capacidade = veiculo.volumeLitros ? Number(veiculo.volumeLitros) * 1000 : 500000;

      vehicleMapping.push({
        index: i,
        carteiroId: carteiro.id,
        veiculoId: veiculo.id,
        matricula: carteiro.matricula,
        veiculoCodigo: veiculo.codigo,
        capacidade,
        modal: veiculo.modal,
      });
    }

    // Build object mapping
    const objectMapping: ObjectMapping[] = [];

    for (let i = 0; i < objetos.length; i++) {
      const obj = objetos[i];
      const cubagem = obj.cubagem ? Number(obj.cubagem) * 1000 : 1000; // default 1L if unknown

      objectMapping.push({
        index: i,
        objetoId: obj.id,
        codigoRastreio: obj.codigoRastreio,
        cep: obj.cepDestino,
        logradouro: obj.logradouro,
        latitude: Number(obj.latitude),
        longitude: Number(obj.longitude),
        cubagem,
      });
    }

    const metadata: JobMetadata = {
      unidadeId,
      modo,
      solver,
      objectMapping,
      vehicleMapping,
    };

    // 6. Build solver-specific input and enqueue
    if (solver === 'PYVRP') {
      const pyvrpInput: PyvrpInput = {
        vehicles: vehicleMapping.map((v) => ({
          id: v.index,
          start: unidadeCoords,
          end: unidadeCoords,
          capacity: Math.round(v.capacidade),
          ...(maxTasksPerVehicle ? { max_duration: maxTasksPerVehicle * 120 } : {}),
        })),
        jobs: objectMapping.map((o) => ({
          id: o.index,
          location: [o.longitude, o.latitude] as [number, number],
          demand: Math.round(o.cubagem),
          service_time: 120, // 2 minutes per delivery
        })),
        options: {
          mode: modo,
          ...(maxTasksPerVehicle ? { max_duration_hours: (maxTasksPerVehicle * 120) / 3600 } : {}),
        },
      };

      const job = await pyvrpQueue.add('solve', {
        pyvrpInput,
        metadata,
      }, {
        removeOnComplete: { age: 3600 * 24 },
        removeOnFail: { age: 3600 * 24 },
      });

      return {
        jobId: job.id,
        veiculos: pairCount,
        objetos: objetos.length,
        message: `Roteirização PyVRP (${modo}) enfileirada com ${pairCount} veículos e ${objetos.length} objetos`,
      };
    }

    // VROOM solver path
    const vroomVehicles = vehicleMapping.map((v) => {
      const isLargeVehicle = v.modal
        ? RoteirizacaoService.LARGE_VEHICLE_MODALS.has(v.modal)
        : false;

      return {
        id: v.index,
        start: unidadeCoords,
        end: unidadeCoords,
        capacity: [Math.round(v.capacidade)] as [number],
        // LARGE_VAN mode: penalize small vehicles so solver prefers large ones
        ...(modo === 'LARGE_VAN'
          ? { costs_fixed: isLargeVehicle ? 0 : 100000 }
          : {}),
        // BALANCEADO mode: cap tasks per vehicle to distribute evenly
        ...(maxTasksPerVehicle ? { max_tasks: maxTasksPerVehicle } : {}),
      };
    });

    const vroomJobs = objectMapping.map((o) => ({
      id: o.index,
      location: [o.longitude, o.latitude] as [number, number],
      amount: [Math.round(o.cubagem)] as [number],
      service: 120, // 2 minutes per delivery
    }));

    const vroomInput: VroomInput = {
      vehicles: vroomVehicles,
      jobs: vroomJobs,
      options: { g: true }, // request geometry
    };

    const job = await vroomQueue.add('solve', {
      vroomInput,
      metadata,
    }, {
      removeOnComplete: { age: 3600 * 24 },
      removeOnFail: { age: 3600 * 24 },
    });

    return {
      jobId: job.id,
      veiculos: pairCount,
      objetos: objetos.length,
      message: `Roteirização VROOM (${modo}) enfileirada com ${pairCount} veículos e ${objetos.length} objetos`,
    };
  }

  /**
   * Look up a job in both solver queues (VROOM first, then PyVRP).
   */
  private async findJob(jobId: string) {
    const vroomJob = await vroomQueue.getJob(jobId);
    if (vroomJob) return { job: vroomJob, solver: 'VROOM' as const };

    const pyvrpJob = await pyvrpQueue.getJob(jobId);
    if (pyvrpJob) return { job: pyvrpJob, solver: 'PYVRP' as const };

    return null;
  }

  /**
   * Get the current state of a solver job.
   */
  async getJobStatus(jobId: string) {
    const found = await this.findJob(jobId);
    if (!found) {
      throw new AppError(404, 'Job não encontrado');
    }

    const { job, solver } = found;
    const state = await job.getState();
    const progress = job.progress;

    return {
      jobId: job.id,
      solver,
      state,
      progress,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };
  }

  /**
   * Retrieve the solved result from a completed job, with mapped names.
   */
  async getResultado(jobId: string) {
    const found = await this.findJob(jobId);
    if (!found) {
      throw new AppError(404, 'Job não encontrado');
    }

    const { job, solver } = found;
    const state = await job.getState();
    if (state !== 'completed') {
      throw new AppError(422, `Job ainda não concluído (estado: ${state})`);
    }

    const result = job.returnvalue as JobResultPayload;
    if (!result) {
      throw new AppError(500, 'Resultado do job não disponível');
    }

    if (solver === 'PYVRP') {
      return this.mapPyvrpResultado(jobId, result as PyvrpJobResultPayload);
    }

    return this.mapVroomResultado(jobId, result as VroomJobResultPayload);
  }

  private mapVroomResultado(jobId: string, result: VroomJobResultPayload) {
    const { vroomResult, metadata } = result;

    if (!vroomResult) {
      throw new AppError(500, 'Resultado VROOM do job não disponível');
    }

    const objectMap = new Map(metadata.objectMapping.map((m) => [m.index, m]));
    const vehicleMap = new Map(metadata.vehicleMapping.map((m) => [m.index, m]));

    const rotas = vroomResult.routes.map((route: VroomRoute) => {
      const vehicle = vehicleMap.get(route.vehicle);
      const stops = route.steps
        .filter((s) => s.type === 'job' && s.id !== undefined)
        .map((s) => {
          const obj = objectMap.get(s.id!);
          return {
            objetoId: obj?.objetoId,
            codigoRastreio: obj?.codigoRastreio,
            cep: obj?.cep,
            logradouro: obj?.logradouro,
            location: s.location,
            arrival: s.arrival,
            duration: s.duration,
            distance: s.distance,
          };
        });

      return {
        vehicleIndex: route.vehicle,
        carteiroId: vehicle?.carteiroId,
        matricula: vehicle?.matricula,
        veiculoId: vehicle?.veiculoId,
        veiculoCodigo: vehicle?.veiculoCodigo,
        totalObjetos: stops.length,
        distanciaKm: Math.round(route.distance / 1000 * 100) / 100,
        duracaoMin: Math.round(route.duration / 60),
        stops,
      };
    });

    const unassigned = vroomResult.unassigned.map((u) => {
      const obj = objectMap.get(u.id);
      return {
        objetoId: obj?.objetoId,
        codigoRastreio: obj?.codigoRastreio,
        location: u.location,
      };
    });

    return {
      jobId,
      summary: vroomResult.summary,
      rotas,
      unassigned,
      metadata: {
        unidadeId: metadata.unidadeId,
        modo: metadata.modo,
        solver: metadata.solver,
        totalVeiculos: metadata.vehicleMapping.length,
        totalObjetos: metadata.objectMapping.length,
      },
    };
  }

  private mapPyvrpResultado(jobId: string, result: PyvrpJobResultPayload) {
    const { pyvrpResult, metadata } = result;

    if (!pyvrpResult) {
      throw new AppError(500, 'Resultado PyVRP do job não disponível');
    }

    const objectMap = new Map(metadata.objectMapping.map((m) => [m.index, m]));
    const vehicleMap = new Map(metadata.vehicleMapping.map((m) => [m.index, m]));

    const rotas = pyvrpResult.routes.map((route: PyvrpRoute) => {
      const vehicle = vehicleMap.get(route.vehicle_id);
      const stops = route.stops.map((s) => {
        const obj = objectMap.get(s.job_id);
        return {
          objetoId: obj?.objetoId,
          codigoRastreio: obj?.codigoRastreio,
          cep: obj?.cep,
          logradouro: obj?.logradouro,
          location: s.location,
          arrival: s.arrival_time,
          duration: 0,
          distance: 0,
        };
      });

      return {
        vehicleIndex: route.vehicle_id,
        carteiroId: vehicle?.carteiroId,
        matricula: vehicle?.matricula,
        veiculoId: vehicle?.veiculoId,
        veiculoCodigo: vehicle?.veiculoCodigo,
        totalObjetos: stops.length,
        distanciaKm: Math.round(route.distance / 1000 * 100) / 100,
        duracaoMin: Math.round(route.duration / 60),
        stops,
      };
    });

    const unassigned = pyvrpResult.unassigned.map((id) => {
      const obj = objectMap.get(id);
      return {
        objetoId: obj?.objetoId,
        codigoRastreio: obj?.codigoRastreio,
        location: obj ? [obj.longitude, obj.latitude] : null,
      };
    });

    return {
      jobId,
      summary: {
        cost: 0,
        routes: pyvrpResult.summary.num_routes,
        unassigned: pyvrpResult.unassigned.length,
        duration: pyvrpResult.summary.total_duration,
        distance: pyvrpResult.summary.total_distance,
      },
      rotas,
      unassigned,
      metadata: {
        unidadeId: metadata.unidadeId,
        modo: metadata.modo,
        solver: metadata.solver,
        totalVeiculos: metadata.vehicleMapping.length,
        totalObjetos: metadata.objectMapping.length,
      },
    };
  }

  /**
   * Approve a solved result: persist Rotas, Paradas, SortPlans to the database.
   * Handles both VROOM and PyVRP result formats.
   */
  async aprovar(jobId: string, _atorId: string) {
    const found = await this.findJob(jobId);
    if (!found) {
      throw new AppError(404, 'Job não encontrado');
    }

    const { job, solver } = found;
    const state = await job.getState();
    if (state !== 'completed') {
      throw new AppError(422, `Job ainda não concluído (estado: ${state})`);
    }

    const result = job.returnvalue as JobResultPayload;
    if (!result) {
      throw new AppError(500, 'Resultado do job não disponível');
    }

    // Normalize routes from both solver formats into a common shape
    const normalizedRoutes = solver === 'PYVRP'
      ? this.normalizePyvrpRoutes(result as PyvrpJobResultPayload)
      : this.normalizeVroomRoutes(result as VroomJobResultPayload);

    const metadata = solver === 'PYVRP'
      ? (result as PyvrpJobResultPayload).metadata
      : (result as VroomJobResultPayload).metadata;

    const objectMap = new Map(metadata.objectMapping.map((m) => [m.index, m]));
    const vehicleMap = new Map(metadata.vehicleMapping.map((m) => [m.index, m]));

    // Get unidade for triagem model
    const unidade = await prisma.unidade.findUnique({
      where: { id: metadata.unidadeId },
      select: { modeloTriagem: true },
    });

    const modeloTriagem = unidade?.modeloTriagem ?? 'MANUAL';

    // Generate route codes: R-YYYYMMDD-NNN
    const dateStr = this.todayDateString();
    const codePrefix = `R-${dateStr}-`;

    // Find last used sequential number for today
    const lastRota = await prisma.rota.findFirst({
      where: { codigo: { startsWith: codePrefix } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });

    let nextSeq = 1;
    if (lastRota) {
      const lastNum = parseInt(lastRota.codigo.slice(codePrefix.length), 10);
      if (!isNaN(lastNum)) {
        nextSeq = lastNum + 1;
      }
    }

    const createdRotas = await prisma.$transaction(async (tx) => {
      const rotasResult = [];

      for (const nRoute of normalizedRoutes) {
        const vehicle = vehicleMap.get(nRoute.vehicleIndex);
        if (!vehicle) continue;

        const codigo = `${codePrefix}${String(nextSeq).padStart(3, '0')}`;
        nextSeq++;

        // Group objects by CEP5 for paradas
        const cep5Groups = new Map<string, {
          objects: ObjectMapping[];
          location: [number, number];
          sequences: number[];
        }>();

        for (let seqIdx = 0; seqIdx < nRoute.stops.length; seqIdx++) {
          const stop = nRoute.stops[seqIdx];
          const obj = objectMap.get(stop.jobId);
          if (!obj) continue;

          const cep5 = obj.cep.substring(0, 5);
          const existing = cep5Groups.get(cep5);
          if (existing) {
            existing.objects.push(obj);
            existing.sequences.push(seqIdx + 1);
          } else {
            cep5Groups.set(cep5, {
              objects: [obj],
              location: stop.location,
              sequences: [seqIdx + 1],
            });
          }
        }

        // Create the rota
        const rota = await tx.rota.create({
          data: {
            codigo,
            unidadeId: metadata.unidadeId,
            carteiroId: vehicle.carteiroId,
            veiculoId: vehicle.veiculoId,
            statusAtual: 'CRIADA',
            modeloTriagem: modeloTriagem as ModeloTriagem,
            modoOtimizacao: metadata.modo as ModoOtimizacao,
            solverUsado: metadata.solver as SolverUsado,
            totalParadas: cep5Groups.size,
            totalObjetos: nRoute.stops.length,
            distanciaEstimadaKm: Math.round(nRoute.distance / 1000 * 100) / 100,
            duracaoEstimadaMin: Math.round(nRoute.duration / 60),
            solverJobId: jobId,
            unitizadorIds: [vehicle.veiculoId],
          },
        });

        // Create paradas (one per CEP5 group)
        let paradaSeq = 1;
        const sortAssignments: Array<{
          paradaSequencia: number;
          objetos: Array<{ objetoId: string; codigoRastreio: string; stopSequence: number }>;
        }> = [];

        for (const [cep5, group] of cep5Groups) {
          await tx.parada.create({
            data: {
              rotaId: rota.id,
              sequencia: paradaSeq,
              latitude: group.location[1], // [lon, lat] -> lat
              longitude: group.location[0],
              cep: cep5.padEnd(8, '0'),
              logradouro: group.objects[0]?.logradouro ?? null,
              totalObjetos: group.objects.length,
            },
          });

          // Track for sort plan
          sortAssignments.push({
            paradaSequencia: paradaSeq,
            objetos: group.objects.map((obj, idx) => ({
              objetoId: obj.objetoId,
              codigoRastreio: obj.codigoRastreio,
              stopSequence: group.sequences[idx],
            })),
          });

          paradaSeq++;
        }

        // Update objects with rotaId and stopSequence
        for (let stopIdx = 0; stopIdx < nRoute.stops.length; stopIdx++) {
          const stop = nRoute.stops[stopIdx];
          const obj = objectMap.get(stop.jobId);
          if (!obj) continue;

          await tx.objeto.update({
            where: { id: obj.objetoId },
            data: {
              rotaId: rota.id,
              stopSequence: stopIdx + 1,
            },
          });
        }

        // Create SortPlan with LIFO assignments (reverse order for bag packing)
        const lifoAssignments = [...sortAssignments].reverse().map((a, idx) => ({
          ...a,
          sortPosition: idx + 1, // position in bag: first packed = last delivered
        }));

        await tx.sortPlan.create({
          data: {
            rotaId: rota.id,
            unidadeId: metadata.unidadeId,
            modelo: modeloTriagem as ModeloTriagem,
            assignments: lifoAssignments,
            validado: false,
          },
        });

        // Update vehicle status to EM_ROTA
        await tx.unitizador.update({
          where: { id: vehicle.veiculoId },
          data: { statusVeiculo: 'EM_ROTA' },
        });

        rotasResult.push({
          id: rota.id,
          codigo: rota.codigo,
          carteiroId: vehicle.carteiroId,
          matricula: vehicle.matricula,
          veiculoId: vehicle.veiculoId,
          totalParadas: cep5Groups.size,
          totalObjetos: nRoute.stops.length,
          distanciaEstimadaKm: rota.distanciaEstimadaKm,
          duracaoEstimadaMin: rota.duracaoEstimadaMin,
        });
      }

      return rotasResult;
    });

    return {
      message: `${createdRotas.length} rota(s) criada(s) com sucesso`,
      rotas: createdRotas,
    };
  }

  /**
   * Normalize VROOM routes into a common shape for the aprovar transaction.
   */
  private normalizeVroomRoutes(result: VroomJobResultPayload) {
    return result.vroomResult.routes.map((route) => ({
      vehicleIndex: route.vehicle,
      distance: route.distance,
      duration: route.duration,
      stops: route.steps
        .filter((s) => s.type === 'job' && s.id !== undefined)
        .map((s) => ({
          jobId: s.id!,
          location: s.location as [number, number],
        })),
    }));
  }

  /**
   * Normalize PyVRP routes into a common shape for the aprovar transaction.
   */
  private normalizePyvrpRoutes(result: PyvrpJobResultPayload) {
    return result.pyvrpResult.routes.map((route) => ({
      vehicleIndex: route.vehicle_id,
      distance: route.distance,
      duration: route.duration,
      stops: route.stops.map((s) => ({
        jobId: s.job_id,
        location: s.location as [number, number],
      })),
    }));
  }

  /**
   * Edit a route: reorder stops or move objects between routes.
   */
  async editarRota(
    rotaId: string,
    changes: {
      reorder?: number[];
      moveObjetos?: Array<{ objetoId: string; toRotaId: string }>;
    },
  ) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      include: { paradas: { orderBy: { sequencia: 'asc' } } },
    });

    if (!rota) {
      throw new AppError(404, 'Rota não encontrada');
    }

    if (rota.statusAtual !== 'CRIADA') {
      throw new AppError(422, 'Só é possível editar rotas com status CRIADA');
    }

    // Reorder paradas
    if (changes.reorder && changes.reorder.length > 0) {
      const newOrder = changes.reorder;

      if (newOrder.length !== rota.paradas.length) {
        throw new AppError(
          400,
          `Reordenação deve conter ${rota.paradas.length} sequências, recebido ${newOrder.length}`,
        );
      }

      // Validate all sequences are present
      const sortedExpected = rota.paradas.map((p) => p.sequencia).sort((a, b) => a - b);
      const sortedNew = [...newOrder].sort((a, b) => a - b);
      if (JSON.stringify(sortedExpected) !== JSON.stringify(sortedNew)) {
        throw new AppError(400, 'Reordenação contém sequências inválidas');
      }

      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < newOrder.length; i++) {
          const parada = rota.paradas.find((p) => p.sequencia === newOrder[i]);
          if (parada) {
            await tx.parada.update({
              where: { id: parada.id },
              data: { sequencia: i + 1 },
            });
          }
        }
      });
    }

    // Move objects between routes
    if (changes.moveObjetos && changes.moveObjetos.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const move of changes.moveObjetos!) {
          const targetRota = await tx.rota.findUnique({
            where: { id: move.toRotaId },
            select: { id: true, statusAtual: true },
          });

          if (!targetRota) {
            throw new AppError(404, `Rota destino ${move.toRotaId} não encontrada`);
          }

          if (targetRota.statusAtual !== 'CRIADA') {
            throw new AppError(422, `Rota destino ${move.toRotaId} não está com status CRIADA`);
          }

          // Get current max stopSequence in target
          const maxStop = await tx.objeto.aggregate({
            where: { rotaId: move.toRotaId },
            _max: { stopSequence: true },
          });

          const nextStop = (maxStop._max.stopSequence ?? 0) + 1;

          await tx.objeto.update({
            where: { id: move.objetoId },
            data: {
              rotaId: move.toRotaId,
              stopSequence: nextStop,
            },
          });

          // Update counts on both routes
          await tx.rota.update({
            where: { id: rotaId },
            data: { totalObjetos: { decrement: 1 } },
          });
          await tx.rota.update({
            where: { id: move.toRotaId },
            data: { totalObjetos: { increment: 1 } },
          });
        }
      });
    }

    // Return updated rota
    const updated = await prisma.rota.findUnique({
      where: { id: rotaId },
      include: {
        paradas: { orderBy: { sequencia: 'asc' } },
        _count: { select: { objetos: true } },
      },
    });

    return updated;
  }

  /**
   * Remove a route (only if status CRIADA).
   * Unassigns objects, deletes paradas, sort plan, and the rota.
   */
  async removerRota(rotaId: string) {
    const rota = await prisma.rota.findUnique({
      where: { id: rotaId },
      select: { id: true, statusAtual: true, veiculoId: true },
    });

    if (!rota) {
      throw new AppError(404, 'Rota não encontrada');
    }

    if (rota.statusAtual !== 'CRIADA') {
      throw new AppError(422, 'Só é possível remover rotas com status CRIADA');
    }

    await prisma.$transaction(async (tx) => {
      // Unassign all objects from this route
      await tx.objeto.updateMany({
        where: { rotaId },
        data: {
          rotaId: null,
          stopSequence: null,
        },
      });

      // Delete sort plan
      await tx.sortPlan.deleteMany({
        where: { rotaId },
      });

      // Delete paradas
      await tx.parada.deleteMany({
        where: { rotaId },
      });

      // Delete the rota
      await tx.rota.delete({
        where: { id: rotaId },
      });

      // Return vehicle to DISPONIVEL
      await tx.unitizador.update({
        where: { id: rota.veiculoId },
        data: { statusVeiculo: 'DISPONIVEL' },
      });
    });

    return { message: 'Rota removida com sucesso' };
  }

  private todayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  private todayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}

export const roteirizacaoService = new RoteirizacaoService();
