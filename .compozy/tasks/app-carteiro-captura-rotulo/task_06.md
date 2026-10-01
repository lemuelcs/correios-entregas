---
status: completed
title: Extensões do supervisor nas telas de entregas
type: frontend
complexity: medium
---

# Task 6: Extensões do supervisor nas telas de entregas

## Overview

Esta tarefa leva a captura às telas do supervisor que o monitoramento cria no `EntregasShell` (ADR-014):
- na lista de pacotes: os chips de origem, o selo "código digitado", o histórico de sobrescritas, a foto do rótulo e a remoção;
- no quadro: as pendências de conferência e as transferências;
- no cadastro de carteiros: a ação "Definir senha".

**Pré-requisito entre workflows**: a task_07 de `monitoramento-entregas-whatsapp` concluída (o `EntregasShell`, `CarregarDadosPage`, `DistritoPacotesPage` e `CadastroPage`).

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST verificar no início que `frontend/src/features/entregas/` existe com as páginas do monitoramento; se não existir, MUST parar e reportar.
- MUST estender `DistritoPacotesPage` com:
  - os chips "Planilha", "Foto" e "Planilha + foto";
  - o selo "código digitado";
  - o histórico do pacote, com os valores antes e depois;
  - a foto do rótulo, e "Foto excluída em DD/MM (prazo de retenção)" no 410;
  - o botão Remover, com confirmação.
- MUST estender `CarregarDadosPage` (o quadro) com "N para conferir no app do carteiro" quando N>0, e as transferências de entrada e saída (código, carteiro, hora).
- MUST adicionar "Definir senha" à aba Carteiros de `CadastroPage`, chamando `PUT /entregas/captura/carteiros/:id/senha`.
- MUST seguir os tokens visuais e as regras de acessibilidade do monitoramento (alvos de 44 px, rótulos, foco visível, sem rolagem horizontal em 390 px).
- MUST NOT alterar o comportamento existente dessas páginas além das adições.
</requirements>

## Subtasks
- [x] 6.1 Verificação do pré-requisito do monitoramento.
- [x] 6.2 Origem, selo, histórico, foto e remoção na lista de pacotes.
- [x] 6.3 Pendências e transferências no quadro.
- [x] 6.4 "Definir senha" no cadastro de carteiros.
- [x] 6.5 Todos os testes atribuídos passando.

## Implementation Details

As mudanças ficam nas páginas e stores de `frontend/src/features/entregas/` (monitoramento). Os endpoints estão em TechSpec › API Endpoints (Supervisor), implementados na task_03.

### Relevant Files
- `frontend/src/features/entregas/pages/DistritoPacotesPage.tsx`, `CarregarDadosPage.tsx`, `CadastroPage.tsx` — criadas pela task_07 do monitoramento.
- `frontend/src/index.css` — os tokens `@theme` do monitoramento.
- `.compozy/tasks/app-carteiro-captura-rotulo/prototipo/Distrito.dc.html` — o visual de referência.
- `frontend/src/services/api.ts` — o cliente.

### Dependent Files
- Os testes de frontend do monitoramento para essas páginas, se existirem, precisam continuar passando.

### Related ADRs
- [ADR-014: Estender o núcleo do monitoramento](adrs/adr-014.md)
- [ADR-001: Transferência e foto vence](adrs/adr-001.md)
- [ADR-004: Senha gerida pelo supervisor](adrs/adr-004.md)
- [ADR-006: Retenção da foto](adrs/adr-006.md)

## Deliverables
- As extensões nas telas de entregas.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-121, UT-122 — pacotes do distrito, com origem e foto excluída
- [x] UT-123, UT-124 — quadro, com transferências e pendências

## Success Criteria
- Every assigned test case implemented and passing
- `npm run lint` e `npm run build` passam no frontend
