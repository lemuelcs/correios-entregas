import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

// A mesma política do backend (auth.service: 8 a 72 caracteres).
const SENHA_MIN = 8;
const SENHA_MAX = 72;

const campoClasse =
  'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-correios-blue focus:border-transparent';

/**
 * "Crie sua senha": troca obrigatória da senha inicial do carteiro (US-001 AC-1).
 * A senha atual vem do login (estado da navegação, só em memória); se a página
 * for reaberta sem ela, o carteiro a digita.
 */
export function CriarSenhaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const senhaDoLogin = (location.state as { senhaAtual?: string } | null)?.senhaAtual ?? '';

  const [senhaAtual, setSenhaAtual] = useState(senhaDoLogin);
  const [novaSenha, setNovaSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!accessToken) navigate('/login', { replace: true });
  }, [accessToken, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!senhaAtual) return setErro('Informe a senha que o supervisor passou.');
    if (novaSenha.length < SENHA_MIN || novaSenha.length > SENHA_MAX) {
      return setErro(`A senha precisa ter de ${SENHA_MIN} a ${SENHA_MAX} caracteres.`);
    }
    if (novaSenha !== repetir) return setErro('As duas senhas não são iguais.');
    if (novaSenha === senhaAtual) return setErro('A nova senha precisa ser diferente da atual.');

    setEnviando(true);
    try {
      await api.post('/auth/trocar-senha', { senhaAtual, novaSenha });
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, senhaTemporaria: false } : s.user }));
      navigate('/carteiro/captura', { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-correios-blue px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-correios-blue">Crie sua senha</h1>
        <p className="text-gray-500 mt-2 mb-6">
          No primeiro acesso, troque a senha que o supervisor passou por uma só sua.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!senhaDoLogin && (
            <div>
              <label htmlFor="senha-atual" className="block text-sm font-medium text-gray-700 mb-1">
                Senha que o supervisor passou
              </label>
              <input
                id="senha-atual"
                type="password"
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className={campoClasse}
              />
            </div>
          )}
          <div>
            <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 mb-1">
              Nova senha
            </label>
            <input
              id="nova-senha"
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className={campoClasse}
            />
            <p className="mt-1 text-xs text-gray-500">De {SENHA_MIN} a {SENHA_MAX} caracteres.</p>
          </div>
          <div>
            <label htmlFor="repetir-senha" className="block text-sm font-medium text-gray-700 mb-1">
              Repita a nova senha
            </label>
            <input
              id="repetir-senha"
              type="password"
              autoComplete="new-password"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              className={campoClasse}
            />
          </div>

          {erro && (
            <div role="alert" className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-correios-blue text-white py-3 rounded-lg font-semibold hover:bg-correios-blue-mid transition-colors disabled:opacity-50"
          >
            {enviando ? 'Salvando...' : 'Salvar e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
