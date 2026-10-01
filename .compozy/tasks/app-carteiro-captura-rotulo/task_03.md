---
status: pending
title: API do supervisor
type: backend
complexity: medium
---

# Task 3: API do supervisor

## Overview

Esta tarefa entrega a API `/api/v1/supervisao`, com a qual o supervisor opera e audita a captura:
- o cadastro mínimo de distritos e a designação do carteiro do dia, que o PRD de monitoramento vai reaproveitar;
- a lista do distrito com a origem de cada pacote, o histórico e a foto;
- a remoção depois da liberação;
- as transferências e as pendências;
- a definição da senha do carteiro.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST expor todos os endpoints de TechSpec › API Endpoints (Supervisor), com `authenticate` e `requireRole('UNIDADE')`, filtrando TUDO por `req.user.unidadeId` (outra unidade → 404).
- MUST permitir o CRUD mínimo de `Distrito` (código único por unidade → 409 em duplicata) e a designação do carteiro do dia, que cria o `DistritoDia` quando necessário e recusa carteiro de outra unidade (400 `carteiro_de_outra_unidade`).
- MUST listar os pacotes do distrito do dia com `origem`, `codigoDigitado`, `temFoto` e o último ATUALIZADO; o histórico a partir de `PacoteEvento`, com os campos antes e depois.
- MUST servir a foto só com checagem de unidade; foto excluída → 410 com `fotoExcluidaEm`.
- MUST remover pacote reutilizando `ConciliacaoService.remover` (evento REMOVIDO, foto excluída); pacote entregue → 409 `pacote_entregue`.
- MUST devolver, em `GET /distritos-dia?data=`, as contagens, as `transferenciasEntrada` e `transferenciasSaida` (código, distrito, carteiro, hora, `origemLiberada`) e `paraConferir` (capturas PARA_CONFERIR ou TRANSFERENCIA_PENDENTE do carteiro do dia); `data` ausente → 400.
- MUST implementar `PUT /carteiros/:id/senha` (valida a política, define `senhaTemporaria=true`, revoga os refresh tokens, 409 `matricula_ausente`, e o último a gravar vence).
- SHOULD oferecer uma forma de marcar o `DistritoDia` como LIBERADO (endpoint mínimo `POST /distritos-dia/:id/liberar`, sem disparar avisos), para os testes de pendência e pós-liberação, até o monitoramento assumir a liberação completa.
</requirements>

## Subtasks
- [ ] 3.1 Módulo `supervisao` montado em `/api/v1/supervisao`, com o filtro por unidade.
- [ ] 3.2 Cadastro mínimo de distritos e designação do carteiro do dia.
- [ ] 3.3 Lista de pacotes do distrito do dia, histórico e foto.
- [ ] 3.4 Remoção de pacote pelo supervisor.
- [ ] 3.5 Quadro do dia com transferências e pendências; liberação mínima.
- [ ] 3.6 Definição e redefinição da senha do carteiro.
- [ ] 3.7 Todos os testes atribuídos passando.

## Implementation Details

O módulo novo fica em `backend/src/modules/supervisao/` (routes, controller, service), no mesmo padrão dos módulos existentes. Reutiliza `ConciliacaoService`, `PhotoStore` e o `distrito-dia.service` das tasks 01 e 02. Os endpoints estão em TechSpec › API Endpoints (Supervisor).

### Relevant Files
- `backend/src/modules/captura/conciliacao.service.ts` — `remover` (task_02).
- `backend/src/modules/captura/photo-store.ts` — a leitura da foto (task_02).
- `backend/src/modules/auth/auth.service.ts` — o hash de senha (bcrypt) e a revogação de refresh (task_01).
- `backend/src/shared/middleware/auth.middleware.ts` — `requireRole('UNIDADE')` e o `unidadeId` no token.
- `backend/src/modules/unidade/` — o padrão de módulo do papel UNIDADE.
- `backend/src/app.ts` — a montagem da rota.

### Dependent Files
- `frontend/src/features/supervisao-captura/*` — consome esta API (task_06).

### Related ADRs
- [ADR-001: Transferência e foto vence](adrs/adr-001.md) — a exibição de transferências e sobrescritas.
- [ADR-004: Matrícula e senha](adrs/adr-004.md) — a senha gerida pelo supervisor.
- [ADR-006: Retenção da foto](adrs/adr-006.md) — o 410 com a data.
- [ADR-007: Núcleo e outbox](adrs/adr-007.md) — o histórico a partir dos eventos.

## Deliverables
- O módulo `backend/src/modules/supervisao/` montado.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] IT-003 — a designação "trocar só hoje" reflete em `/captura/hoje`
- [ ] IT-046, IT-047, IT-048, IT-049, IT-050, IT-051 — senha do carteiro
- [ ] IT-077, IT-078, IT-079 — remoção pelo supervisor
- [ ] IT-080, IT-081, IT-082, IT-083, IT-084 — lista, histórico, foto e isolamento por unidade
- [ ] IT-085, IT-086 — transferências no quadro
- [ ] IT-087, IT-088, IT-089 — pendências e liberação
- [ ] IT-106, IT-107, IT-108 — falhas documentadas de `/supervisao`

## Success Criteria
- Every assigned test case implemented and passing
- Nenhum endpoint de `/supervisao` devolve dado de outra unidade (verificado por IT-051 e IT-084)
- `npm run lint` e `npm run build` passam no backend
