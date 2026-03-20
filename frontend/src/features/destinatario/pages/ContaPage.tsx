import { Badge } from '@/shared/ui/Badge';
import { useAuthStore } from '@/stores/auth.store';
import { accountData } from '../destinatario.data';

export function ContaPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Use authenticated user data when available, otherwise fall back to mock
  const name = user?.nome ?? accountData.name;
  const email = user?.email ?? accountData.email;
  const cpf = user?.cpf ?? accountData.cpf;

  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      <div className="rounded-[28px] bg-correios-blue p-5 text-white shadow-[0_20px_44px_rgba(0,51,153,0.18)]">
        <p className="text-xs text-white/70">Conta ativa</p>
        <h2 className="mt-2 text-xl font-bold">{name}</h2>
        <p className="mt-1 text-sm text-white/75">{email}</p>
        <div className="mt-4 flex gap-2">
          <Badge variant="yellow">Notificacoes ativas</Badge>
          <Badge variant="blue">CPF verificado</Badge>
        </div>
      </div>

      <div className="space-y-3">
        {[
          ['CPF', cpf],
          ['Canal de alertas', accountData.notifications],
          ['Preferencia de entrega', 'Receber atualizacoes em tempo real'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[24px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <button
        className="w-full rounded-[22px] border border-rose-200 px-4 py-3.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
        onClick={logout}
        type="button"
      >
        Sair da conta
      </button>
    </div>
  );
}
