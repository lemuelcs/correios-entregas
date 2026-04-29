import { useEffect, useState, type FormEvent } from 'react';
import { useGestaoUsuariosStore } from '@/stores/gestao-usuarios.store';
import { useGestaoUnidadesStore } from '@/stores/gestao-unidades.store';
import { Panel } from '@/shared/ui/Panel';
import { Badge } from '@/shared/ui/Badge';

interface UsuarioListItem {
  id: string;
  cpf?: string;
  email?: string;
  matricula?: string;
  nome: string;
  role: string;
  unidadeId?: string;
  unidade?: { id: string; nome: string; codigo: string } | null;
  telefoneCelular?: string;
  telefoneComercial?: string;
  ativo: boolean;
  createdAt: string;
}

const ROLES = ['GESTAO', 'UNIDADE', 'CARTEIRO', 'DESTINATARIO'] as const;
const ROLE_LABELS: Record<string, string> = { GESTAO: 'Gestao', UNIDADE: 'Unidade', CARTEIRO: 'Carteiro', DESTINATARIO: 'Destinatario' };
const ROLE_VARIANT: Record<string, 'blue' | 'info' | 'warning' | 'success'> = { GESTAO: 'blue', UNIDADE: 'info', CARTEIRO: 'warning', DESTINATARIO: 'success' };

const emptyForm = {
  cpf: '', email: '', matricula: '', senha: '', nome: '',
  role: 'UNIDADE' as string, unidadeId: '',
  telefoneCelular: '', telefoneComercial: '',
  endResidencialCidade: '', endResidencialUf: '', endResidencialCep: '',
  endResidencialLogradouro: '', endResidencialNumero: '', endResidencialComplemento: '',
};

export function GestaoUsuariosPage() {
  const { usuarios, loading, fetchAll, create, update } = useGestaoUsuariosStore();
  const { unidades, fetchAll: fetchUnidades } = useGestaoUnidadesStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => { fetchAll(); fetchUnidades(); }, []);

  const isEmployee = form.role !== 'DESTINATARIO';

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(u: UsuarioListItem) {
    setEditId(u.id);
    setForm({
      cpf: u.cpf ?? '', email: u.email ?? '', matricula: u.matricula ?? '', senha: '', nome: u.nome,
      role: u.role, unidadeId: u.unidadeId ?? '',
      telefoneCelular: u.telefoneCelular ?? '', telefoneComercial: u.telefoneComercial ?? '',
      endResidencialCidade: '', endResidencialUf: '', endResidencialCep: '',
      endResidencialLogradouro: '', endResidencialNumero: '', endResidencialComplemento: '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: Record<string, string | boolean | undefined> = { ...form };
    // Clean up empty strings
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') delete payload[key];
    }
    if (!payload.senha && editId) delete payload.senha;
    if (editId) await update(editId, payload);
    else await create(payload);
    setShowForm(false);
  }

  const filtered = filterRole ? usuarios.filter(u => u.role === filterRole) : usuarios;
  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-correios-blue focus:border-transparent';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Usuarios ({filtered.length})</h2>
          <select className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">Todos os roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <button onClick={openNew} className="rounded-lg bg-correios-blue px-4 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid">Novo Usuario</button>
      </div>

      {showForm && (
        <Panel title={editId ? 'Editar Usuario' : 'Novo Usuario'} description="">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Nome</label><input className={inputClass} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">CPF</label><input className={inputClass} value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value.replace(/\D/g, '')})} maxLength={11} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Email</label><input className={inputClass} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Role</label><select className={inputClass} value={form.role} onChange={e => setForm({...form, role: e.target.value})}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
            {isEmployee && <div><label className="mb-1 block text-xs font-medium text-slate-600">Matricula (8 digitos)</label><input className={inputClass} value={form.matricula} onChange={e => setForm({...form, matricula: e.target.value.replace(/\D/g, '')})} maxLength={8} required /></div>}
            {isEmployee && form.role !== 'GESTAO' && <div><label className="mb-1 block text-xs font-medium text-slate-600">Unidade</label><select className={inputClass} value={form.unidadeId} onChange={e => setForm({...form, unidadeId: e.target.value})}><option value="">Selecione</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.codigo} - {u.nome}</option>)}</select></div>}
            <div><label className="mb-1 block text-xs font-medium text-slate-600">{editId ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}</label><input className={inputClass} type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} {...(!editId ? { required: true } : {})} minLength={6} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Tel. Celular</label><input className={inputClass} value={form.telefoneCelular} onChange={e => setForm({...form, telefoneCelular: e.target.value})} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Tel. Comercial</label><input className={inputClass} value={form.telefoneComercial} onChange={e => setForm({...form, telefoneComercial: e.target.value})} /></div>
            <div className="flex gap-3 md:col-span-3">
              <button type="submit" className="rounded-lg bg-correios-blue px-6 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid">Salvar</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title="" description="">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Matricula</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">CPF</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{u.nome}</td>
                    <td className="px-4 py-3"><Badge variant={ROLE_VARIANT[u.role] ?? 'neutral'}>{ROLE_LABELS[u.role] ?? u.role}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs">{u.matricula ?? '-'}</td>
                    <td className="px-4 py-3">{u.unidade?.nome ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.cpf ?? '-'}</td>
                    <td className="px-4 py-3 text-xs">{u.email ?? '-'}</td>
                    <td className="px-4 py-3"><Badge variant={u.ativo ? 'success' : 'neutral'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td className="px-4 py-3"><button onClick={() => openEdit(u)} className="text-correios-blue hover:underline">Editar</button></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nenhum usuario encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
