---
status: completed
title: Extensões do supervisor no módulo entregas
type: backend
complexity: medium
---

# Task 3: Extensões do supervisor no módulo entregas

## Overview

Esta tarefa dá ao supervisor a auditoria e a operação da captura dentro do módulo `entregas` do monitoramento (ADR-014):
- a lista de pacotes e o quadro ganham origem, "código digitado", foto, transferências e pendências;
- a captura ganha histórico, foto e remoção de pacote;
- a definição da senha do carteiro, criando o login quando ele ainda não existe.

O cadastro de distritos e a escala continuam com o monitoramento.

**Pré-requisito entre workflows**: as tasks **03 e 04 de `monitoramento-entregas-whatsapp`** mergeadas (quadro, lista de pacotes, escala, `escopo.ts`). Verifique no início e pare se faltar.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST montar `captura-supervisao.routes.ts` em `/api/v1/entregas/captura` no router `entregas` do monitoramento, com JWT e `escopo.ts` (outra unidade → 404).
- MUST estender de forma **aditiva** o `GET /api/v1/entregas/cargas/:cargaId/pacotes` (`origem`, `codigoDigitado`, `temFoto`) e o `GET /api/v1/entregas/quadro` (`paraConferir`, `transferencias.entrada/saida` com `{codigo, distrito, carteiro, hora, origemLiberada}`), sem remover nem renomear campos existentes; MUST manter verdes os testes do monitoramento.
- MUST implementar `GET /captura/pacotes/:id/historico` (a partir de `EventoPacote`, com os campos antes e depois) e `GET /captura/pacotes/:id/foto` (410 com `fotoExcluidaEm` quando excluída).
- MUST implementar `DELETE /captura/pacotes/:id` reutilizando `ConciliacaoService.remover` (evento REMOVIDO, foto excluída); `status = ENTREGUE` → 409 `pacote_entregue`.
- MUST implementar `PUT /captura/carteiros/:id/senha`: valida a política (400 `senha_fraca`); cria o `Usuario` (CARTEIRO, matrícula do `Carteiro`, unidade) quando `usuarioId` é nulo e o vincula; define `senhaTemporaria=true`; revoga os refresh tokens; 409 `matricula_ausente`; em concorrência, a última gravação vence.
</requirements>

## Subtasks
- [x] 3.1 Rotas de supervisor da captura montadas no módulo `entregas`, com escopo por unidade.
- [x] 3.2 Extensões aditivas da lista de pacotes e do quadro.
- [x] 3.3 Histórico e foto do pacote.
- [x] 3.4 Remoção de pacote pelo supervisor.
- [x] 3.5 Senha do carteiro, com criação do login quando ausente.
- [x] 3.6 Todos os testes atribuídos passando, e a suíte do monitoramento verde.

## Implementation Details

Os endpoints estão em TechSpec › API Endpoints (Supervisor). O arquivo novo é `backend/src/modules/captura/captura-supervisao.routes.ts` (e o controller correspondente). As alterações aditivas vão nos serviços do quadro e da lista de `backend/src/modules/entregas/` (monitoramento).

### Relevant Files
- `backend/src/modules/entregas/entregas.routes.ts`, `escopo.ts` — o router e o escopo (monitoramento, task_04 de lá).
- `backend/src/modules/entregas/*` (quadro e lista de pacotes) — o ponto das extensões.
- `backend/src/modules/captura/conciliacao.service.ts`, `photo-store.ts` — `remover` e a foto (task_02).
- `backend/src/modules/auth/auth.service.ts` — o hash de senha e a revogação de refresh (task_01).

### Dependent Files
- `frontend/src/features/entregas/*` — consome os campos novos (task_06).
- A suíte de testes de `entregas` do monitoramento — precisa continuar passando.

### Related ADRs
- [ADR-014: Estender o núcleo do monitoramento](adrs/adr-014.md)
- [ADR-001: Transferência e foto vence](adrs/adr-001.md)
- [ADR-004: Senha gerida pelo supervisor](adrs/adr-004.md)
- [ADR-006: Retenção da foto](adrs/adr-006.md)

## Deliverables
- As rotas `/api/v1/entregas/captura/*` e as extensões do quadro e da lista.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] IT-003 — a escala do monitoramento reflete em `/captura/hoje`
- [x] IT-046, IT-047, IT-048, IT-049, IT-050, IT-051, IT-112 — senha do carteiro, inclusive carteiro sem login
- [x] IT-077, IT-078, IT-079 — remoção pelo supervisor
- [x] IT-080, IT-081, IT-082, IT-083, IT-084 — lista estendida, histórico, foto e isolamento
- [x] IT-085, IT-086 — transferências no quadro
- [x] IT-087, IT-088, IT-089 — pendências e liberação (IT-088 escrito, mas fica em `skip` até a rota `POST /cargas/:cargaId/liberar` — task_06 do monitoramento — existir; ativa sozinho)

## Success Criteria
- Every assigned test case implemented and passing
- A suíte de testes do monitoramento continua passando (as respostas só ganharam campos)
- `npm run lint` e `npm run build` passam no backend
