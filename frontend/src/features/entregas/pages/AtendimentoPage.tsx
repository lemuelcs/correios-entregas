/**
 * Atendimento (US-027, ADR-010): o Chatwoot incorporado num iframe, já
 * autenticado. A URL vem de `POST /entregas/atendimento/sessao` (uso único,
 * ~5 min). Indisponível (503) → aviso e "Abrir em nova aba", que gera outra sessão.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { ApiError } from '@/services/api';
import { entregasApi } from '../entregas.api';
import { avisarErro, ehSessaoExpirada, mensagemDeErro } from '../mensagens';
import { Botao, Carregando } from '../components/ui';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; url: string }
  | { tipo: 'indisponivel'; mensagem: string };

export function AtendimentoPage() {
  const user = useAuthStore((s) => s.user);
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [abrindo, setAbrindo] = useState(false);
  const pedido = useRef<string | null>(null);
  const ehGestao = user?.role === 'GESTAO';
  const unidadeId = ehGestao ? unidadeGestaoId ?? undefined : undefined;

  const abrirSessao = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      const sessao = await entregasApi.sessaoAtendimento(unidadeId);
      setEstado({ tipo: 'pronto', url: sessao.url });
    } catch (err) {
      if (ehSessaoExpirada(err)) return;
      const indisponivel = err instanceof ApiError && err.status === 503;
      setEstado({
        tipo: 'indisponivel',
        mensagem: indisponivel ? 'Atendimento indisponível no momento' : mensagemDeErro(err, 'Atendimento indisponível no momento'),
      });
    }
  }, [unidadeId]);

  useEffect(() => {
    // A URL é de uso único: uma sessão por abertura da tela (o StrictMode monta duas vezes).
    const chave = unidadeId ?? 'propria';
    if (pedido.current === chave) return;
    pedido.current = chave;
    void abrirSessao();
  }, [abrirSessao, unidadeId]);

  /** Nova sessão numa aba própria (cookies de terceiros bloqueados no iframe, Safari). */
  async function abrirEmNovaAba() {
    const aba = window.open('', '_blank');
    setAbrindo(true);
    try {
      const sessao = await entregasApi.sessaoAtendimento(unidadeId);
      if (aba) {
        aba.opener = null;
        aba.location.href = sessao.url;
      } else {
        window.location.assign(sessao.url);
      }
    } catch (err) {
      aba?.close();
      avisarErro(err, 'Atendimento indisponível no momento');
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="m-0 text-2xl font-bold">Atendimento</h1>
          <span className="text-sm text-ce-suave">
            Chatwoot incorporado · entrou como {user?.nome} (login único)
          </span>
        </div>
        <Botao variante="texto" onClick={() => void abrirEmNovaAba()} disabled={abrindo}>
          Abrir em nova aba <ExternalLink size={16} aria-hidden="true" />
        </Botao>
      </header>

      {estado.tipo === 'carregando' && <Carregando texto="Abrindo o atendimento…" />}

      {estado.tipo === 'pronto' && (
        <iframe
          key={estado.url}
          title="Chatwoot — conversas da unidade"
          src={estado.url}
          className="min-h-[640px] w-full flex-1 rounded-xl border border-ce-linha-forte bg-white"
          allow="clipboard-write; microphone"
          referrerPolicy="no-referrer"
        />
      )}

      {estado.tipo === 'indisponivel' && (
        <section role="alert" aria-label="Atendimento indisponível" className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-ce-linha-forte bg-white p-8 text-center">
          <h2 className="m-0 text-xl font-bold">{estado.mensagem}</h2>
          <p className="m-0 max-w-[60ch] text-[15px] text-ce-tinta-2">
            O Chatwoot não respondeu ou recusou a incorporação nesta tela. Você pode abri-lo numa aba própria ou tentar de novo.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Botao onClick={() => void abrirEmNovaAba()} disabled={abrindo}>Abrir em nova aba</Botao>
            <Botao variante="secundario" onClick={() => void abrirSessao()}>Tentar de novo</Botao>
          </div>
        </section>
      )}
    </div>
  );
}
