---
status: pending
title: Fundação do app no aparelho
type: frontend
complexity: high
---

# Task 4: Fundação do app no aparelho

## Overview

Esta tarefa entrega a infraestrutura do app do carteiro no navegador, sem telas de captura:
- o cliente de API com multipart e refresh rotativo;
- o login com a troca de senha obrigatória;
- a fila offline persistente e o sincronizador;
- a leitura dos três códigos com zxing-wasm;
- a instalação como PWA;
- a infraestrutura de testes do frontend, que hoje não existe.

Roda em paralelo com a task_02 contra o contrato da TechSpec.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST configurar Vitest + Testing Library + jsdom + `fake-indexeddb` no frontend, com o script `test` integrado ao `npm test` da raiz (turbo), reaproveitando a configuração se o monitoramento já tiver criado uma.
- MUST garantir o envio de `FormData` no `services/api.ts` sem fixar o Content-Type JSON (reutilizar o do monitoramento, task_07 de lá, se já existir; senão, adicionar) e gravar o `refreshToken` rotacionado; dois 401 simultâneos MUST gerar um único refresh; uma falha de refresh MUST NOT tocar o IndexedDB da fila.
- MUST implementar o fluxo de senha temporária no login (a tela "Crie sua senha" chamando `POST /auth/trocar-senha`, depois `/carteiro/captura`), com a validação de campos vazios e a mensagem de primeiro acesso offline; MUST fazer o papel CARTEIRO ir para `/carteiro/captura`, coordenando com o redirecionamento por papel que a task_07 do monitoramento põe no `LoginPage` (os demais papéis ficam como lá).
- MUST implementar `captureQueue` (IndexedDB via `idb`: stores `fila` e `recentes`, os estados da TechSpec, `QuotaExceededError` → evento `espaco_insuficiente`, e `navigator.storage.persist()` pedido).
- MUST implementar `captureSync` com envio em série por ordem de `capturadoEm`, os gatilhos `online`/`visibilitychange`/30 s, a política de retry da ADR-012 (409/408/429/rede → aguardando; 4xx definitivos → `falhou_definitivo`; 401 → pausa), e as operações enfileiradas de "desfazer".
- MUST implementar `barcode.decode(jpeg)` com zxing-wasm carregado sob demanda (Code 128 e DataMatrix), detectando múltiplos S10 distintos como `MultiplosRotulos`.
- MUST copiar para `frontend/src/features/captura/lib/` os módulos puros `s10.ts` e `telefone.ts` (do monitoramento) e `sigep-datamatrix.ts` (task_01 desta feature) sem alterar o comportamento.
- MUST configurar vite-plugin-pwa (manifest com `start_url=/carteiro/captura`, `scope=/carteiro/`, ícones reais; precache do shell e do WASM).
- MUST implementar o diálogo de saída com fila pendente.
- MUST consumir as fixtures de rótulo geradas pela task_01 em `backend/src/__tests__/fixtures/rotulos/` (não gerar outras).
</requirements>

## Subtasks
- [ ] 4.1 Infra de testes do frontend.
- [ ] 4.2 Cliente de API com multipart e refresh rotativo.
- [ ] 4.3 Login com troca de senha obrigatória e mensagens de erro.
- [ ] 4.4 Fila offline persistente.
- [ ] 4.5 Sincronizador com política de retry.
- [ ] 4.6 Leitura dos códigos com zxing-wasm e as cópias dos módulos puros.
- [ ] 4.7 Testes de decodificação sobre as fixtures da task_01.
- [ ] 4.8 PWA instalável (manifest, service worker, ícones).
- [ ] 4.9 Todos os testes atribuídos passando.

## Implementation Details

Os padrões estão em TechSpec › Component Overview (Aparelho), Core Interfaces (`CapturaLocal`) e ADR-012. O código novo fica em `frontend/src/features/captura/` (`captureQueue.ts`, `captureSync.ts`, `barcode.ts`, `lib/`). A troca de senha vai em `frontend/src/pages/LoginPage.tsx`, ou numa página nova ao lado.

### Relevant Files
- `frontend/src/services/api.ts` — o wrapper fetch com Content-Type fixo (:5) e o refresh (:37-63).
- `frontend/src/stores/auth.store.ts` — os tokens em localStorage.
- `frontend/src/hooks/useAuthGuard.ts` — o redirecionamento por papel.
- `frontend/src/pages/LoginPage.tsx` — a aba de matrícula.
- `frontend/vite.config.ts` — os plugins e o proxy.
- `frontend/public/manifest.json`, `frontend/index.html` — o manifest sem ícones.
- `frontend/package.json` — sem framework de teste.
- `backend/src/shared/utils/{s10,telefone}.ts` (monitoramento) e `sigep-datamatrix.ts` (task_01) — a origem das cópias.

### Dependent Files
- `frontend/src/features/captura/pages/*` — as telas da task_05 usam fila, sync e decode.
- `turbo.json`, `package.json` (raiz) — a tarefa `test` do frontend.

### Related ADRs
- [ADR-003: Captura sem sinal](adrs/adr-003.md) — a fila persistente.
- [ADR-004: PWA e matrícula+senha](adrs/adr-004.md)
- [ADR-011: zxing-wasm e DataMatrix](adrs/adr-011.md)
- [ADR-012: Síncrono e idempotente; a fila do aparelho é o retry](adrs/adr-012.md)
- [ADR-013: Vitest e fixtures](adrs/adr-013.md)

## Deliverables
- A infra de testes do frontend rodando em `npm test`.
- `api.ts` atualizado e o login com troca de senha.
- `captureQueue`, `captureSync`, `barcode` e `lib/` em `frontend/src/features/captura/`.
- O PWA configurado e as fixtures de rótulo.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-071, UT-072, UT-073, UT-074, UT-075, UT-076 — `captureQueue`
- [ ] UT-077, UT-078, UT-079, UT-080, UT-081, UT-082, UT-083, UT-084, UT-085 — `captureSync`
- [ ] UT-086, UT-087, UT-088, UT-089, UT-090 — `barcode.decode`
- [ ] UT-127 — cópia de `s10.ts` no aparelho
- [ ] UT-111, UT-112, UT-113, UT-114 — `api.ts`
- [ ] UT-115, UT-116, UT-117, UT-118, UT-119 — login, troca de senha e saída com fila

## Success Criteria
- Every assigned test case implemented and passing
- `npm run build` gera o service worker e o manifest com ícones; o Lighthouse "installable" passa no `vite preview`
- `npm run lint` passa no frontend
