---
status: completed
title: Frontend Entregas
type: frontend
complexity: high
---

# Task 7: Frontend Entregas

## Overview
Entrega a interface nova do correios-entregas, seguindo o protótipo validado (https://claude.ai/artifact/T3HneV28vRrr9cKPbTKbFV):
- o shell `/entregas/*` com o menu Monitoramento (Carregar Dados e Rotas "em breve"), Atendimento, Cadastro e SGPD v2;
- as páginas do quadro de distritos, do carregamento de pacotes, da lista de pacotes do distrito, do Cadastro e do Atendimento (Chatwoot em iframe);
- o redirecionamento por papel no login e a faixa "Protótipo" nas telas antigas.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar `frontend/src/features/entregas/` com:
  - `EntregasShell` (guarda de papel `UNIDADE` ou `GESTAO`; menu com subitens e recolhido em telas estreitas);
  - as páginas `CarregarDadosPage` (quadro), `CargaDistritoPage` (planilha ou colar, prévia, correção por linha, confirmação), `DistritoPacotesPage`, `CadastroPage` (abas Unidades e Supervisores só para a Gestão; Distritos, Carteiros, Agências e lockers; carteiro do dia), `AtendimentoPage` e `RotasEmBrevePage`.
- MUST registrar as rotas `/entregas/carregar`, `/entregas/carregar/:distritoId`, `/entregas/distritos/:cargaId`, `/entregas/cadastro`, `/entregas/atendimento` e `/entregas/rotas` em `main.tsx`, sem remover as rotas legadas.
- MUST mudar o `LoginPage`: `UNIDADE` → `/entregas/carregar`, `GESTAO` → `/entregas/cadastro`. Os papéis `CARTEIRO` e `DESTINATARIO` seguem para os shells legados.
- MUST levar "SGPD v2" a `/unidade` ou `/gestao` conforme o papel, e acrescentar aos shells legados `UnidadeShell` e `GestaoShell` a faixa fixa "Protótipo — dados de demonstração" e o link "Voltar aos módulos".
- MUST adicionar ao `services/api.ts` o envio de `FormData` (sem forçar `Content-Type` JSON). Os stores novos propagam erro e mostram toast; nenhum dado fictício de fallback.
- MUST fazer polling de 30 s no quadro e na lista de pacotes, pausado com a aba oculta (`visibilitychange`).
- MUST, no Atendimento, criar a sessão (`POST /entregas/atendimento/sessao`) e colocar a URL no `src` do iframe. Com 503 ou recusa de incorporação: "Atendimento indisponível no momento" e o botão "Abrir em nova aba", que gera uma nova sessão.
- MUST seguir o visual do protótipo: menu escuro, pílulas de status com as cores do protótipo, fonte Source Sans 3 e IBM Plex Mono nos códigos. As cores ficam como tokens `@theme` no `index.css`, sem apagar os existentes.
- MUST ser acessível: botões reais, rótulos nos campos, foco visível e alvos de pelo menos 44 px; sem rolagem horizontal em 390 px.
- MUST configurar o Playwright no frontend (Chromium) contra o backend em modo de teste com os servidores falsos, e criar o job `e2e-ui` no CI.
</requirements>

## Subtasks
- [x] 7.1 Suporte a `FormData` no cliente de API e os stores Zustand novos com propagação de erro e polling.
- [x] 7.2 `EntregasShell`, menu (com versão recolhida) e registro das rotas `/entregas/*`.
- [x] 7.3 Redirecionamento por papel no login e a faixa "Protótipo" nos shells legados.
- [x] 7.4 Página do quadro de distritos, com filtros, resumo e o diálogo de liberação.
- [x] 7.5 Página de carregamento de pacotes (planilha ou colar, prévia, correção, confirmação).
- [x] 7.6 Página da lista de pacotes do distrito, com filtros por status e sinalizações.
- [x] 7.7 Página de Cadastro com as abas por papel e o carteiro do dia.
- [x] 7.8 Página de Atendimento com iframe e alternativa "Abrir em nova aba"; página Rotas "em breve".
- [x] 7.9 Playwright configurado, as jornadas de interface e o job de CI.

## Implementation Details
Ver TechSpec: "Component Overview" (Frontend Entregas), "API Endpoints" e ADR-015. O protótipo tem as telas de referência (`Main`, `Upload`, `Distrito`, `Cadastro`, `Atendimento`, `Rotas`, `Sgpd`, `Sidebar`). Cópias locais de parte delas estão em `.compozy/tasks/app-carteiro-captura-rotulo/prototipo/`.

### Relevant Files
- `frontend/src/main.tsx` (:48–133) — roteador com shells aninhados.
- `frontend/src/pages/LoginPage.tsx` (:43–46) — redirecionamento por papel.
- `frontend/src/features/unidade/layout/UnidadeShell.tsx`, `UnidadeSidebar.tsx`, `frontend/src/features/gestao/layout/GestaoShell.tsx` — shells legados, que recebem a faixa.
- `frontend/src/hooks/useAuthGuard.ts` — guarda de um único papel; o shell novo aceita dois.
- `frontend/src/services/api.ts` — sem suporte a `FormData`, `BASE_URL='/api/v1'`, refresh em 401.
- `frontend/src/stores/*.store.ts` — padrão Zustand (os existentes engolem erro; os novos não).
- `frontend/src/shared/ui/` (`Panel`, `Badge`, `AlertBanner`, `KpiCard`, `ProgressBar`) — componentes reutilizáveis.
- `frontend/src/index.css` (:4–19) — tokens `@theme`.
- `frontend/vite.config.ts` — proxy de dev; atenção: `/api/v1/comunicacao` vai direto ao hub, e as rotas `/api/v1/entregas` precisam ir ao backend.

### Dependent Files
- `frontend/package.json` — `@playwright/test` e scripts.
- `.github/workflows/ci.yml` — job `e2e-ui`.

### Related ADRs
- [ADR-015: Shell Entregas com polling](../adrs/adr-015.md) — rotas, polling, legado.
- [ADR-009](../adrs/adr-009.md) e [ADR-010](../adrs/adr-010.md) — módulos, SGPD v2, Chatwoot em iframe.
- [ADR-017: Planilha no backend](../adrs/adr-017.md) — a prévia vem do servidor.

## Deliverables
- Área `/entregas/*` completa e navegável.
- Telas legadas com a faixa de protótipo e o caminho de volta.
- Playwright e o job `e2e-ui`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] E2E-005 — menu, Rotas em breve, SGPD v2 e volta
- [x] E2E-006 — carregamento de planilha e "28 de 37"
- [x] E2E-007 — diálogo de liberação e bloqueios
- [x] E2E-008 — Cadastro (distrito, carteiro, ponto)
- [x] E2E-009 — Atendimento em iframe e alternativa
- [x] E2E-010 — jornada da Gestão (canal, unidade, supervisor)
- [x] E2E-011 — tela de 390 px
- [x] E2E-012 — polling atualiza o quadro e a lista
- [x] E2E-013 — unidade sem distritos
- [x] E2E-014 — sessão expirada volta ao módulo
- [x] E2E-015 — papéis legados e favoritos antigos

## Success Criteria
- Every assigned test case implemented and passing
- `npm run build` e `tsc --noEmit` do frontend passam.
- Nenhuma tela nova usa dados fictícios.
- Sem rolagem horizontal a 390 px em todas as páginas novas.
