import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queue';
import { prisma } from '../shared/utils/prisma';

const VIACEP_URL = process.env.VIACEP_URL || 'https://viacep.com.br/ws';

// Approximate coordinates for major Brazilian UF capitals.
// Used as fallback since ViaCEP does not return lat/lng.
// Phase 2 will use OSRM/Nominatim or Correios CWS for precise geocoding.
const UF_APPROX_COORDS: Record<string, { lat: number; lng: number }> = {
  AC: { lat: -9.97499, lng: -67.80999 },
  AL: { lat: -9.66599, lng: -35.73509 },
  AM: { lat: -3.11903, lng: -60.02173 },
  AP: { lat: 0.03493, lng: -51.06956 },
  BA: { lat: -12.97111, lng: -38.51083 },
  CE: { lat: -3.71722, lng: -38.54337 },
  DF: { lat: -15.79310, lng: -47.88282 },
  ES: { lat: -20.31520, lng: -40.31270 },
  GO: { lat: -16.68640, lng: -49.26430 },
  MA: { lat: -2.53073, lng: -44.28251 },
  MG: { lat: -19.91910, lng: -43.93860 },
  MS: { lat: -20.44280, lng: -54.64640 },
  MT: { lat: -15.59611, lng: -56.09667 },
  PA: { lat: -1.45583, lng: -48.50444 },
  PB: { lat: -7.11509, lng: -34.86306 },
  PE: { lat: -8.05428, lng: -34.87110 },
  PI: { lat: -5.08917, lng: -42.80194 },
  PR: { lat: -25.42950, lng: -49.27130 },
  RJ: { lat: -22.90680, lng: -43.17290 },
  RN: { lat: -5.79448, lng: -35.21098 },
  RO: { lat: -8.76077, lng: -63.89989 },
  RR: { lat: 2.81954, lng: -60.67333 },
  RS: { lat: -30.03330, lng: -51.23000 },
  SC: { lat: -27.59490, lng: -48.54800 },
  SE: { lat: -10.90910, lng: -37.07400 },
  SP: { lat: -23.55050, lng: -46.63330 },
  TO: { lat: -10.18430, lng: -48.33470 },
};

interface GeocoderJobData {
  objetoId: string;
  cep: string;
  logradouro?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

async function processGeocoderJob(job: Job<GeocoderJobData>): Promise<void> {
  const { objetoId, cep, cidade, uf } = job.data;

  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) {
    throw new Error(`CEP invalido: ${cep}`);
  }

  // 1. Check cache
  const cached = await prisma.enderecoGeocode.findUnique({
    where: { cep: cleanCep },
  });

  if (cached) {
    // Use cached coordinates to update the Objeto
    await prisma.objeto.update({
      where: { id: objetoId },
      data: {
        latitude: cached.latitude,
        longitude: cached.longitude,
        geocodeAccuracy: cached.accuracy,
      },
    });
    return;
  }

  // 2. Fetch address details from ViaCEP
  let viaCepData: ViaCepResponse | null = null;
  try {
    const response = await fetch(`${VIACEP_URL}/${cleanCep}/json/`);
    if (response.ok) {
      viaCepData = await response.json() as ViaCepResponse;
      if (viaCepData?.erro) {
        viaCepData = null;
      }
    }
  } catch (err) {
    console.warn(`ViaCEP request failed for CEP ${cleanCep}:`, (err as Error).message);
  }

  // 3. Determine approximate coordinates from UF
  const resolvedUf = viaCepData?.uf || uf || 'DF';
  const approx = UF_APPROX_COORDS[resolvedUf.toUpperCase()] || UF_APPROX_COORDS['DF'];

  // Add small random offset to avoid all objects in same city stacking on exact same point
  // Range: ~0.01 degree ~ 1.1 km spread
  const latitude = approx.lat + (Math.random() - 0.5) * 0.02;
  const longitude = approx.lng + (Math.random() - 0.5) * 0.02;

  const logradouro = viaCepData?.logradouro || job.data.logradouro || '';
  const bairro = viaCepData?.bairro || '';
  const resolvedCidade = viaCepData?.localidade || cidade || '';

  // 4. Save to EnderecoGeocode cache
  await prisma.enderecoGeocode.upsert({
    where: { cep: cleanCep },
    create: {
      cep: cleanCep,
      logradouro,
      bairro,
      cidade: resolvedCidade,
      uf: resolvedUf.toUpperCase(),
      latitude,
      longitude,
      accuracy: 'APPROXIMATE',
      fonte: viaCepData ? 'VIACEP' : 'APPROXIMATE_UF',
    },
    update: {
      logradouro,
      bairro,
      cidade: resolvedCidade,
      uf: resolvedUf.toUpperCase(),
      latitude,
      longitude,
      accuracy: 'APPROXIMATE',
      fonte: viaCepData ? 'VIACEP' : 'APPROXIMATE_UF',
    },
  });

  // 5. Update Objeto with geocoded coordinates
  await prisma.objeto.update({
    where: { id: objetoId },
    data: {
      latitude,
      longitude,
      geocodeAccuracy: 'APPROXIMATE',
    },
  });
}

let geocoderWorker: Worker | null = null;

export function startGeocoderWorker(): Worker {
  if (geocoderWorker) {
    return geocoderWorker;
  }

  geocoderWorker = new Worker<GeocoderJobData>(
    'geocoder',
    async (job) => {
      await processGeocoderJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // max 10 jobs per second (respect ViaCEP rate limits)
      },
    },
  );

  geocoderWorker.on('completed', (job) => {
    console.log(`[geocoder] Job ${job.id} completed for objeto ${job.data.objetoId}`);
  });

  geocoderWorker.on('failed', (job, err) => {
    console.error(`[geocoder] Job ${job?.id} failed:`, err.message);
  });

  geocoderWorker.on('error', (err) => {
    console.error('[geocoder] Worker error:', err.message);
  });

  console.log('[geocoder] Worker listening on queue "geocoder"');
  return geocoderWorker;
}

export function stopGeocoderWorker(): Promise<void> {
  if (!geocoderWorker) return Promise.resolve();
  const w = geocoderWorker;
  geocoderWorker = null;
  return w.close();
}
