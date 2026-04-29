import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { useDestinatarioStore } from '@/stores/destinatario.store';

interface DestinatarioLoginPageProps {
  initialTab?: 'login' | 'rastrear';
}

export function DestinatarioLoginPage({ initialTab = 'login' }: DestinatarioLoginPageProps) {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const fetchObjetoDetalhe = useDestinatarioStore((s) => s.fetchObjetoDetalhe);

  const [tab, setTab] = useState<'login' | 'rastrear'>(initialTab);
  const [credential, setCredential] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoRastreio, setCodigoRastreio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const isCpf = /^\d/.test(credential.replace(/\D/g, ''));
      await login(isCpf ? { cpf: credential, senha } : { email: credential, senha });
      navigate('/destinatario');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleRastrear = async () => {
    if (!codigoRastreio.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await fetchObjetoDetalhe(codigoRastreio.trim());
      navigate('/destinatario/detalhe');
    } catch {
      // Navigate anyway – the detalhe page will show mock data as fallback
      navigate('/destinatario/detalhe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="bg-correios-blue px-6 py-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-correios-yellow text-sm font-black tracking-[0.24em] text-correios-blue shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
          CE
        </div>
        <h1 className="mt-4 text-xl font-black text-white">Correios Entregas</h1>
        <p className="mt-1 text-xs text-white/65">Acompanhe e gerencie suas encomendas</p>
      </div>

      <div className="flex-1 space-y-4 px-6 pt-6">
        <div className="flex rounded-2xl bg-slate-100 p-1">
          {[
            { id: 'login' as const, label: 'Entrar' },
            { id: 'rastrear' as const, label: 'Rastrear' },
          ].map((item) => (
            <button
              key={item.id}
              className={[
                'flex-1 rounded-xl py-2 text-xs font-semibold transition-colors',
                tab === item.id ? 'bg-white text-correios-blue shadow-sm' : 'text-slate-500',
              ].join(' ')}
              onClick={() => { setTab(item.id); setError(null); }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        {tab === 'login' ? (
          <>
            <InputField
              label="CPF ou e-mail"
              placeholder="000.000.000-00"
              value={credential}
              onChange={setCredential}
            />
            <InputField
              label="Senha"
              placeholder="••••••••"
              type="password"
              value={senha}
              onChange={setSenha}
            />
            <button
              className="w-full rounded-[22px] bg-correios-blue px-4 py-4 text-sm font-bold text-white transition hover:bg-correios-blue-dark disabled:opacity-50"
              onClick={handleLogin}
              disabled={loading || !credential || !senha}
              type="button"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button className="w-full rounded-[22px] border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50" type="button">
              Criar conta
            </button>
          </>
        ) : (
          <>
            <InputField
              label="Codigo de rastreio"
              placeholder="AA000000000BR"
              mono
              value={codigoRastreio}
              onChange={setCodigoRastreio}
            />
            <button
              className="w-full rounded-[22px] bg-correios-blue px-4 py-4 text-sm font-bold text-white transition hover:bg-correios-blue-dark disabled:opacity-50"
              onClick={handleRastrear}
              disabled={loading || !codigoRastreio.trim()}
              type="button"
            >
              {loading ? 'Rastreando...' : 'Rastrear objeto'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  mono = false,
  placeholder,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  mono?: boolean;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      <input
        className={[
          'w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm outline-none ring-correios-blue/25 transition focus:ring-2',
          mono ? 'font-mono uppercase tracking-[0.16em]' : '',
        ].join(' ')}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
