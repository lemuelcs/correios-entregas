/** Auditoria da interface da área Entregas: lista de pacotes, Cadastro da Gestão e guardas. */
import { expect, test, type Page } from '@playwright/test';
import { cenarioSupervisor, controle, entrarDireto, reiniciar } from './apoio';

test.beforeEach(async () => {
  await reiniciar();
});

interface Gestor {
  gestor: { email: string; senha: string };
  prosioUrl: string;
  outraUnidadeId: string;
}

/** Chamada à API com a sessão da página (como outra aba da mesma pessoa faria). */
async function api<T = unknown>(page: Page, metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; corpo: T }> {
  return page.evaluate(async ({ metodo, caminho, corpo }) => {
    const r = await fetch(`/api/v1${caminho}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  }, { metodo, caminho, corpo }) as Promise<{ status: number; corpo: T }>;
}

const linha = (page: Page, codigo: string) => page.locator(`tr[data-pacote="${codigo}"]`);

test('E2E-017 — edição de pacote: WhatsApp e endereço, com o aviso imediato em rota liberada', async ({ page }) => {
  const c = await cenarioSupervisor();
  await entrarDireto(page, c.supervisor.email, `/entregas/distritos/${c.distritos['D-01'].cargaId}`);

  // O cabeçalho traz o carteiro e a hora da liberação; a tela fala "rota".
  await expect(page.locator('[data-cabecalho-rota]')).toHaveText(/Carteiro: Marcos Paulo Lima · liberada às \d{2}:\d{2}/);
  await expect(page.getByRole('link', { name: '← Voltar ao quadro de rotas' })).toBeVisible();

  const semWhats = page.locator('tr[data-pacote]', { hasText: 'Edson Pereira' });
  await expect(semWhats).toContainText('Sem WhatsApp');
  const codigo = (await semWhats.getAttribute('data-pacote'))!;
  await semWhats.getByRole('button', { name: `Editar ${codigo}` }).click();

  const dialogo = page.getByRole('dialog', { name: `Editar ${codigo}` });
  const whatsapp = dialogo.getByLabel('WhatsApp do destinatário');
  await expect(whatsapp).toBeFocused();

  // Número sem DDD: o erro fica no campo e o diálogo continua aberto.
  await whatsapp.fill('98460-7712');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo.getByText('Informe o DDD do WhatsApp.')).toBeVisible();
  await expect(dialogo).toBeVisible();

  await whatsapp.fill('(61) 98460-7712');
  await expect(dialogo.locator('[data-aviso-imediato]')).toContainText('o destinatário recebe o aviso de entrega na hora');
  await dialogo.getByLabel('Complemento').fill('Casa 2');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();

  await expect(dialogo).toBeHidden();
  await expect(page.getByText(/o aviso ao destinatário foi enviado agora/)).toBeVisible();
  await expect(linha(page, codigo)).toContainText('(61) 98460-7712');
  await expect(linha(page, codigo)).toContainText('Casa 2');
  await expect(linha(page, codigo)).not.toContainText('Sem WhatsApp');

  // Gravado no servidor.
  const lista = await api<{ pacotes: Array<{ codigo: string; whatsapp: string | null; endereco: { complemento: string | null } }> }>(
    page, 'GET', `/entregas/cargas/${c.distritos['D-01'].cargaId}/pacotes`,
  );
  const gravado = lista.corpo.pacotes.find((p) => p.codigo === codigo);
  expect(gravado?.whatsapp).toBe('+5561984607712');
  expect(gravado?.endereco.complemento).toBe('Casa 2');
});

test('E2E-018 — sinais do pacote aparecem como selos com rótulo', async ({ page }) => {
  const c = await cenarioSupervisor();
  const [p1, p2] = c.pacotesD01;
  await controle(`/pacotes/${p1.id}/sinais`, { sinais: ['divergencia', 'caso_recusado:opt_out', 'falha_envio_carteiro'] });
  await controle(`/pacotes/${p2.id}/sinais`, { sinais: ['retido_consentimento', 'nao_foi_possivel'] });
  await entrarDireto(page, c.supervisor.email, `/entregas/distritos/${c.distritos['D-01'].cargaId}`);

  const selos1 = page.getByRole('list', { name: `Sinalizações de ${p1.codigo}` });
  await expect(selos1.getByRole('listitem')).toHaveText([/^Divergência/, /^Mediação recusada/, /^Falha no envio ao carteiro/]);
  await expect(selos1.locator('[data-sinal="caso_recusado:opt_out"]')).toHaveAttribute('title', /pediu para não receber mensagens/);
  const selos2 = page.getByRole('list', { name: `Sinalizações de ${p2.codigo}` });
  await expect(selos2.getByRole('listitem')).toHaveText([/^Aguardando consentimento/, /^Carteiro não conseguiu/]);
  // Nenhum código cru na tela.
  await expect(page.getByText(/caso_recusado|retido_consentimento|nao_foi_possivel/)).toHaveCount(0);
  await expect(page.getByRole('list', { name: `Sinalizações de ${c.pacotesD01[2].codigo}` })).toHaveCount(0);
});

test('E2E-019 — canal: editar, gerar novo token (o diálogo não fecha com Esc) e desativar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const g = await controle<Gestor>('/cenarios/gestor', {});
  await entrarDireto(page, g.gestor.email, '/entregas/cadastro?aba=canais');
  await expect(page.getByRole('tab', { name: 'Canais de WhatsApp' })).toHaveAttribute('aria-selected', 'true');
  const criado = await api<{ id: string; tokenEntrada: string }>(page, 'POST', '/gestao/canais-prosio', {
    nome: 'Canal Taguatinga', baseUrl: g.prosioUrl, apiKey: 'psk_teste_1234567890', callbackSecret: 'segredo-de-callback-0123456789',
  });
  expect(criado.status).toBe(201);
  await page.reload();
  const linhaCanal = page.getByRole('row', { name: /Canal Taguatinga/ });
  await expect(linhaCanal).toBeVisible();

  // Editar o nome.
  await linhaCanal.getByRole('button', { name: 'Editar Canal Taguatinga' }).click();
  const dEditar = page.getByRole('dialog', { name: 'Editar Canal Taguatinga' });
  await dEditar.getByLabel('Nome').fill('Canal Tag Norte');
  await dEditar.getByRole('button', { name: 'Salvar' }).click();
  await expect(dEditar).toBeHidden();
  const linhaNova = page.getByRole('row', { name: /Canal Tag Norte/ });
  await expect(linhaNova).toBeVisible();

  // Gerar novo token: confirmação, depois o token, uma única vez.
  await linhaNova.getByRole('button', { name: 'Gerar novo token de Canal Tag Norte' }).click();
  const dConfirmar = page.getByRole('dialog', { name: 'Gerar novo token de Canal Tag Norte?' });
  await expect(dConfirmar).toContainText('O token atual deixa de valer na hora');
  await dConfirmar.getByRole('button', { name: 'Gerar novo token' }).click();

  const dToken = page.getByRole('dialog', { name: 'Novo token de entrada' });
  const campo = dToken.getByLabel('Token de entrada');
  await expect(campo).toHaveValue(/^cet_/);
  const token = await campo.inputValue();
  expect(token).not.toBe(criado.corpo.tokenEntrada);
  await expect(dToken.getByRole('button', { name: 'Fechar' })).toHaveCount(0);

  // Esc e clique fora não fecham.
  await page.keyboard.press('Escape');
  await expect(dToken).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dToken).toBeVisible();
  await expect(campo).toHaveValue(token);

  await dToken.getByRole('button', { name: 'Copiar' }).click();
  await expect(dToken.getByText('Token copiado para a área de transferência.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(token);

  await dToken.getByRole('button', { name: 'Já copiei o token' }).click();
  await expect(dToken).toBeHidden();
  await expect(page.getByText(/cet_/)).toHaveCount(0);

  // Desativar pede confirmação.
  await linhaNova.getByRole('button', { name: 'Desativar Canal Tag Norte' }).click();
  const dDesativar = page.getByRole('dialog', { name: 'Desativar Canal Tag Norte?' });
  await dDesativar.getByRole('button', { name: 'Desativar canal' }).click();
  await expect(dDesativar).toBeHidden();
  await expect(linhaNova).toContainText('Inativo');
  await expect(linhaNova.getByRole('button', { name: 'Reativar Canal Tag Norte' })).toBeVisible();
});

test('E2E-020 — supervisor: a Gestão edita celular, unidade e situação', async ({ page }) => {
  const g = await controle<Gestor>('/cenarios/gestor', {});
  await entrarDireto(page, g.gestor.email, '/entregas/cadastro?aba=supervisores');
  const outra = await api<{ id: string }>(page, 'POST', '/gestao/unidades', {
    codigo: 'CDD-TAG-01', nome: 'CDD Taguatinga', tipo: 'CDD', logradouro: 'QNA 1 Lote 10', numero: '10', bairro: 'Taguatinga Norte',
    cidade: 'Brasília', uf: 'DF', cep: '72110010', latitude: -15.8335, longitude: -48.0566,
  });
  expect(outra.status).toBe(201);
  const sup = await api<{ id: string }>(page, 'POST', '/gestao/usuarios', {
    nome: 'Rogério Pacheco', email: 'rogerio@e2e.local', matricula: '83910047', senha: 'senha-rogerio', role: 'UNIDADE',
    unidadeId: g.outraUnidadeId, telefoneCelular: '(61) 98822-0917',
  });
  expect(sup.status).toBe(201);
  await page.reload();

  const linhaSup = page.getByRole('row', { name: /Rogério Pacheco/ });
  await expect(linhaSup).toContainText('CEE Águas Claras');
  await expect(linhaSup).toContainText('(61) 98822-0917');
  await linhaSup.getByRole('button', { name: 'Editar Rogério Pacheco' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Editar Rogério Pacheco' });

  // Celular inválido: o erro do servidor aparece no campo.
  await dialogo.getByLabel('WhatsApp').fill('98822-0917');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo.getByRole('alert').first()).toContainText('WhatsApp inválido');
  await expect(dialogo).toBeVisible();

  await dialogo.getByLabel('WhatsApp').fill('(61) 99301-2210');
  await dialogo.getByLabel('Unidade').selectOption({ label: 'CDD Taguatinga' });
  await dialogo.getByRole('checkbox', { name: 'Supervisor ativo' }).uncheck();
  await expect(dialogo).toContainText('perde o acesso na próxima ação');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo).toBeHidden();

  await expect(linhaSup).toContainText('(61) 99301-2210');
  await expect(linhaSup).toContainText('CDD Taguatinga');
  await expect(linhaSup).toContainText('Inativo');
  const gravado = await api<{ ativo: boolean; unidadeId: string; telefoneCelular: string }>(page, 'GET', `/gestao/usuarios/${sup.corpo.id}`);
  expect(gravado.corpo).toMatchObject({ ativo: false, unidadeId: outra.corpo.id, telefoneCelular: '+5561993012210' });
});

test('E2E-021 — unidade: endereço, tipo Híbrida e o 409 "alterado por outro" sem perder o diálogo', async ({ page }) => {
  const g = await controle<Gestor>('/cenarios/gestor', {});
  await entrarDireto(page, g.gestor.email, '/entregas/cadastro?aba=unidades');
  const linhaUnidade = page.getByRole('row', { name: /CEE Águas Claras/ });
  await linhaUnidade.getByRole('button', { name: 'Editar CEE Águas Claras' }).click();
  const dialogo = page.getByRole('dialog', { name: /^Editar / });
  await expect(dialogo.getByLabel('CEP')).toHaveValue(/^\d{8}$/);

  // Outra pessoa renomeia a unidade enquanto o diálogo está aberto.
  const lida = await api<{ atualizadoEm: string }>(page, 'GET', `/gestao/unidades/${g.outraUnidadeId}`);
  const outraPessoa = await api(page, 'PUT', `/gestao/unidades/${g.outraUnidadeId}`, { nome: 'CEE Águas Claras Sul', atualizadoEm: lida.corpo.atualizadoEm });
  expect(outraPessoa.status).toBe(200);

  await dialogo.getByLabel('Tipo').selectOption({ label: 'Híbrida (CDD + CEE)' });
  await dialogo.getByLabel('Bairro').fill('Areal');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();

  // 409: o diálogo fica, explica, e recarrega os campos com a versão do servidor.
  const alerta = dialogo.getByRole('alert');
  await expect(alerta).toContainText('Outra pessoa alterou este registro enquanto você editava');
  await expect(page.getByRole('dialog', { name: 'Editar CEE Águas Claras Sul' })).toBeVisible();
  await expect(dialogo.getByLabel('Nome')).toHaveValue('CEE Águas Claras Sul');
  await expect(dialogo.getByLabel('Tipo')).toHaveValue('CEE');

  // Refaz a alteração sobre a versão atual e salva.
  await dialogo.getByLabel('Tipo').selectOption({ label: 'Híbrida (CDD + CEE)' });
  await dialogo.getByLabel('Bairro').fill('Areal');
  await dialogo.getByLabel('Unidade ativa').uncheck();
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo).toBeHidden();

  const nova = page.getByRole('row', { name: /CEE Águas Claras Sul/ });
  await expect(nova).toContainText('Híbrida');
  await expect(nova).toContainText('Areal');
  await expect(nova).toContainText('desativada');
  const gravada = await api<{ nome: string; tipo: string; bairro: string; ativa: boolean }>(page, 'GET', `/gestao/unidades/${g.outraUnidadeId}`);
  expect(gravada.corpo).toMatchObject({ nome: 'CEE Águas Claras Sul', tipo: 'HIBRIDA', bairro: 'Areal', ativa: false });
});

test('E2E-022 — Cadastro: busca e páginas de rotas e carteiros', async ({ page }) => {
  const c = await cenarioSupervisor();
  await entrarDireto(page, c.supervisor.email, '/entregas/cadastro');
  await expect(page.getByRole('tab', { name: 'Rotas', exact: true })).toHaveAttribute('aria-selected', 'true');
  // 4 rotas do cenário + 19 = 23: duas páginas de 20.
  for (let i = 10; i < 29; i += 1) {
    const r = await api(page, 'POST', '/entregas/cadastro/distritos', { codigo: `R-${i}`, nome: i === 17 ? 'Vicente Pires' : `Setor ${i}` });
    expect(r.status).toBe(201);
  }
  await page.reload();

  const tabela = page.getByRole('region', { name: 'Rotas', exact: true });
  const paginacao = page.getByRole('navigation', { name: 'Paginação' });
  await expect(paginacao).toContainText('Página 1 de 2 · 23 registros');
  await expect(tabela.locator('tbody tr')).toHaveCount(20);
  await expect(paginacao.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  await paginacao.getByRole('button', { name: 'Próxima' }).click();
  await expect(paginacao).toContainText('Página 2 de 2');
  await expect(tabela.locator('tbody tr')).toHaveCount(3);
  await expect(paginacao.getByRole('button', { name: 'Próxima' })).toBeDisabled();

  // A busca volta à primeira página e filtra no servidor (código ou nome).
  const busca = page.getByRole('searchbox', { name: 'Buscar rota por código ou nome' });
  await busca.fill('vicente');
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  await expect(tabela.getByRole('row', { name: /R-17/ })).toContainText('Vicente Pires');
  await expect(paginacao).toHaveCount(0);
  await busca.fill('zzz');
  await expect(tabela).toContainText('Nada encontrado para “zzz”.');
  await busca.fill('');
  await expect(paginacao).toContainText('Página 1 de 2');

  // Carteiros: busca por nome.
  await page.getByRole('tab', { name: 'Carteiros' }).click();
  const carteiros = page.getByRole('region', { name: 'Carteiros' });
  await expect(carteiros.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('searchbox', { name: 'Buscar carteiro por nome ou matrícula' }).fill('renato');
  await expect(carteiros.locator('tbody tr')).toHaveCount(1);
  await expect(carteiros).toContainText('Renato Alves Costa');
});

test('E2E-023 — Gestão: carga pela URL explica em vez de mostrar o envio; Atendimento abre sem unidade com um canal', async ({ page }) => {
  const c = await cenarioSupervisor();
  await controle('/cenarios/gestor', {});
  await entrarDireto(page, 'gestor@e2e.local', `/entregas/carregar/${c.distritos['D-03'].id}`);

  await expect(page.getByRole('heading', { name: 'O carregamento é feito pelo supervisor da unidade' })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Enviar planilha' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Voltar ao quadro de rotas' }).click();
  await expect(page).toHaveURL(/\/entregas\/carregar$/);

  // Sem unidade em foco: o quadro pede a unidade, mas o Atendimento abre pelo único canal ativo.
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await menu.getByLabel('Unidade em foco').selectOption('');
  await expect(page.getByText('Escolha a unidade em foco no menu para ver os dados.')).toBeVisible();

  await menu.getByRole('link', { name: /^Atendimento/ }).click();
  await expect(page).toHaveURL(/\/entregas\/atendimento$/);
  await expect(page.locator('iframe[title^="Chatwoot"]')).toHaveAttribute('src', /sso_token=/);
});
