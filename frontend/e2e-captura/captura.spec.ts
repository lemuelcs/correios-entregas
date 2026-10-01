/**
 * Jornadas E2E da captura do rótulo (`_tests.md` › End-to-End Tests).
 * Câmera substituída pelas fixtures de `backend/src/__tests__/fixtures/rotulos/`
 * (`?e2eImage=`); o extrator falso do backend responde pelo sha256 de cada uma.
 */
import { expect, test } from '@playwright/test';
import { C1, contador, entrar, entrarNoApp, fotografar, semear, usarFixtures } from './captura.ajuda';

test.describe('Captura do rótulo', () => {
  test('E2E-001 captura na triagem, com login e troca de senha', async ({ page }) => {
    await semear({ senhaTemporaria: true });

    await entrar(page, C1.senhaInicial);
    await expect(page.getByRole('heading', { name: 'Crie sua senha' })).toBeVisible();
    await page.getByLabel('Nova senha', { exact: true }).fill(C1.senha);
    await page.getByLabel('Repita a nova senha').fill(C1.senha);
    await page.getByRole('button', { name: 'Salvar e entrar' }).click();

    await expect(page).toHaveURL(/\/carteiro\/captura$/);
    await expect(page.getByRole('heading', { name: 'D-03 · Águas Claras Sul' })).toBeVisible();
    await expect(contador(page, 'capturados')).toHaveText('0');

    await usarFixtures(page, 'rotulo-completo.jpg');
    await page.getByRole('button', { name: 'Fotografar rótulo' }).click();
    await expect(page.getByTestId('camera-titulo')).toHaveText('D-03 · pacote 1');
    await fotografar(page, 2);

    const aviso = page.getByRole('status').filter({ hasText: 'Pacote OY716488072BR salvo no D-03' });
    await expect(aviso).toHaveText('Pacote OY716488072BR salvo no D-03 · desfazer');

    await page.getByRole('button', { name: 'Concluir' }).click();
    const item = page.getByRole('link', { name: /OY716488072BR · ALINE RODRIGUES/ });
    await expect(item).toBeVisible();
    await expect(item).toContainText('Completo');
    await expect(contador(page, 'capturados')).toHaveText('1');

    await aviso.getByRole('button', { name: 'desfazer' }).click();
    await expect(item).toHaveCount(0);
    await expect(contador(page, 'capturados')).toHaveText('0');
    await expect(page.getByText('Nenhum pacote ainda')).toBeVisible();
  });

  test('E2E-002 conferência', async ({ page }) => {
    await semear({ senhaTemporaria: false });
    await entrarNoApp(page);
    await usarFixtures(page, 'rotulo-cep-unico.jpg');

    await page.getByRole('button', { name: 'Fotografar rótulo' }).click();
    await fotografar(page, 2);
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(contador(page, 'conferir')).toHaveText('Para conferir: 1');

    await page.getByRole('link', { name: /Para conferir: 1/ }).click();
    await page.getByRole('link', { name: /OY716488293BR/ }).click();
    await expect(page.getByRole('heading', { name: 'Confira os dados' })).toBeVisible();
    const rua = page.getByLabel('Rua');
    await expect(page.locator('[data-campo="logradouro"]')).toHaveAttribute('data-duvida', 'true');
    await expect(rua).toHaveAccessibleDescription(/O CEP não traz a rua/);

    await rua.fill('Rua Sete');
    await page.getByLabel('Número').fill('120');
    await page.getByRole('button', { name: 'Salvar no D-03' }).click();

    await expect(page.getByText('Nenhum pacote para conferir.')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await expect(contador(page, 'conferir')).toHaveText('Para conferir: 0');
    const item = page.getByRole('link', { name: /OY716488293BR · HELENA SOUZA/ });
    await expect(item).toContainText('Completo');
  });

  test('E2E-003 sem sinal para online', async ({ page, context }) => {
    // Precache lento de propósito: o service worker ativa depois que a página da captura
    // já abriu. Sem o clientsClaim ela ficava sem controlador e não reabria offline
    // (era a causa da intermitência: dependia de o precache terminar durante o login).
    await context.route('**/e2e-fixtures/rotulo-escuro.jpg', async (route) => {
      if (route.request().serviceWorker()) await new Promise((r) => setTimeout(r, 3_000));
      await route.continue();
    });
    await semear({ senhaTemporaria: false });
    await entrarNoApp(page);
    await usarFixtures(page, 'rotulo-completo.jpg', 'rotulo-sem-datamatrix.jpg', 'rotulo-cep-unico.jpg');
    // O service worker precisa estar no controle para o app abrir sem rede.
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, { timeout: 60_000 });

    await context.setOffline(true);
    await expect(page.getByText(/Sem conexão/)).toBeVisible();

    await page.getByRole('button', { name: 'Fotografar rótulo' }).click();
    await fotografar(page, 2);
    await fotografar(page, 3);
    await fotografar(page, 4);
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(contador(page, 'aguardando')).toHaveText('Aguardando envio: 3');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'D-03 · Águas Claras Sul' })).toBeVisible();
    await expect(page.getByText(/Sem conexão/)).toBeVisible();
    await expect(contador(page, 'aguardando')).toHaveText('Aguardando envio: 3');

    await context.setOffline(false);
    await expect(contador(page, 'aguardando')).toHaveText('Aguardando envio: 0', { timeout: 30_000 });
    await expect(page.getByRole('link', { name: /OY716488072BR · ALINE RODRIGUES/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /AA123456785BR · JOSE CARLOS PEREIRA/ })).toBeVisible();
    await expect(contador(page, 'conferir')).toHaveText('Para conferir: 1');
    await expect(contador(page, 'capturados')).toHaveText('2');
  });
});
