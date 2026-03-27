import { useState } from 'react'
import Badge from '../../shared/components/Badge'
import KpiCard from '../../shared/components/KpiCard'

// ─── Previsão de Volume ───────────────────────────────────────────────────────
export function Previsao() {
  const historico = [1840, 2100, 1650, 1980, 2240, 1720, 1900, 2050, 1780, 2130, 1990, 2310, 2100, 1850]
  const maxV = Math.max(...historico)

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Previsão Amanhã"  value="2.180"  accent="blue" />
        <KpiCard label="Média 14 dias"    value="1.975"  accent="blue" />
        <KpiCard label="Carteiros Necessários" value="14" accent="yellow" />
        <KpiCard label="Capacidade Disponível" value="92" unit="%" accent="green" />
      </div>

      {/* Gráfico histórico */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Histórico 14 Dias + Previsão</h2>
        <div className="flex items-end gap-1.5 h-32">
          {historico.map((v, i) => {
            const pct = (v / maxV) * 100
            const isLast = i >= historico.length - 3
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{v}</span>
                <div
                  className={`w-full rounded-t-sm ${isLast ? 'bg-[#FFD600]' : 'bg-[#003399]'} opacity-80 hover:opacity-100 transition-opacity`}
                  style={{ height: `${pct}%` }}
                />
                <span className="text-[8px] text-gray-400">{i + 1}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#003399] inline-block"/>Histórico</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#FFD600] inline-block"/>Previsão</span>
        </div>
      </div>

      {/* Simulador */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Simulador de Dimensionamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Volume esperado</label>
            <input type="number" defaultValue={2200} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">SPH médio esperado</label>
            <input type="number" defaultValue={18} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Horas por carteiro</label>
            <input type="number" defaultValue={8} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
          </div>
        </div>
        <div className="mt-4 p-3 bg-[#E6EBF7] rounded-lg">
          <p className="text-sm text-[#003399] font-semibold">
            Resultado: <strong>15 carteiros necessários</strong> · Capacidade por carteiro: ~147 objetos/dia
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Unitizadores ─────────────────────────────────────────────────────────────
const UNI_DATA = [
  { codigo: 'UNI-001', tipo: 'Bag',    objetos: 48,  status: 'Triagem', cep: '01310-100' },
  { codigo: 'UNI-002', tipo: 'Saca',   objetos: 112, status: 'Despacho', cep: '01320-200' },
  { codigo: 'UNI-003', tipo: 'Pallete',objetos: 240, status: 'Recebido', cep: '01330-300' },
  { codigo: 'UNI-004', tipo: 'Caixa',  objetos: 34,  status: 'Devolvido', cep: '01340-400' },
]

export function Unitizadores() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <input type="text" placeholder="Buscar unitizador..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option>Todos os tipos</option>
            <option>Bag</option>
            <option>Saca</option>
            <option>Pallete</option>
            <option>Caixa</option>
          </select>
        </div>
        <button className="px-4 py-2 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">
          + Novo Unitizador
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-3 font-semibold">Código</th>
              <th className="text-left px-4 py-3 font-semibold">Tipo</th>
              <th className="text-right px-4 py-3 font-semibold">Objetos</th>
              <th className="text-left px-4 py-3 font-semibold">CEP Base</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-center px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {UNI_DATA.map((u) => (
              <tr key={u.codigo} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{u.codigo}</td>
                <td className="px-4 py-3 text-gray-700">{u.tipo}</td>
                <td className="px-4 py-3 text-right text-gray-700">{u.objetos}</td>
                <td className="px-4 py-3 text-gray-700">{u.cep}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.status === 'Despacho' ? 'info' : u.status === 'Triagem' ? 'warning' : u.status === 'Recebido' ? 'success' : 'neutral'} size="sm">
                    {u.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <button className="text-xs text-[#003399] hover:underline font-medium">QR Code</button>
                  {' · '}
                  <button className="text-xs text-gray-500 hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Veículos ─────────────────────────────────────────────────────────────────
const VEICULOS = [
  { placa: 'ABC-1234', tipo: 'Moto',    capacidade: 60,  status: 'Em rota',    km: 48320 },
  { placa: 'DEF-5678', tipo: 'Moto',    capacidade: 60,  status: 'Disponível', km: 32100 },
  { placa: 'GHI-9012', tipo: 'Van',     capacidade: 200, status: 'Em rota',    km: 87650 },
  { placa: 'JKL-3456', tipo: 'Van',     capacidade: 200, status: 'Manutenção', km: 102300 },
  { placa: 'MNO-7890', tipo: 'Bicicleta',capacidade: 30, status: 'Disponível', km: 8700 },
]

export function Veiculos() {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Frota"    value="5"   accent="blue" />
        <KpiCard label="Em Rota"        value="2"   accent="info" />
        <KpiCard label="Disponíveis"    value="2"   accent="green" />
        <KpiCard label="Manutenção"     value="1"   accent="amber" />
      </div>
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Frota</h2>
          <button className="px-3 py-1.5 bg-[#003399] text-white text-xs font-semibold rounded-lg">+ Veículo</button>
        </div>
        <div className="divide-y divide-gray-50">
          {VEICULOS.map((v) => (
            <div key={v.placa} className="flex items-center gap-4 px-4 py-3">
              <span className="text-xl">{v.tipo === 'Moto' ? '🏍️' : v.tipo === 'Van' ? '🚐' : '🚲'}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{v.placa}</p>
                <p className="text-xs text-gray-500">{v.tipo} · Cap. {v.capacidade} obj · {v.km.toLocaleString('pt-BR')} km</p>
              </div>
              <Badge variant={v.status === 'Em rota' ? 'info' : v.status === 'Disponível' ? 'success' : 'warning'} dot size="sm">
                {v.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Carteiros ────────────────────────────────────────────────────────────────
const CARTEIROS_LIST = [
  { nome: 'Carlos Mendes',  matricula: 'COR-001', rota: 'R-01', sph: 18.4, status: 'Ativo' },
  { nome: 'Ana Lima',       matricula: 'COR-002', rota: 'R-02', sph: 17.2, status: 'Ativo' },
  { nome: 'Paulo Souza',    matricula: 'COR-003', rota: 'R-03', sph: 19.1, status: 'Ativo' },
  { nome: 'Marcia Torres',  matricula: 'COR-004', rota: 'R-04', sph: 15.8, status: 'Férias' },
]

export function Carteiros() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <input type="text" placeholder="Buscar carteiro..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
        <div className="flex gap-2">
          <button className="px-3 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Importar CSV</button>
          <button className="px-4 py-2 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">+ Carteiro</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-3 font-semibold">Nome</th>
              <th className="text-left px-4 py-3 font-semibold">Matrícula</th>
              <th className="text-left px-4 py-3 font-semibold">Rota Padrão</th>
              <th className="text-right px-4 py-3 font-semibold">SPH Médio</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {CARTEIROS_LIST.map((c) => (
              <tr key={c.matricula} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{c.nome}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.matricula}</td>
                <td className="px-4 py-3 font-bold text-[#003399]">{c.rota}</td>
                <td className="px-4 py-3 text-right text-gray-700">{c.sph}</td>
                <td className="px-4 py-3">
                  <Badge variant={c.status === 'Ativo' ? 'success' : 'neutral'} size="sm" dot>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Ponto do Dia ─────────────────────────────────────────────────────────────
export function Ponto() {
  const [registros, setRegistros] = useState([
    { nome: 'Carlos Mendes', matricula: 'COR-001', entrada: '07:48', status: 'Presente' },
    { nome: 'Ana Lima',      matricula: 'COR-002', entrada: '07:52', status: 'Presente' },
    { nome: 'Paulo Souza',   matricula: 'COR-003', entrada: '08:05', status: 'Atrasado' },
    { nome: 'Marcia Torres', matricula: 'COR-004', entrada: '—',     status: 'Ausente' },
  ])

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Presentes"  value="3" accent="green" />
        <KpiCard label="Atrasados"  value="1" accent="amber" />
        <KpiCard label="Ausentes"   value="1" accent="red" />
        <KpiCard label="Total Equipe" value="5" accent="blue" />
      </div>
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Registro do Dia</h2>
          <button className="px-3 py-1.5 bg-[#003399] text-white text-xs font-semibold rounded-lg">+ Registrar Manual</button>
        </div>
        <div className="divide-y divide-gray-50">
          {registros.map((r, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#E6EBF7] flex items-center justify-center text-[#003399] font-bold text-sm">
                {r.nome.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{r.nome}</p>
                <p className="text-xs text-gray-500">{r.matricula}</p>
              </div>
              <span className="text-xs font-mono text-gray-600">{r.entrada}</span>
              <Badge
                variant={r.status === 'Presente' ? 'success' : r.status === 'Atrasado' ? 'warning' : 'danger'}
                size="sm" dot
              >
                {r.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Configurações ────────────────────────────────────────────────────────────
export function Configuracoes() {
  const [tab, setTab] = useState('unidade')
  const tabs = [
    { id: 'unidade',  label: 'Dados da Unidade' },
    { id: 'cep',      label: 'Faixas de CEP' },
    { id: 'triagem',  label: 'Config. Triagem' },
    { id: 'integr',   label: 'Integrações' },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-[#003399] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
        {tab === 'unidade' && (
          <>
            <h2 className="text-sm font-semibold text-gray-800">Dados da Unidade</h2>
            {[
              { label: 'Nome da Unidade', value: 'CDD São Paulo Centro' },
              { label: 'Código DR', value: 'SP-01-001' },
              { label: 'CNPJ', value: '34.028.316/0001-03' },
              { label: 'Endereço', value: 'Praça do Correio, s/n — São Paulo/SP' },
              { label: 'Tipo de Unidade', value: 'CDD — Centro de Distribuição Domiciliária' },
            ].map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">{f.label}</label>
                <input type="text" defaultValue={f.value} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003399]/30" />
              </div>
            ))}
          </>
        )}
        {tab === 'integr' && (
          <>
            <h2 className="text-sm font-semibold text-gray-800">Integrações</h2>
            {[
              { nome: 'CWS (Controle de Workflow)', status: 'Conectado', cor: 'success' },
              { nome: 'SGOD (Gestão Operacional)', status: 'Conectado', cor: 'success' },
              { nome: 'SRO (Rastreamento)',         status: 'Conectado', cor: 'success' },
              { nome: 'OSRM (Roteirização)',        status: 'Configurar', cor: 'warning' },
            ].map((int, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{int.nome}</span>
                <Badge variant={int.cor} size="sm" dot>{int.status}</Badge>
              </div>
            ))}
          </>
        )}
        {(tab === 'cep' || tab === 'triagem') && (
          <div className="py-8 text-center text-gray-400">
            <p className="text-2xl mb-2">⚙️</p>
            <p className="text-sm">Configurações avançadas de {tab === 'cep' ? 'Faixas de CEP' : 'Triagem'}</p>
          </div>
        )}
        <div className="pt-2 border-t border-gray-100">
          <button className="px-5 py-2 bg-[#003399] text-white text-sm font-semibold rounded-lg hover:bg-[#002266]">
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  )
}
