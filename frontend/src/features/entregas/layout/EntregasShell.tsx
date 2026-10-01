/**
 * Shell da área nova (`/entregas/*`, ADR-015): menu escuro do protótipo com
 * Monitoramento (Carregar Dados, Rotas "em breve"), Atendimento, Cadastro e
 * SGPD v2. Aceita `UNIDADE` e `GESTAO`; os papéis legados voltam aos seus shells.
 * Em telas estreitas o menu recolhe num botão (US-036.EC-3) e abre como um diálogo:
 * foco dentro dele, Tab preso, Esc fecha e o foco volta ao botão.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Toaster } from 'react-hot-toast';
import {
  ClipboardList,
  Download,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  Package,
  Route as IconeRota,
  X,
} from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuthStore } from '@/stores/auth.store';
import { useEntregasContextoStore } from '@/stores/entregas-contexto.store';
import { useEntregasCadastroStore } from '@/stores/entregas-cadastro.store';
import { avisarErro } from '../mensagens';
import { FOCO } from '../components/ui';
import { useCamadaModal } from '../components/foco';

const PAPEIS = ['UNIDADE', 'GESTAO'] as const;

/**
 * Telas que a Gestão abre sem unidade em foco. O Atendimento entra aqui: com um único
 * canal ativo o servidor abre a sessão sem unidade; com vários, ele pede a unidade e a
 * própria tela explica.
 */
const SEM_UNIDADE_EM_FOCO = ['/entregas/cadastro', '/entregas/rotas', '/entregas/atendimento'];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

function ItemMenu({ para, ativo, icone, rotulo, selo, aoNavegar }: {
  para: string;
  ativo: boolean;
  icone: ReactNode;
  rotulo: string;
  selo?: ReactNode;
  aoNavegar?: () => void;
}) {
  return (
    <Link
      to={para}
      onClick={aoNavegar}
      aria-current={ativo ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] no-underline ${FOCO} focus-visible:outline-ce-amarelo ${
        ativo ? 'bg-ce-menu-ativo font-semibold text-white' : 'text-ce-menu-texto hover:bg-ce-menu-ativo/60 hover:text-white'
      }`}
    >
      {icone}
      {rotulo}
      {selo}
    </Link>
  );
}

function MenuEntregas({ aoNavegar }: { aoNavegar?: () => void }) {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const unidadeNomeSalvo = useAuthStore((s) => s.unidadeNome);
  const logout = useAuthStore((s) => s.logout);
  const unidades = useEntregasCadastroStore((s) => s.unidades);
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const escolherUnidade = useEntregasContextoStore((s) => s.escolherUnidade);

  const ehGestao = user?.role === 'GESTAO';
  const em = (prefixos: string[]) => prefixos.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const unidadeNome = user?.unidade?.nome ?? unidadeNomeSalvo;
  const sgpd = ehGestao ? '/gestao' : '/unidade';
  const icone = { size: 18, 'aria-hidden': true } as const;

  function sair() {
    // Recarga completa: some com os dados do usuário que saiu (stores em memória)
    // e a saída voluntária não vira "voltar para" no login.
    logout();
    window.location.assign('/login');
  }

  return (
    <nav aria-label="Menu principal" className="flex h-full flex-col gap-5 bg-ce-menu px-3.5 py-5 text-ce-menu-texto">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-ce-amarelo text-ce-menu">
          <Package size={20} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold text-white">Correios Entregas</span>
          <span className="truncate text-xs text-ce-menu-sub">{ehGestao ? 'Gestão (sede)' : unidadeNome ?? 'Unidade'}</span>
        </div>
      </div>

      {ehGestao && (
        <div className="flex flex-col gap-1 px-2">
          <label htmlFor="unidade-foco" className="text-[11px] uppercase tracking-[0.08em] text-ce-menu-secao">Unidade em foco</label>
          <select
            id="unidade-foco"
            value={unidadeGestaoId ?? ''}
            onChange={(e) => escolherUnidade(e.target.value || null)}
            className={`min-h-11 rounded-lg border border-ce-menu-borda bg-ce-menu-ativo px-2 text-sm text-white ${FOCO} focus-visible:outline-ce-amarelo`}
          >
            <option value="">Escolha uma unidade</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="px-2.5 pb-1 text-[11px] uppercase tracking-[0.08em] text-ce-menu-secao">Monitoramento</span>
        <ItemMenu
          para="/entregas/carregar"
          ativo={em(['/entregas/carregar', '/entregas/distritos'])}
          icone={<Download {...icone} />}
          rotulo="Carregar Dados"
          aoNavegar={aoNavegar}
        />
        <ItemMenu
          para="/entregas/rotas"
          ativo={em(['/entregas/rotas'])}
          icone={<IconeRota {...icone} />}
          rotulo="Rotas"
          aoNavegar={aoNavegar}
          selo={<span className="ml-auto rounded-full bg-ce-menu-borda px-2 py-0.5 text-[11px] text-ce-menu-selo">em breve</span>}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="px-2.5 pb-1 text-[11px] uppercase tracking-[0.08em] text-ce-menu-secao">Operação</span>
        <ItemMenu para="/entregas/atendimento" ativo={em(['/entregas/atendimento'])} icone={<MessageCircle {...icone} />} rotulo="Atendimento" aoNavegar={aoNavegar} />
        <ItemMenu para="/entregas/cadastro" ativo={em(['/entregas/cadastro'])} icone={<ClipboardList {...icone} />} rotulo="Cadastro" aoNavegar={aoNavegar} />
      </div>

      <div className="mt-auto flex flex-col gap-1 border-t border-ce-menu-borda pt-3.5">
        <ItemMenu
          para={sgpd}
          ativo={false}
          icone={<Monitor {...icone} />}
          rotulo="SGPD v2"
          aoNavegar={aoNavegar}
          selo={<span className="ml-auto text-[11px] text-ce-menu-secao">protótipo</span>}
        />
        {user && (
          <div className="flex items-center gap-2.5 px-2.5 pt-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ce-menu-borda text-[13px] font-bold text-white" aria-hidden="true">
              {iniciais(user.nome)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold text-white">{user.nome}</span>
              <span className="text-xs text-ce-menu-sub">{ehGestao ? 'Gestão' : 'Supervisão'}</span>
            </div>
            <button
              type="button"
              onClick={sair}
              aria-label="Sair"
              title="Sair"
              className={`inline-flex size-11 items-center justify-center rounded-lg text-ce-menu-sub hover:bg-ce-menu-ativo hover:text-white ${FOCO} focus-visible:outline-ce-amarelo`}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export function EntregasShell() {
  useAuthGuard([...PAPEIS]);
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const gaveta = useRef<HTMLDivElement>(null);
  const carregarUnidades = useEntregasCadastroStore((s) => s.carregarUnidades);
  const unidadeGestaoId = useEntregasContextoStore((s) => s.unidadeGestaoId);
  const escolherUnidade = useEntregasContextoStore((s) => s.escolherUnidade);
  const ehGestao = user?.role === 'GESTAO';

  useEffect(() => setMenuAberto(false), [pathname]);

  // Menu em tela estreita = diálogo modal: foco no item da página atual, Tab preso, rolagem travada.
  useCamadaModal(gaveta, menuAberto, {
    aoEsc: () => setMenuAberto(false),
    focoInicial: (caixa) => caixa.querySelector<HTMLElement>('a[aria-current="page"]') ?? caixa.querySelector<HTMLElement>('a[href]'),
  });

  // Alargou a janela com o menu aberto: a gaveta some (lg:hidden) e não pode continuar prendendo o foco.
  useEffect(() => {
    if (!menuAberto || typeof window.matchMedia !== 'function') return undefined;
    const largo = window.matchMedia('(min-width: 1024px)');
    const aoMudar = () => {
      if (largo.matches) setMenuAberto(false);
    };
    aoMudar();
    largo.addEventListener('change', aoMudar);
    return () => largo.removeEventListener('change', aoMudar);
  }, [menuAberto]);

  // Gestão: lista de unidades para escolher a unidade em foco.
  useEffect(() => {
    if (!ehGestao) return;
    carregarUnidades()
      .then((lista) => {
        const atual = useEntregasContextoStore.getState().unidadeGestaoId;
        if (!lista.some((u) => u.id === atual)) escolherUnidade(lista[0]?.id ?? null);
      })
      .catch((err) => avisarErro(err));
  }, [ehGestao, carregarUnidades, escolherUnidade]);

  if (!user || !(PAPEIS as readonly string[]).includes(user.role)) {
    return <div className="min-h-screen bg-ce-fundo" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen bg-ce-fundo font-entregas text-ce-tinta lg:flex">
      <Toaster position="top-right" />

      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 overflow-y-auto lg:block">
        <MenuEntregas />
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-ce-menu px-4 text-white lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ce-amarelo text-ce-menu">
            <Package size={18} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <span className="truncate text-[15px] font-bold">Correios Entregas</span>
        </div>
        <button
          ref={botaoMenu}
          type="button"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
          aria-haspopup="dialog"
          aria-controls="menu-entregas-movel"
          className={`inline-flex size-11 items-center justify-center rounded-lg hover:bg-ce-menu-ativo ${FOCO} focus-visible:outline-ce-amarelo`}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>

      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-[rgba(20,33,58,0.45)]" onClick={() => setMenuAberto(false)} />
          <div
            ref={gaveta}
            id="menu-entregas-movel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="relative h-full w-[280px] max-w-[85vw] overflow-y-auto overscroll-contain shadow-xl"
          >
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className={`absolute right-2 top-3 z-10 inline-flex size-11 items-center justify-center rounded-lg text-ce-menu-sub hover:text-white ${FOCO} focus-visible:outline-ce-amarelo`}
            >
              <X size={20} aria-hidden="true" />
            </button>
            <MenuEntregas aoNavegar={() => setMenuAberto(false)} />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-12 pt-5 md:px-8 md:pt-7">
        {ehGestao && !unidadeGestaoId && !SEM_UNIDADE_EM_FOCO.includes(pathname) ? (
          <p className="m-0 text-[15px] text-ce-suave">Escolha a unidade em foco no menu para ver os dados.</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
