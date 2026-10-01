---
status: completed
title: Liberação do distrito e avisos
type: backend
complexity: high
---

# Task 6: Liberação do distrito e avisos

## Overview
Fecha o fluxo do backend:
- liberação do distrito (idempotente, com adiamento noturno);
- `AvisoWorker`, que envia o aviso "saiu para entrega" com as opções e o resumo ao carteiro;
- abertura dos casos de mediação;
- aviso imediato para pacotes que entram numa carga já liberada;
- troca de carteiro depois da liberação.

Também entrega as quatro jornadas ponta a ponta de API, que só são possíveis com todo o backend pronto.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST implementar `POST /api/v1/entregas/cargas/:cargaId/liberar` (UNIDADE, com escopo):
  - bloqueios: sem carteiro (409 `sem_carteiro`), carga vazia (409 `carga_vazia`), unidade inativa (409 `unidade_inativa`), nenhum WhatsApp sem `confirmarSemAvisos` (409 `nenhum_destinatario`);
  - snapshot do carteiro e `liberadoEm`;
  - resposta `202 {avisosAgendados, semWhatsapp, agendadoPara?}`;
  - chamada repetida não gera avisos novos.
- MUST implementar o `AvisoWorker` (fila `entregas-aviso`):
  - um job por pacote com WhatsApp e não descadastrado (`jobId=aviso:<pacoteId>`);
  - adiamento para 06:05 (America/Sao_Paulo) quando liberado entre 0h e 6h;
  - `limiter` de 25/min por canal;
  - 5 tentativas com backoff exponencial, e depois `NAO_ENVIADO` com `falha_envio`;
  - reenfileiramento de 30 min para o limite do canal, até as 20h.
- MUST montar o texto e os botões do aviso: "Olá, <primeiro nome>, …", as opções omitidas quando a unidade não tem ponto ativo do tipo, a menção à orientação guardada, e os ids `CE_OP:<pacoteId>.<OPCAO>`. Nenhum link, pix ou pagamento. Reutilizar `textos.ts` da task_05.
- MUST enviar o resumo ao carteiro na liberação (`resumo:<cargaId>:<carteiroId>`), em blocos de 20 numerados e só quando houver orientações conhecidas. Carteiro sem WhatsApp → sem envio e com o sinal.
- MUST, com `mediacaoAtiva`, abrir um caso de mediação por pacote com WhatsApp e não descadastrado:
  - `externalRef=<codigo>@<data>`, `providerPhone` do carteiro do dia, `recipientPhone` do destinatário;
  - `resumo='<primeiro nome> · <endereço curto>'`, `respondBy` no fim do dia e `unidadeRef` quando o canal é compartilhado;
  - gravar `mediacaoCaseId`;
  - sinalizar `retido_consentimento` (`firstContact: 'blocked'`) e `caso_recusado:<motivo>` (422) sem interromper os avisos.
- MUST implementar os ganchos deixados pelas tasks 03 e 04:
  - `notificarTrocaCarteiro`: reenvia o resumo ao novo carteiro; orientações já criadas mantêm o carteiro antigo;
  - `aoAdicionarPacotesEmCargaLiberada`: avisos imediatos na confirmação e na edição de pacote.
- MUST escrever as jornadas E2E-001 a E2E-004 via supertest com os servidores falsos, passando só pela API pública e pelos webhooks e ações simulados.
</requirements>

## Subtasks
- [x] 6.1 Implementar a rota de liberação com bloqueios, snapshot e idempotência.
- [x] 6.2 Implementar o `AvisoWorker` (agendamento noturno, limitador, retries, reenfileiramento por limite do canal).
- [x] 6.3 Montar o texto e os botões do aviso.
- [x] 6.4 Enviar o resumo das orientações ao carteiro na liberação.
- [x] 6.5 Abrir os casos de mediação na liberação e tratar retenção e recusa.
- [x] 6.6 Implementar os ganchos de troca de carteiro e de pacote novo em carga liberada.
- [x] 6.7 Escrever as quatro jornadas E2E de API.

## Implementation Details
Novos arquivos em `backend/src/modules/entregas/`: `liberacao.service.ts`, `liberacao.controller.ts` e `aviso.builder.ts`. Worker em `backend/src/workers/entregas-aviso.worker.ts`, fila em `backend/src/queue.ts`. As jornadas ficam em `backend/src/__tests__/e2e/`. Ver TechSpec: "Component Overview" (fluxo principal), "API Endpoints › Carga (liberar)", "Integration Points › API de mensagens e mediação" e "Development Sequencing" (passos 8 e 15).

### Relevant Files
- `backend/src/queue.ts`, `backend/src/workers/index.ts`, `backend/src/workers/vroom.worker.ts` — padrão de fila, worker e `start`/`stop`.
- `backend/src/modules/entregas/textos.ts`, `orientacao.service.ts` (task_05) — textos e envio ao carteiro.
- `backend/src/modules/entregas/carga.service.ts`, `status.ts` (task_04) — ganchos e derivação de status.
- `backend/src/modules/entregas/cadastro.service.ts` (task_03) — gancho de troca de carteiro e dados da escala.
- `backend/src/integrations/prosio/*` (task_02) — `enviarMensagem`, `abrirCaso` e servidor falso.

### Dependent Files
- `backend/src/modules/entregas/carga.service.ts` e `cadastro.service.ts` — recebem a implementação dos ganchos.
- A task_07 usa a liberação e o status dos avisos no quadro.

### Related ADRs
- [ADR-011: Integração híbrida com o Prosio](../adrs/adr-011.md) — aviso por botões, caso por pacote.
- [ADR-012: Topologia mista no Prosio](../adrs/adr-012.md) — canal por unidade e `unidadeRef`.
- [ADR-002: Canal por unidade](../adrs/adr-002.md) — o texto já nasce no formato de modelo.
- [ADR-001: Direção do produto](../adrs/adr-001.md) — liberação como gatilho, sem link.

## Deliverables
- Liberação, `AvisoWorker`, resumo ao carteiro, abertura de casos e os ganchos implementados.
- Jornadas E2E de API passando.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-041, UT-042, UT-043, UT-044, UT-045 — texto e botões do aviso, ausência de link e pagamento
- [x] UT-046, UT-047, UT-048 — agendamento noturno e ids idempotentes
- [x] UT-083 — resumo ao carteiro em blocos de 20
- [x] UT-097 — `externalRef` do caso por código e dia
- [x] IT-014 — troca de carteiro depois da liberação
- [x] IT-024, IT-025, IT-026, IT-027, IT-028, IT-029, IT-030 — liberação e envio (idempotência, bloqueios, noite, limite, falha, descadastro)
- [x] IT-031, IT-032 — pacote novo e WhatsApp adicionado em carga liberada
- [x] IT-054, IT-055 — resumo ao carteiro e carteiro sem WhatsApp
- [x] IT-057, IT-070, IT-071, IT-072 — casos de mediação (abertura, descadastrado, retenção, recusa)
- [x] IT-073 — liberação sem nenhum WhatsApp
- [x] E2E-001, E2E-002, E2E-003, E2E-004 — jornadas de API

## Success Criteria
- Every assigned test case implemented and passing
- Um distrito de 150 pacotes tem todos os avisos entregues ao Prosio falso em até 10 min de relógio simulado.
- Liberar duas vezes nunca duplica mensagens nem casos.
