-- Saídas do dia (ADR-019): um arquivo por unidade por saída, com todas as rotas.
-- Aditiva: tabela nova `saidas` e coluna opcional `cargas_distrito.saidaId` (cargas antigas e da captura ficam sem saída).
-- AlterTable
ALTER TABLE "cargas_distrito" ADD COLUMN     "saidaId" TEXT;

-- CreateTable
CREATE TABLE "saidas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "numero" INTEGER NOT NULL,
    "horario" CHAR(5) NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "importadaEm" TIMESTAMP(3) NOT NULL,
    "importadaPorId" TEXT,
    "aceitos" INTEGER NOT NULL DEFAULT 0,
    "descartados" INTEGER NOT NULL DEFAULT 0,
    "descartes" JSONB NOT NULL DEFAULT '[]',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saidas_unidadeId_data_numero_key" ON "saidas"("unidadeId", "data", "numero");

-- CreateIndex
CREATE INDEX "cargas_distrito_saidaId_idx" ON "cargas_distrito"("saidaId");

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_importadaPorId_fkey" FOREIGN KEY ("importadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas_distrito" ADD CONSTRAINT "cargas_distrito_saidaId_fkey" FOREIGN KEY ("saidaId") REFERENCES "saidas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

