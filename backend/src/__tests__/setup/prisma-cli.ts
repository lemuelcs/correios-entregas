import { spawnSync } from 'child_process';
import path from 'path';

export const BACKEND_DIR = path.resolve(__dirname, '../../..');

export interface ResultadoCli {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Executa o CLI do Prisma no diretório do backend com DATABASE_URL explícita. */
export function prismaCli(args: string[], databaseUrl: string): ResultadoCli {
  const bin = require.resolve('prisma/build/index.js', { paths: [BACKEND_DIR] });
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
