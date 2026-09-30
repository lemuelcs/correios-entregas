-- AlterTable
ALTER TABLE "pacotes_dia" ADD COLUMN     "sinais" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "orientacoes" ADD COLUMN     "sinais" TEXT[] DEFAULT ARRAY[]::TEXT[];

