export const carteiroSummary = {
  route: 'R-01',
  unit: 'CDD Sao Paulo Centro',
  todayObjects: 142,
  delivered: 97,
  unsuccessful: 4,
  pending: 41,
  sph: '18,4',
  progress: 68,
  currentStop: 'Rua das Flores, 234 - Apto 42',
  currentObjectCode: 'AA123456789BR',
};

export const expectedUnitizers = [
  { code: 'UNI-20260319-001', type: 'Bag', objects: 48 },
  { code: 'UNI-20260319-002', type: 'Sacola', objects: 67 },
];

export const routeStops = [
  {
    id: 1,
    address: 'Rua das Flores, 234 - Apto 42',
    objects: 3,
    type: 'PAC',
    distance: '0,4 km',
    current: true,
  },
  {
    id: 2,
    address: 'Av. Paulista, 1578 - Sala 302',
    objects: 1,
    type: 'SEDEX',
    distance: '1,2 km',
    current: false,
  },
  {
    id: 3,
    address: 'Rua Augusta, 89',
    objects: 2,
    type: 'PAC',
    distance: '2,1 km',
    current: false,
  },
];

export const failureReasons = [
  { code: 'BDE_02', label: 'Destinatario ausente' },
  { code: 'BDE_04', label: 'Endereco insuficiente ou incorreto' },
  { code: 'BDE_07', label: 'Recusado pelo destinatario' },
  { code: 'BDE_10', label: 'Residencia ou empresa fechada' },
];

export const finalRouteStats = {
  successRate: '92,9%',
  delivered: 131,
  unsuccessful: 8,
  returned: 3,
  sph: '18,4 obj/h',
};

export const historyData = [
  { date: '19/03', delivered: 131, sph: '18,4', successRate: '92,9%', fadr: '18,4' },
  { date: '18/03', delivered: 118, sph: '17,2', successRate: '90,1%', fadr: '17,2' },
  { date: '17/03', delivered: 142, sph: '19,8', successRate: '96,6%', fadr: '19,8' },
  { date: '15/03', delivered: 109, sph: '15,6', successRate: '88,3%', fadr: '15,6' },
];
