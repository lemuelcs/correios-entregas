import { expect, test } from '@playwright/test';
import { cartao, cenarioSupervisor, controle, entrarDireto, planilha, reiniciar } from './apoio';

test.beforeEach(async () => {
  await reiniciar();
});

test('E2E-006 — carregamento de planilha, prévia, correção e "28 de 37"', async ({ page }) => {
  const c = await cenarioSupervisor('pendente');
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');

  const d03 = cartao(page, 'D-03');
  await expect(d03).toContainText('Pendente de upload');
  await d03.getByRole('link', { name: 'Carregar pacotes' }).click();
  await expect(page).toHaveURL(new RegExp(`/entregas/carregar/${c.distritos['D-03'].id}$`));
  await expect(page.getByRole('heading', { name: 'Águas Claras Sul' })).toBeVisible();

  const entrada = page.locator('input#arquivo-planilha');
  const previa = page.getByRole('region', { name: 'Prévia' });

  // Só linhas inválidas: "Confirmar" fica desabilitado.
  await entrada.setInputFiles(await planilha('so-invalidas.csv'));
  await expect(previa.getByText('3 inválidos')).toBeVisible();
  await expect(previa.getByRole('button', { name: /^Confirmar/ })).toBeDisabled();

  // Correção por linha: completar o nome que faltava torna a linha válida (prévia recalculada no servidor).
  const linhaSemNome = previa.locator('tr', { hasText: 'Faltam campos' });
  await linhaSemNome.getByRole('button', { name: /^Corrigir linha/ }).click();
  await previa.getByLabel('Destinatário').fill('Helena Duarte');
  await previa.getByRole('button', { name: 'Aplicar' }).click();
  await expect(previa.getByText('1 válidos')).toBeVisible();
  await expect(previa.getByText('2 inválidos')).toBeVisible();
  await expect(previa.getByRole('button', { name: 'Confirmar 1 pacotes' })).toBeEnabled();
  await previa.getByRole('button', { name: 'Cancelar' }).click();
  await expect(previa).toHaveCount(0);

  // A planilha de 40 linhas.
  await entrada.setInputFiles(await planilha('aguas-claras-sul.xlsx'));
  await expect(previa.getByText('36 válidos')).toBeVisible();
  await expect(previa.getByText('1 para corrigir')).toBeVisible();
  await expect(previa.getByText('3 inválidos')).toBeVisible();
  await expect(previa.getByText('Dígito verificador não confere')).toBeVisible();
  await expect(previa.getByText('Duplicado na planilha')).toBeVisible();
  // Inválidas primeiro.
  await expect(previa.locator('tbody tr').first()).toContainText(/Faltam campos|Dígito|Duplicado/);

  await previa.getByRole('button', { name: 'Confirmar 37 pacotes' }).click();
  await expect(page).toHaveURL(/\/entregas\/carregar$/);
  await expect(cartao(page, 'D-03')).toContainText('Dados carregados');
  await expect(cartao(page, 'D-03')).toContainText('28 de 37 pacotes com WhatsApp');
  await expect(cartao(page, 'D-03')).toContainText('9 sem WhatsApp não serão avisados');
});

test('E2E-007 — diálogo de liberação e bloqueios', async ({ page }) => {
  const c = await cenarioSupervisor('carregado');
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');

  // Distrito sem carteiro: liberação indisponível.
  const d06 = cartao(page, 'D-06');
  await expect(d06).toContainText('Sem carteiro');
  await expect(d06.getByRole('button', { name: 'Liberar distrito' })).toBeDisabled();

  // Liberação normal.
  const d03 = cartao(page, 'D-03');
  await expect(d03).toContainText('28 de 37 pacotes com WhatsApp');
  await d03.getByRole('button', { name: 'Liberar distrito' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Liberar D-03 · Águas Claras Sul?' });
  await expect(dialogo).toContainText('28 destinatários');
  await expect(dialogo).toContainText('9 sem WhatsApp');
  await expect(dialogo).toContainText('Renato Alves Costa');
  await dialogo.getByRole('button', { name: 'Liberar e enviar avisos' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(d03).toContainText('Liberado');
  await expect(d03.getByRole('button', { name: 'Liberar distrito' })).toHaveCount(0);

  // Nenhum pacote com WhatsApp: confirmação explícita.
  const d04 = cartao(page, 'D-04');
  await d04.getByRole('button', { name: 'Liberar distrito' }).click();
  const semAvisos = page.getByRole('dialog', { name: /Liberar D-04/ });
  await expect(semAvisos).toContainText('Nenhum destinatário será avisado');
  const liberar = semAvisos.getByRole('button', { name: 'Liberar sem avisos' });
  await expect(liberar).toBeDisabled();
  await semAvisos.getByLabel('Entendo e quero liberar sem enviar avisos').check();
  await liberar.click();
  await expect(semAvisos).toHaveCount(0);
  await expect(d04).toContainText('Liberado');

  // No servidor: D-03 com 28 avisos agendados; nada saiu para o D-04.
  const quadro = await page.evaluate(async () => {
    const r = await fetch('/api/v1/entregas/quadro', { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
    return r.json();
  });
  const porCodigo = Object.fromEntries((quadro.distritos as Array<{ codigo: string; status: string; porStatus: Record<string, number> }>).map((d) => [d.codigo, d]));
  expect(porCodigo['D-03'].status).toBe('LIBERADO');
  expect(porCodigo['D-03'].porStatus.AGENDADO).toBe(28);
  expect(porCodigo['D-04'].status).toBe('LIBERADO');
  expect(porCodigo['D-04'].porStatus.AGENDADO ?? 0).toBe(0);
  expect(await controle<unknown[]>('/prosio/sessoes')).toEqual([]);
});

test('E2E-012 — polling atualiza o quadro e a lista sem recarregar', async ({ page }) => {
  test.setTimeout(150_000);
  const c = await cenarioSupervisor();
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');

  const d01 = cartao(page, 'D-01');
  await expect(d01).toContainText('Em entrega');
  await expect(d01.locator('[data-status="ENVIADO"]')).toContainText('3');
  await expect(d01.locator('[data-status="LIDO"]')).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { __semRecarregar: boolean }).__semRecarregar = true;
  });

  const r1 = await controle<{ status: number }>('/prosio/status', { pacoteId: c.pacotesD01[0].id, status: 'read' });
  expect(r1.status).toBe(204);
  await expect(d01.locator('[data-status="LIDO"]')).toContainText('Lido 1', { timeout: 35_000 });
  await expect(d01.locator('[data-status="ENVIADO"]')).toContainText('2');
  expect(await page.evaluate(() => (window as unknown as { __semRecarregar?: boolean }).__semRecarregar)).toBe(true);

  // A lista do distrito também se atualiza sozinha.
  await d01.getByRole('link', { name: 'Ver pacotes →' }).click();
  await expect(page).toHaveURL(new RegExp(`/entregas/distritos/${c.distritos['D-01'].cargaId}$`));
  const filtroLido = page.locator('[data-filtro="LIDO"]');
  await expect(filtroLido).toContainText('1');
  await expect(page.locator(`tr[data-pacote="${c.pacotesD01[0].codigo}"]`)).toContainText('Lido');
  await page.evaluate(() => {
    (window as unknown as { __semRecarregar: boolean }).__semRecarregar = true;
  });

  const r2 = await controle<{ status: number }>('/prosio/status', { pacoteId: c.pacotesD01[1].id, status: 'read' });
  expect(r2.status).toBe(204);
  await expect(filtroLido).toContainText('2', { timeout: 35_000 });
  await expect(page.locator(`tr[data-pacote="${c.pacotesD01[1].codigo}"]`)).toContainText('Lido');
  expect(await page.evaluate(() => (window as unknown as { __semRecarregar?: boolean }).__semRecarregar)).toBe(true);
});
