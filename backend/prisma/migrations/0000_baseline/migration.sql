-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoUnidade" AS ENUM ('CDD', 'CEE', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "ModeloTriagem" AS ENUM ('MANUAL', 'PTL', 'ADTA');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GESTAO', 'UNIDADE', 'CARTEIRO', 'DESTINATARIO');

-- CreateEnum
CREATE TYPE "ModalEntrega" AS ENUM ('A_PE', 'BICICLETA', 'BICICLETA_ELETRICA', 'MOTOCICLETA', 'CARRO', 'FURGAO', 'VAN', 'SPRINTER');

-- CreateEnum
CREATE TYPE "TipoUnitizador" AS ENUM ('BAG', 'SACOLA', 'CARRINHO', 'CAIXETA', 'CDL', 'CAF', 'VEICULO');

-- CreateEnum
CREATE TYPE "StatusUnitizador" AS ENUM ('DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusVeiculo" AS ENUM ('DISPONIVEL', 'EM_ROTA', 'MANUTENCAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusObjeto" AS ENUM ('AGUARDANDO_CHEGADA', 'RECEBIDO_UNIDADE', 'EM_CONFERENCIA', 'TRIADO', 'UNITIZADO', 'DISPONIVEL_COLETA', 'COLETADO_CARTEIRO', 'EM_ROTA', 'ENTREGUE', 'TENTATIVA_SEM_ATENDIMENTO', 'DEVOLVIDO_UNIDADE', 'AGUARDANDO_RETIRADA', 'DEVOLVIDO_REMETENTE', 'AVARIADO', 'EXTRAVIADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusRota" AS ENUM ('CRIADA', 'DISPONIVEL', 'COLETADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "StatusParada" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "ModoOtimizacao" AS ENUM ('ABSOLUTO', 'LARGE_VAN', 'BALANCEADO');

-- CreateEnum
CREATE TYPE "SolverUsado" AS ENUM ('VROOM', 'PYVRP');

-- CreateEnum
CREATE TYPE "TipoAtorEvento" AS ENUM ('CARTEIRO', 'GESTOR', 'SISTEMA', 'DESTINATARIO');

-- CreateEnum
CREATE TYPE "ServicoAdicional" AS ENUM ('AR_FISICO', 'AR_ELETRONICO', 'AR_DIGITAL', 'MAO_PROPRIA');

-- CreateEnum
CREATE TYPE "TipoInteracao" AS ENUM ('REAGENDAR', 'AUTORIZAR_TERCEIRO', 'REDIRECIONAR', 'MANTER_AGENCIA', 'CONTATAR_CARTEIRO');

-- CreateEnum
CREATE TYPE "StatusInteracao" AS ENUM ('PENDENTE', 'PROCESSADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "GeocodeAccuracy" AS ENUM ('ROOFTOP', 'INTERPOLATED', 'APPROXIMATE');

-- CreateTable
CREATE TABLE "superintendencias_estaduais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "isSede" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "superintendencias_estaduais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "mcu" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" "TipoUnidade" NOT NULL,
    "seId" TEXT,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "cep" CHAR(8) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "faixasCep" JSONB NOT NULL DEFAULT '[]',
    "modeloTriagem" "ModeloTriagem" NOT NULL DEFAULT 'MANUAL',
    "configTriagem" JSONB NOT NULL DEFAULT '{}',
    "horarioAbre" TEXT,
    "horarioFecha" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT,
    "cpf" TEXT,
    "email" TEXT,
    "matricula" TEXT,
    "senha" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "telefoneCelular" TEXT,
    "telefoneComercial" TEXT,
    "endResidencialCidade" TEXT,
    "endResidencialUf" CHAR(2),
    "endResidencialCep" CHAR(8),
    "endResidencialLogradouro" TEXT,
    "endResidencialNumero" TEXT,
    "endResidencialComplemento" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revogado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carteiros" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "modalPrincipal" "ModalEntrega" NOT NULL DEFAULT 'A_PE',
    "cnh" TEXT,
    "telefonePiloto" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "familiaridadeH3" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carteiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_dia" (
    "id" TEXT NOT NULL,
    "carteiroId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "horaEntrada" TIMESTAMP(3),
    "horaSaida" TIMESTAMP(3),
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pontos_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetos" (
    "id" TEXT NOT NULL,
    "codigoRastreio" TEXT NOT NULL,
    "servicoCodigo" CHAR(2) NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "destinatarioNome" TEXT NOT NULL,
    "destinatarioCpf" TEXT,
    "destinatarioEmail" TEXT,
    "destinatarioTelefone" TEXT,
    "cepDestino" CHAR(8) NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geocodeAccuracy" "GeocodeAccuracy",
    "remetenteNome" TEXT NOT NULL,
    "remetenteCpfCnpj" TEXT,
    "pesoGramas" INTEGER NOT NULL,
    "larguraCm" DECIMAL(8,2),
    "alturaCm" DECIMAL(8,2),
    "comprimentoCm" DECIMAL(8,2),
    "cubagem" DECIMAL(10,3),
    "servicosAdicionais" "ServicoAdicional"[],
    "notaFiscalChave" CHAR(44),
    "notaFiscalNumero" TEXT,
    "statusAtual" "StatusObjeto" NOT NULL DEFAULT 'AGUARDANDO_CHEGADA',
    "unitizadorId" TEXT,
    "rotaId" TEXT,
    "stopSequence" INTEGER,
    "distritoCodigo" TEXT,
    "tentativasEntrega" INTEGER NOT NULL DEFAULT 0,
    "maxTentativas" INTEGER NOT NULL DEFAULT 2,
    "diasGuarda" INTEGER NOT NULL DEFAULT 7,
    "dataLimiteGuarda" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unitizadores" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "tipo" "TipoUnitizador" NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "larguraCm" DECIMAL(8,2),
    "alturaCm" DECIMAL(8,2),
    "profundidadeCm" DECIMAL(8,2),
    "volumeLitros" DECIMAL(10,3),
    "capacidadeKg" DECIMAL(8,2),
    "placa" TEXT,
    "modeloVeiculo" TEXT,
    "modal" "ModalEntrega",
    "statusVeiculo" "StatusVeiculo",
    "statusAtual" "StatusUnitizador" NOT NULL DEFAULT 'DISPONIVEL',
    "localizacaoAtual" JSONB NOT NULL DEFAULT '{"tipo":"ESPACO_FISICO","referencia":""}',
    "rotaAtualId" TEXT,
    "parentId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unitizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unitizadores_historico" (
    "id" TEXT NOT NULL,
    "unitizadorId" TEXT NOT NULL,
    "statusAnterior" "StatusUnitizador" NOT NULL,
    "statusNovo" "StatusUnitizador" NOT NULL,
    "localizacaoAnterior" JSONB NOT NULL,
    "localizacaoNova" JSONB NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atorId" TEXT NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "unitizadores_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias_carga" (
    "id" TEXT NOT NULL,
    "origemIds" JSONB NOT NULL,
    "destinoIds" JSONB NOT NULL,
    "objetoIds" JSONB NOT NULL,
    "tipo" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atorId" TEXT NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "transferencias_carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "carteiroId" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "statusAtual" "StatusRota" NOT NULL DEFAULT 'CRIADA',
    "modeloTriagem" "ModeloTriagem" NOT NULL,
    "modoOtimizacao" "ModoOtimizacao" NOT NULL DEFAULT 'ABSOLUTO',
    "solverUsado" "SolverUsado" NOT NULL DEFAULT 'VROOM',
    "totalParadas" INTEGER NOT NULL DEFAULT 0,
    "totalObjetos" INTEGER NOT NULL DEFAULT 0,
    "totalEntregues" INTEGER NOT NULL DEFAULT 0,
    "totalInsucessos" INTEGER NOT NULL DEFAULT 0,
    "totalPnovs" INTEGER NOT NULL DEFAULT 0,
    "distanciaEstimadaKm" DECIMAL(8,2),
    "duracaoEstimadaMin" INTEGER,
    "horarioDespachoAlvo" TIMESTAMP(3),
    "iniciadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "retornoEstimado" TIMESTAMP(3),
    "retornoProjetado" TIMESTAMP(3),
    "posicaoEstacao" TEXT,
    "unitizadorIds" JSONB NOT NULL DEFAULT '[]',
    "solverJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paradas" (
    "id" TEXT NOT NULL,
    "rotaId" TEXT NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "cep" CHAR(8) NOT NULL,
    "logradouro" TEXT,
    "statusAtual" "StatusParada" NOT NULL DEFAULT 'PENDENTE',
    "estimativaChegada" TIMESTAMP(3),
    "chegadaReal" TIMESTAMP(3),
    "saidaReal" TIMESTAMP(3),
    "entregaAgrupada" BOOLEAN NOT NULL DEFAULT false,
    "totalObjetos" INTEGER NOT NULL DEFAULT 0,
    "totalEntregues" INTEGER NOT NULL DEFAULT 0,
    "totalInsucessos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetos_eventos" (
    "id" TEXT NOT NULL,
    "objetoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "localDescricao" TEXT NOT NULL,
    "atorTipo" "TipoAtorEvento" NOT NULL,
    "atorId" TEXT NOT NULL,
    "evidencias" JSONB,
    "rotaId" TEXT,
    "stopSequence" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "objetos_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sort_plans" (
    "id" TEXT NOT NULL,
    "rotaId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelo" "ModeloTriagem" NOT NULL,
    "assignments" JSONB NOT NULL DEFAULT '[]',
    "validado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sort_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volumes_previsao" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "faixa" TEXT NOT NULL,
    "quantidadeEstimada" INTEGER NOT NULL,
    "quantidadeChegou" INTEGER NOT NULL DEFAULT 0,
    "data" DATE NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volumes_previsao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nps_respostas" (
    "id" TEXT NOT NULL,
    "objetoId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "comentario" TEXT,
    "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nps_respostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacoes_objeto" (
    "id" TEXT NOT NULL,
    "objetoId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "tipo" "TipoInteracao" NOT NULL,
    "dados" JSONB NOT NULL,
    "status" "StatusInteracao" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),
    "processadoPor" TEXT,

    CONSTRAINT "interacoes_objeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_snapshots" (
    "id" TEXT NOT NULL,
    "rotaId" TEXT NOT NULL,
    "carteiroId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "velocidade" DECIMAL(5,2),
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ritmo_snapshots" (
    "id" TEXT NOT NULL,
    "rotaId" TEXT NOT NULL,
    "paradasFeitas" INTEGER NOT NULL,
    "objetosEntregues" INTEGER NOT NULL,
    "sphAtual" DECIMAL(6,2) NOT NULL,
    "retornoProjetado" TIMESTAMP(3),
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ritmo_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos_geocode" (
    "cep" CHAR(8) NOT NULL,
    "logradouro" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy" "GeocodeAccuracy" NOT NULL,
    "fonte" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enderecos_geocode_pkey" PRIMARY KEY ("cep")
);

-- CreateTable
CREATE TABLE "configuracao_global" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "descricao" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_global_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lockers_correios" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "cep" CHAR(8) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "horarioAbre" TEXT NOT NULL,
    "horarioFecha" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "unidadeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lockers_correios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fluxo_configs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "unidadeId" TEXT,
    "codigo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "definicao" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fluxo_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "superintendencias_estaduais_sigla_key" ON "superintendencias_estaduais"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_codigo_key" ON "unidades"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_mcu_key" ON "unidades"("mcu");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_matricula_key" ON "usuarios"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "carteiros_usuarioId_key" ON "carteiros"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "carteiros_matricula_key" ON "carteiros"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_dia_carteiroId_data_key" ON "pontos_dia"("carteiroId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "objetos_codigoRastreio_key" ON "objetos"("codigoRastreio");

-- CreateIndex
CREATE INDEX "objetos_codigoRastreio_idx" ON "objetos"("codigoRastreio");

-- CreateIndex
CREATE INDEX "objetos_unidadeId_statusAtual_idx" ON "objetos"("unidadeId", "statusAtual");

-- CreateIndex
CREATE INDEX "objetos_cepDestino_idx" ON "objetos"("cepDestino");

-- CreateIndex
CREATE INDEX "objetos_rotaId_idx" ON "objetos"("rotaId");

-- CreateIndex
CREATE UNIQUE INDEX "unitizadores_codigo_key" ON "unitizadores"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unitizadores_qrCode_key" ON "unitizadores"("qrCode");

-- CreateIndex
CREATE INDEX "unitizadores_unidadeId_idx" ON "unitizadores"("unidadeId");

-- CreateIndex
CREATE INDEX "unitizadores_codigo_idx" ON "unitizadores"("codigo");

-- CreateIndex
CREATE INDEX "unitizadores_historico_unitizadorId_idx" ON "unitizadores_historico"("unitizadorId");

-- CreateIndex
CREATE UNIQUE INDEX "rotas_codigo_key" ON "rotas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "rotas_veiculoId_key" ON "rotas"("veiculoId");

-- CreateIndex
CREATE INDEX "rotas_unidadeId_statusAtual_idx" ON "rotas"("unidadeId", "statusAtual");

-- CreateIndex
CREATE INDEX "rotas_carteiroId_idx" ON "rotas"("carteiroId");

-- CreateIndex
CREATE INDEX "paradas_rotaId_idx" ON "paradas"("rotaId");

-- CreateIndex
CREATE INDEX "objetos_eventos_objetoId_idx" ON "objetos_eventos"("objetoId");

-- CreateIndex
CREATE INDEX "objetos_eventos_ocorridoEm_idx" ON "objetos_eventos"("ocorridoEm");

-- CreateIndex
CREATE UNIQUE INDEX "sort_plans_rotaId_key" ON "sort_plans"("rotaId");

-- CreateIndex
CREATE UNIQUE INDEX "volumes_previsao_unidadeId_faixa_data_key" ON "volumes_previsao"("unidadeId", "faixa", "data");

-- CreateIndex
CREATE UNIQUE INDEX "nps_respostas_objetoId_key" ON "nps_respostas"("objetoId");

-- CreateIndex
CREATE INDEX "interacoes_objeto_objetoId_idx" ON "interacoes_objeto"("objetoId");

-- CreateIndex
CREATE INDEX "gps_snapshots_rotaId_ocorridoEm_idx" ON "gps_snapshots"("rotaId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "ritmo_snapshots_rotaId_ocorridoEm_idx" ON "ritmo_snapshots"("rotaId", "ocorridoEm");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_global_chave_key" ON "configuracao_global"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "lockers_correios_codigo_key" ON "lockers_correios"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "fluxo_configs_unidadeId_codigo_key" ON "fluxo_configs"("unidadeId", "codigo");

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_seId_fkey" FOREIGN KEY ("seId") REFERENCES "superintendencias_estaduais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carteiros" ADD CONSTRAINT "carteiros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carteiros" ADD CONSTRAINT "carteiros_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_dia" ADD CONSTRAINT "pontos_dia_carteiroId_fkey" FOREIGN KEY ("carteiroId") REFERENCES "carteiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetos" ADD CONSTRAINT "objetos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetos" ADD CONSTRAINT "objetos_unitizadorId_fkey" FOREIGN KEY ("unitizadorId") REFERENCES "unitizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetos" ADD CONSTRAINT "objetos_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "rotas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unitizadores" ADD CONSTRAINT "unitizadores_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unitizadores_historico" ADD CONSTRAINT "unitizadores_historico_unitizadorId_fkey" FOREIGN KEY ("unitizadorId") REFERENCES "unitizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_carteiroId_fkey" FOREIGN KEY ("carteiroId") REFERENCES "carteiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "unitizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paradas" ADD CONSTRAINT "paradas_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "rotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetos_eventos" ADD CONSTRAINT "objetos_eventos_objetoId_fkey" FOREIGN KEY ("objetoId") REFERENCES "objetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetos_eventos" ADD CONSTRAINT "objetos_eventos_atorId_fkey" FOREIGN KEY ("atorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sort_plans" ADD CONSTRAINT "sort_plans_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "rotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volumes_previsao" ADD CONSTRAINT "volumes_previsao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nps_respostas" ADD CONSTRAINT "nps_respostas_objetoId_fkey" FOREIGN KEY ("objetoId") REFERENCES "objetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes_objeto" ADD CONSTRAINT "interacoes_objeto_objetoId_fkey" FOREIGN KEY ("objetoId") REFERENCES "objetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ritmo_snapshots" ADD CONSTRAINT "ritmo_snapshots_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "rotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lockers_correios" ADD CONSTRAINT "lockers_correios_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fluxo_configs" ADD CONSTRAINT "fluxo_configs_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

