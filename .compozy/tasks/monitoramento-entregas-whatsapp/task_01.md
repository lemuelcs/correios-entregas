---
status: pending
title: "Base: migrations, utilitários e harness de testes"
type: infra
complexity: critical
---

# Task 1: Base: migrations, utilitários e harness de testes

## Overview
Deixa o repositório pronto para as outras tarefas trabalharem em paralelo: schema versionado com os modelos novos da feature, utilitários de domínio corrigidos ou novos (S10, telefone, cifra) e um harness de testes que roda contra um banco isolado. Hoje o schema foi aplicado por `db push`, o `migrate deploy` do CI não cria nada e o único teste depende de um servidor no ar. Sem essa base, nenhuma outra tarefa consegue testar de verdade.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar `backend/prisma/migrations/0000_baseline` a partir do schema ATUAL (antes das mudanças desta feature), gerado com `prisma migrate diff --from-empty --to-schema-datamodel`.
- MUST criar uma migration seguinte com os modelos e enums da seção Data Models do TechSpec (`CanalProsio`, `Distrito`, `EscalaDistrito`, `CargaDistrito`, `PacoteDia`, `PontoRetirada`, `Orientacao`, `EventoPacote`, `DescadastroWhatsapp`, `WebhookRecebido`) e as alterações em `Unidade` (`canalProsioId`, `prosioUnidadeRef`, `mediacaoAtiva`, `atualizadoEm` para o controle de concorrência) e `Carteiro` (`usuarioId` opcional, `nome`, `whatsappE164` único, `ativo`).
- MUST documentar em `backend/prisma/MIGRATIONS.md` o passo `prisma migrate resolve --applied 0000_baseline` para bancos existentes (dev e prod criados por `db push`). NÃO executar esse passo em nenhum banco compartilhado.
- MUST corrigir `calculateS10CheckDigit` para a regra da UPU (resto 0 → 5, resto 1 → 0) e adicionar a opção `validateS10(code, { qualquerPais: true })`, mantendo o comportamento só-BR por padrão.
- MUST criar `shared/utils/telefone.ts` (`normalizarTelefone` → E.164 BR, `TelefoneInvalido` com os códigos `sem_ddd` e `formato`) e `shared/utils/cripto.ts` (AES-256-GCM com `ENTREGAS_CRYPTO_KEY`; `cifrar`, `decifrar`, `carregarChave`).
- MUST criar o harness de testes: projetos Jest `unit` e `integration` e um `globalSetup` que usa `TEST_DATABASE_URL`, RECUSA rodar se o nome do banco não terminar em `_test`, e roda `prisma migrate reset --force --skip-seed`. MUST fornecer as fábricas de dados em `__tests__/fixtures/entregas.ts` (unidade, supervisor, distrito, carteiro, carga, pacote, canal) e um helper de login JWT.
- MUST trocar `app.health.test.ts` para supertest sobre o `app` exportado.
- MUST ajustar `.github/workflows/ci.yml` para rodar os projetos de teste contra o Postgres do serviço com `migrate deploy`.
- MUST ajustar as consultas legadas que fazem join `Carteiro → Usuario` para ignorar carteiros sem usuário, sem mudar o comportamento das telas do SGPD v2.
- SHOULD adicionar `ENTREGAS_CRYPTO_KEY`, `SEU_RASTREIO_TOKEN` e `TEST_DATABASE_URL` ao `backend/.env.example` e ao `docker-compose.yml` (só a variável, nunca o valor).
</requirements>

## Subtasks
- [ ] 1.1 Gerar a migration de linha de base a partir do schema atual e validar do zero num banco `_test`.
- [ ] 1.2 Modelar os enums e modelos novos e as alterações em `Unidade`/`Carteiro`, e gerar a migration da feature.
- [ ] 1.3 Documentar o roteiro de migração para bancos existentes.
- [ ] 1.4 Corrigir o dígito verificador S10 e aceitar qualquer sufixo de país como opção.
- [ ] 1.5 Criar os utilitários de telefone E.164 e de cifra dos segredos.
- [ ] 1.6 Montar o harness Jest (unit/integration), o `globalSetup` com trava `_test`, as fábricas e o helper de login.
- [ ] 1.7 Migrar o teste de health para supertest e ajustar o CI.
- [ ] 1.8 Proteger as consultas legadas de carteiro contra `usuarioId` nulo.

## Implementation Details
Ver TechSpec: "Data Models", "Testing Approach", "Impact Analysis" e "Development Sequencing" (passos 1–3).

### Relevant Files
- `backend/prisma/schema.prisma` — modelos existentes (`Unidade` :167, `Usuario` :206, `Carteiro` :248, `Objeto` :285); recebe os modelos novos.
- `backend/prisma.config.ts` — configuração do Prisma e do seed.
- `backend/src/shared/utils/s10.ts` — regra do dígito invertida (linhas 34–37) e regex só-BR (:42).
- `backend/src/shared/utils/prisma.ts` — singleton do cliente.
- `backend/jest.config.js` — ts-jest, `testMatch **/__tests__/**/*.test.ts`.
- `backend/src/__tests__/app.health.test.ts` — faz `fetch` num servidor vivo; trocar por supertest.
- `backend/src/app.ts` — `app` exportado separadamente de `server.ts`.
- `.github/workflows/ci.yml` — job `verify` com Postgres 18 e Redis 8; `prisma migrate deploy` (:66).
- `backend/.env.example`, `docker-compose.yml` (serviço `backend`, :107–135) — variáveis de ambiente.

### Dependent Files
- `backend/src/modules/carteiro/*.service.ts`, `backend/src/modules/despacho/despacho.service.ts`, `backend/src/modules/gestao/usuarios-gestao.service.ts` — consultas que incluem `carteiro.usuario`; conferir com `usuarioId` opcional.
- `backend/src/modules/destinatario/destinatario.service.ts`, `backend/src/modules/reconciliacao/reconciliacao.service.ts` — usam `validateS10`; a regra corrigida muda o resultado para os códigos com resto 0 ou 1.
- Todas as tarefas seguintes usam o schema, as fábricas e o `globalSetup` desta tarefa.

### Related ADRs
- [ADR-013: Modelo de dados e migrations](../adrs/adr-013.md) — modelos próprios, `Carteiro.usuarioId` opcional, linha de base.
- [ADR-016: Rastreio adaptativo e S10](../adrs/adr-016.md) — correção do dígito verificador.
- [ADR-007: Validação S10 e texto neutro](../adrs/adr-007.md) — qualquer sufixo de país.
- [ADR-012: Topologia mista no Prosio](../adrs/adr-012.md) — `CanalProsio` e os campos em `Unidade`.

## Deliverables
- `backend/prisma/migrations/0000_baseline/` e a migration da feature, aplicáveis do zero.
- `backend/prisma/MIGRATIONS.md` com o roteiro para bancos existentes.
- `s10.ts` corrigido; `telefone.ts` e `cripto.ts` novos.
- Harness de testes (projetos, `globalSetup` com trava, fábricas, helper de login).
- CI significativo (cria as tabelas e roda os testes).
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-001, UT-002, UT-003, UT-004, UT-005 — validação S10 (regra da UPU, qualquer país, normalização)
- [ ] UT-006, UT-007, UT-008, UT-009, UT-010 — normalização de telefone E.164 BR
- [ ] UT-011, UT-012, UT-013 — cifra AES-256-GCM dos segredos
- [ ] IT-052 — `migrate deploy` do zero cria todas as tabelas
- [ ] IT-053 — health via supertest

## Success Criteria
- Every assigned test case implemented and passing
- `npx prisma migrate deploy` num banco vazio `_test` aplica as duas migrations sem erro, e `migrate status` fica limpo.
- `npx tsc --noEmit` do backend passa, e os testes existentes continuam verdes.
- Nenhum banco compartilhado (`correiosentregas_db`) é alterado durante a tarefa.
