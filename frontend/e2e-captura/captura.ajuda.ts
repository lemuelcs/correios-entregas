import { expect, type Page } from '@playwright/test';

const API_URL = `http://127.0.0.1:${Number(process.env.E2E_API_PORT || 3192)}`;

export const C1 = {
  matricula: '40123456',
  senhaInicial: 'senha-inicial-123',
  senha: 'senha-do-carteiro-1',
};

/** Recria o banco de teste com o C1 no D-03 (backend E2E, `POST /__e2e/semente`). */
export async function semear(opcoes: { senhaTemporaria: boolean }): Promise<void> {
  const resp = await fetch(`${API_URL}/__e2e/semente`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opcoes),
  });
  if (!resp.ok) throw new Error(`semente falhou: ${resp.status} ${await resp.text()}`);
}

/** Login por matrícula na tela /login. */
export async function entrar(page: Page, senha: string): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Matrícula' }).click();
  await page.getByLabel('Matrícula').fill(C1.matricula);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Entra com a senha definitiva e espera o início do distrito do dia. */
export async function entrarNoApp(page: Page): Promise<void> {
  await entrar(page, C1.senha);
  await expect(page).toHaveURL(/\/carteiro\/captura$/);
  await expect(page.getByRole('heading', { name: 'D-03 · Águas Claras Sul' })).toBeVisible();
}

/** Troca a câmera pelas fixtures (build de teste): `?e2eImage=a.jpg,b.jpg`. */
export async function usarFixtures(page: Page, ...arquivos: string[]): Promise<void> {
  await page.goto(`/carteiro/captura?e2eImage=${arquivos.join(',')}`);
  await expect(page.getByRole('heading', { name: 'D-03 · Águas Claras Sul' })).toBeVisible();
}

export function contador(page: Page, nome: 'capturados' | 'conferir' | 'aguardando') {
  return page.getByTestId(`contador-${nome}`);
}

/** Na câmera: dispara e espera a câmera voltar pronta com o próximo número. */
export async function fotografar(page: Page, proximo: number): Promise<void> {
  const disparador = page.getByRole('button', { name: 'Tirar foto' });
  await expect(disparador).toBeEnabled();
  await disparador.click();
  await expect(page.getByTestId('camera-titulo')).toHaveText(`D-03 · pacote ${proximo}`);
  await expect(disparador).toBeEnabled();
}
