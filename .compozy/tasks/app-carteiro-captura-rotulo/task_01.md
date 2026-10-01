---
status: pending
title: "Fundação: migrations, núcleo de dados, auth e infra de teste"
type: backend
complexity: critical
---

# Task 1: Fundação: migrations, núcleo de dados, auth e infra de teste

## Overview

Esta tarefa monta a base de que todas as outras dependem:
- a primeira baseline de migrations do Prisma, porque hoje não existe `prisma/migrations` e o dev foi criado por `db push`;
- o núcleo de dados do distrito do dia, compartilhado com o PRD de monitoramento;
- as correções pré-requisito de S10 e refresh token;
- o fluxo de senha do carteiro (troca obrigatória, bloqueio, sessão longa);
- os utilitários puros de leitura do rótulo;
- uma infra de testes de integração segura, que só roda em banco `_test`.

É crítica porque mexe em auth (todos os logins) e na forma de migrar o banco.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar a migration baseline `0000_baseline` do schema atual e documentar o `prisma migrate resolve --applied` para o banco de dev ANTES da migration da feature; MUST conferir com `prisma migrate diff` contra o banco de dev que não há drift, e registrar qualquer drift encontrado em vez de aplicá-lo às cegas.
- MUST adicionar os enums e os modelos `Distrito`, `DistritoDia`, `Pacote`, `Captura` e `PacoteEvento` e os campos `senhaTemporaria`, `tentativasFalhas` e `bloqueadoAte` em `Usuario`, exatamente como em TechSpec › Data Models, com `@@unique([data, codigo])` em `Pacote`.
- MUST NOT alterar `Objeto` nem os modelos do SGPD v2.
- MUST corrigir `validateS10` e `calculateS10CheckDigit` para a regra UPU (resto 0 → 5, resto 1 → 0) e aceitar qualquer sufixo de duas letras, com normalização de espaços, hífens e minúsculas.
- MUST criar `parseSigepDataMatrix` (ADR-011) e `normalizarWhatsapp`/`mesmoNumero` como módulos puros, sem dependência de Node, para que a task_04 possa copiá-los ao frontend.
- MUST criar `distrito-dia.service` que resolve o distrito do dia do carteiro (designação, depois distrito padrão), com o dia civil em America/Sao_Paulo e um relógio injetável.
- MUST fazer `POST /auth/refresh` devolver `{ accessToken, refreshToken }` com rotação (revoga o usado); o TTL do refresh é de 30 dias para CARTEIRO e 7 dias para os demais.
- MUST implementar `POST /auth/trocar-senha`, o claim `senhaTemporaria` no token, o bloqueio de 15 min após 5 falhas seguidas (423 `acesso_bloqueado`), 403 `acesso_desativado` para inativo, e a mesma mensagem para matrícula inexistente e senha errada.
- MUST expor um middleware `requireSenhaDefinitiva` que responde 403 `troca_de_senha_obrigatoria` (usado pelas rotas `/captura` na task_02).
- MUST criar o `globalSetup` do Jest que aborta se o `DATABASE_URL` não terminar em `_test` e aplica `prisma migrate deploy`; MUST criar helpers de app em processo (supertest) e de semente.
- MUST renomear o banco da CI para `correiosentregas_test` em `.github/workflows/ci.yml`.
- SHOULD remover do `app.health.test.ts` a dependência de servidor vivo (usar supertest).
</requirements>

## Subtasks
- [ ] 1.1 Baseline de migrations criada e procedimento de adoção no dev registrado na descrição do PR (o CLAUDE.md do repo proíbe criar .md de documentação sem pedido).
- [ ] 1.2 Modelos e enums do núcleo e campos de `Usuario` adicionados, com a migration da feature gerada.
- [ ] 1.3 S10 corrigido, com vetores UPU.
- [ ] 1.4 Parser do DataMatrix SIGEP e normalização de telefone como módulos puros.
- [ ] 1.5 Serviço de resolução do distrito do dia do carteiro.
- [ ] 1.6 Auth: rotação de refresh, TTL por papel, troca de senha, bloqueio, inativo e middleware de senha definitiva.
- [ ] 1.7 Infra de testes: trava `_test`, `globalSetup`, supertest em processo, sementes; CI com banco `_test`.
- [ ] 1.8 Todos os testes atribuídos passando.

## Implementation Details

Os padrões estão em TechSpec › Data Models, API Endpoints (Auth) e Testing Approach. Os módulos seguem o padrão routes/controller/service com singleton e zod no controller (`backend/src/modules/auth/`). O `distrito-dia.service.ts` fica em `backend/src/modules/captura/`, que é criado aqui só com esse serviço.

### Relevant Files
- `backend/prisma/schema.prisma` — os modelos novos e os campos de `Usuario`; `Usuario` em :206, `RefreshToken` em :235, `Carteiro` em :248.
- `backend/prisma.config.ts` — a configuração do Prisma e do seed.
- `backend/src/shared/utils/s10.ts` — o bug do DV (:35-36) e a regex só com BR (:42).
- `backend/src/modules/auth/auth.service.ts` — o login (:24-38), o refresh sem rotação (:56-79) e os TTLs (:7-9).
- `backend/src/modules/auth/auth.controller.ts` — o schema zod da matrícula (`length(8)`).
- `backend/src/shared/middleware/auth.middleware.ts` — `authenticate` e `requireRole`, e o payload do JWT.
- `backend/src/shared/middleware/error-handler.middleware.ts` — `AppError` e o mapeamento de Prisma e Zod.
- `backend/jest.config.js`, `backend/src/__tests__/app.health.test.ts` — o Jest atual.
- `backend/src/app.ts` — a exportação do app para supertest.
- `.github/workflows/ci.yml` — o banco `correiosentregas_db` deve virar `_test`.

### Dependent Files
- `frontend/src/services/api.ts` — passa a receber o refreshToken rotacionado (ajustado na task_04).
- `backend/src/modules/captura/*` e `backend/src/modules/supervisao/*` — consomem o núcleo (tasks 02 e 03).

### Related ADRs
- [ADR-007: Núcleo do distrito do dia com outbox](adrs/adr-007.md) — os modelos criados aqui.
- [ADR-004: PWA com matrícula e senha](adrs/adr-004.md) — senha temporária e sessão longa.
- [ADR-011: zxing-wasm e DataMatrix](adrs/adr-011.md) — o parser SIGEP.
- [ADR-013: Testes com banco _test](adrs/adr-013.md) — a trava e a CI.

## Deliverables
- A baseline e a migration da feature em `backend/prisma/migrations/`.
- Os utilitários `s10.ts` (corrigido), `sigep-datamatrix.ts` e `telefone.ts` em `backend/src/shared/utils/`.
- `backend/src/modules/captura/distrito-dia.service.ts`.
- Auth atualizado, com as novas rotas e o middleware.
- A infra de testes (`globalSetup`, helpers) e a CI com banco `_test`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-001, UT-002, UT-003, UT-004, UT-005, UT-006 — validação S10 (UPU)
- [ ] UT-007, UT-008, UT-009, UT-010, UT-011, UT-012 — parser DataMatrix SIGEP
- [ ] UT-013, UT-014, UT-015, UT-016, UT-017 — normalização de telefone
- [ ] UT-056, UT-057, UT-058, UT-059, UT-060, UT-061 — resolução do distrito do dia
- [ ] UT-062, UT-063, UT-064, UT-065, UT-066, UT-067, UT-068, UT-069, UT-070 — auth
- [ ] UT-125 — trava do banco `_test`
- [ ] IT-042, IT-043, IT-044, IT-045 — refresh rotativo, credenciais, bloqueio e inativo via HTTP

## Success Criteria
- Every assigned test case implemented and passing
- `prisma migrate deploy` num banco vazio `_test` cria o schema inteiro sem erro
- `npm test` com o `DATABASE_URL` apontando para um banco sem `_test` aborta antes de conectar
- Dois refresh seguidos funcionam; reusar o refresh antigo dá 401
- `npm run lint` e `npm run build` passam no backend
