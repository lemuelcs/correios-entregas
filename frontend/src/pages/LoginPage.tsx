import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';

type IdentifierType = 'cpf' | 'matricula' | 'email';

const IDENTIFIER_CONFIG: Record<IdentifierType, { label: string; placeholder: string; maxLength?: number; type: string }> = {
  cpf: { label: 'CPF', placeholder: '00000000000', maxLength: 11, type: 'text' },
  matricula: { label: 'Matricula', placeholder: '00000000', maxLength: 8, type: 'text' },
  email: { label: 'Email', placeholder: 'usuario@correios.local', type: 'email' },
};

export function LoginPage() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('cpf');
  const [identifier, setIdentifier] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  function handleIdentifierChange(value: string) {
    if (identifierType === 'cpf' || identifierType === 'matricula') {
      setIdentifier(value.replace(/\D/g, ''));
    } else {
      setIdentifier(value);
    }
  }

  function switchIdentifierType(type: IdentifierType) {
    setIdentifierType(type);
    setIdentifier('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const credentials: { cpf?: string; matricula?: string; email?: string; senha: string } = { senha };
      credentials[identifierType] = identifier;
      const user = await login(credentials);
      if (user.role === 'GESTAO') navigate('/gestao');
      else if (user.role === 'UNIDADE') navigate('/unidade');
      else if (user.role === 'CARTEIRO') navigate('/carteiro');
      else navigate('/destinatario');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  const config = IDENTIFIER_CONFIG[identifierType];

  return (
    <div className="min-h-screen flex items-center justify-center bg-correios-blue">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-correios-blue">Correios Entregas</h1>
          <p className="text-gray-500 mt-2">Sistema de Gestao de Distribuicao</p>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
          {(['cpf', 'matricula', 'email'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => switchIdentifierType(type)}
              className={[
                'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all',
                identifierType === type
                  ? 'bg-white text-correios-blue shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {IDENTIFIER_CONFIG[type].label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{config.label}</label>
            <input
              type={config.type}
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-correios-blue focus:border-transparent"
              placeholder={config.placeholder}
              maxLength={config.maxLength}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-correios-blue focus:border-transparent"
              placeholder="******"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-correios-blue text-white py-3 rounded-lg font-semibold hover:bg-correios-blue-mid transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
