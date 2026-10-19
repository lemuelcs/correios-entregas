/*
  Warnings:

  - The values [VROOM] on the enum `SolverUsado` will be removed. If these variants are still used in the database, this will fail.

*/
-- Rotas antigas resolvidas pelo VROOM passam a PYVRP (o único solver que resta).
UPDATE "rotas" SET "solverUsado" = 'PYVRP' WHERE "solverUsado" = 'VROOM';

-- AlterEnum
BEGIN;
CREATE TYPE "SolverUsado_new" AS ENUM ('PYVRP');
ALTER TABLE "rotas" ALTER COLUMN "solverUsado" DROP DEFAULT;
ALTER TABLE "rotas" ALTER COLUMN "solverUsado" TYPE "SolverUsado_new" USING ("solverUsado"::text::"SolverUsado_new");
ALTER TYPE "SolverUsado" RENAME TO "SolverUsado_old";
ALTER TYPE "SolverUsado_new" RENAME TO "SolverUsado";
DROP TYPE "SolverUsado_old";
ALTER TABLE "rotas" ALTER COLUMN "solverUsado" SET DEFAULT 'PYVRP';
COMMIT;

-- AlterTable
ALTER TABLE "rotas" ALTER COLUMN "solverUsado" SET DEFAULT 'PYVRP';
