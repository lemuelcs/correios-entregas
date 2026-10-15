-- Matrícula do arquivo sem carteiro cadastrado, por rota: o cartão da rota oferece "Cadastrar carteiro" mesmo após recarregar.
-- Aditiva: coluna com default, sem reescrever dados.
-- AlterTable
ALTER TABLE "saidas" ADD COLUMN     "carteirosNaoEncontrados" JSONB NOT NULL DEFAULT '[]';
