import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/services/api';
import { destinoAposLogin } from '@/hooks/useAuthGuard';

export const MENSAGEM_PRIMEIRO_ACESSO_OFFLINE = 'Sem conexão. O primeiro acesso precisa de internet.';

// A tela só oferece matrícula e senha. A API ainda aceita CPF e email (contas
// antigas e testes), mas a interface não mostra mais esses modos.
const MATRICULA = { label: 'Matrícula', placeholder: '00000000', maxLength: 8, vazio: 'Informe a matrícula.' };

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [camposVazios, setCamposVazios] = useState<{ identificador: boolean; senha: boolean }>({
    identificador: false,
    senha: false,
  });
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleIdentifierChange(value: string) {
    setIdentifier(value.replace(/\D/g, ''));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const vazios = { identificador: !identifier.trim(), senha: !senha };
    setCamposVazios(vazios);
    if (vazios.identificador || vazios.senha) return;
    // Sem tokens não há sessão para retomar: o primeiro acesso precisa da rede.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError(MENSAGEM_PRIMEIRO_ACESSO_OFFLINE);
      return;
    }
    setLoading(true);
    try {
      const user = await login({ matricula: identifier, senha });
      if (user.role === 'CARTEIRO' && user.senhaTemporaria) {
        // App de captura; a senha inicial do supervisor é trocada antes (US-001 AC-1).
        navigate('/carteiro/criar-senha', { replace: true, state: { senhaAtual: senha } });
      } else {
        // Supervisor → Monitoramento › Carregar Dados; Gestão → Cadastro; carteiro → captura.
        // Com `?voltar=` (sessão expirada), volta à tela pedida se ela for do papel.
        navigate(destinoAposLogin(user.role, searchParams.get('voltar')), { replace: true });
      }
    } catch (err) {
      if (!(err instanceof ApiError) && err instanceof TypeError) setError(MENSAGEM_PRIMEIRO_ACESSO_OFFLINE);
      else setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  const config = MATRICULA;

  return (
    <div className="min-h-screen flex items-center justify-center bg-correios-blue">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-correios-blue">Correios Entregas</h1>
          <p className="text-gray-500 mt-2">Sistema de Gestão de Distribuição</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-identificador" className="block text-sm font-medium text-gray-700 mb-1">{config.label}</label>
            <input
              id="login-identificador"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              className={[
                'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-correios-blue focus:border-transparent',
                camposVazios.identificador ? 'border-red-500 bg-red-50' : 'border-gray-300',
              ].join(' ')}
              placeholder={config.placeholder}
              maxLength={config.maxLength}
              required
              aria-invalid={camposVazios.identificador || undefined}
              aria-describedby={camposVazios.identificador ? 'login-identificador-erro' : undefined}
            />
            {camposVazios.identificador && (
              <p id="login-identificador-erro" className="mt-1 text-sm text-red-600">{config.vazio}</p>
            )}
          </div>

          <div>
            <label htmlFor="login-senha" className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              id="login-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={[
                'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-correios-blue focus:border-transparent',
                camposVazios.senha ? 'border-red-500 bg-red-50' : 'border-gray-300',
              ].join(' ')}
              placeholder="******"
              required
              aria-invalid={camposVazios.senha || undefined}
              aria-describedby={camposVazios.senha ? 'login-senha-erro' : undefined}
            />
            {camposVazios.senha && <p id="login-senha-erro" className="mt-1 text-sm text-red-600">Informe a senha.</p>}
          </div>

          {error && (
            <div role="alert" className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
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
