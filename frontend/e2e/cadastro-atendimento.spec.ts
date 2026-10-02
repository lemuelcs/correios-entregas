import { expect, test } from '@playwright/test';
import { cartao, cenarioSupervisor, controle, entrarDireto, entrarPelaTela, reiniciar } from './apoio';

test.beforeEach(async () => {
  await reiniciar();
});

test('E2E-008 — Cadastro: distrito, carteiro, ponto e carteiro do dia', async ({ page }) => {
  const c = await cenarioSupervisor();
  await entrarDireto(page, c.supervisor.email, '/entregas/cadastro');

  // Rotas (aba padrão do supervisor). A Gestão não aparece.
  await expect(page.getByRole('tab', { name: 'Rotas', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Unidades' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Supervisores' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Nova rota' }).click();
  const dDistrito = page.getByRole('dialog', { name: 'Nova rota' });
  await dDistrito.getByLabel('Código').fill('D-09');
  await dDistrito.getByLabel('Nome').fill('Taguatinga Oeste');
  await dDistrito.getByLabel('Carteiro padrão').selectOption({ label: 'Wesley Mota Ramos' });
  await dDistrito.getByRole('button', { name: 'Salvar' }).click();
  await expect(dDistrito).toHaveCount(0);
  const linhaD09 = page.getByRole('row', { name: /D-09/ });
  await expect(linhaD09).toContainText('Taguatinga Oeste');
  await expect(linhaD09).toContainText('Wesley Mota Ramos');

  // Carteiro do dia: D-06 (sem carteiro) recebe um carteiro só para hoje.
  const escalaD06 = page.getByLabel('D-06 · Ceilândia Sul');
  await expect(page.getByText('Sem carteiro: a rota não pode ser liberada').first()).toBeVisible();
  await escalaD06.selectOption({ label: 'Renato Alves Costa' });
  await expect(page.getByText('Carteiro de hoje da rota D-06 atualizado.')).toBeVisible();

  // Carteiros.
  await page.getByRole('tab', { name: 'Carteiros' }).click();
  await page.getByRole('button', { name: 'Novo carteiro' }).click();
  const dCarteiro = page.getByRole('dialog', { name: 'Novo carteiro' });
  await dCarteiro.getByLabel('Nome').fill('Gloria Maria Vieira');
  await dCarteiro.getByLabel('Matrícula').fill('84159902');
  await dCarteiro.getByLabel('WhatsApp').fill('(61) 98460-7712');
  await dCarteiro.getByLabel('Rota padrão').selectOption({ label: 'D-09 · Taguatinga Oeste' });
  await dCarteiro.getByRole('button', { name: 'Salvar' }).click();
  await expect(dCarteiro).toHaveCount(0);
  const linhaGloria = page.getByRole('row', { name: /Gloria Maria Vieira/ });
  await expect(linhaGloria).toContainText('(61) 98460-7712');
  await expect(linhaGloria).toContainText('D-09');

  // Agências e lockers.
  await page.getByRole('tab', { name: 'Agências e lockers' }).click();
  await page.getByRole('button', { name: 'Novo ponto de retirada' }).click();
  const dPonto = page.getByRole('dialog', { name: 'Novo ponto de retirada' });
  await dPonto.getByLabel('Tipo').selectOption('AGENCIA');
  await dPonto.getByLabel('Nome (até 24 caracteres)').fill('AC Taguatinga Centro');
  await dPonto.getByLabel('Endereço').fill('C 12 Lote 1 · Taguatinga');
  await dPonto.getByLabel('Horário').fill('Seg–sex 9h–17h');
  await dPonto.getByRole('button', { name: 'Salvar' }).click();
  await expect(dPonto).toHaveCount(0);
  await expect(page.getByRole('row', { name: /AC Taguatinga Centro/ })).toContainText('Agência');
  await expect(page.getByText('Ativos: 1/10 agências · 0/10 lockers')).toBeVisible();

  // O quadro já mostra o D-06 com carteiro.
  await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: /^Carregar Dados/ }).click();
  // (ADR-019) A rota só aparece no quadro quando um arquivo de saída a trouxe: o D-09, sem carga, não aparece.
  await expect(cartao(page, 'D-06')).toContainText('Renato Alves Costa');
  await expect(cartao(page, 'D-06').getByRole('button', { name: 'Liberar rota' })).toBeEnabled();
  await expect(cartao(page, 'D-09')).toHaveCount(0);
});

test('E2E-009 — Atendimento em iframe e alternativa', async ({ page }) => {
  const c = await cenarioSupervisor();
  const resposta = page.waitForResponse((r) => r.url().endsWith('/api/v1/entregas/atendimento/sessao') && r.request().method() === 'POST');
  await entrarDireto(page, c.supervisor.email, '/entregas/atendimento');
  const sessao = await (await resposta).json() as { url: string };
  expect(sessao.url).toContain('sso_token=');

  const iframe = page.locator('iframe[title^="Chatwoot"]');
  await expect(iframe).toHaveAttribute('src', sessao.url);
  const urls = await controle<string[]>('/prosio/sessoes');
  expect(urls.at(-1)).toBe(sessao.url);

  // Chatwoot indisponível: aviso e "Abrir em nova aba".
  await controle('/prosio/sessoes', { indisponivel: true });
  await page.reload();
  const alerta = page.getByRole('alert', { name: 'Atendimento indisponível' });
  await expect(alerta).toContainText('Atendimento indisponível no momento');
  await expect(alerta.getByRole('button', { name: 'Abrir em nova aba' })).toBeVisible();
  await expect(iframe).toHaveCount(0);

  // De volta ao ar: "Abrir em nova aba" gera uma sessão nova numa aba própria.
  await controle('/prosio/sessoes', { indisponivel: false });
  const popup = page.waitForEvent('popup');
  await alerta.getByRole('button', { name: 'Abrir em nova aba' }).click();
  const aba = await popup;
  await aba.waitForURL(/sso_token=/);
  const novas = await controle<string[]>('/prosio/sessoes');
  expect(novas).toHaveLength(1);
  expect(aba.url()).toBe(novas[0]);
  expect(novas[0]).not.toBe(sessao.url);
});

test('E2E-010 — jornada da Gestão: canal, unidade e supervisor', async ({ page }) => {
  const g = await controle<{ gestor: { email: string; matricula: string; senha: string }; prosioUrl: string; outraUnidadeId: string }>('/cenarios/gestor', {});
  await entrarPelaTela(page, g.gestor.matricula, g.gestor.senha);
  await expect(page).toHaveURL(/\/entregas\/cadastro$/);
  await expect(page.getByRole('tab', { name: 'Unidades' })).toHaveAttribute('aria-selected', 'true');

  // Canal Prosio: o token de entrada aparece uma vez.
  await page.getByRole('tab', { name: 'Canais de WhatsApp' }).click();
  await page.getByRole('button', { name: 'Novo canal' }).click();
  const dCanal = page.getByRole('dialog', { name: 'Novo canal de WhatsApp' });
  await dCanal.getByLabel('Nome').fill('Canal Taguatinga');
  await dCanal.getByLabel('Endereço do Prosio').fill(g.prosioUrl);
  await dCanal.getByLabel('Chave de API do Prosio').fill('psk_teste_1234567890');
  await dCanal.getByLabel('Segredo dos callbacks').fill('segredo-de-callback-0123456789');
  await dCanal.getByRole('button', { name: 'Criar canal' }).click();
  const dToken = page.getByRole('dialog', { name: 'Canal criado' });
  await expect(dToken).toContainText('Ele é exibido só esta vez.');
  await expect(dToken.getByLabel('Token de entrada')).toHaveValue(/^cet_/);
  await dToken.getByRole('button', { name: 'Já copiei o token' }).click();
  await expect(page.getByRole('row', { name: /Canal Taguatinga/ })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/cet_/)).toHaveCount(0);

  // Unidade vinculada ao canal.
  await page.getByRole('tab', { name: 'Unidades' }).click();
  await page.getByRole('button', { name: 'Nova unidade' }).click();
  const dUnidade = page.getByRole('dialog', { name: 'Nova unidade' });
  await dUnidade.getByLabel('Código da unidade').fill('CDD-TAG-01');
  await dUnidade.getByLabel('Nome').fill('CDD Taguatinga');
  await dUnidade.getByLabel('Tipo').selectOption('CDD');
  await dUnidade.getByLabel('Logradouro').fill('QNA 1 Lote 10');
  await dUnidade.getByLabel('Número').fill('10');
  await dUnidade.getByLabel('Bairro').fill('Taguatinga Norte');
  await dUnidade.getByLabel('Cidade').fill('Brasília');
  await dUnidade.getByLabel('UF').fill('DF');
  await dUnidade.getByLabel('CEP').fill('72110010');
  await dUnidade.getByLabel('Latitude').fill('-15.8335');
  await dUnidade.getByLabel('Longitude').fill('-48.0566');
  await dUnidade.getByLabel('Canal de WhatsApp').selectOption({ label: 'Canal Taguatinga · número atual' });
  await dUnidade.getByRole('button', { name: 'Salvar' }).click();
  await expect(dUnidade).toHaveCount(0);
  const linhaUnidade = page.getByRole('row', { name: /CDD Taguatinga/ });
  await expect(linhaUnidade).toContainText('Número atual (WAHA) · Canal Taguatinga');
  await expect(linhaUnidade).toContainText('sem supervisor');

  // Supervisor da unidade.
  await page.getByRole('tab', { name: 'Supervisores' }).click();
  await page.getByRole('button', { name: 'Novo supervisor' }).click();
  const dSup = page.getByRole('dialog', { name: 'Novo supervisor' });
  await dSup.getByLabel('Nome').fill('Rogério Pacheco');
  await dSup.getByLabel('E-mail de acesso').fill('rogerio@e2e.local');
  await dSup.getByLabel('Matrícula').fill('8.391.004-7');
  await dSup.getByLabel('WhatsApp').fill('(61) 98822-0917');
  await dSup.getByLabel('Unidade').selectOption({ label: 'CDD Taguatinga' });
  await dSup.getByLabel('Senha inicial').fill('senha-rogerio');
  await dSup.getByRole('button', { name: 'Salvar' }).click();
  await expect(dSup).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Rogério Pacheco/ })).toContainText('CDD Taguatinga');

  // O supervisor entra e vê só a própria unidade.
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarPelaTela(page, '83910047', 'senha-rogerio');
  await expect(page).toHaveURL(/\/entregas\/carregar$/);
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await expect(menu).toContainText('CDD Taguatinga');
  await expect(page.getByRole('heading', { name: 'Saída 1 ainda não foi importada' })).toBeVisible();
  await expect(page.getByText('D-50')).toHaveCount(0);
  await menu.getByRole('link', { name: /^Cadastro/ }).click();
  await expect(page.getByRole('tab', { name: 'Unidades' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Supervisores' })).toHaveCount(0);
  await expect(page.getByText('Arniqueiras')).toHaveCount(0);
  const outra = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/entregas/quadro?unidadeId=${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
    return r.status;
  }, g.outraUnidadeId);
  expect(outra).toBe(404);
});
