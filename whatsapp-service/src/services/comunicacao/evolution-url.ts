import fs from 'fs';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const DOCKER_HOST_ALIAS = 'host.docker.internal';

function normalizeUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

export function isRunningInDocker(): boolean {
  return process.env.CI !== 'true' && (
    process.env.container === 'docker'
    || process.env.KUBERNETES_SERVICE_HOST !== undefined
    || fs.existsSync('/.dockerenv')
  );
}

export function resolveEvolutionBaseUrl(rawUrl?: string | null): string | undefined {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return undefined;

  try {
    const parsed = new URL(normalized);
    if (!isRunningInDocker() || !LOCALHOST_HOSTS.has(parsed.hostname)) {
      return parsed.toString().replace(/\/+$/, '');
    }

    parsed.hostname = DOCKER_HOST_ALIAS;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return normalized;
  }
}

export function getEvolutionBaseUrl(): string | undefined {
  return resolveEvolutionBaseUrl(process.env.EVOLUTION_PILOT_URL ?? process.env.EVOLUTION_API_URL);
}

export function describeEvolutionBaseUrl(): string {
  const configured = normalizeUrl(process.env.EVOLUTION_PILOT_URL ?? process.env.EVOLUTION_API_URL);
  const resolved = getEvolutionBaseUrl();

  if (!resolved) return 'não definido';
  if (!configured || configured === resolved) return resolved;
  return `${resolved} (ajustado automaticamente a partir de ${configured})`;
}
