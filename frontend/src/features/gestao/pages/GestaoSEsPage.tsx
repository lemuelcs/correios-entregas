import { useEffect, useState, type FormEvent } from 'react';
import { useGestaoSEsStore } from '@/stores/gestao-ses.store';
import { Panel } from '@/shared/ui/Panel';
import { Badge } from '@/shared/ui/Badge';

const emptyForm = { nome: '', sigla: '', cidade: '', uf: '', isSede: false };

export function GestaoSEsPage() {
  const { ses, loading, fetchAll, create, update, remove } = useGestaoSEsStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchAll(); }, []);

  function openEdit(se: any) {
    setEditId(se.id);
    setForm({ nome: se.nome, sigla: se.sigla, cidade: se.cidade, uf: se.uf, isSede: se.isSede });
    setShowForm(true);
  }

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editId) await update(editId, form);
    else await create(form);
    setShowForm(false);
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-correios-blue focus:border-transparent';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Superintendencias Estaduais ({ses.length})</h2>
        <button onClick={openNew} className="rounded-lg bg-correios-blue px-4 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid">Nova SE</button>
      </div>

      {showForm && (
        <Panel title={editId ? 'Editar SE' : 'Nova SE'} description="">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Nome</label><input className={inputClass} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Sigla</label><input className={inputClass} value={form.sigla} onChange={e => setForm({...form, sigla: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Cidade</label><input className={inputClass} value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">UF</label><input className={inputClass} value={form.uf} onChange={e => setForm({...form, uf: e.target.value.toUpperCase()})} maxLength={2} required /></div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isSede} onChange={e => setForm({...form, isSede: e.target.checked})} className="h-4 w-4 rounded border-slate-300" /> Correios Sede</label>
            </div>
            <div className="flex items-end gap-3">
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
                <th className="px-4 py-3">Sigla</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Cidade</th><th className="px-4 py-3">UF</th><th className="px-4 py-3">Sede?</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {ses.map(se => (
                  <tr key={se.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold">{se.sigla}</td>
                    <td className="px-4 py-3 font-medium">{se.nome}</td>
                    <td className="px-4 py-3">{se.cidade}</td>
                    <td className="px-4 py-3">{se.uf}</td>
                    <td className="px-4 py-3">{se.isSede ? <Badge variant="yellow">Sede</Badge> : '-'}</td>
                    <td className="px-4 py-3"><Badge variant={se.ativa ? 'success' : 'neutral'}>{se.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
                    <td className="px-4 py-3 space-x-3">
                      <button onClick={() => openEdit(se)} className="text-correios-blue hover:underline">Editar</button>
                      {!se.isSede && se.ativa && <button onClick={() => remove(se.id)} className="text-red-500 hover:underline">Desativar</button>}
                    </td>
                  </tr>
                ))}
                {ses.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhuma SE cadastrada</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
