import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '@/services/api';
import { obterCaptureQueue, type CapturaLocal, type CamposLidos } from '../captureQueue';
import { codigoDoDistrito, useCapturaStore } from '../captura.store';

export interface Pendencia {
  capturaId: string;
  tipo: 'PARA_CONFERIR' | 'TRANSFERENCIA_PENDENTE';
  distritoId: string;
  data: string;
  codigo: string | null;
  capturadoEm: string;
  campos: CamposLidos | null;
  motivos: string[];
  distritoOrigem: string | null;
  temFoto: boolean;
}

const MOTIVO_FALHA: Record<string, string> = {
  distrito_nao_autorizado: 'o distrito não é mais seu hoje',
  foto_muito_grande: 'a foto ficou grande demais',
  foto_invalida: 'a foto não pôde ser lida',
  meta_invalido: 'dados da foto inválidos',
};

/** As pendências do carteiro, as mais antigas primeiro (US-006, US-011, US-014). */
export function ConferirListPage() {
  const navigate = useNavigate();
  const hoje = useCapturaStore((s) => s.hoje);
  const online = useCapturaStore((s) => s.online);
  const [lista, setLista] = useState<Pendencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<CapturaLocal[]>([]);

  const carregar = useCallback(async () => {
    setFalhas(await obterCaptureQueue().listar('falhou_definitivo'));
    try {
      setLista(await api.get<Pendencia[]>('/captura/conferir'));
      setErro(null);
    } catch (err) {
      setErro(err instanceof TypeError ? 'Sem conexão. A lista Para conferir precisa de internet.' : 'Não deu para carregar a lista.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar, online]);

  async function descartarFalha(capturaId: string) {
    await obterCaptureQueue().remover(capturaId);
    await useCapturaStore.getState().atualizarFila();
    await carregar();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-[#E1E4EA] bg-white px-2 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/carteiro/captura')}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
          aria-label="Voltar ao início"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <h1 className="m-0 text-xl font-bold">Para conferir</h1>
      </header>

      <main className="flex flex-col gap-2.5 p-4 pb-40">
        {erro && (
          <p role="alert" className="rounded-xl bg-slate-800 px-4 py-3 text-[15px] font-semibold text-white">
            {erro}
          </p>
        )}
        {lista === null && !erro && <p className="text-[15px] text-[#5B6474]">Carregando…</p>}
        {lista?.length === 0 && falhas.length === 0 && (
          <p className="text-[15px] text-[#5B6474]">Nenhum pacote para conferir.</p>
        )}

        {lista && lista.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {lista.map((p) => (
              <li key={p.capturaId}>
                <Link
                  to={`/carteiro/captura/conferir/${p.capturaId}`}
                  className="flex min-h-14 items-center justify-between gap-2 rounded-[10px] border border-[#E0A400] bg-white px-3.5 py-3"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">
                      <span className="font-mono text-[13px]">{p.codigo ?? 'Sem código'}</span>
                      {p.campos?.nome?.valor ? ` · ${p.campos.nome.valor}` : ''}
                    </span>
                    <span className="text-[13px] text-[#7A4E00]">
                      {p.tipo === 'TRANSFERENCIA_PENDENTE'
                        ? `Está no ${p.distritoOrigem ?? 'outro distrito'} hoje. Trazer para o ${codigoDoDistrito(hoje, p.distritoId)}?`
                        : 'Confira os dados destacados'}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {falhas.length > 0 && (
          <section aria-labelledby="titulo-falhas" className="mt-2 flex flex-col gap-2.5">
            <h2 id="titulo-falhas" className="m-0 text-[15px] font-semibold text-[#5B6474]">
              Fotos não aceitas
            </h2>
            {falhas.map((f) => (
              <div key={f.capturaId} className="flex items-center justify-between gap-2 rounded-[10px] border border-red-300 bg-white px-3.5 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-[13px]">{f.codigo}</span>
                  <span className="text-[13px] text-red-800">
                    Não enviada: {MOTIVO_FALHA[f.ultimoErro ?? ''] ?? f.ultimoErro ?? 'erro'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void descartarFalha(f.capturaId)}
                  className="min-h-11 rounded-lg border border-[#D5DAE2] px-3 text-sm font-semibold"
                >
                  Descartar
                </button>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
