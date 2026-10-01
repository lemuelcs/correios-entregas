import { Camera, ChevronRight, WifiOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { AvisoEspaco } from '../components/AvisoEspaco';
import { BotaoSair } from '../components/BotaoSair';
import { distritoAtivo, useCapturaStore, type RecenteServidor } from '../captura.store';

function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

function Chip({ recente, desfazer }: { recente: RecenteServidor; desfazer?: string }) {
  if (desfazer === 'removendo') {
    return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">Removendo</span>;
  }
  return recente.semWhatsapp ? (
    <span className="rounded-full bg-[#FDF1D6] px-2 py-0.5 text-xs font-bold text-[#7A4E00]">Sem WhatsApp</span>
  ) : (
    <span className="rounded-full bg-[#E2F2E8] px-2 py-0.5 text-xs font-bold text-[#1F6F43]">Completo</span>
  );
}

/** Início do distrito do dia (US-003, US-014). */
export function CapturaHomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const unidadeNome = useAuthStore((s) => s.unidadeNome);
  const hoje = useCapturaStore((s) => s.hoje);
  const carregando = useCapturaStore((s) => s.carregandoHoje);
  const erroHoje = useCapturaStore((s) => s.erroHoje);
  const online = useCapturaStore((s) => s.online);
  const aguardando = useCapturaStore((s) => s.aguardando);
  const falhas = useCapturaStore((s) => s.falhas);
  const desfazer = useCapturaStore((s) => s.desfazer);
  const escolherDistrito = useCapturaStore((s) => s.escolherDistrito);

  const ativo = distritoAtivo(hoje);
  const semDistrito = hoje !== null && hoje.distritos.length === 0;
  const recentes = (hoje?.recentes ?? []).filter((r) => desfazer[r.capturaId] !== 'desfeito');
  const capturados = hoje?.contadores.capturados ?? 0;
  const paraConferir = (hoje?.contadores.paraConferir ?? 0) + falhas;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-col gap-1 bg-[#14213A] px-[18px] pb-4 pt-[max(1.1rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-[#BFD0E8]">
            {[user?.nome, unidadeNome ?? user?.unidade?.nome].filter(Boolean).join(' · ')}
          </span>
          <BotaoSair className="min-h-11 px-2 text-sm font-semibold text-[#DCE3EE] underline" />
        </div>
        <h1 className="m-0 text-[22px] font-bold">{ativo ? `${ativo.codigo} · ${ativo.nome}` : 'Captura de rótulos'}</h1>
        {hoje && (
          <span className="text-sm text-[#DCE3EE]">
            Hoje, {dataCurta(hoje.data)} ·{' '}
            <strong className="text-white tabular-nums" data-testid="contador-capturados">
              {capturados}
            </strong>{' '}
            {capturados === 1 ? 'pacote capturado' : 'pacotes capturados'}
          </span>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4 pb-40">
        {!online && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-[15px] font-semibold text-white">
            <WifiOff size={20} aria-hidden="true" />
            Sem conexão. As fotos ficam no aparelho e são enviadas quando o sinal voltar.
          </div>
        )}
        <AvisoEspaco />

        {!hoje && carregando && <p className="text-[15px] text-[#5B6474]">Carregando a rota de hoje…</p>}
        {!hoje && !carregando && !online && (
          <p className="text-[15px] text-[#5B6474]">Abra o app com internet para ver a rota de hoje.</p>
        )}
        {!hoje && !carregando && online && erroHoje && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-800">
            {erroHoje}
          </p>
        )}

        {semDistrito && (
          <p role="alert" className="rounded-xl border border-[#E0A400] bg-[#FFFBEF] px-4 py-3 text-[15px] font-semibold text-[#7A4E00]">
            Você não tem rota hoje. Fale com o supervisor.
          </p>
        )}

        {hoje && hoje.distritos.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="distrito-hoje" className="text-sm font-semibold">
              Rota em que os pacotes entram
            </label>
            <select
              id="distrito-hoje"
              value={hoje.ativo ?? ''}
              onChange={(e) => void escolherDistrito(e.target.value)}
              className="min-h-12 rounded-lg border border-[#D5DAE2] bg-white px-3 text-[15px]"
            >
              <option value="" disabled>
                Escolha a rota
              </option>
              {hoje.distritos.map((d) => (
                <option key={d.distritoId} value={d.distritoId}>
                  {d.codigo} · {d.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {hoje && !semDistrito && (
          <button
            type="button"
            disabled={!ativo}
            onClick={() => navigate('/carteiro/captura/camera')}
            className="flex min-h-16 items-center justify-center gap-2.5 rounded-[14px] bg-[#1E4FA3] text-lg font-bold text-white disabled:opacity-50"
          >
            <Camera size={24} aria-hidden="true" />
            Fotografar rótulo
          </button>
        )}

        {hoje && (
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              to="/carteiro/captura/conferir"
              className={`flex min-h-14 items-center justify-between rounded-xl border px-3.5 text-[15px] font-semibold ${
                paraConferir > 0 ? 'border-[#E0A400] bg-[#FFFBEF] text-[#7A4E00]' : 'border-[#E1E4EA] bg-white text-[#1B2230]'
              }`}
            >
              <span data-testid="contador-conferir">
                Para conferir: <span className="tabular-nums">{paraConferir}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <div className="flex min-h-14 items-center rounded-xl border border-[#E1E4EA] bg-white px-3.5 text-[15px] font-semibold">
              <span data-testid="contador-aguardando">
                Aguardando envio: <span className="tabular-nums">{aguardando}</span>
              </span>
            </div>
          </div>
        )}

        {hoje && !semDistrito && (
          <section aria-labelledby="titulo-recentes" className="flex flex-col gap-2.5">
            <h2 id="titulo-recentes" className="m-0 mt-1 text-[15px] font-semibold text-[#5B6474]">
              Capturados agora há pouco
            </h2>
            {recentes.length === 0 ? (
              <p className="text-[15px] text-[#5B6474]">Nenhum pacote ainda</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {recentes.map((r) => (
                  <li key={r.capturaId}>
                    <Link
                      to={`/carteiro/captura/pacote/${r.pacoteId}`}
                      className="flex min-h-14 items-center justify-between gap-2 rounded-[10px] border border-[#E1E4EA] bg-white px-3.5 py-3"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">
                          <span className="font-mono text-[13px]">{r.codigo}</span> · {r.nome ?? 'Sem nome'}
                        </span>
                        {r.codigoDigitado && <span className="text-[13px] text-[#5B6474]">Código digitado</span>}
                      </span>
                      <Chip recente={r} desfazer={desfazer[r.capturaId]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
