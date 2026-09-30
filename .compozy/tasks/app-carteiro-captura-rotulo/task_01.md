---
status: pending
title: "Extensões de dados, auth do carteiro e utilitários do rótulo"
type: backend
complexity: critical
---

# Task 1: Extensões de dados, auth do carteiro e utilitários do rótulo

## Overview

Esta tarefa prepara o backend da captura sobre o núcleo do monitoramento (ADR-014):
- a migration que estende `PacoteDia` e `Usuario` e cria `Captura`;
- o fluxo de senha do carteiro (troca obrigatória, bloqueio, sessão longa) e a rotação do refresh token, que hoje desloga no segundo refresh;
- o parser do DataMatrix SIGEP;
- a classificação de telefone;
- a resolução do distrito do dia do carteiro.

É crítica porque mexe em auth, o que afeta todos os logins.

**Pré-requisito entre workflows** (o Compozy não expressa esta aresta): a task **01 de `monitoramento-entregas-whatsapp`** concluída (baseline, migration do núcleo, `s10.ts` corrigido, `telefone.ts`, harness de testes). O módulo `entregas` e o gancho de aviso (task_04 de lá) são exigidos só a partir da task_02 daqui. Verifique no início e pare, com uma mensagem clara, se faltar algo.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST verificar, antes de qualquer edição, que existem `backend/prisma/migrations/0000_baseline`, os modelos `CargaDistrito`, `EscalaDistrito`, `PacoteDia` e `EventoPacote`, `validateS10(..., { qualquerPais })`, `normalizarTelefone` e o `globalSetup` com a trava `_test`. Se algum faltar, MUST parar e reportar.
- MUST implementar a recusa de usuário inativo no LOGIN (403 `acesso_desativado`). A recusa de token já emitido no `authenticate` é da task_03 do monitoramento: se ela ainda não estiver mergeada, a segunda metade do IT-045 fica como `it.todo` com o motivo, e é habilitada quando ela chegar.
- MUST criar uma migration nova, depois das do monitoramento, com os enums `OrigemPacote` e `ResultadoCapturaTipo`; os campos de `PacoteDia` (`origem` com default PLANILHA, `codigoDigitado`, `capturadoPorId`, `telefoneOutro`); o modelo `Captura`; e os campos de `Usuario` (`senhaTemporaria`, `tentativasFalhas`, `bloqueadoAte`), conforme TechSpec › Data Models.
- MUST conferir se `EventoPacote.pacoteId` tem FK; se tiver, garantir que a remoção física de `PacoteDia` preserve os eventos (`onDelete: SetNull` ou equivalente), sem quebrar os testes do monitoramento.
- MUST NOT recriar baseline, S10, `telefone.ts` nem harness; MUST reutilizar os do monitoramento.
- MUST criar `shared/utils/sigep-datamatrix.ts` (`parseSigepDataMatrix`, ADR-011) como módulo puro, sem dependência de Node.
- MUST criar `classificarTelefone` (WhatsApp × fixo sobre `normalizarTelefone`) e `mesmoNumero` como funções puras.
- MUST criar `modules/captura/distrito-do-dia.service.ts`: a escala de hoje, depois o distrito padrão (sem escala de hoje para outro carteiro); vários distritos → lista; dia civil em America/Sao_Paulo com relógio injetável; `garantirCarga(distritoId, data)`.
- MUST fazer o `POST /auth/refresh` devolver `{ accessToken, refreshToken }` com rotação; TTL do refresh de 30 dias para CARTEIRO e 7 dias para os demais.
- MUST implementar `POST /auth/trocar-senha`, o claim `senhaTemporaria`, o bloqueio de 15 min após 5 falhas (423 `acesso_bloqueado`), a mensagem única para matrícula inexistente ou senha errada, e o middleware `requireSenhaDefinitiva` (403 `troca_de_senha_obrigatoria`).
- MUST gerar as fixtures de rótulo sintéticas da Strategy de `_tests.md` em `backend/src/__tests__/fixtures/rotulos/` (script versionado com `bwip-js`, já dependência do backend: Code 128 do objeto, código do CEP e DataMatrix SIGEP montado por um `montarSigepDataMatrix` inverso do parser), commitando os JPEGs e o script; dados fictícios, DV válido.
- MUST estender as fábricas `__tests__/fixtures/entregas.ts` com `escala`, `captura` e `pacoteCapturado`, sem mudar as existentes.
</requirements>

## Subtasks
- [ ] 1.1 Verificação dos pré-requisitos do monitoramento.
- [ ] 1.2 Migration da captura (`PacoteDia`, `Usuario`, `Captura`, enums) e a preservação dos eventos na remoção.
- [ ] 1.3 Parser do DataMatrix SIGEP.
- [ ] 1.4 Classificação e igualdade de telefone.
- [ ] 1.5 Distrito do dia do carteiro e garantia da carga.
- [ ] 1.6 Auth: rotação, TTL por papel, troca de senha, bloqueio e middleware de senha definitiva.
- [ ] 1.7 Fábricas de teste estendidas e fixtures de rótulo geradas.
- [ ] 1.8 Todos os testes atribuídos passando, e a suíte do monitoramento continua verde.

## Implementation Details

Os padrões estão em TechSpec › Data Models, API Endpoints (Auth) e Testing Approach, e em ADR-014. Módulos no padrão routes/controller/service com zod no controller.

### Relevant Files
- `backend/prisma/schema.prisma` — `PacoteDia`, `EventoPacote` e `Usuario`, depois da migration do monitoramento.
- `backend/prisma/migrations/` — a baseline e a migration do monitoramento (pré-requisito).
- `backend/src/shared/utils/s10.ts`, `backend/src/shared/utils/telefone.ts` — do monitoramento, reutilizados.
- `backend/src/modules/auth/auth.service.ts` — login (:24-38), refresh sem rotação (:56-79), TTLs (:7-9).
- `backend/src/modules/auth/auth.controller.ts`, `auth.routes.ts` — as rotas novas.
- `backend/src/shared/middleware/auth.middleware.ts` — `authenticate` (que o monitoramento fez recusar inativo) e `requireRole`.
- `backend/src/__tests__/fixtures/entregas.ts` — as fábricas do monitoramento.
- `.compozy/tasks/monitoramento-entregas-whatsapp/_techspec.md` — os nomes do núcleo.

### Dependent Files
- `backend/src/modules/captura/*` — a task_02 consome os modelos, o parser e o distrito do dia.
- `frontend/src/services/api.ts` — grava o refresh rotacionado (task_04).

### Related ADRs
- [ADR-014: A captura estende o núcleo do monitoramento](adrs/adr-014.md) — o escopo desta tarefa.
- [ADR-004: PWA com matrícula e senha](adrs/adr-004.md) — senha temporária e sessão longa.
- [ADR-011: zxing-wasm e DataMatrix](adrs/adr-011.md) — o parser.
- [ADR-013: Testes com banco _test](adrs/adr-013.md)

## Deliverables
- A migration da captura em `backend/prisma/migrations/`.
- `backend/src/shared/utils/sigep-datamatrix.ts` e as funções de telefone.
- `backend/src/modules/captura/distrito-do-dia.service.ts`.
- Auth atualizado, com as rotas novas e o middleware.
- As fábricas de teste estendidas.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-007, UT-008, UT-009, UT-010, UT-011, UT-012 — parser DataMatrix SIGEP
- [ ] UT-013, UT-014, UT-015, UT-016, UT-017 — `classificarTelefone` e `mesmoNumero`
- [ ] UT-056, UT-057, UT-058, UT-059, UT-060, UT-061 — distrito do dia
- [ ] UT-062, UT-063, UT-064, UT-065, UT-066, UT-067, UT-068, UT-069, UT-070 — auth
- [ ] IT-042, IT-043, IT-044, IT-045 — refresh rotativo, credenciais, bloqueio e inativo via HTTP

## Success Criteria
- Every assigned test case implemented and passing
- A suíte de testes do monitoramento continua passando após a migration e as mudanças de auth
- Dois refresh seguidos funcionam; reusar o antigo dá 401
- `npm run lint` e `npm run build` passam no backend
