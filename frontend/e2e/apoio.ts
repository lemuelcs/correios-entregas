/** Apoio dos testes de interface: servidor de controle do backend de teste e login. */
import { expect, type Page } from '@playwright/test';

const CONTROLE = process.env.E2E_CONTROLE_URL ?? 'http://127.0.0.1:3714';

export async function controle<T = unknown>(caminho: string, corpo?: unknown, metodo = corpo === undefined ? 'GET' : 'POST'): Promise<T> {
  const r = await fetch(`${CONTROLE}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`controle ${caminho}: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export interface CenarioSupervisor {
  supervisor: { email: string; senha: string };
  unidadeId: string;
  distritos: Record<'D-01' | 'D-03' | 'D-04' | 'D-06', { id: string; cargaId: string | null }>;
  pacotesD01: Array<{ id: string; codigo: string }>;
}

export async function reiniciar(): Promise<{ prosioUrl: string }> {
  return controle('/reset', {});
}

export async function cenarioSupervisor(d03: 'pendente' | 'carregado' = 'pendente'): Promise<CenarioSupervisor> {
  return controle('/cenarios/supervisor', { d03 });
}

export async function planilha(nome: string): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const r = await fetch(`${CONTROLE}/planilhas/${nome}`);
  if (!r.ok) throw new Error(`planilha ${nome}: HTTP ${r.status}`);
  return {
    name: nome,
    mimeType: r.headers.get('content-type') ?? 'application/octet-stream',
    buffer: Buffer.from(await r.arrayBuffer()),
  };
}

/** Login pela tela (aba "Email"). */
export async function entrarPelaTela(page: Page, email: string, senha: string): Promise<void> {
  if (!page.url().includes('/login')) await page.goto('/login');
  await page.getByRole('button', { name: 'Email' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Entra sem passar pela tela (tokens reais do backend) e abre `destino`. */
export async function entrarDireto(page: Page, email: string, destino: string, senha = 'senha-e2e-123'): Promise<void> {
  const s = await controle<{ accessToken: string; refreshToken: string; user: { unidadeId?: string; unidade?: { nome: string } | null } }>(
    '/sessoes',
    { email, senha },
  );
  await page.goto('/login');
  await page.evaluate((sessao) => {
    localStorage.setItem('accessToken', sessao.accessToken);
    localStorage.setItem('refreshToken', sessao.refreshToken);
    if (sessao.user.unidadeId) localStorage.setItem('unidadeId', sessao.user.unidadeId);
    if (sessao.user.unidade?.nome) localStorage.setItem('unidadeNome', sessao.user.unidade.nome);
  }, s);
  await page.goto(destino);
}

/** Cartão da rota no quadro das saídas (o código é o da rota no Cadastro). */
export function cartao(page: Page, codigo: string) {
  return page.locator(`article[data-rota="${codigo}"]`);
}

/** Aba de uma saída do dia ("Saída 2", "Sem saída"). */
export function abaSaida(page: Page, nome: string | RegExp) {
  return page.getByRole('tablist', { name: 'Saídas do dia' }).getByRole('tab', { name: nome });
}

/** A página não rola na horizontal (largura do documento cabe na janela). */
export async function semRolagemHorizontal(page: Page): Promise<void> {
  const medidas = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
  expect(medidas.doc, `scrollWidth ${medidas.doc} > ${medidas.janela}`).toBeLessThanOrEqual(medidas.janela);
}
