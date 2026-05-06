import { PrismaClient, TipoUnidade, ModeloTriagem, ModalEntrega, TipoUnitizador, StatusVeiculo } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function fluxoEntregaDefinicao() {
  return {
    estadoInicial: 'PERGUNTA_PRESENCA',
    variaveis: ['saudacao', 'nome', 'codigoRastreio', 'unidadeNome', 'unidadeEndereco', 'unidadeHorario', 'lockerNome', 'lockerEndereco', 'lockerHorario', 'diasGuarda'],
    estados: {
      PERGUNTA_PRESENCA: {
        mensagem: '{saudacao}, {nome}!\n\nSua encomenda *{codigoRastreio}* saiu para entrega hoje!\n\nTerá alguém no endereço para receber?\n\n*1* - Sim, pode entregar\n*2* - Não, preciso de alternativa',
        opcoes: [
          { trigger: '1', label: 'Sim', proximoEstado: 'CONFIRMADO', acao: 'CONFIRMAR_PRESENCA' },
          { trigger: 'SIM', label: 'Sim', proximoEstado: 'CONFIRMADO', acao: 'CONFIRMAR_PRESENCA' },
          { trigger: '2', label: 'Não', proximoEstado: 'OPCOES_ALTERNATIVA' },
          { trigger: 'NAO', label: 'Não', proximoEstado: 'OPCOES_ALTERNATIVA' },
          { trigger: 'NÃO', label: 'Não', proximoEstado: 'OPCOES_ALTERNATIVA' },
        ],
      },
      CONFIRMADO: {
        mensagem: 'Perfeito, {nome}! Aguarde a entrega no endereço cadastrado.\nVocê será notificado quando o carteiro estiver próximo.',
        acaoEntrada: 'LIMPAR_FLUXO',
      },
      OPCOES_ALTERNATIVA: {
        mensagem: 'Sem problemas! Escolha uma alternativa:\n\n*1* - Entregar para um vizinho\n*2* - Tentar novamente amanhã\n*3* - Retirar na Agência {unidadeNome}, {unidadeEndereco}. Aberta das {unidadeHorario}\n*4* - Retirar no Locker {lockerNome}, {lockerEndereco}. Aberto das {lockerHorario}',
        opcoes: [
          { trigger: '1', label: 'Vizinho', proximoEstado: 'VIZINHO_CONFIRMADO', acao: 'CRIAR_INTERACAO', dados: { tipo: 'AUTORIZAR_TERCEIRO' } },
          { trigger: '2', label: 'Amanhã', proximoEstado: 'REAGENDAR_CONFIRMADO', acao: 'CRIAR_INTERACAO', dados: { tipo: 'REAGENDAR' } },
          { trigger: '3', label: 'Agência', proximoEstado: 'AGENCIA_CONFIRMADO', acao: 'CRIAR_INTERACAO', dados: { tipo: 'MANTER_AGENCIA' } },
          { trigger: '4', label: 'Locker', proximoEstado: 'LOCKER_CONFIRMADO', acao: 'CRIAR_INTERACAO', dados: { tipo: 'REDIRECIONAR' } },
        ],
      },
      VIZINHO_CONFIRMADO: {
        mensagem: 'Combinado! O carteiro tentará entregar para um vizinho.',
        acaoEntrada: 'LIMPAR_FLUXO',
      },
      REAGENDAR_CONFIRMADO: {
        mensagem: 'Certo! Vamos tentar novamente amanhã.',
        acaoEntrada: 'LIMPAR_FLUXO',
      },
      AGENCIA_CONFIRMADO: {
        mensagem: 'Ok! Seu pacote ficará disponível na agência {unidadeNome}. Prazo de retirada: {diasGuarda} dias.',
        acaoEntrada: 'LIMPAR_FLUXO',
      },
      LOCKER_CONFIRMADO: {
        mensagem: 'Ok! Seu pacote será encaminhado ao Locker {lockerNome}. Prazo de retirada: {diasGuarda} dias.',
        acaoEntrada: 'LIMPAR_FLUXO',
      },
    },
  };
}

async function main() {
  console.log('🌱 Seeding database...');

  const senhaHash = await bcrypt.hash('123456', 10);

  // 1. Superintendencias Estaduais
  const sede = await prisma.superintendenciaEstadual.upsert({
    where: { sigla: 'CS' },
    update: {},
    create: {
      nome: 'Correios Sede',
      sigla: 'CS',
      cidade: 'Brasília',
      uf: 'DF',
      isSede: true,
    },
  });
  console.log(`  ✓ SE: ${sede.nome} (${sede.sigla})`);

  const seDF = await prisma.superintendenciaEstadual.upsert({
    where: { sigla: 'SE/DF' },
    update: {},
    create: {
      nome: 'Superintendência Estadual do DF',
      sigla: 'SE/DF',
      cidade: 'Brasília',
      uf: 'DF',
    },
  });
  console.log(`  ✓ SE: ${seDF.nome} (${seDF.sigla})`);

  // 2. Unidade CDD Demo
  const unidade = await prisma.unidade.upsert({
    where: { codigo: 'CDD-BSB-01' },
    update: { mcu: '00073701', seId: seDF.id },
    create: {
      codigo: 'CDD-BSB-01',
      mcu: '00073701',
      nome: 'CDD Brasília Centro',
      tipo: TipoUnidade.HIBRIDA,
      seId: seDF.id,
      logradouro: 'SIA Trecho 10',
      numero: '100',
      bairro: 'SIA',
      cidade: 'Brasília',
      uf: 'DF',
      cep: '71200100',
      latitude: -15.7975,
      longitude: -47.8919,
      modeloTriagem: ModeloTriagem.MANUAL,
      faixasCep: [
        { inicio: '70000000', fim: '70999999', distritoCodigo: 'DP-01' },
        { inicio: '71000000', fim: '71999999', distritoCodigo: 'DP-02' },
        { inicio: '72000000', fim: '72499999', distritoCodigo: 'DP-03' },
      ],
      configTriagem: {
        estruturas: 2,
        posicoesPorEstrutura: 18,
        throughputHora: 400,
      },
    },
  });
  console.log(`  ✓ Unidade: ${unidade.nome} (${unidade.codigo})`);

  // 3. Usuario GESTAO (Sede) - CPF 88888888888
  const gestaoUser = await prisma.usuario.upsert({
    where: { cpf: '88888888888' },
    update: { role: 'GESTAO', matricula: '20000001' },
    create: {
      cpf: '88888888888',
      email: 'gestao@correios.local',
      matricula: '20000001',
      senha: senhaHash,
      nome: 'Admin Gestão Central',
      role: 'GESTAO',
    },
  });
  console.log(`  ✓ Gestão: ${gestaoUser.nome} (CPF ${gestaoUser.cpf})`);

  // 4. Usuario UNIDADE (era GESTOR) - CPF 00000000000
  const unidadeUser = await prisma.usuario.upsert({
    where: { cpf: '00000000000' },
    update: { role: 'UNIDADE', matricula: '10000001' },
    create: {
      cpf: '00000000000',
      email: 'gestor@correios.local',
      matricula: '10000001',
      senha: senhaHash,
      nome: 'Admin Unidade',
      role: 'UNIDADE',
      unidadeId: unidade.id,
    },
  });
  console.log(`  ✓ Unidade: ${unidadeUser.nome} (CPF ${unidadeUser.cpf})`);

  // 5. Destinatário
  const destinatario = await prisma.usuario.upsert({
    where: { cpf: '99999999999' },
    update: {},
    create: {
      cpf: '99999999999',
      email: 'destinatario@teste.local',
      senha: senhaHash,
      nome: 'João Destinatário',
      role: 'DESTINATARIO',
    },
  });
  console.log(`  ✓ Destinatário: ${destinatario.nome}`);

  // 6. Carteiros (5) - agora com matricula no Usuario
  const carteirosData = [
    { cpf: '11111111111', nome: 'Carlos Silva', email: 'carlos@correios.local', matricula: '00000001', modal: ModalEntrega.SPRINTER },
    { cpf: '22222222222', nome: 'Maria Santos', email: 'maria@correios.local', matricula: '00000002', modal: ModalEntrega.VAN },
    { cpf: '33333333333', nome: 'João Oliveira', email: 'joao@correios.local', matricula: '00000003', modal: ModalEntrega.MOTOCICLETA },
    { cpf: '44444444444', nome: 'Ana Costa', email: 'ana@correios.local', matricula: '00000004', modal: ModalEntrega.BICICLETA_ELETRICA },
    { cpf: '55555555555', nome: 'Pedro Souza', email: 'pedro@correios.local', matricula: '00000005', modal: ModalEntrega.A_PE },
  ];

  const carteiros = [];
  for (const c of carteirosData) {
    const usuario = await prisma.usuario.upsert({
      where: { cpf: c.cpf },
      update: { role: 'CARTEIRO', matricula: c.matricula },
      create: {
        cpf: c.cpf,
        email: c.email,
        matricula: c.matricula,
        senha: senhaHash,
        nome: c.nome,
        role: 'CARTEIRO',
        unidadeId: unidade.id,
      },
    });

    const carteiro = await prisma.carteiro.upsert({
      where: { usuarioId: usuario.id },
      update: { matricula: c.matricula },
      create: {
        usuarioId: usuario.id,
        unidadeId: unidade.id,
        matricula: c.matricula,
        modalPrincipal: c.modal,
      },
    });

    carteiros.push(carteiro);
    console.log(`  ✓ Carteiro: ${c.nome} (${c.matricula})`);
  }

  // 7. Veículos (10) - criados como Unitizador tipo VEICULO
  const veiculosData = [
    { codigo: 'VEI-001', placa: 'BSB-0001', modelo: 'Sprinter 415', modal: ModalEntrega.SPRINTER, capacidade: 1500, volume: 12000 },
    { codigo: 'VEI-002', placa: 'BSB-0002', modelo: 'Sprinter 415', modal: ModalEntrega.SPRINTER, capacidade: 1500, volume: 12000 },
    { codigo: 'VEI-003', placa: 'BSB-0003', modelo: 'Fiorino', modal: ModalEntrega.FURGAO, capacidade: 650, volume: 3200 },
    { codigo: 'VEI-004', placa: 'BSB-0004', modelo: 'Fiorino', modal: ModalEntrega.FURGAO, capacidade: 650, volume: 3200 },
    { codigo: 'VEI-005', placa: 'BSB-0005', modelo: 'Kangoo', modal: ModalEntrega.VAN, capacidade: 800, volume: 4000 },
    { codigo: 'VEI-006', placa: 'BSB-0006', modelo: 'Kangoo', modal: ModalEntrega.VAN, capacidade: 800, volume: 4000 },
    { codigo: 'VEI-007', placa: 'BSB-0007', modelo: 'CG 160', modal: ModalEntrega.MOTOCICLETA, capacidade: 20, volume: 80 },
    { codigo: 'VEI-008', placa: 'BSB-0008', modelo: 'CG 160', modal: ModalEntrega.MOTOCICLETA, capacidade: 20, volume: 80 },
    { codigo: 'VEI-009', placa: 'BSB-0009', modelo: 'E-Bike Caloi', modal: ModalEntrega.BICICLETA_ELETRICA, capacidade: 15, volume: 60 },
    { codigo: 'VEI-010', placa: 'BSB-0010', modelo: 'Bag Pedestre', modal: ModalEntrega.A_PE, capacidade: 10, volume: 40 },
  ];

  for (const v of veiculosData) {
    await prisma.unitizador.upsert({
      where: { codigo: v.codigo },
      update: {},
      create: {
        codigo: v.codigo,
        qrCode: `QR-${v.codigo}`,
        tipo: TipoUnitizador.VEICULO,
        unidadeId: unidade.id,
        capacidadeKg: v.capacidade,
        volumeLitros: v.volume,
        placa: v.placa,
        modeloVeiculo: v.modelo,
        modal: v.modal,
        statusVeiculo: StatusVeiculo.DISPONIVEL,
      },
    });
    console.log(`  ✓ Veículo: ${v.codigo} (${v.modelo})`);
  }

  // 8. Bags e unitizadores
  const bagsData = [
    { codigo: 'BAG-001', tipo: TipoUnitizador.BAG, volume: 120 },
    { codigo: 'BAG-002', tipo: TipoUnitizador.BAG, volume: 120 },
    { codigo: 'BAG-003', tipo: TipoUnitizador.BAG, volume: 120 },
    { codigo: 'BAG-004', tipo: TipoUnitizador.BAG, volume: 120 },
    { codigo: 'BAG-005', tipo: TipoUnitizador.BAG, volume: 120 },
    { codigo: 'CDL-001', tipo: TipoUnitizador.CDL, volume: 800 },
    { codigo: 'CDL-002', tipo: TipoUnitizador.CDL, volume: 800 },
    { codigo: 'CAF-001', tipo: TipoUnitizador.CAF, volume: 1200 },
  ];

  for (const b of bagsData) {
    await prisma.unitizador.upsert({
      where: { codigo: b.codigo },
      update: {},
      create: {
        codigo: b.codigo,
        qrCode: `QR-${b.codigo}`,
        tipo: b.tipo,
        unidadeId: unidade.id,
        volumeLitros: b.volume,
      },
    });
    console.log(`  ✓ Unitizador: ${b.codigo}`);
  }

  // 9. Objetos teste (100)
  function calcCheckDigit(serial: string): number {
    const weights = [8, 6, 4, 2, 3, 5, 9, 7];
    const digits = serial.split('').map(Number);
    const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
    const remainder = sum % 11;
    if (remainder === 0) return 0;
    if (remainder === 1) return 5;
    return 11 - remainder;
  }

  const enderecos = [
    { logradouro: 'SQN 308 Bloco A', numero: '101', bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70747090', lat: -15.7631, lng: -47.8827 },
    { logradouro: 'SQN 310 Bloco D', numero: '203', bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70757040', lat: -15.7589, lng: -47.8845 },
    { logradouro: 'SQS 108 Bloco B', numero: '304', bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70347090', lat: -15.8131, lng: -47.8827 },
    { logradouro: 'SQS 206 Bloco F', numero: '102', bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70253060', lat: -15.8189, lng: -47.8845 },
    { logradouro: 'CLN 208 Bloco A', numero: '10', bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70862510', lat: -15.7621, lng: -47.8797 },
    { logradouro: 'CLS 106 Bloco B', numero: '15', bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70345530', lat: -15.8141, lng: -47.8797 },
    { logradouro: 'SHIS QI 05 Conj 2', numero: '1', bairro: 'Lago Sul', cidade: 'Brasília', uf: 'DF', cep: '71615200', lat: -15.8333, lng: -47.8583 },
    { logradouro: 'SHIN QI 09 Conj 11', numero: '5', bairro: 'Lago Norte', cidade: 'Brasília', uf: 'DF', cep: '71515210', lat: -15.7444, lng: -47.8472 },
    { logradouro: 'Rua 10 Chácara 81', numero: '200', bairro: 'Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72007810', lat: -15.8083, lng: -48.0333 },
    { logradouro: 'QNM 36 Conj A', numero: '50', bairro: 'Ceilândia', cidade: 'Brasília', uf: 'DF', cep: '72145360', lat: -15.8292, lng: -48.0972 },
  ];

  const servicos = ['PB', 'DG', 'RB', 'DL'];
  const nomes = ['José Silva', 'Maria Oliveira', 'Pedro Santos', 'Ana Lima', 'Carlos Mendes', 'Fernanda Costa', 'Roberto Souza', 'Julia Ferreira', 'Lucas Almeida', 'Beatriz Rocha'];

  for (let i = 0; i < 100; i++) {
    const serial = String(i + 1).padStart(8, '0');
    const servico = servicos[i % servicos.length];
    const dv = calcCheckDigit(serial);
    const codigoRastreio = `${servico}${serial}${dv}BR`;
    const endereco = enderecos[i % enderecos.length];
    const nome = nomes[i % nomes.length];
    const peso = 200 + Math.floor(Math.random() * 5000);

    await prisma.objeto.upsert({
      where: { codigoRastreio },
      update: {},
      create: {
        codigoRastreio,
        servicoCodigo: servico,
        unidadeId: unidade.id,
        destinatarioNome: nome,
        destinatarioCpf: destinatario.cpf,
        cepDestino: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        latitude: endereco.lat,
        longitude: endereco.lng,
        remetenteNome: 'Loja Teste LTDA',
        remetenteCpfCnpj: '12345678000100',
        pesoGramas: peso,
        maxTentativas: servico === 'DG' || servico === 'DL' ? 3 : servico === 'RB' ? 1 : 2,
        diasGuarda: servico === 'RB' ? 20 : 7,
      },
    });
  }

  console.log('  ✓ 100 objetos de teste criados');

  // 10. Atualizar horários da Unidade
  await prisma.unidade.update({
    where: { id: unidade.id },
    data: { horarioAbre: '08:00', horarioFecha: '18:00' },
  });
  console.log('  ✓ Horários da unidade configurados');

  // 11. Locker Correios
  await prisma.lockerCorreios.upsert({
    where: { codigo: 'LCK-BSB-01' },
    update: {},
    create: {
      nome: 'Locker Shopping Conjunto Nacional',
      codigo: 'LCK-BSB-01',
      logradouro: 'SDN Conjunto A',
      numero: 'S/N',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      cep: '70077900',
      latitude: -15.7917,
      longitude: -47.8825,
      horarioAbre: '06:00',
      horarioFecha: '23:00',
      unidadeId: unidade.id,
    },
  });
  await prisma.lockerCorreios.upsert({
    where: { codigo: 'LCK-BSB-02' },
    update: {},
    create: {
      nome: 'Locker Rodoviária',
      codigo: 'LCK-BSB-02',
      logradouro: 'Plataforma Rodoviária',
      numero: 'S/N',
      bairro: 'Plano Piloto',
      cidade: 'Brasília',
      uf: 'DF',
      cep: '70070100',
      latitude: -15.7942,
      longitude: -47.8822,
      horarioAbre: '05:00',
      horarioFecha: '00:00',
      unidadeId: unidade.id,
    },
  });
  console.log('  ✓ 2 Lockers Correios criados');

  // 12. FluxoConfig — Fluxo "Saiu para Entrega" (configurável sem deploy)
  // upsert não funciona com unidadeId null em unique composto; usar findFirst + create/update
  const existingFluxo = await prisma.fluxoConfig.findFirst({
    where: { unidadeId: null, codigo: 'FLUXO_ENTREGA' },
  });
  if (existingFluxo) {
    await prisma.fluxoConfig.update({
      where: { id: existingFluxo.id },
      data: { definicao: fluxoEntregaDefinicao(), versao: { increment: 1 } },
    });
  } else {
    await prisma.fluxoConfig.create({
      data: { codigo: 'FLUXO_ENTREGA', unidadeId: null, definicao: fluxoEntregaDefinicao() },
    });
  }
  console.log('  ✓ FluxoConfig FLUXO_ENTREGA criado');

  console.log('\n✅ Seed concluído!');
  console.log('\nCredenciais de teste:');
  console.log('  Gestão (Sede): CPF 88888888888 / senha 123456');
  console.log('  Unidade:       CPF 00000000000 / senha 123456');
  console.log('  Carteiros:     CPF 11111111111-55555555555 / senha 123456');
  console.log('  Destinatário:  CPF 99999999999 / senha 123456');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
