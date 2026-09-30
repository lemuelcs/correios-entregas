-- CreateEnum
CREATE TYPE "TipoCanal" AS ENUM ('WAHA', 'WABA');

-- CreateEnum
CREATE TYPE "StatusCarga" AS ENUM ('CARREGADO', 'LIBERADO', 'EM_ENTREGA', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "StatusPacote" AS ENUM ('SEM_WHATSAPP', 'AGUARDANDO_LIBERACAO', 'AGENDADO', 'NAO_ENVIADO', 'ENVIADO', 'LIDO', 'INTERAGINDO', 'INSUCESSO', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "TipoPonto" AS ENUM ('AGENCIA', 'LOCKER');

-- CreateEnum
CREATE TYPE "TipoOrientacao" AS ENUM ('AMANHA', 'VIZINHO', 'AGENCIA', 'LOCKER', 'OUTRA', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoOrientacao" AS ENUM ('AGUARDANDO_CONFIRMACAO', 'ENVIADA', 'VISTA', 'FEITA', 'NAO_FOI_POSSIVEL', 'GUARDADA', 'SUBSTITUIDA');

-- CreateEnum
CREATE TYPE "OrigemOrientacao" AS ENUM ('BOTAO', 'MEDIACAO', 'SUPERVISOR');

-- AlterTable
ALTER TABLE "unidades" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "canalProsioId" TEXT,
ADD COLUMN     "mediacaoAtiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prosioUnidadeRef" TEXT;

-- AlterTable
ALTER TABLE "carteiros" ADD COLUMN     "nome" TEXT,
ADD COLUMN     "whatsappE164" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "canais_prosio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyCifrada" TEXT NOT NULL,
    "callbackSecretCifrado" TEXT NOT NULL,
    "tokenEntradaHash" TEXT NOT NULL,
    "tipo" "TipoCanal" NOT NULL DEFAULT 'WAHA',
    "compartilhado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canais_prosio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distritos" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "carteiroPadraoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas_distrito" (
    "distritoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "carteiroId" TEXT NOT NULL,

    CONSTRAINT "escalas_distrito_pkey" PRIMARY KEY ("distritoId","data")
);

-- CreateTable
CREATE TABLE "cargas_distrito" (
    "id" TEXT NOT NULL,
    "distritoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "status" "StatusCarga" NOT NULL DEFAULT 'CARREGADO',
    "carteiroId" TEXT,
    "liberadoEm" TIMESTAMP(3),
    "liberadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargas_distrito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacotes_dia" (
    "id" TEXT NOT NULL,
    "cargaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "codigo" CHAR(13) NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsappE164" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" CHAR(2),
    "cep" CHAR(8),
    "enderecoTexto" TEXT,
    "referencia" TEXT,
    "status" "StatusPacote" NOT NULL,
    "naoEnviadoMotivo" TEXT,
    "escalonado" BOOLEAN NOT NULL DEFAULT false,
    "prosioMessageId" TEXT,
    "mediacaoCaseId" TEXT,
    "rastreioDescricao" TEXT,
    "rastreioEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacotes_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_retirada" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "tipo" "TipoPonto" NOT NULL,
    "nome" VARCHAR(24) NOT NULL,
    "endereco" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pontos_retirada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orientacoes" (
    "id" TEXT NOT NULL,
    "codigo" CHAR(13) NOT NULL,
    "pacoteId" TEXT,
    "tipo" "TipoOrientacao" NOT NULL,
    "texto" VARCHAR(300) NOT NULL,
    "pontoRetiradaId" TEXT,
    "vizinhoNome" TEXT,
    "vizinhoCasa" TEXT,
    "estado" "EstadoOrientacao" NOT NULL,
    "origem" "OrigemOrientacao" NOT NULL,
    "criadaPorId" TEXT,
    "carteiroId" TEXT,
    "respostaCarteiro" TEXT,
    "respondidoEm" TIMESTAMP(3),
    "valeAPartirDe" DATE,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orientacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_pacote" (
    "id" TEXT NOT NULL,
    "pacoteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pacote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "descadastros_whatsapp" (
    "whatsappE164" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "descadastros_whatsapp_pkey" PRIMARY KEY ("whatsappE164")
);

-- CreateTable
CREATE TABLE "webhooks_recebidos" (
    "chave" TEXT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_recebidos_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "distritos_unidadeId_codigo_key" ON "distritos"("unidadeId", "codigo");

-- CreateIndex
CREATE INDEX "escalas_distrito_carteiroId_idx" ON "escalas_distrito"("carteiroId");

-- CreateIndex
CREATE UNIQUE INDEX "cargas_distrito_distritoId_data_key" ON "cargas_distrito"("distritoId", "data");

-- CreateIndex
CREATE INDEX "pacotes_dia_cargaId_status_idx" ON "pacotes_dia"("cargaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pacotes_dia_codigo_data_key" ON "pacotes_dia"("codigo", "data");

-- CreateIndex
CREATE INDEX "pontos_retirada_unidadeId_tipo_ativo_idx" ON "pontos_retirada"("unidadeId", "tipo", "ativo");

-- CreateIndex
CREATE INDEX "orientacoes_codigo_estado_idx" ON "orientacoes"("codigo", "estado");

-- CreateIndex
CREATE INDEX "orientacoes_pacoteId_idx" ON "orientacoes"("pacoteId");

-- CreateIndex
CREATE INDEX "eventos_pacote_pacoteId_criadoEm_idx" ON "eventos_pacote"("pacoteId", "criadoEm");

-- CreateIndex
CREATE INDEX "unidades_canalProsioId_idx" ON "unidades"("canalProsioId");

-- CreateIndex
CREATE UNIQUE INDEX "carteiros_whatsappE164_key" ON "carteiros"("whatsappE164");

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_canalProsioId_fkey" FOREIGN KEY ("canalProsioId") REFERENCES "canais_prosio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distritos" ADD CONSTRAINT "distritos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distritos" ADD CONSTRAINT "distritos_carteiroPadraoId_fkey" FOREIGN KEY ("carteiroPadraoId") REFERENCES "carteiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_distrito" ADD CONSTRAINT "escalas_distrito_distritoId_fkey" FOREIGN KEY ("distritoId") REFERENCES "distritos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_distrito" ADD CONSTRAINT "escalas_distrito_carteiroId_fkey" FOREIGN KEY ("carteiroId") REFERENCES "carteiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas_distrito" ADD CONSTRAINT "cargas_distrito_distritoId_fkey" FOREIGN KEY ("distritoId") REFERENCES "distritos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas_distrito" ADD CONSTRAINT "cargas_distrito_carteiroId_fkey" FOREIGN KEY ("carteiroId") REFERENCES "carteiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas_distrito" ADD CONSTRAINT "cargas_distrito_liberadoPorId_fkey" FOREIGN KEY ("liberadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacotes_dia" ADD CONSTRAINT "pacotes_dia_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "cargas_distrito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_retirada" ADD CONSTRAINT "pontos_retirada_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orientacoes" ADD CONSTRAINT "orientacoes_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "pacotes_dia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orientacoes" ADD CONSTRAINT "orientacoes_pontoRetiradaId_fkey" FOREIGN KEY ("pontoRetiradaId") REFERENCES "pontos_retirada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orientacoes" ADD CONSTRAINT "orientacoes_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orientacoes" ADD CONSTRAINT "orientacoes_carteiroId_fkey" FOREIGN KEY ("carteiroId") REFERENCES "carteiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_pacote" ADD CONSTRAINT "eventos_pacote_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "pacotes_dia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

