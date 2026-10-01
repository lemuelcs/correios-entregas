import { ChevronLeft } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, api } from '@/services/api';
import { CARGA_LIBERADA, useCapturaStore, type RecenteServidor } from '../captura.store';
import { ROTULOS, soDigitos, type NomeCampo } from '../conferencia';
import { normalizarTelefone } from '../lib/telefone';

const EDITAVEIS: NomeCampo[] = ['nome', 'whatsapp', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];

/**
 * Um pacote que o carteiro capturou (US-017): editar os campos de contato e
 * endereço (não o código) e remover enquanto o distrito não foi liberado.
 * Campo em branco = mantém o valor atual.
 */
export function PacotePage() {
  const { pacoteId = '' } = useParams();
  const navigate = useNavigate();
  const hoje = useCapturaStore((s) => s.hoje);
  const carregarHoje = useCapturaStore((s) => s.carregarHoje);
  // O último visto: uma recarga do início sem o pacote (ex.: removido em outra aba) não some com a tela.
  const visto = useRef<RecenteServidor | null>(null);
  const recente = hoje?.recentes.find((r) => r.pacoteId === pacoteId) ?? visto.current;
  visto.current = recente;
  const distrito = recente ? hoje?.distritos.find((d) => d.distritoId === recente.distritoId) ?? null : null;

  const [valores, setValores] = useState<Record<NomeCampo, string>>(() => {
    const v = {} as Record<NomeCampo, string>;
    for (const n of EDITAVEIS) v[n] = '';
    v.nome = recente?.nome ?? '';
    return v;
  });
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (!recente) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[15px]">Pacote não encontrado entre os capturados de hoje.</p>
        <button
          type="button"
          onClick={() => navigate('/carteiro/captura')}
          className="min-h-11 self-start rounded-lg border border-[#D5DAE2] bg-white px-4 font-semibold"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  const liberado = distrito?.cargaStatus ? CARGA_LIBERADA.has(distrito.cargaStatus) : false;
  const podeRemover = !liberado && recente.origem !== 'PLANILHA';

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const corpo: Partial<Record<NomeCampo, string | null>> = {};
    for (const n of EDITAVEIS) {
      const v = valores[n].trim();
      if (n === 'nome' ? v !== (recente?.nome ?? '') : v !== '') corpo[n] = n === 'cep' ? soDigitos(v) : v;
    }
    if (corpo.nome === '') return setMensagem({ tipo: 'erro', texto: 'Informe o nome do destinatário' });
    if (corpo.whatsapp) {
      try {
        normalizarTelefone(corpo.whatsapp);
      } catch {
        return setMensagem({ tipo: 'erro', texto: 'Número incompleto: corrija ou deixe em branco' });
      }
    }
    if (corpo.cep !== undefined && corpo.cep?.length !== 8) return setMensagem({ tipo: 'erro', texto: 'CEP deve ter 8 dígitos' });
    if (Object.keys(corpo).length === 0) return setMensagem({ tipo: 'erro', texto: 'Nada foi alterado.' });
    setOcupado(true);
    try {
      await api.patch(`/captura/pacotes/${encodeURIComponent(pacoteId)}`, corpo);
      setMensagem({ tipo: 'ok', texto: 'Pacote atualizado.' });
      void carregarHoje();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err instanceof ApiError ? err.message : 'Sem conexão. Tente de novo.' });
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    setConfirmarRemocao(false);
    setOcupado(true);
    try {
      await api.delete(`/captura/pacotes/${encodeURIComponent(pacoteId)}`);
      await carregarHoje();
      navigate('/carteiro/captura', { replace: true });
    } catch (err) {
      setMensagem({
        tipo: 'erro',
        texto:
          err instanceof ApiError && err.code === 'remocao_nao_permitida'
            ? 'Para remover, fale com o supervisor.'
            : err instanceof ApiError
              ? err.message
              : 'Sem conexão. Tente de novo.',
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-start gap-1 border-b border-[#E1E4EA] bg-white px-2 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/carteiro/captura')}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
          aria-label="Voltar ao início"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <div className="flex flex-col gap-0.5 pt-1.5">
          <h1 className="m-0 font-mono text-lg font-bold">{recente.codigo}</h1>
          <span className="text-sm text-[#5B6474]">
            {distrito ? `${distrito.codigo} · ` : ''}
            {recente.semWhatsapp ? 'Sem WhatsApp' : 'Completo'}
            {recente.codigoDigitado ? ' · código digitado' : ''}
          </span>
        </div>
      </header>

      <form onSubmit={(e) => void salvar(e)} noValidate className="flex flex-1 flex-col gap-3.5 px-[18px] py-4 pb-40">
        <p className="text-[13px] text-[#5B6474]">Deixe em branco o que não muda.</p>
        {EDITAVEIS.map((n) => (
          <div key={n} className="flex flex-col gap-1.5">
            <label htmlFor={`pacote-${n}`} className="text-sm font-semibold">
              {ROTULOS[n]}
            </label>
            <input
              id={`pacote-${n}`}
              value={valores[n]}
              onChange={(e) => setValores((v) => ({ ...v, [n]: e.target.value }))}
              inputMode={n === 'cep' ? 'numeric' : n === 'whatsapp' ? 'tel' : undefined}
              maxLength={n === 'uf' ? 2 : undefined}
              autoComplete="off"
              className="h-[46px] rounded-lg border border-[#D5DAE2] bg-white px-3 text-[15px]"
            />
          </div>
        ))}

        {mensagem && (
          <p
            role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
            className={`text-[14px] font-semibold ${mensagem.tipo === 'erro' ? 'text-red-700' : 'text-[#1F6F43]'}`}
          >
            {mensagem.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={ocupado}
          className="min-h-[52px] rounded-xl bg-[#1E4FA3] text-[17px] font-bold text-white disabled:opacity-50"
        >
          Salvar alterações
        </button>

        {podeRemover ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setConfirmarRemocao(true)}
            className="min-h-11 rounded-xl border border-red-300 bg-white font-semibold text-red-700"
          >
            Remover
          </button>
        ) : (
          <p className="rounded-xl border border-[#E1E4EA] bg-white px-4 py-3 text-[15px] text-[#5B6474]">
            Para remover, fale com o supervisor.
          </p>
        )}
      </form>

      {confirmarRemocao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="remover-titulo" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p id="remover-titulo" className="text-base font-semibold">
              Remover o pacote {recente.codigo} da lista da rota{distrito?.codigo ? ` ${distrito.codigo}` : ''}?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" autoFocus onClick={() => setConfirmarRemocao(false)} className="min-h-11 rounded-lg bg-[#1E4FA3] px-4 font-semibold text-white">
                Cancelar
              </button>
              <button type="button" onClick={() => void remover()} className="min-h-11 rounded-lg border border-red-300 px-4 font-semibold text-red-700">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
