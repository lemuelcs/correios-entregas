import { Keyboard } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '@/services/api';
import { MultiplosRotulos, decode } from '../barcode';
import { comprimirArquivo, criarFontePadrao, erroDePermissao, type FonteCamera } from '../camera';
import { EspacoInsuficiente, obterCaptureQueue, type BarcodesLidos } from '../captureQueue';
import { obterCaptureSync } from '../captureSync';
import { distritoAtivo, useCapturaStore } from '../captura.store';
import { normalizeS10, validateS10 } from '../lib/s10';

type EstadoCamera = 'iniciando' | 'pronta' | 'lendo' | 'negada' | 'indisponivel';

const SEM_LEITURA: BarcodesLidos = { objeto: null, cepLinear: null, dataMatrixRaw: null, multiplos: false };
const FORMATO_S10 = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export const MSG_DV_INVALIDO = 'Código não confere. Fotografe de novo ou digite.';
export const MSG_NAO_LIDO = 'Não deu para ler. Enquadre o rótulo inteiro.';
export const MSG_MULTIPLOS = 'Mais de um rótulo na foto. Fotografe um de cada vez.';

/** Uma foto do app de câmera do sistema (câmera do navegador negada). */
async function fotoDoArquivo(arquivo: File): Promise<Blob> {
  try {
    return await comprimirArquivo(arquivo);
  } catch {
    return arquivo; // navegador sem createImageBitmap: segue com o JPEG original
  }
}

/**
 * Câmera com moldura (US-004, US-007): o disparo congela a foto, lê os códigos
 * no aparelho, valida o S10 e enfileira; a câmera volta pronta sem esperar a
 * extração. `?substitui=<capturaId>` ("Refazer foto") descarta a pendência ao salvar.
 */
export function CameraPage({ criarFonte = criarFontePadrao }: { criarFonte?: () => FonteCamera }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const substitui = params.get('substitui');
  const hoje = useCapturaStore((s) => s.hoje);
  const ativo = distritoAtivo(hoje);
  const [base] = useState(() => (hoje?.contadores.capturados ?? 0) + useCapturaStore.getState().aguardando);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fonteRef = useRef<FonteCamera | null>(null);
  const [estado, setEstado] = useState<EstadoCamera>('iniciando');
  const [previa, setPrevia] = useState<string | null>(null);
  const [feitas, setFeitas] = useState(0);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [podeDigitar, setPodeDigitar] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [ultimaFoto, setUltimaFoto] = useState<{ blob: Blob; lidos: BarcodesLidos } | null>(null);

  useEffect(() => {
    const fonte = criarFonte();
    fonteRef.current = fonte;
    let ativa = true;
    fonte
      .iniciar(videoRef.current)
      .then(() => {
        if (!ativa) return;
        setPrevia(fonte.previa ?? null);
        setEstado('pronta');
      })
      .catch((err: unknown) => {
        if (!ativa) return;
        setEstado(erroDePermissao(err) ? 'negada' : 'indisponivel');
      });
    return () => {
      ativa = false;
      fonte.parar();
    };
  }, [criarFonte]);

  const fotoUrl = useUrlDoBlob(ultimaFoto?.blob ?? null);

  async function enfileirar(jpeg: Blob, lidos: BarcodesLidos, codigo: string, codigoDigitado: boolean): Promise<boolean> {
    if (!ativo || !hoje) {
      setMensagem('Escolha a rota de hoje antes de fotografar.');
      return false;
    }
    try {
      await obterCaptureQueue().add({
        capturaId: crypto.randomUUID(),
        distritoId: ativo.distritoId,
        data: hoje.data,
        capturadoEm: new Date().toISOString(),
        jpeg,
        barcodes: lidos,
        codigo,
        codigoDigitado,
      });
    } catch (err) {
      setMensagem(
        err instanceof EspacoInsuficiente
          ? 'Espaço do aparelho acabando. Envie os pacotes da fila antes de fotografar mais.'
          : 'Não deu para guardar a foto. Tente de novo.',
      );
      return false;
    }
    setFeitas((n) => n + 1);
    setMensagem(null);
    setPodeDigitar(false);
    setUltimaFoto(null);
    if (substitui) {
      void api.post(`/captura/capturas/${encodeURIComponent(substitui)}/descartar`).catch(() => undefined);
      setParams({}, { replace: true });
    }
    void obterCaptureSync().sincronizar();
    return true;
  }

  async function disparar() {
    const fonte = fonteRef.current;
    if (!fonte || estado !== 'pronta') return;
    setEstado('lendo');
    setMensagem(null);
    try {
      let blob: Blob;
      try {
        blob = await fonte.capturar();
      } catch {
        setMensagem('Não deu para tirar a foto. Tente de novo.');
        return;
      }
      let lidos: BarcodesLidos;
      try {
        lidos = await decode(blob);
      } catch (err) {
        if (err instanceof MultiplosRotulos) {
          setMensagem(MSG_MULTIPLOS);
          return;
        }
        lidos = SEM_LEITURA;
      }
      const codigo = lidos.objeto ? normalizeS10(lidos.objeto) : '';
      if (!codigo || !FORMATO_S10.test(codigo)) {
        setUltimaFoto({ blob, lidos });
        setPodeDigitar(true);
        setMensagem(MSG_NAO_LIDO);
        return;
      }
      if (!validateS10(codigo, { qualquerPais: true }).valid) {
        setUltimaFoto({ blob, lidos });
        setPodeDigitar(true);
        setMensagem(MSG_DV_INVALIDO);
        return;
      }
      await enfileirar(blob, lidos, codigo, false);
    } finally {
      setPrevia(fonte.previa ?? null);
      setEstado((e) => (e === 'lendo' ? 'pronta' : e));
    }
  }

  const proximo = base + feitas + 1;
  const titulo = ativo ? `${ativo.codigo} · pacote ${proximo}` : `pacote ${proximo}`;

  if (digitando) {
    return (
      <DigitarCodigo
        titulo={titulo}
        fotoUrl={fotoUrl}
        precisaFoto={!ultimaFoto}
        onVoltar={() => setDigitando(false)}
        onSalvar={async (codigo, foto) => {
          const ok = await enfileirar(foto ?? ultimaFoto!.blob, ultimaFoto?.lidos ?? SEM_LEITURA, codigo, true);
          if (ok) setDigitando(false);
          return ok;
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0E1422] text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/carteiro/captura')}
          className="min-h-11 px-3 text-[15px] font-semibold"
        >
          {feitas > 0 ? 'Concluir' : 'Cancelar'}
        </button>
        <span className="text-sm text-[#BFD0E8]" data-testid="camera-titulo">
          {titulo}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {estado === 'negada' || estado === 'indisponivel' ? (
          <div role="alert" className="flex max-w-sm flex-col gap-3 rounded-xl bg-[#1C2436] p-5 text-[15px] leading-snug">
            {estado === 'negada' ? (
              <>
                <strong className="text-base">A câmera está bloqueada para o app.</strong>
                <span>
                  Para liberar: toque no cadeado ao lado do endereço (ou em Ajustes do navegador), abra Câmera e
                  escolha Permitir. Depois volte e toque em Fotografar rótulo.
                </span>
              </>
            ) : (
              <span>Não foi possível abrir a câmera neste aparelho.</span>
            )}
            <span>Enquanto isso, você pode digitar o código do pacote.</span>
          </div>
        ) : (
          <div className="relative aspect-[300/380] w-full max-w-[300px] overflow-hidden rounded-xl bg-[#1C2436]">
            {previa ? (
              <img src={previa} alt="Rótulo na câmera" className="h-full w-full object-contain" />
            ) : (
              <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
            )}
            <div aria-hidden="true" className="absolute inset-[18px] rounded-[10px] border-[3px] border-[#F2B705]" />
          </div>
        )}

        <p className="text-center text-[15px] text-[#DCE3EE]" aria-live="polite">
          {estado === 'lendo' ? 'Lendo os códigos…' : 'Enquadre o rótulo inteiro dentro da moldura'}
        </p>
        {mensagem && (
          <p role="alert" className="max-w-sm rounded-lg bg-[#FDF1D6] px-4 py-2 text-center text-[15px] font-semibold text-[#7A4E00]">
            {mensagem}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {estado !== 'negada' && estado !== 'indisponivel' && (
          <button
            type="button"
            onClick={() => void disparar()}
            disabled={estado !== 'pronta'}
            aria-label="Tirar foto"
            className="h-[76px] w-[76px] rounded-full border-[5px] border-white bg-[#F2B705] disabled:opacity-60"
          />
        )}
        {(podeDigitar || estado === 'negada' || estado === 'indisponivel') && (
          <button
            type="button"
            onClick={() => setDigitando(true)}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-white/40 px-5 text-[15px] font-semibold"
          >
            <Keyboard size={20} aria-hidden="true" />
            Digitar código
          </button>
        )}
      </div>
    </div>
  );
}

function useUrlDoBlob(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function DigitarCodigo({
  titulo,
  fotoUrl,
  precisaFoto,
  onVoltar,
  onSalvar,
}: {
  titulo: string;
  fotoUrl: string | null;
  precisaFoto: boolean;
  onVoltar: () => void;
  onSalvar: (codigo: string, foto: Blob | null) => Promise<boolean>;
}) {
  const [codigo, setCodigo] = useState('');
  const [foto, setFoto] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const urlArquivo = useUrlDoBlob(foto);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const c = normalizeS10(codigo);
    if (!FORMATO_S10.test(c)) return setErro('O código tem 2 letras, 9 números e 2 letras (ex.: OY716488072BR).');
    if (!validateS10(c, { qualquerPais: true }).valid) return setErro('Código não confere. Confira no pacote.');
    if (precisaFoto && !foto) return setErro('Tire a foto do rótulo para enviar junto.');
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar(c, foto);
    } finally {
      setSalvando(false);
    }
  }

  const imagem = fotoUrl ?? urlArquivo;
  return (
    <div className="flex min-h-dvh flex-col bg-[#F4F6F9]">
      <header className="flex items-center justify-between border-b border-[#E1E4EA] bg-white px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onVoltar} className="min-h-11 px-2 text-[15px] font-semibold text-[#1E4FA3]">
          Voltar
        </button>
        <span className="text-sm text-[#5B6474]">{titulo}</span>
      </header>
      <form onSubmit={(e) => void enviar(e)} noValidate className="flex flex-1 flex-col gap-4 p-4">
        <h1 className="m-0 text-xl font-bold">Digitar código</h1>
        {imagem && <img src={imagem} alt="Foto do rótulo" className="max-h-64 w-full rounded-lg object-contain bg-white" />}
        {precisaFoto && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="foto-rotulo" className="text-sm font-semibold">
              Foto do rótulo (pelo app de câmera do celular)
            </label>
            <input
              id="foto-rotulo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void fotoDoArquivo(f).then(setFoto);
              }}
              className="min-h-12 text-[15px]"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo-digitado" className="text-sm font-semibold">
            Código do objeto
          </label>
          <input
            id="codigo-digitado"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? 'codigo-digitado-erro' : undefined}
            className="h-12 rounded-lg border border-[#D5DAE2] bg-white px-3 font-mono text-base uppercase"
          />
          {erro && (
            <span id="codigo-digitado-erro" role="alert" className="text-[13px] font-semibold text-red-700">
              {erro}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="mt-auto min-h-[52px] rounded-xl bg-[#1E4FA3] text-[17px] font-bold text-white disabled:opacity-50"
        >
          Salvar código
        </button>
      </form>
    </div>
  );
}
