/**
 * Dependências de I/O da captura (CEP, extrator, fotos, relógio, distrito do dia),
 * com padrões de produção e troca nos testes (`configurarCaptura`).
 */
import { DistritoDoDiaService, distritoDoDiaService } from './distrito-do-dia.service';
import { ViaCepService } from './cep.service';
import { criarLabelExtractor } from './extraction.service';
import { DiskPhotoStore } from './photo-store';
import type { CepService, LabelExtractor, PhotoStore } from './captura.types';

export interface DependenciasCaptura {
  cep: CepService;
  extractor: LabelExtractor;
  photoStore: PhotoStore;
  now: () => Date;
  distritoDoDia: DistritoDoDiaService;
}

let atual: DependenciasCaptura | null = null;

function padrao(): DependenciasCaptura {
  return {
    cep: new ViaCepService(),
    extractor: criarLabelExtractor(),
    photoStore: new DiskPhotoStore(),
    now: () => new Date(),
    distritoDoDia: distritoDoDiaService,
  };
}

export function dependenciasCaptura(): DependenciasCaptura {
  atual ??= padrao();
  return atual;
}

/** Substitui parte das dependências (testes). */
export function configurarCaptura(over: Partial<DependenciasCaptura>): void {
  atual = { ...dependenciasCaptura(), ...over };
}

/** Volta aos padrões de produção. */
export function redefinirCaptura(): void {
  atual = null;
}
