---
status: pending
title: Telas do supervisor
type: frontend
complexity: medium
---

# Task 6: Telas do supervisor

## Overview

Esta tarefa entrega as telas do supervisor, na área da unidade:
- os distritos do dia, com as pendências de conferência e as transferências;
- a lista de pacotes do distrito, com a origem, o selo "código digitado", o histórico de sobrescritas e a foto do rótulo;
- a remoção de pacote;
- a definição e redefinição da senha do carteiro.

É a visão que o monitoramento vai depois expandir.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar `DistritosDiaPage` (data selecionável; por distrito: carteiro do dia, status, contagens, "N para conferir no app do carteiro" quando N>0, e as transferências de entrada e saída com código, carteiro e hora; designação do carteiro do dia).
- MUST criar `DistritoPacotesPage` (os chips de origem "Planilha", "Foto" e "Planilha + foto"; o selo "código digitado"; o histórico com os valores antes e depois; a foto do rótulo; "Foto excluída em DD/MM (prazo de retenção)" no 410; e Remover com confirmação).
- MUST adicionar o cadastro mínimo de distritos (código, nome, carteiro padrão).
- MUST adicionar a ação "Definir senha" ao cadastro de carteiros existente (`CadastrosConfigPage section="carteiros"`).
- MUST montar as rotas dentro do `UnidadeShell` existente, em `/unidade/captura/*`, com um item no menu da unidade.
- SHOULD seguir o visual dos artboards "Distrito D-01 — pacotes" e "Carregar pacotes do distrito" do protótipo.
</requirements>

## Subtasks
- [ ] 6.1 Rotas e item de menu na área da unidade.
- [ ] 6.2 Distritos do dia, com pendências, transferências e designação.
- [ ] 6.3 Pacotes do distrito, com origem, histórico, foto e remoção.
- [ ] 6.4 Cadastro mínimo de distritos.
- [ ] 6.5 Senha do carteiro no cadastro existente.
- [ ] 6.6 Todos os testes atribuídos passando.

## Implementation Details

As páginas ficam em `frontend/src/features/supervisao-captura/pages/` e a store em `frontend/src/features/supervisao-captura/supervisao.store.ts`. A API está em TechSpec › API Endpoints (Supervisor), implementada na task_03.

### Relevant Files
- `frontend/src/features/unidade/layout/UnidadeShell.tsx`, `frontend/src/features/unidade/unidade.config.ts` — o shell e o menu da unidade.
- `frontend/src/main.tsx` — as rotas da unidade e `CadastrosConfigPage section="carteiros"` (:86).
- `frontend/src/shared/ui/` — Badge, Panel e AlertBanner.
- `.compozy/tasks/app-carteiro-captura-rotulo/prototipo/Distrito.dc.html`, `prototipo/Upload.dc.html` — o visual de referência.
- `frontend/src/services/api.ts` — o cliente (task_04).

### Dependent Files
- `frontend/src/features/unidade/unidade.config.ts` — o novo item de menu.

### Related ADRs
- [ADR-001: Transferência e foto vence](adrs/adr-001.md)
- [ADR-004: Senha gerida pelo supervisor](adrs/adr-004.md)
- [ADR-006: Retenção da foto](adrs/adr-006.md)

## Deliverables
- As telas do supervisor em `/unidade/captura/*` e a senha do carteiro no cadastro.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-121, UT-122 — pacotes do distrito, com origem e foto excluída
- [ ] UT-123, UT-124 — quadro do dia, com transferências e pendências

## Success Criteria
- Every assigned test case implemented and passing
- `npm run lint` e `npm run build` passam no frontend
