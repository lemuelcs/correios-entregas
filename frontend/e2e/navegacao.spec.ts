import { expect, test } from '@playwright/test';
import { cenarioSupervisor, controle, entrarDireto, entrarPelaTela, reiniciar, semRolagemHorizontal } from './apoio';

test.beforeEach(async () => {
  await reiniciar();
});

test('E2E-005 — menu, Rotas em breve, SGPD v2 e volta', async ({ page }) => {
  const c = await cenarioSupervisor();
  await entrarPelaTela(page, c.supervisor.email, c.supervisor.senha);
  await expect(page).toHaveURL(/\/entregas\/carregar$/);

  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  for (const item of ['Carregar Dados', 'Rotas', 'Atendimento', 'Cadastro', 'SGPD v2']) {
    await expect(menu.getByRole('link', { name: new RegExp(`^${item}`) })).toBeVisible();
  }
  await expect(menu.getByRole('link', { name: /^Rotas/ })).toContainText('em breve');

  await menu.getByRole('link', { name: /^Rotas/ }).click();
  await expect(page).toHaveURL(/\/entregas\/rotas$/);
  await expect(page.getByRole('heading', { name: 'Em breve' })).toBeVisible();

  await menu.getByRole('link', { name: /^SGPD v2/ }).click();
  await expect(page).toHaveURL(/\/unidade$/);
  await expect(page.getByRole('note').filter({ hasText: 'Protótipo — dados de demonstração' })).toBeVisible();

  await page.getByRole('link', { name: 'Voltar aos módulos' }).click();
  await expect(page).toHaveURL(/\/entregas\/carregar$/);
  await expect(page.getByRole('heading', { name: 'Carregar Dados' })).toBeVisible();
});

test('E2E-011 — tela de 390 px: menu vira botão, mesmos itens, sem rolagem horizontal', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const c = await cenarioSupervisor('carregado');
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');
  await expect(page.getByRole('heading', { name: 'Carregar Dados' })).toBeVisible();

  // O menu lateral não aparece; no lugar, um botão.
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeHidden();
  const botao = page.getByRole('button', { name: 'Abrir menu' });
  await expect(botao).toBeVisible();
  await semRolagemHorizontal(page);

  await botao.click();
  await expect(botao).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  for (const item of ['Carregar Dados', 'Rotas', 'Atendimento', 'Cadastro', 'SGPD v2']) {
    await expect(menu.getByRole('link', { name: new RegExp(`^${item}`) })).toBeVisible();
  }
  await menu.getByRole('link', { name: /^Cadastro/ }).click();
  await expect(page).toHaveURL(/\/entregas\/cadastro$/);
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeHidden();

  // Todas as páginas novas cabem em 390 px.
  const paginas = [
    '/entregas/carregar',
    `/entregas/carregar/${c.distritos['D-03'].id}`,
    `/entregas/distritos/${c.distritos['D-03'].cargaId}`,
    '/entregas/cadastro',
    '/entregas/cadastro?aba=carteiros',
    '/entregas/cadastro?aba=pontos',
    '/entregas/atendimento',
    '/entregas/rotas',
  ];
  for (const caminho of paginas) {
    await page.goto(caminho);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    // Conteúdo carregado (tabelas, prévia, iframe) antes de medir.
    await expect(page.getByRole('status')).toHaveCount(0);
    await semRolagemHorizontal(page);
  }
});

test('E2E-013 — unidade sem distritos: "Cadastre distritos" com atalho', async ({ page }) => {
  const c = await controle<{ supervisor: { email: string } }>('/cenarios/vazio', {});
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');
  await expect(page.getByRole('heading', { name: 'Cadastre distritos' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir para o Cadastro' }).click();
  await expect(page).toHaveURL(/\/entregas\/cadastro$/);
  await expect(page.getByRole('tab', { name: 'Distritos' })).toHaveAttribute('aria-selected', 'true');
});

test('E2E-014 — sessão expirada volta ao módulo depois do login', async ({ page }) => {
  const c = await cenarioSupervisor();
  await entrarPelaTela(page, c.supervisor.email, c.supervisor.senha);
  await expect(page).toHaveURL(/\/entregas\/carregar$/);
  await expect(page.getByRole('heading', { name: 'Carregar Dados' })).toBeVisible();

  const { accessToken } = await controle<{ accessToken: string }>('/tokens/expirado', { email: c.supervisor.email });
  await page.evaluate((token) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', crypto.randomUUID());
  }, accessToken);

  await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: /^Atendimento/ }).click();
  await expect(page).toHaveURL(/\/login\?voltar=%2Fentregas%2Fatendimento$/);

  await entrarPelaTela(page, c.supervisor.email, c.supervisor.senha);
  await expect(page).toHaveURL(/\/entregas\/atendimento$/);
  await expect(page.locator('iframe[title^="Chatwoot"]')).toBeVisible();
});

test('E2E-015 — papéis legados e favoritos antigos', async ({ page }) => {
  const legado = await controle<{ carteiro: { email: string; senha: string } }>('/cenarios/carteiro', {});
  const c = await cenarioSupervisor();

  // Carteiro legado: shell antigo, sem os três módulos nem o SGPD v2.
  await entrarPelaTela(page, legado.carteiro.email, legado.carteiro.senha);
  await expect(page).toHaveURL(/\/carteiro$/);
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toHaveCount(0);
  await expect(page.getByText('SGPD v2')).toHaveCount(0);
  await page.goto('/entregas/carregar');
  await expect(page).toHaveURL(/\/carteiro$/);
  await expect(page.getByText('SGPD v2')).toHaveCount(0);
  await expect(page.getByText('Carregar Dados')).toHaveCount(0);

  // Favorito antigo do supervisor: a tela antiga, com a faixa de protótipo.
  await page.evaluate(() => localStorage.clear());
  await entrarDireto(page, c.supervisor.email, '/unidade/despacho');
  await expect(page).toHaveURL(/\/unidade\/despacho$/);
  await expect(page.getByRole('note').filter({ hasText: 'Protótipo — dados de demonstração' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar aos módulos' })).toHaveAttribute('href', '/entregas/carregar');
});
