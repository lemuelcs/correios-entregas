import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, api } from '@/services/api';
import type { ResultadoCaptura } from '../captureQueue';
import { codigoDoDistrito, textoRecusa, useCapturaStore } from '../captura.store';
import {
  ROTULOS,
  apagarRascunho,
  camposParaEnviar,
  gravarRascunho,
  lerRascunho,
  referenciaRotulo,
  soDigitos,
  textoDuvida,
  validar,
  valoresIniciais,
  type NomeCampo,
  type Valores,
} from '../conferencia';
import type { Pendencia } from './ConferirListPage';

interface CepInfo {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
}

const CAMPOS_ENDERECO: NomeCampo[] = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];

/** A foto da captura (`GET /captura/capturas/:id/foto`), com o token da sessão. */
async function buscarFoto(capturaId: string): Promise<Blob> {
  const token = localStorage.getItem('accessToken');
  const resp = await fetch(`/api/v1/captura/capturas/${encodeURIComponent(capturaId)}/foto`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (resp.status === 410) throw new Error('A foto já foi excluída.');
  if (!resp.ok) throw new Error('Não deu para abrir a foto.');
  return resp.blob();
}

/** "Confira os dados" (US-006, US-008, US-011). */
export function ConferirPage() {
  const { capturaId = '' } = useParams();
  const navigate = useNavigate();
  const hoje = useCapturaStore((s) => s.hoje);
  const carregarHoje = useCapturaStore((s) => s.carregarHoje);

  const [pendencia, setPendencia] = useState<Pendencia | null | undefined>(undefined);
  const [valores, setValores] = useState<Valores | null>(null);
  const [editados, setEditados] = useState<Set<NomeCampo>>(new Set());
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [transferir, setTransferir] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ url?: string; erro?: string } | null>(null);
  const cepConsultado = useRef<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<Pendencia[]>('/captura/conferir')
      .then((lista) => {
        if (!ativo) return;
        const p = lista.find((x) => x.capturaId === capturaId) ?? null;
        setPendencia(p);
        if (p) {
          const rascunho = lerRascunho(capturaId);
          const iniciais = valoresIniciais(p.campos);
          setValores(rascunho ?? iniciais);
          if (rascunho) {
            setEditados(new Set((Object.keys(rascunho) as NomeCampo[]).filter((n) => rascunho[n] !== iniciais[n])));
          }
          cepConsultado.current = soDigitos(rascunho?.cep ?? iniciais.cep);
        }
      })
      .catch(() => ativo && setPendencia(null));
    return () => {
      ativo = false;
    };
  }, [capturaId]);

  useEffect(() => () => {
    if (foto?.url) URL.revokeObjectURL(foto.url);
  }, [foto]);

  const erros = useMemo(() => (valores ? validar(valores) : {}), [valores]);
  const distritoCodigo = pendencia ? codigoDoDistrito(hoje, pendencia.distritoId) : '';

  if (pendencia === undefined) {
    return <p className="p-4 text-[15px] text-[#5B6474]">Carregando…</p>;
  }
  if (pendencia === null || !valores) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[15px]">Esta pendência já foi resolvida ou não está mais disponível.</p>
        <button
          type="button"
          onClick={() => navigate('/carteiro/captura/conferir')}
          className="min-h-11 self-start rounded-lg border border-[#D5DAE2] bg-white px-4 font-semibold"
        >
          Voltar para Para conferir
        </button>
      </div>
    );
  }

  const campos = pendencia.campos;
  const temErro = Object.keys(erros).length > 0;

  function mudar(nome: NomeCampo, valor: string) {
    setValores((v) => {
      const novo = { ...(v as Valores), [nome]: valor };
      gravarRascunho(capturaId, novo);
      return novo;
    });
    setEditados((s) => new Set(s).add(nome));
    if (nome === 'cep') void reconsultarCep(valor);
  }

  async function reconsultarCep(valor: string) {
    const cep = soDigitos(valor);
    if (cep.length !== 8 || cep === cepConsultado.current) return;
    cepConsultado.current = cep;
    setCepMsg('Consultando o CEP…');
    try {
      const info = await api.get<CepInfo>(`/captura/cep/${cep}`);
      setValores((v) => {
        const atual = v as Valores;
        const novo: Valores = {
          ...atual,
          logradouro: info.logradouro ?? atual.logradouro,
          bairro: info.bairro ?? atual.bairro,
          cidade: info.cidade,
          uf: info.uf,
        };
        gravarRascunho(capturaId, novo);
        return novo;
      });
      setEditados((s) => new Set([...s, 'logradouro', 'bairro', 'cidade', 'uf'] as NomeCampo[]));
      setCepMsg(info.logradouro ? null : 'O CEP não traz a rua. Preencha pelo rótulo.');
    } catch (err) {
      setCepMsg(
        err instanceof ApiError && err.code === 'cep_nao_encontrado'
          ? 'CEP não encontrado. Confira no rótulo.'
          : 'Não deu para consultar o CEP agora. Preencha o endereço pelo rótulo.',
      );
    }
  }

  async function enviar(confirmarTransferencia: boolean) {
    if (!valores || temErro) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await api.post<ResultadoCaptura>(`/captura/capturas/${encodeURIComponent(capturaId)}/confirmar`, {
        campos: camposParaEnviar(valores, campos),
        ...(confirmarTransferencia ? { confirmarTransferencia: true } : {}),
      });
      if (r.tipo === 'TRANSFERENCIA_PENDENTE') {
        setTransferir(r.distritoOrigem || pendencia?.distritoOrigem || '');
        return;
      }
      if (r.tipo === 'RECUSADO') {
        apagarRascunho(capturaId);
        setErroEnvio(`Este pacote não pode ser salvo: ${textoRecusa(r.codigo)}.`);
        return;
      }
      if (r.tipo === 'PARA_CONFERIR') {
        setErroEnvio('Ainda falta conferir algum campo.');
        return;
      }
      apagarRascunho(capturaId);
      void carregarHoje();
      navigate('/carteiro/captura/conferir', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'captura_ja_resolvida') {
        apagarRascunho(capturaId);
        setErroEnvio('Esta pendência já foi resolvida.');
      } else if (err instanceof ApiError && err.code === 'transferencia_concorrente') {
        setErroEnvio('O pacote mudou de rota enquanto você conferia. Volte e abra de novo.');
      } else if (err instanceof ApiError) {
        setErroEnvio(err.message);
      } else {
        setErroEnvio('Sem conexão. Tente salvar quando o sinal voltar; o que você digitou fica guardado.');
      }
    } finally {
      setEnviando(false);
    }
  }

  function salvar() {
    if (pendencia?.tipo === 'TRANSFERENCIA_PENDENTE') {
      setTransferir(pendencia.distritoOrigem ?? '');
      return;
    }
    void enviar(false);
  }

  async function verFoto() {
    try {
      const blob = await buscarFoto(capturaId);
      setFoto({ url: URL.createObjectURL(blob) });
    } catch (err) {
      setFoto({ erro: err instanceof Error ? err.message : 'Não deu para abrir a foto.' });
    }
  }

  function campo(nome: NomeCampo, opts: { mono?: boolean; inputMode?: 'numeric' | 'tel' | 'text'; maxLength?: number } = {}) {
    const duvida = editados.has(nome) ? null : textoDuvida(nome, campos?.[nome]);
    const referencia = nome === 'logradouro' ? referenciaRotulo(campos?.logradouro) : null;
    const erro = erros[nome];
    const okCodigo = nome === 'codigo' && !erro;
    const id = `campo-${nome}`;
    const descricoes = [duvida && `${id}-duvida`, erro && `${id}-erro`, referencia && `${id}-ref`, okCodigo && `${id}-ok`]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="flex flex-col gap-1.5" data-campo={nome} data-duvida={duvida ? 'true' : undefined}>
        <label htmlFor={id} className="text-sm font-semibold">
          {ROTULOS[nome]}
        </label>
        <input
          id={id}
          value={valores![nome]}
          onChange={(e) => mudar(nome, e.target.value)}
          inputMode={opts.inputMode}
          maxLength={opts.maxLength}
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricoes || undefined}
          className={`h-[46px] rounded-lg px-3 text-[15px] ${opts.mono ? 'font-mono' : ''} ${
            duvida ? 'border-2 border-[#E0A400] bg-[#FFFBEF]' : okCodigo ? 'border border-[#9FD2B3] bg-white' : 'border border-[#D5DAE2] bg-white'
          }`}
        />
        {duvida && (
          <span id={`${id}-duvida`} className="text-[13px] font-semibold text-[#8A5A00]">
            {duvida}
          </span>
        )}
        {referencia && (
          <span id={`${id}-ref`} className="text-[13px] text-[#5B6474]">
            No rótulo: {referencia}
          </span>
        )}
        {okCodigo && (
          <span id={`${id}-ok`} className="text-[13px] font-semibold text-[#1F6F43]">
            Dígito verificador confere
          </span>
        )}
        {erro && (
          <span id={`${id}-erro`} className="text-[13px] font-semibold text-red-700">
            {erro}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-start gap-1 border-b border-[#E1E4EA] bg-white px-2 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/carteiro/captura/conferir')}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
          aria-label="Voltar para Para conferir"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <div className="flex flex-col gap-0.5 pt-1.5">
          <h1 className="m-0 text-xl font-bold">Confira os dados</h1>
          <span className="text-sm text-[#5B6474]">Lidos do rótulo · corrija o que estiver destacado</span>
        </div>
      </header>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        className="flex flex-1 flex-col"
      >
        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
          {campo('codigo', { mono: true })}
          {campo('nome')}
          {campo('whatsapp', { inputMode: 'tel' })}
          {CAMPOS_ENDERECO.map((n) => (
            <div key={n}>{campo(n, n === 'cep' ? { inputMode: 'numeric', maxLength: 9 } : n === 'uf' ? { maxLength: 2 } : {})}</div>
          ))}
          {cepMsg && (
            <p role="status" className="text-[13px] font-semibold text-[#5B6474]">
              {cepMsg}
            </p>
          )}

          {pendencia.temFoto && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void verFoto()}
                className="min-h-11 self-start rounded-lg border border-[#D5DAE2] bg-white px-4 text-[15px] font-semibold"
              >
                Ver foto do rótulo
              </button>
              {foto?.url && <img src={foto.url} alt="Foto do rótulo" className="w-full rounded-lg bg-white object-contain" />}
              {foto?.erro && <p className="text-[13px] text-red-700">{foto.erro}</p>}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[#E1E4EA] bg-white px-[18px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          {erroEnvio && (
            <p role="alert" className="text-[14px] font-semibold text-red-700">
              {erroEnvio}
            </p>
          )}
          <button
            type="submit"
            disabled={temErro || enviando}
            className="min-h-[52px] rounded-xl bg-[#1E4FA3] text-[17px] font-bold text-white disabled:opacity-50"
          >
            {enviando ? 'Salvando…' : `Salvar na rota ${distritoCodigo}`}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/carteiro/captura/camera?substitui=${encodeURIComponent(capturaId)}`)}
            className="min-h-11 rounded-xl border border-[#D5DAE2] bg-white font-semibold"
          >
            Refazer foto
          </button>
        </div>
      </form>

      {transferir !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="transferir-titulo"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <p id="transferir-titulo" className="text-base font-semibold">
              Este pacote está {transferir ? `na rota ${transferir}` : 'em outra rota'} hoje. Trazer para a rota {distritoCodigo}?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTransferir(null)}
                className="min-h-11 rounded-lg border border-[#D5DAE2] px-4 font-semibold"
              >
                Agora não
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setTransferir(null);
                  void enviar(true);
                }}
                className="min-h-11 rounded-lg bg-[#1E4FA3] px-4 font-semibold text-white"
              >
                Trazer para a rota {distritoCodigo}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
