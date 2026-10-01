import { expect, test } from '@playwright/test';
import { cenarioSupervisor, controle, entrarDireto, reiniciar } from './apoio';

test.beforeEach(async () => {
  await reiniciar();
});

test('E2E-016 — orientação manual na lista do distrito (US-026)', async ({ page }) => {
  const c = await cenarioSupervisor();
  const [p1, p2, p3] = c.pacotesD01;
  await entrarDireto(page, c.supervisor.email, `/entregas/distritos/${c.distritos['D-01'].cargaId}`);

  const linha = (codigo: string) => page.locator(`tr[data-pacote="${codigo}"]`);
  const dialogo = page.getByRole('dialog', { name: 'Registrar orientação' });
  const campo = dialogo.getByLabel('Orientação para o carteiro');
  const enviar = dialogo.getByRole('button', { name: 'Registrar orientação' });
  const abrir = (codigo: string) => linha(codigo).getByRole('button', { name: `Registrar orientação para ${codigo}` }).click();
  const mensagens = () => controle<Array<{ to: string | null; body: string | null; reference: string | null }>>('/prosio/mensagens');

  // Diálogo acessível: foco no texto, contador, Esc fecha e devolve o foco ao botão da linha.
  await expect(linha(p1.codigo)).toContainText('Enviado');
  await abrir(p1.codigo);
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText(p1.codigo);
  await expect(campo).toBeFocused();
  await expect(campo).toHaveAccessibleDescription(/0 de 300 caracteres/);
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(linha(p1.codigo).getByRole('button', { name: `Registrar orientação para ${p1.codigo}` })).toBeFocused();

  // Vazia e acima de 300: recusadas no diálogo, nada chega ao carteiro.
  await abrir(p1.codigo);
  await enviar.click();
  await expect(dialogo.getByRole('alert')).toHaveText('Escreva a orientação para o carteiro.');
  await campo.fill('a'.repeat(301));
  await expect(campo).toHaveAccessibleDescription(/301 de 300 caracteres/);
  await enviar.click();
  await expect(dialogo.getByRole('alert')).toContainText('passa de 300 caracteres');
  expect(await mensagens()).toHaveLength(0);

  // Registra: o diálogo fecha, a linha mostra a orientação e o carteiro recebe a mensagem.
  const texto = 'Deixar com o porteiro do bloco B';
  await campo.fill(texto);
  await expect(campo).toHaveAccessibleDescription(new RegExp(`${texto.length} de 300 caracteres`));
  await enviar.click();
  await expect(dialogo).toBeHidden();
  await expect(linha(p1.codigo)).toContainText(texto);
  await expect(linha(p1.codigo)).toContainText('Interagindo');
  const enviadas = await mensagens();
  expect(enviadas).toHaveLength(1);
  expect(enviadas[0].body).toContain(texto);
  expect(enviadas[0].body).toContain(p1.codigo);

  // "Vale também para amanhã": fica guardada, sem mensagem hoje.
  await abrir(p2.codigo);
  await campo.fill('Entregar na loja ao lado, das 9h às 18h');
  await dialogo.getByRole('checkbox', { name: /Vale também para amanhã/ }).check();
  await enviar.click();
  await expect(dialogo).toBeHidden();
  await expect(linha(p2.codigo)).toContainText('Entregar na loja ao lado, das 9h às 18h');
  await expect(linha(p2.codigo)).toContainText(/Orientação guardada para \d{2}\/\d{2}/);
  expect(await mensagens()).toHaveLength(1);

  // Erro 400 da API: 300 caracteres na tela, mas o telefone vira "[removido]" no servidor e passa do limite.
  await abrir(p3.codigo);
  await campo.fill(`${'a'.repeat(291)} 98124412`);
  await expect(campo).toHaveAccessibleDescription(/300 de 300 caracteres/);
  await enviar.click();
  await expect(dialogo.getByRole('alert')).toContainText('passa de 300 caracteres depois da troca');
  await expect(dialogo).toBeVisible();

  // Erro 409 da API: o pacote foi entregue enquanto o diálogo estava aberto.
  await controle(`/pacotes/${p3.id}/entregue`, {});
  await campo.fill('Deixar na portaria');
  await enviar.click();
  await expect(dialogo.getByRole('alert')).toContainText('já consta como entregue');
  await expect(linha(p3.codigo)).toContainText('Entregue');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(linha(p3.codigo).getByRole('button', { name: /Registrar orientação/ })).toHaveCount(0);
  expect(await mensagens()).toHaveLength(1);
});
