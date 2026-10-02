import { expect, test, type Page } from '@playwright/test';
import { abaSaida, cartao, cenarioSupervisor, controle, entrarDireto, planilha, reiniciar } from './apoio';

test.beforeEach(async () => {
  await reiniciar();
});

interface RotaApi {
  codigo: string;
  status: string;
  saidaNumero: number | null;
  total: number;
  semCarteiro: boolean;
  carteiro: { nome: string } | null;
  porStatus: Record<string, number>;
}

/** O quadro das saídas como o servidor devolve ao usuário logado. */
async function saidasNoServidor(page: Page, consulta = ''): Promise<{ saidas: Array<{ numero: number; aceitos: number; descartados: number }>; rotas: RotaApi[] }> {
  return page.evaluate(async (q) => {
    const r = await fetch(`/api/v1/entregas/saidas${q}`, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
    return r.json();
  }, consulta);
}

async function importarSaida(page: Page, arquivo: string, horario: string | null, numero: number) {
  if (horario !== null) await page.getByLabel('Horário da saída').fill(horario);
  await page.locator('input#saida-arquivo').setInputFiles(await planilha(arquivo));
  await page.getByRole('button', { name: `Importar Saída ${numero}` }).click();
}

// E2E-006 (prévia, correção por linha e "Confirmar") foi retirado: a importação é direta (ADR-019).

test('E2E-017 — importação direta da Saída 2: horário obrigatório, "7 aceitos, 3 descartados", WhatsApp inválido entra sem WhatsApp e a lista das linhas recusadas', async ({ page }) => {
  const c = await cenarioSupervisor('carregado');
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');

  // Saída 1 já importada; a próxima espera o arquivo. Sem seletor de unidade para o supervisor.
  await expect(abaSaida(page, /Saída 1 · 10:00/)).toHaveAttribute('aria-selected', 'true');
  await expect(abaSaida(page, /Saída 1/)).toContainText('4 rotas');
  await expect(abaSaida(page, /Saída 2/)).toContainText('Aguardando arquivo e horário');
  await expect(page.getByLabel('Unidade')).toHaveCount(0);
  await expect(cartao(page, 'D-03')).toContainText('Carregada');
  await expect(cartao(page, 'D-03')).toContainText('28 de 37 pacotes com WhatsApp');
  await expect(page.getByText('Pendente de upload')).toHaveCount(0);

  await abaSaida(page, /Saída 2/).click();
  await expect(page.getByRole('heading', { name: 'Saída 2 ainda não foi importada' })).toBeVisible();

  // Sem horário, nada é enviado.
  await page.locator('input#saida-arquivo').setInputFiles(await planilha('saida-2.xlsx'));
  await page.getByRole('button', { name: 'Importar Saída 2' }).click();
  await expect(page.getByText('Confirme o horário da Saída 2 antes de importar.')).toBeVisible();
  expect((await saidasNoServidor(page)).saidas).toHaveLength(1);

  await page.getByLabel('Horário da saída').fill('14:00');
  await page.getByRole('button', { name: 'Importar Saída 2' }).click();

  // Gravou direto: a aba da Saída 2 abre com as rotas do arquivo.
  await expect(abaSaida(page, /Saída 2 · 14:00/)).toHaveAttribute('aria-selected', 'true');
  await expect(abaSaida(page, /Saída 2/)).toContainText('2 rotas');
  await expect(page.getByText('saida-2.xlsx')).toBeVisible();
  const resumo = page.getByRole('region', { name: 'Resumo da saída' });
  await expect(resumo).toContainText('2rotas nesta saída');
  await expect(resumo).toContainText('7pacotes');
  await expect(resumo).toContainText('5com WhatsApp');

  // Rota nova com o carteiro do arquivo; rota nova sem carteiro.
  const r509 = cartao(page, '509');
  await expect(r509.getByRole('heading', { name: 'Wesley Mota Ramos' })).toBeVisible();
  await expect(r509).toContainText('4 pacotes');
  await expect(r509).toContainText('3 de 4 pacotes com WhatsApp');
  const r510 = cartao(page, '510');
  await expect(r510.getByRole('heading', { name: 'Sem carteiro definido' })).toBeVisible();
  // O WhatsApp malformado não descarta a linha: o pacote entra na rota, sem WhatsApp.
  await expect(r510).toContainText('2 de 3 pacotes com WhatsApp');
  await expect(page.getByText('1 pacote entrou sem WhatsApp: o número do arquivo é inválido.')).toBeVisible();
  await expect(r510.getByRole('button', { name: 'Liberar rota' })).toHaveCount(0);
  await expect(page.getByText('Rotas criadas no Cadastro: 509, 510.')).toBeVisible();

  // O resultado fica em destaque, com a lista consultável.
  const resultado = page.getByRole('region', { name: 'Resultado da importação' });
  await expect(resultado).toContainText('7 aceitos, 3 descartados');
  await resultado.getByRole('button', { name: 'Ver linhas descartadas (3)' }).click();
  const linhas = resultado.locator('tbody tr');
  await expect(linhas).toHaveCount(3);
  await expect(linhas.nth(0).locator('td').nth(0)).toHaveText('8');
  await expect(linhas.nth(0).locator('td').nth(1)).toHaveText('D-03');
  await expect(linhas.nth(0)).toContainText('A rota já foi carregada na Saída 1 hoje');
  await expect(linhas.nth(1)).toContainText('AB123456789BR');
  await expect(linhas.nth(1)).toContainText('Dígito verificador do código não confere');
  await expect(linhas.nth(2)).toContainText('Linha sem rota');
  // Nome e telefone das linhas recusadas não aparecem.
  await expect(resultado).not.toContainText('Beatriz');
  await expect(resultado).not.toContainText('98876');

  // Depois de recarregar, o resultado continua lá (está gravado com a saída).
  await page.reload();
  await abaSaida(page, /Saída 2/).click();
  await expect(page.getByRole('region', { name: 'Resultado da importação' })).toContainText('7 aceitos, 3 descartados');
  await expect(abaSaida(page, /Saída 3/)).toContainText('Aguardando arquivo e horário');

  const servidor = await saidasNoServidor(page);
  expect(servidor.saidas.map((s) => [s.numero, s.aceitos, s.descartados])).toEqual([[1, 46, 0], [2, 7, 3]]);
  // A D-03 continua só na Saída 1, com os 37 pacotes dela.
  expect(servidor.rotas.find((r) => r.codigo === 'D-03')).toEqual(expect.objectContaining({ saidaNumero: 1, total: 37 }));
});

test('E2E-018 — "Definir carteiro" abre o modal "Atribuir carteiros"; depois, liberação em lote das rotas carregadas', async ({ page }) => {
  const c = await cenarioSupervisor('carregado');
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');
  await abaSaida(page, /Saída 2/).click();
  await importarSaida(page, 'saida-2.xlsx', '14:00', 2);
  await expect(abaSaida(page, /Saída 2 · 14:00/)).toHaveAttribute('aria-selected', 'true');

  // Só a 509 tem carteiro: uma rota só não mostra a liberação em lote.
  await expect(page.getByRole('button', { name: /Liberar \d+ rotas carregadas/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Atribuir carteiros (1)' })).toBeVisible();

  await cartao(page, '510').getByRole('button', { name: 'Definir carteiro' }).click();
  const modal = page.getByRole('dialog', { name: 'Atribuir carteiros' });
  await expect(modal).toContainText('1 rota está sem carteiro');
  const salvar = modal.getByRole('button', { name: 'Salvar carteiro' });
  await expect(salvar).toBeDisabled();
  await modal.getByLabel(/Carteiro da rota 510/).selectOption({ label: 'Patrícia Nunes' });
  await modal.getByLabel('Definir também como carteiro padrão da rota 510').check();
  await salvar.click();
  await expect(modal).toHaveCount(0);

  const r510 = cartao(page, '510');
  await expect(r510.getByRole('heading', { name: 'Patrícia Nunes' })).toBeVisible();
  await expect(r510.getByRole('button', { name: 'Liberar rota' })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Atribuir carteiros/ })).toHaveCount(0);

  // Liberação em lote: totais e a lista das rotas.
  await page.getByRole('button', { name: 'Liberar 2 rotas carregadas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Liberar 2 rotas da Saída 2?' });
  await expect(dialogo).toContainText('5 destinatários');
  await expect(dialogo).toContainText('2 pacotes sem WhatsApp');
  await expect(dialogo).toContainText('Rotas 509, 510.');
  await dialogo.getByRole('button', { name: 'Liberar e enviar avisos' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(cartao(page, '509')).toContainText('Liberada');
  await expect(r510).toContainText('Liberada');
  await expect(r510.getByRole('button', { name: 'Liberar rota' })).toHaveCount(0);

  const servidor = await saidasNoServidor(page);
  const porCodigo = Object.fromEntries(servidor.rotas.map((r) => [r.codigo, r]));
  expect(porCodigo['509']).toEqual(expect.objectContaining({ status: 'LIBERADO', saidaNumero: 2 }));
  expect(porCodigo['509'].porStatus.AGENDADO).toBe(3);
  expect(porCodigo['510']).toEqual(expect.objectContaining({ status: 'LIBERADO', carteiro: expect.objectContaining({ nome: 'Patrícia Nunes' }) }));
  expect(porCodigo['510'].porStatus.AGENDADO).toBe(2);
  // A Saída 1 não foi tocada.
  expect(porCodigo['D-03'].status).toBe('DADOS_CARREGADOS');
  // O padrão da rota 510 ficou gravado no Cadastro.
  const cadastro = await page.evaluate(async () => {
    const r = await fetch('/api/v1/entregas/cadastro/distritos?tamanho=100', { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
    return r.json();
  });
  const rota510 = (cadastro.itens as Array<{ codigo: string; nome: string; carteiroPadrao: { nome: string } | null }>).find((d) => d.codigo === '510');
  expect(rota510).toEqual(expect.objectContaining({ nome: 'Rota 510', carteiroPadrao: expect.objectContaining({ nome: 'Patrícia Nunes' }) }));
});

test('E2E-019 — reimportar a saída substitui só as rotas não liberadas e avisa antes', async ({ page }) => {
  const c = await cenarioSupervisor('carregado');
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');
  await abaSaida(page, /Saída 2/).click();
  await importarSaida(page, 'saida-2.xlsx', '14:00', 2);
  await expect(abaSaida(page, /Saída 2 · 14:00/)).toHaveAttribute('aria-selected', 'true');

  // Libera a 509; a 510 continua carregada.
  await cartao(page, '509').getByRole('button', { name: 'Liberar rota' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Liberar rota 509 · Wesley Mota Ramos?' });
  await dialogo.getByRole('button', { name: 'Liberar e enviar avisos' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(cartao(page, '509')).toContainText('Liberada');

  // Escolher a saída já importada: "(reimportar)", o horário dela e o aviso.
  const numero = page.getByLabel('Número da saída');
  await expect(numero.locator('option')).toHaveText(['Saída 1 (reimportar)', 'Saída 2 (reimportar)', 'Saída 3']);
  await numero.selectOption({ label: 'Saída 2 (reimportar)' });
  await expect(page.getByLabel('Horário da saída')).toHaveValue('14:00');
  await expect(page.getByText(/A Saída 2 já foi importada às \d{2}h\d{2}\. Importar de novo substitui os dados das rotas que ainda não foram liberadas\./)).toBeVisible();

  await importarSaida(page, 'saida-2-reimportacao.csv', '15:30', 2);
  await expect(abaSaida(page, /Saída 2 · 15:30/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('saida-2-reimportacao.csv')).toBeVisible();

  // A 510 foi substituída (3 pacotes, 2 com WhatsApp); a 509, liberada, ficou como estava (4 pacotes).
  await expect(cartao(page, '510')).toContainText('3 pacotes');
  await expect(cartao(page, '510')).toContainText('2 de 3 pacotes com WhatsApp');
  await expect(cartao(page, '509')).toContainText('4 pacotes');
  await expect(cartao(page, '509')).toContainText('Liberada');
  await expect(page.getByText('Rota já liberada, mantida como estava: 509.')).toBeVisible();

  const resultado = page.getByRole('region', { name: 'Resultado da importação' });
  await expect(resultado).toContainText('3 aceitos, 2 descartados');
  await resultado.getByRole('button', { name: 'Ver linhas descartadas (2)' }).click();
  await expect(resultado.locator('tbody tr')).toHaveCount(2);
  await expect(resultado.locator('tbody tr').first()).toContainText('509');
  await expect(resultado.locator('tbody tr').first()).toContainText('Rota já liberada');

  const servidor = await saidasNoServidor(page);
  expect(servidor.saidas).toHaveLength(2);
  const porCodigo = Object.fromEntries(servidor.rotas.map((r) => [r.codigo, r]));
  expect(porCodigo['509']).toEqual(expect.objectContaining({ status: 'LIBERADO', total: 4 }));
  expect(porCodigo['509'].porStatus.AGENDADO).toBe(3);
  expect(porCodigo['510']).toEqual(expect.objectContaining({ status: 'DADOS_CARREGADOS', total: 3 }));
});

test('E2E-020 — Gestão: "Todas as unidades" é só leitura; para importar, escolhe a unidade', async ({ page }) => {
  await cenarioSupervisor('carregado');
  const g = await controle<{ gestor: { email: string } }>('/cenarios/gestor', {});
  await entrarDireto(page, g.gestor.email, '/entregas/carregar');

  const unidade = page.getByLabel('Unidade', { exact: true });
  await expect(unidade.locator('option')).toHaveText(['Todas as unidades', 'CDD Taguatinga', 'CEE Águas Claras']);

  await unidade.selectOption({ label: 'Todas as unidades' });
  await expect(abaSaida(page, /Saída 1/)).toContainText('1 unidade · 4 rotas');
  await expect(cartao(page, 'D-03')).toContainText('CDD Taguatinga');
  await expect(page.getByRole('button', { name: /Importar Saída/ })).toBeDisabled();
  await expect(page.getByText('Escolha uma unidade para importar.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Liberar rota' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Definir carteiro' })).toHaveCount(0);

  // Na unidade escolhida, a Gestão importa a saída dela.
  await unidade.selectOption({ label: 'CEE Águas Claras' });
  await expect(page.getByRole('heading', { name: 'Saída 1 ainda não foi importada' })).toBeVisible();
  await importarSaida(page, 'saida-2.xlsx', '09:30', 1);
  await expect(abaSaida(page, /Saída 1 · 09:30/)).toContainText('3 rotas');
  await expect(page.getByRole('region', { name: 'Resultado da importação' })).toContainText('8 aceitos, 2 descartados');
  // A liberação continua sendo do supervisor da unidade.
  await expect(page.getByRole('button', { name: 'Liberar rota' })).toHaveCount(0);

  const todas = await saidasNoServidor(page, '?unidadeId=todas');
  expect(todas.saidas).toHaveLength(2);
  expect(todas.rotas).toHaveLength(7);
});

test('E2E-007 — diálogo de liberação e bloqueios', async ({ page }) => {
  const c = await cenarioSupervisor('carregado');
  await entrarDireto(page, c.supervisor.email, '/entregas/carregar');

  // Rota sem carteiro: liberação indisponível; o cartão oferece "Definir carteiro".
  const d06 = cartao(page, 'D-06');
  await expect(d06).toContainText('Sem carteiro definido');
  await expect(d06.getByRole('button', { name: 'Liberar rota' })).toHaveCount(0);
  await expect(d06.getByRole('button', { name: 'Definir carteiro' })).toBeVisible();

  // Liberação normal.
  const d03 = cartao(page, 'D-03');
  await expect(d03).toContainText('28 de 37 pacotes com WhatsApp');
  await expect(d03).toContainText('9 sem WhatsApp não serão avisados');
  await d03.getByRole('button', { name: 'Liberar rota' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Liberar rota D-03 · Renato Alves Costa?' });
  await expect(dialogo).toContainText('28 destinatários');
  await expect(dialogo).toContainText('9 pacotes sem WhatsApp');
  await expect(dialogo).toContainText('Ele(a) recebe no WhatsApp o resumo das orientações já conhecidas.');
  await dialogo.getByRole('button', { name: 'Liberar e enviar avisos' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(d03).toContainText('Liberada');
  await expect(d03.getByRole('button', { name: 'Liberar rota' })).toHaveCount(0);

  // Nenhum pacote com WhatsApp: confirmação explícita.
  const d04 = cartao(page, 'D-04');
  await d04.getByRole('button', { name: 'Liberar rota' }).click();
  const semAvisos = page.getByRole('dialog', { name: /Liberar rota D-04/ });
  await expect(semAvisos).toContainText('Nenhum destinatário será avisado');
  const liberar = semAvisos.getByRole('button', { name: 'Liberar sem avisos' });
  await expect(liberar).toBeDisabled();
  await semAvisos.getByLabel('Entendo e quero liberar sem enviar avisos').check();
  await liberar.click();
  await expect(semAvisos).toHaveCount(0);
  await expect(d04).toContainText('Liberada');

  // No servidor: D-03 com 28 avisos agendados; nada saiu para o D-04.
  const { rotas } = await saidasNoServidor(page);
  const porCodigo = Object.fromEntries(rotas.map((r) => [r.codigo, r]));
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

  // A lista da rota também se atualiza sozinha.
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
