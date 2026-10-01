-- Captura do rótulo (app do carteiro): estende o núcleo do monitoramento (ADR-014).
-- EventoPacote.pacoteId passa a opcional com ON DELETE SET NULL: remover um PacoteDia preserva o histórico.
-- CreateEnum
CREATE TYPE "OrigemPacote" AS ENUM ('PLANILHA', 'FOTO', 'PLANILHA_FOTO');

-- CreateEnum
CREATE TYPE "ResultadoCapturaTipo" AS ENUM ('PROCESSANDO', 'SALVO', 'PARA_CONFERIR', 'TRANSFERENCIA_PENDENTE', 'RECUSADO', 'DESCARTADO', 'DESFEITO');

-- DropForeignKey
ALTER TABLE "eventos_pacote" DROP CONSTRAINT "eventos_pacote_pacoteId_fkey";

-- AlterTable
ALTER TABLE "eventos_pacote" ALTER COLUMN "pacoteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pacotes_dia" ADD COLUMN     "capturadoPorId" TEXT,
ADD COLUMN     "codigoDigitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origem" "OrigemPacote" NOT NULL DEFAULT 'PLANILHA',
ADD COLUMN     "telefoneOutro" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "bloqueadoAte" TIMESTAMP(3),
ADD COLUMN     "senhaTemporaria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tentativasFalhas" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "capturas" (
    "id" TEXT NOT NULL,
    "carteiroId" TEXT NOT NULL,
    "distritoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "cargaId" TEXT,
    "codigo" TEXT,
    "resultado" "ResultadoCapturaTipo" NOT NULL,
    "recusa" TEXT,
    "pacoteId" TEXT,
    "campos" JSONB,
    "pacoteAntes" JSONB,
    "cargaOrigemId" TEXT,
    "fotoKey" TEXT,
    "fotoExcluidaEm" TIMESTAMP(3),
    "llmInputTokens" INTEGER,
    "llmOutputTokens" INTEGER,
    "capturadoEm" TIMESTAMP(3) NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "capturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capturas_carteiroId_resultado_idx" ON "capturas"("carteiroId", "resultado");

-- CreateIndex
CREATE INDEX "capturas_cargaId_resultado_idx" ON "capturas"("cargaId", "resultado");

-- AddForeignKey
ALTER TABLE "eventos_pacote" ADD CONSTRAINT "eventos_pacote_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "pacotes_dia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

