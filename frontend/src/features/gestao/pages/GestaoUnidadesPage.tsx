import { useEffect, useState, type FormEvent } from 'react';
import { useGestaoUnidadesStore } from '@/stores/gestao-unidades.store';
import { useGestaoSEsStore } from '@/stores/gestao-ses.store';
import type { Unidade, TipoUnidade } from '@/types/api.types';
import { Panel } from '@/shared/ui/Panel';
import { Badge } from '@/shared/ui/Badge';

const emptyForm: {
  codigo: string; mcu: string; nome: string; tipo: TipoUnidade; seId: string;
  logradouro: string; numero: string; complemento: string; bairro: string;
  cidade: string; uf: string; cep: string; latitude: string; longitude: string; faixasCep: string;
} = {
  codigo: '', mcu: '', nome: '', tipo: 'CDD', seId: '',
  logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '',
  latitude: '', longitude: '', faixasCep: '[]',
};

export function GestaoUnidadesPage() {
  const { unidades, loading, fetchAll, create, update } = useGestaoUnidadesStore();
  const { ses, fetchAll: fetchSEs } = useGestaoSEsStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchAll(); fetchSEs(); }, []);

  function openEdit(u: Unidade) {
    setEditId(u.id);
    setForm({
      codigo: u.codigo, mcu: u.mcu ?? '', nome: u.nome, tipo: u.tipo, seId: u.seId ?? '',
      logradouro: u.logradouro, numero: u.numero, complemento: u.complemento ?? '',
      bairro: u.bairro, cidade: u.cidade, uf: u.uf, cep: u.cep,
      latitude: String(u.latitude), longitude: String(u.longitude),
      faixasCep: JSON.stringify(u.faixasCep ?? [], null, 2),
    });
    setShowForm(true);
  }

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      faixasCep: JSON.parse(form.faixasCep || '[]'),
      seId: form.seId || undefined,
      mcu: form.mcu || undefined,
      complemento: form.complemento || undefined,
    };
    if (editId) await update(editId, payload);
    else await create(payload);
    setShowForm(false);
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-correios-blue focus:border-transparent';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Unidades ({unidades.length})</h2>
        <button onClick={openNew} className="rounded-lg bg-correios-blue px-4 py-2 text-sm font-semibold text-white hover:bg-correios-blue-mid">Nova Unidade</button>
      </div>

      {showForm && (
        <Panel title={editId ? 'Editar Unidade' : 'Nova Unidade'} description="">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Codigo</label><input className={inputClass} value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">MCU</label><input className={inputClass} value={form.mcu} onChange={e => setForm({...form, mcu: e.target.value})} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Nome</label><input className={inputClass} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label><select className={inputClass} value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value as TipoUnidade})}><option value="CDD">CDD</option><option value="CEE">CEE</option><option value="HIBRIDA">Hibrida</option></select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Superintendencia</label><select className={inputClass} value={form.seId} onChange={e => setForm({...form, seId: e.target.value})}><option value="">Nenhuma</option>{ses.map(s => <option key={s.id} value={s.id}>{s.sigla} - {s.nome}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">CEP</label><input className={inputClass} value={form.cep} onChange={e => setForm({...form, cep: e.target.value.replace(/\D/g, '')})} maxLength={8} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Logradouro</label><input className={inputClass} value={form.logradouro} onChange={e => setForm({...form, logradouro: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Numero</label><input className={inputClass} value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Complemento</label><input className={inputClass} value={form.complemento} onChange={e => setForm({...form, complemento: e.target.value})} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Bairro</label><input className={inputClass} value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Cidade</label><input className={inputClass} value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">UF</label><input className={inputClass} value={form.uf} onChange={e => setForm({...form, uf: e.target.value.toUpperCase()})} maxLength={2} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Latitude</label><input className={inputClass} type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} required /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Longitude</label><input className={inputClass} type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} required /></div>
            <div className="md:col-span-3"><label className="mb-1 block text-xs font-medium text-slate-600">Faixas de CEP (JSON)</label><textarea className={inputClass + ' h-24 font-mono text-xs'} value={form.faixasCep} onChange={e => setForm({...form, faixasCep: e.target.value})} /></div>
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
                <th className="px-4 py-3">MCU</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Sigla</th><th className="px-4 py-3">SE</th><th className="px-4 py-3">Cidade/UF</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {unidades.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{u.mcu ?? '-'}</td>
                    <td className="px-4 py-3 font-medium">{u.nome}</td>
                    <td className="px-4 py-3">{u.codigo}</td>
                    <td className="px-4 py-3">{u.se?.sigla ?? '-'}</td>
                    <td className="px-4 py-3">{u.cidade}/{u.uf}</td>
                    <td className="px-4 py-3"><Badge variant="info">{u.tipo}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={u.ativa ? 'success' : 'neutral'}>{u.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
                    <td className="px-4 py-3"><button onClick={() => openEdit(u)} className="text-correios-blue hover:underline">Editar</button></td>
                  </tr>
                ))}
                {unidades.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nenhuma unidade cadastrada</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
