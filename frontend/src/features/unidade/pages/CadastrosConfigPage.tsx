import { useEffect } from 'react';
import { NavLink } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { useUnidadeStore } from '@/stores/unidade.store';
import { useDespachoStore } from '@/stores/despacho.store';
import { Badge } from '@/shared/ui/Badge';
import { Panel } from '@/shared/ui/Panel';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import {
  attendance as mockAttendance,
  carteiroTeam as mockCarteiroTeam,
  forecastSeries as mockForecastSeries,
  unidadeConfiguracoes as mockConfiguracoes,
  unitizerInventory as mockUnitizerInventory,
  vehicleFleet as mockVehicleFleet,
} from '../unidade.data';

type CadastrosSection = 'previsao' | 'unitizadores' | 'veiculos' | 'carteiros' | 'ponto' | 'configuracoes';

interface CadastrosConfigPageProps {
  section: CadastrosSection;
}

const tabs: Array<{ id: CadastrosSection; label: string; path: string }> = [
  { id: 'previsao', label: 'Previsao', path: '/unidade/previsao' },
  { id: 'unitizadores', label: 'Unitizadores', path: '/unidade/unitizadores' },
  { id: 'veiculos', label: 'Veiculos', path: '/unidade/veiculos' },
  { id: 'carteiros', label: 'Carteiros', path: '/unidade/carteiros' },
  { id: 'ponto', label: 'Ponto', path: '/unidade/ponto' },
  { id: 'configuracoes', label: 'Configuracoes', path: '/unidade/configuracoes' },
];

export function CadastrosConfigPage({ section }: CadastrosConfigPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) =>
              [
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                isActive ? 'bg-correios-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
              ].join(' ')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {section === 'previsao' ? <ForecastSection /> : null}
      {section === 'unitizadores' ? <UnitizadoresSection /> : null}
      {section === 'veiculos' ? <VeiculosSection /> : null}
      {section === 'carteiros' ? <CarteirosSection /> : null}
      {section === 'ponto' ? <PontoSection /> : null}
      {section === 'configuracoes' ? <ConfiguracoesSection /> : null}
    </div>
  );
}

function ForecastSection() {
  const { previsoes, loading, fetchPrevisaoVolume } = useDespachoStore();

  useEffect(() => {
    fetchPrevisaoVolume();
  }, [fetchPrevisaoVolume]);

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const forecastSeries = previsoes.length > 0
    ? previsoes.map((p: any) => [p.data ?? p.label, p.volume ?? p.value] as const)
    : mockForecastSeries;

  const maxVolume = Math.max(...forecastSeries.map(([, value]) => value));

  if (loading && previsoes.length === 0) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <Panel title="Previsao de volume" description="Serie sintetica de 14 dias e estimativa de dimensionamento da operacao.">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          {forecastSeries.map(([label, value]) => (
            <div key={label}>
              <ProgressBar
                label={`${label} • ${value.toLocaleString('pt-BR')} objetos`}
                tone={value > 20000 ? 'amber' : 'blue'}
                value={Math.round((value / maxVolume) * 100)}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {[
            ['Carteiros estimados', '68'],
            ['Frota recomendada', '12 modais'],
            ['Margem de contingencia', '8%'],
            ['Pico previsto', '01/04'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function UnitizadoresSection() {
  // TODO: replace with API data when backend provides unitizer inventory endpoint
  const unitizerInventory = mockUnitizerInventory;

  return (
    <Panel title="Inventario de unitizadores" description="Posicao atual do parque operacional por tipo e status.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {unitizerInventory.map((item) => (
          <div key={item.code} className="rounded-[24px] border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-slate-900">{item.type}</p>
              <Badge variant={item.status === 'Disponivel' ? 'success' : item.status === 'Em uso' ? 'blue' : 'warning'}>
                {item.status}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-500">{item.code}</p>
            <p className="mt-5 text-3xl font-bold text-slate-950">{item.quantity}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function VeiculosSection() {
  // TODO: replace with API data when backend provides vehicle fleet endpoint
  const vehicleFleet = mockVehicleFleet;

  return (
    <Panel title="Frota da unidade" description="Status operacional da frota e alocacao atual para rotas e reservas.">
      <div className="space-y-3">
        {vehicleFleet.map((vehicle) => (
          <div key={vehicle.plate} className="rounded-[24px] border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{vehicle.model}</p>
                <p className="text-sm text-slate-500">
                  {vehicle.plate} • {vehicle.route}
                </p>
              </div>
              <Badge variant={vehicle.status === 'Disponivel' ? 'success' : vehicle.status === 'Em rota' ? 'blue' : 'warning'}>
                {vehicle.status}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-600">Combustivel/Bateria: {vehicle.fuel}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CarteirosSection() {
  const { carteiros, loading, fetchCarteiros } = useDespachoStore();

  useEffect(() => {
    fetchCarteiros();
  }, [fetchCarteiros]);

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const carteiroTeam = carteiros.length > 0
    ? carteiros.map((c: any) => ({
        name: c.nome ?? c.name ?? '',
        modal: c.modal ?? '',
        status: c.status ?? '',
        familiarity: c.familiaridade ?? c.familiarity ?? '',
      }))
    : mockCarteiroTeam;

  if (loading && carteiros.length === 0) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <Panel title="Equipe de carteiros" description="Distribuicao da equipe por modal e nivel de familiaridade nas areas H3.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {carteiroTeam.map((person) => (
          <div key={person.name} className="rounded-[24px] border border-slate-200 p-5">
            <p className="font-bold text-slate-900">{person.name}</p>
            <p className="mt-1 text-sm text-slate-500">{person.modal}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="blue">{person.status}</Badge>
              <Badge variant="neutral">{person.familiarity}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PontoSection() {
  const { pontoDia, loading, fetchPontoDia, registrarPonto } = useDespachoStore();

  useEffect(() => {
    fetchPontoDia();
  }, [fetchPontoDia]);

  // Use API data when available, fall back to mock data for development/demo
  // TODO: replace with API data when backend matches
  const attendance = pontoDia.length > 0
    ? pontoDia.map((p: any) => ({
        name: p.nome ?? p.name ?? '',
        shift: p.turno ?? p.shift ?? '',
        status: p.status ?? '',
      }))
    : mockAttendance;

  const handleRegistrarPonto = (nome: string) => {
    registrarPonto({ nome, horario: new Date().toISOString() }).then(() => fetchPontoDia());
  };

  if (loading && pontoDia.length === 0) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <Panel title="Ponto do dia" description="Registro sintetico de presenca da equipe escalada para a operacao.">
      <div className="space-y-3">
        {attendance.map((item) => (
          <div key={item.name} className="flex flex-col gap-3 rounded-[24px] border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-bold text-slate-900">{item.name}</p>
              <p className="text-sm text-slate-500">Entrada prevista {item.shift}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={item.status === 'Presente' ? 'success' : item.status.includes('Atraso') ? 'warning' : 'danger'}>
                {item.status}
              </Badge>
              {item.status !== 'Presente' && (
                <button
                  onClick={() => handleRegistrarPonto(item.name)}
                  disabled={loading}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Registrar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ConfiguracoesSection() {
  const unidadeId = useAuthStore((s) => s.user?.unidadeId);
  const { unidade, loading, fetchUnidade } = useUnidadeStore();

  useEffect(() => {
    if (unidadeId) fetchUnidade(unidadeId);
  }, [unidadeId, fetchUnidade]);

  // TODO: replace with API data when backend matches — Unidade type may not have all config fields
  const u = unidade as any;
  const unidadeConfiguracoes = unidade
    ? [
        { label: 'Unidade', value: unidade.nome ?? '' },
        { label: 'Modelo de triagem', value: unidade.modeloTriagem ?? '' },
        { label: 'Faixas de CEP', value: (unidade.faixasCep ?? []).map((f: any) => `${f.inicio}-${f.fim}`).join(', ') || '' },
        { label: 'Integracao SRO', value: u?.integracaoSro ?? '' },
        { label: 'Integracao solver', value: u?.integracaoSolver ?? '' },
        { label: 'Janela de despacho', value: u?.janelaDespacho ?? '' },
      ].filter((c) => c.value)
    : mockConfiguracoes;

  if (loading && !unidade) {
    return <p className="py-12 text-center text-slate-500">Carregando...</p>;
  }

  return (
    <Panel title="Configuracoes da unidade" description="Parametros e integracoes que sustentam a operacao do prototipo.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {unidadeConfiguracoes.map((item) => (
          <div key={item.label} className="rounded-[24px] bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
            <p className="mt-3 text-base font-semibold leading-7 text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
