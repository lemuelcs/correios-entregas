---
status: pending
title: Telas da captura e E2E
type: frontend
complexity: high
---

# Task 5: Telas da captura e E2E

## Overview

Esta tarefa entrega o que o carteiro vê e toca:
- o início do distrito do dia, com os contadores e os recentes;
- a câmera com moldura, a digitação de código e o aviso "Salvo · desfazer";
- a lista Para conferir e a tela "Confira os dados";
- a edição e remoção de pacote.

Fecha também as três jornadas E2E com Playwright e o job na CI. Segue o protótipo `prototipo/AppCaptura.dc.html`.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar as rotas `/carteiro/captura/*` FORA do `CarteiroShell` (sem a moldura de celular nem a status bar falsa), em tela cheia real, com `useAuthGuard` para o papel CARTEIRO.
- MUST implementar `CapturaHomePage` conforme a US-003 (distrito, data, contador, "Fotografar rótulo", contadores Para conferir e Aguardando envio, recentes com os chips "Completo" e "Sem WhatsApp", indicador "Sem conexão", seletor quando há dois distritos, e o estado sem distrito).
- MUST implementar `CameraPage` (preview com moldura; disparo → foto parada comprimida para JPEG de 1600 px com qualidade 0,8 → `barcode.decode` → validação S10 → `captureQueue.add` → câmera pronta com "pacote N+1"; cancelar; digitar código; câmera negada), sem esperar a extração.
- MUST implementar o aviso "Pacote <código> salvo no <distrito> · desfazer", um por captura.
- MUST implementar `ConferirListPage` e `ConferirPage` ("Confira os dados": campos rotulados; destaque de dúvida com texto, não só cor; reconsulta de CEP; bloqueios de nome e endereço; WhatsApp em branco permitido; rascunho local; ver foto; "Refazer foto"; confirmação de transferência "Este pacote está no D-01 hoje. Trazer para o D-03?").
- MUST implementar `PacotePage` (editar; Remover só quando permitido; senão "Para remover, fale com o supervisor").
- MUST ter alvos de toque ≥44 px, contraste AA e campos com `<label>`.
- MUST suportar, só em build de teste, `?e2eImage=<fixture>` no `CameraPage` para substituir o `getUserMedia`.
- MUST acrescentar as três jornadas da captura à suíte Playwright do monitoramento (job `e2e-ui`, task_07 de lá), com backend em `CAPTURA_AI_PROVIDER=fake` e banco `_test` semeado; se o job ainda não existir, criá-lo nos mesmos moldes.
</requirements>

## Subtasks
- [ ] 5.1 Rotas e layout de tela cheia da captura.
- [ ] 5.2 Início do distrito do dia.
- [ ] 5.3 Câmera, digitação de código e enfileiramento.
- [ ] 5.4 Aviso de salvo com desfazer.
- [ ] 5.5 Lista Para conferir e tela de conferência, inclusive transferência.
- [ ] 5.6 Edição e remoção de pacote.
- [ ] 5.7 Acessibilidade conforme o PRD.
- [ ] 5.8 Suíte Playwright e job na CI.
- [ ] 5.9 Todos os testes atribuídos passando.

## Implementation Details

As páginas ficam em `frontend/src/features/captura/pages/` e o estado em `frontend/src/features/captura/captura.store.ts` (zustand). As rotas vão em `frontend/src/main.tsx`. Os padrões visuais estão no protótipo (`prototipo/AppCaptura.dc.html`) e em PRD › User Experience. Os endpoints estão em TechSpec › API Endpoints (Carteiro).

### Relevant Files
- `.compozy/tasks/app-carteiro-captura-rotulo/prototipo/AppCaptura.dc.html` — as telas de referência (início, câmera, conferência).
- `frontend/src/main.tsx` — as rotas `/carteiro` (:104-114).
- `frontend/src/features/carteiro/layout/CarteiroShell.tsx` — o shell com moldura falsa (NÃO usar).
- `frontend/src/shared/ui/` — AlertBanner, Badge, Panel.
- `frontend/src/features/captura/{captureQueue,captureSync,barcode}.ts` — task_04.
- `frontend/src/services/api.ts` — `postForm` (task_04).
- `.github/workflows/ci.yml` — o job de E2E.

### Dependent Files
- `frontend/package.json` — `@playwright/test`, script `test:e2e`.
- `.github/workflows/ci.yml` — o novo job.

### Related ADRs
- [ADR-002: Revisão só quando há dúvida](adrs/adr-002.md)
- [ADR-003: Captura sem sinal](adrs/adr-003.md)
- [ADR-005: Janela de correção](adrs/adr-005.md)
- [ADR-013: Playwright com rótulos de exemplo](adrs/adr-013.md)

## Deliverables
- As telas da captura em `/carteiro/captura`.
- A suíte Playwright com 3 jornadas e o job na CI.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-091, UT-092, UT-093, UT-094, UT-095, UT-096, UT-097, UT-098, UT-099, UT-100 — conferência
- [ ] UT-101, UT-102, UT-103, UT-104, UT-105 — início e aviso de salvo
- [ ] UT-106, UT-107, UT-108, UT-109, UT-110 — câmera
- [ ] UT-120 — `PacotePage`
- [ ] E2E-001 — captura na triagem, com login e troca de senha
- [ ] E2E-002 — conferência
- [ ] E2E-003 — sem sinal para online

## Success Criteria
- Every assigned test case implemented and passing
- As 3 jornadas E2E passam na CI
- `npm run lint` e `npm run build` passam no frontend
- Roteiro manual recomendado (fora do gate): instalar o PWA e capturar um rótulo real num Android e num iPhone
