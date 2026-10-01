/**
 * Fonte das fotos da captura.
 *
 * - `FonteGetUserMedia`: a câmera traseira em vídeo; o disparo congela o quadro e
 *   o comprime para JPEG de até 1600 px no lado maior, qualidade 0,8.
 * - `FonteE2E` (só em build de teste, `VITE_E2E=1`): `?e2eImage=a.jpg,b.jpg` troca a
 *   câmera pelas fixtures de rótulo; cada disparo entrega a próxima, com os bytes
 *   originais (o extrator falso do backend reconhece a fixture pelo sha256).
 */

export const LADO_MAXIMO_PX = 1600;
export const QUALIDADE_JPEG = 0.8;

export interface FonteCamera {
  /** Liga a câmera no `<video>` (ou prepara a fonte). Rejeita com `NotAllowedError` se negada. */
  iniciar(video: HTMLVideoElement | null): Promise<void>;
  /** A foto parada, já em JPEG. */
  capturar(): Promise<Blob>;
  parar(): void;
  /** URL de uma imagem para mostrar no lugar do vídeo (fonte sem vídeo). */
  readonly previa?: string | null;
}

export function erroDePermissao(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err.name === 'NotAllowedError' || err.name === 'SecurityError' || err.name === 'PermissionDeniedError')
  );
}

/** Dimensões reduzidas para caber em `LADO_MAXIMO_PX`, mantendo a proporção. */
export function dimensoesReduzidas(largura: number, altura: number, max = LADO_MAXIMO_PX) {
  const escala = Math.min(1, max / Math.max(largura, altura));
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

/** Desenha a imagem num canvas reduzido e devolve o JPEG (qualidade 0,8). */
export function comprimirParaJpeg(origem: CanvasImageSource, largura: number, altura: number): Promise<Blob> {
  const d = dimensoesReduzidas(largura, altura);
  const canvas = document.createElement('canvas');
  canvas.width = d.largura;
  canvas.height = d.altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas_indisponivel'));
  ctx.drawImage(origem, 0, 0, d.largura, d.altura);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg_falhou'))), 'image/jpeg', QUALIDADE_JPEG),
  );
}

/** Uma foto escolhida do aparelho (app de câmera do sistema), comprimida do mesmo jeito. */
export async function comprimirArquivo(arquivo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  try {
    return await comprimirParaJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export class FonteGetUserMedia implements FonteCamera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  async iniciar(video: HTMLVideoElement | null): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error('Câmera indisponível neste navegador');
      e.name = 'NotSupportedError';
      throw e;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    this.video = video;
    if (video) {
      video.srcObject = this.stream;
      await video.play().catch(() => undefined);
    }
  }

  async capturar(): Promise<Blob> {
    const v = this.video;
    if (!v || !v.videoWidth) throw new Error('camera_nao_pronta');
    return comprimirParaJpeg(v, v.videoWidth, v.videoHeight);
  }

  parar(): void {
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }
}

export const CHAVE_E2E_IMAGEM = 'e2eImage';
const CHAVE_E2E_INDICE = 'e2eImageIdx';

/** Build de teste: troca a câmera pelas fixtures (`?e2eImage=`). */
export const MODO_E2E = import.meta.env.VITE_E2E === '1';

/** Guarda o `?e2eImage=` da URL na sessão (sobrevive a recarregar e à navegação). */
export function registrarImagemE2E(busca: string): void {
  if (!MODO_E2E) return;
  const valor = new URLSearchParams(busca).get(CHAVE_E2E_IMAGEM);
  if (valor) {
    sessionStorage.setItem(CHAVE_E2E_IMAGEM, valor);
    sessionStorage.setItem(CHAVE_E2E_INDICE, '0');
  }
}

export class FonteE2E implements FonteCamera {
  previa: string | null = null;

  constructor(private readonly nomes: string[]) {}

  private indice(): number {
    return Number(sessionStorage.getItem(CHAVE_E2E_INDICE) ?? '0') || 0;
  }

  private url(i: number): string {
    return `/e2e-fixtures/${encodeURIComponent(this.nomes[i % this.nomes.length])}`;
  }

  async iniciar(): Promise<void> {
    this.previa = this.url(this.indice());
  }

  async capturar(): Promise<Blob> {
    const i = this.indice();
    const resp = await fetch(this.url(i));
    if (!resp.ok) throw new Error(`fixture ausente: ${this.nomes[i % this.nomes.length]}`);
    sessionStorage.setItem(CHAVE_E2E_INDICE, String(i + 1));
    this.previa = this.url(i + 1);
    return new Blob([await resp.arrayBuffer()], { type: 'image/jpeg' });
  }

  parar(): void {}
}

/** A fonte do app: a câmera; no build de teste com `?e2eImage=`, as fixtures. */
export function criarFontePadrao(): FonteCamera {
  if (MODO_E2E) {
    const nomes = (sessionStorage.getItem(CHAVE_E2E_IMAGEM) ?? '').split(',').map((n) => n.trim()).filter(Boolean);
    if (nomes.length > 0) return new FonteE2E(nomes);
  }
  return new FonteGetUserMedia();
}
