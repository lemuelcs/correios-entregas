---
status: completed
title: Orientações, entrada do Prosio e rastreio
type: backend
complexity: critical
---

# Task 5: Orientações, entrada do Prosio e rastreio

## Overview
Entrega o núcleo reativo do fluxo:
- a máquina de estados da orientação, com a mensagem ao carteiro e as respostas Vi, Feito e Não foi possível;
- a entrada do Prosio: o webhook assinado de status e de `mediation.outcome`/`mediation.escalated`, e as ações de botão `CE_OP`, `CE_PT`, `CE_SN` e `CE_CT`;
- a regra de resposta tardia pelo rastreio;
- o worker de rastreio adaptativo;
- a orientação manual do supervisor.

É onde a escolha do destinatário vira instrução ao carteiro.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST implementar o `OrientacaoService` de "Core Interfaces":
  - estados e transições de "Business Rules › Orientação" do PRD;
  - uma única orientação vigente por código (a anterior vira `SUBSTITUIDA`, e o carteiro recebe "ATUALIZADA:");
  - `GUARDADA` com `valeAPartirDe` = próximo dia de entrega (segunda a sexta);
  - texto de no máximo 300 caracteres, com truncamento e reticências no desfecho;
  - remoção de CPF e telefone do texto ao carteiro;
  - bloqueio para pacote `ENTREGUE`.
- MUST enviar a orientação ao carteiro do distrito pelo `ProsioClient` com botões `CE_CT:<orientacaoId>.VI|FEITO|NAO`, `Idempotency-Key=orient:<id>` e `reference=o:<id>`. Carteiro sem WhatsApp → sinal `nao_entregue_carteiro`, sem chamada ao Prosio.
- MUST montar o roteador `POST /api/v1/entregas/prosio/:canalId/webhook` com `express.raw` (256 kb) ANTES do `express.json()` global em `app.ts`:
  - verifica a assinatura com o `callbackSecret` do canal;
  - identifica status de mensagem, `mediation.outcome` e `mediation.escalated` (R7);
  - é idempotente via `WebhookRecebido`;
  - responde 204, ou 401 quando a assinatura é inválida.
- MUST aplicar o status de mensagem ao pacote (`reference` = pacoteId) usando `avancarStatusPacote` da task_04: `sent`/`read`/`failed` com motivo e reenfileiramento de limite do canal. Também deve gravar `recipientOptOut` em `DescadastroWhatsapp`.
- MUST mapear `mediation.outcome` para `NovaOrientacao` (tabela de "Integration Points › mediação" do TechSpec) e ignorar desfecho de pacote `ENTREGUE`. `disposition: 'proposto'` → evento e `escalonado`. `mediation.escalated` → `escalonado: true`.
- MUST montar `POST /api/v1/entregas/prosio/:canalId/acao/:prefixo`:
  - autenticação por `Bearer` comparada ao hash do token de entrada do canal;
  - corpo `{acao}` e header `x-actor-phone`;
  - resposta sempre `200 {mensagem}` para regras de negócio, e 401 só para autenticação;
  - telefone divergente → mensagem neutra, sem efeito.
- MUST implementar os quatro prefixos com as regras de `_tests.md`:
  - **`CE_OP`:** amanhã; agência ou locker com sub-lista `CE_PT` ou confirmação direta quando há um só ponto; vizinho e outra opção atualizam os fatos do caso (`atualizarFatosCaso`) quando `mediacaoAtiva`, e sem ela vão para o atendimento humano; limite de 2 insucessos anteriores → escalonamento.
  - **`CE_PT`:** ponto inativo → nova sub-lista.
  - **`CE_SN`:** confirmação "vale para amanhã" e confirmação de ponto único.
  - **`CE_CT`:** Vi, Feito, Não foi possível com os motivos por botões; `FECHADO` num locker avisa o destinatário e escalona; "Feito" contra rastreio de insucesso → divergência.
- MUST aplicar a regra de resposta tardia: consulta síncrona ao `RastreioClient` (3 s); se falhar, usar a última resposta do carteiro; divergência entre rastreio e carteiro → transferência.
- MUST implementar `POST /api/v1/entregas/pacotes/:id/orientacao` (orientação manual, `origem SUPERVISOR`, opção "vale para amanhã").
- MUST implementar o `RastreioWorker` (fila `entregas-rastreio`, registrado em `workers/index.ts`):
  - job repetido de hora em hora das 7h às 20h (America/Sao_Paulo) só para pacotes `LIDO` ou `INTERAGINDO` de cargas liberadas do dia;
  - varredura às 20h de todos os que ainda não chegaram a um estado final;
  - `ENTREGUE` cancela o caso de mediação aberto (`cancelarCaso`).
- MUST limitar a taxa das rotas `prosio/*` com um limitador próprio, fora do `authenticate`.
</requirements>

## Subtasks
- [x] 5.1 Implementar o `OrientacaoService` (estados, substituição, guarda, envio ao carteiro, respostas do carteiro, calendário de dias de entrega).
- [x] 5.2 Montar o roteador de entrada do Prosio com corpo cru e verificação de assinatura, antes do JSON global.
- [x] 5.3 Aplicar os callbacks de status de mensagem e de descadastro aos pacotes.
- [x] 5.4 Mapear `mediation.outcome` e `mediation.escalated` para orientações e sinais.
- [x] 5.5 Implementar a autenticação por token de entrada e as ações `CE_OP`, `CE_PT`, `CE_SN` e `CE_CT`.
- [x] 5.6 Implementar a regra de resposta tardia com consulta ao rastreio e alternativa pelo carteiro.
- [x] 5.7 Implementar a orientação manual do supervisor.
- [x] 5.8 Implementar o `RastreioWorker` adaptativo e o cancelamento do caso em `ENTREGUE`.
- [x] 5.9 Adicionar logs estruturados (telefone mascarado) e as métricas de "Monitoring and Observability".

## Implementation Details
Novos arquivos em `backend/src/modules/entregas/`:
- `orientacao.service.ts`, `calendario.ts`, `desfecho.mapper.ts`;
- `prosio-entrada.routes.ts`, `prosio-entrada.controller.ts`, `acoes.service.ts`;
- `textos.ts` (mensagens ao destinatário e ao carteiro, sem link, pagamento ou pix).

O worker fica em `backend/src/workers/entregas-rastreio.worker.ts`, e a fila é registrada em `backend/src/queue.ts`. Ver TechSpec: "Core Interfaces", "API Endpoints › Entrada do Prosio", "Integration Points" e ADR-014.

### Relevant Files
- `backend/src/app.ts` (:27–34) — ordem dos middlewares: helmet → cors → `express.json()` → métricas. O roteador `prosio` com `express.raw` precisa entrar antes do JSON.
- `backend/src/queue.ts`, `backend/src/workers/index.ts`, `backend/src/server.ts` (:11–18) — padrão de filas e workers no processo da API.
- `backend/src/shared/middleware/rate-limit.middleware.ts` — `express-rate-limit` existente.
- `backend/src/shared/utils/logger.ts` — logger com assinatura `(data, msg)`.
- `backend/src/integrations/prosio/*`, `backend/src/integrations/seu-rastreio/*` (task_02) — clientes, assinatura e servidores falsos.
- `backend/src/modules/entregas/status.ts`, `escopo.ts`, `entregas.routes.ts` (task_04).
- `/root/dev/prosio/apps/api/src/modules/orchestrator/button-actions.ts` — contrato real da ação de botão (entrada única, `x-actor-phone`, resposta `mensagem`).

### Dependent Files
- `backend/src/app.ts` — monta o roteador de entrada.
- A task_06 reutiliza `textos.ts`, o `OrientacaoService` (resumo e reaplicação) e o envio ao carteiro.
- A task_07 exibe orientação, sinais e escalonamento na lista de pacotes.

### Related ADRs
- [ADR-011: Integração híbrida com o Prosio](../adrs/adr-011.md) — botões para o estruturado, mediação para o livre.
- [ADR-014: Entrada do Prosio](../adrs/adr-014.md) — webhook HMAC e ações por token.
- [ADR-005: Resposta tardia](../adrs/adr-005.md) e [ADR-016](../adrs/adr-016.md) — rastreio sob demanda e adaptativo.
- [ADR-004: "Outra opção" com IA](../adrs/adr-004.md) e [ADR-008](../adrs/adr-008.md) — desfecho mediado vira orientação.

## Deliverables
- `OrientacaoService`, entrada do Prosio (webhook + 4 ações), orientação manual e `RastreioWorker`.
- Mensagens ao destinatário e ao carteiro centralizadas em `textos.ts`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-049, UT-050, UT-051, UT-052, UT-053, UT-054, UT-055, UT-056, UT-057, UT-058, UT-059, UT-060 — OrientacaoService
- [x] UT-091, UT-092, UT-093, UT-094, UT-095, UT-096 — orientação: pontos, guarda, remoção de dados, locker, truncamento
- [x] UT-061, UT-062 — calendário de dias de entrega
- [x] UT-063, UT-064, UT-065, UT-066, UT-067, UT-068, UT-069, UT-070 — decisões das ações de botão e resposta tardia
- [x] UT-071, UT-072, UT-073, UT-074 — mapeamento do desfecho da mediação
- [x] UT-099 — seleção adaptativa do rastreio
- [x] IT-033, IT-034 — webhook de status e descadastro
- [x] IT-035, IT-036, IT-037, IT-038, IT-039, IT-040, IT-041, IT-042 — ações de botão
- [x] IT-043, IT-044, IT-065, IT-066 — desfecho e escalonamento da mediação
- [x] IT-045 (withdrawn; nada a implementar)
- [x] IT-046 — orientação manual
- [x] IT-047 — `RastreioWorker`
- [x] IT-051 — ordem dos middlewares (corpo cru e JSON)
- [x] IT-056 — rastreio "entregue" cancela o caso
- [x] IT-064, IT-067, IT-068, IT-069 — limite de tentativas, ponto único, sub-lista antiga, ordem das orientações

## Success Criteria
- Every assigned test case implemented and passing
- p95 da rota de ação abaixo de 4 s com o rastreio falso respondendo em 3 s (o limite de tempo funciona).
- Nenhuma mensagem gerada contém `http`, `pix` ou `pagamento`.
- Callback repetido nunca gera efeito duplicado.
