---
status: pending
title: "Prosio: roteamento por unidade em tenant compartilhado (P1–P3)"
type: backend
complexity: medium
---

# Task 8: Prosio: roteamento por unidade em tenant compartilhado (P1–P3)

## Overview
Trabalho no repositório **`/root/dev/prosio`** (não no correios-entregas). Ele permite que várias unidades dos Correios compartilhem um tenant do Prosio sem que um supervisor veja as conversas de outra unidade:
- mensagens e casos passam a aceitar uma `unidadeRef`;
- o espelhamento no Chatwoot escolhe a inbox pela unidade;
- a sessão de login único adiciona o agente só à inbox da unidade dele.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST trabalhar num branch próprio no repositório do Prosio a partir do `develop` atualizado, sem tocar no módulo de mediação além do campo de contrato (a ligação da mediação está sendo feita em outra sessão, e conflitos lá devem ser evitados).
- **P1:**
  - MUST aceitar `unidadeRef?: string` (1..64, `[A-Za-z0-9_-]`) em `MessagingSendRequestSchema` e `MediationOpenCaseRequestSchema` (`packages/contracts`), sem quebrar o `strictObject`;
  - MUST gravar a `unidadeRef` na `Conversation` criada ou reutilizada (migration Prisma nova, coluna nula).
- **P2:**
  - MUST adicionar `Tenant.chatwootInboxesPorUnidade Json @default("{}")`;
  - MUST fazer o `chatwoot-mirror-consumer` escolher a inbox pela `unidadeRef` da conversa, com retorno à `chatwootInboxId` padrão quando não houver mapeamento.
- **P3:**
  - MUST aceitar `unidadeRef?` em `POST /api/v1/atendimento/sessoes`. Com ela, o agente é adicionado só à inbox mapeada. `papel: 'administrador'` sem `unidadeRef` entra em todas as inboxes do mapa e na padrão.
  - MUST expor o mapa `chatwootInboxesPorUnidade` na superfície admin do tenant existente, se houver endpoint de configuração do tenant; senão, documentar a configuração por script de operação.
- MUST respeitar as regras do repositório do Prosio: RLS com `WITH CHECK`, `withTenant`, testes de integração que só rodam na rede docker. Seguir o CLAUDE.md do Prosio.
- MUST atualizar `apps/api/openapi.public.json` com os campos novos.
- MUST NOT fazer deploy nem promover para produção. Ao final, abrir PR no Prosio para revisão.
</requirements>

## Subtasks
- [ ] 8.1 Criar o branch no Prosio e a migration das colunas novas (`Conversation.unidadeRef`, `Tenant.chatwootInboxesPorUnidade`).
- [ ] 8.2 Aceitar e propagar `unidadeRef` na API de mensagens e na abertura de caso de mediação.
- [ ] 8.3 Escolher a inbox do espelhamento no Chatwoot pela unidade da conversa.
- [ ] 8.4 Restringir o login único do atendimento à inbox da unidade.
- [ ] 8.5 Atualizar a especificação pública (OpenAPI) e a configuração do mapa por tenant.
- [ ] 8.6 Abrir o PR no Prosio.

## Implementation Details
Ver TechSpec: "Integration Points › Prosio — roteamento por unidade em tenant compartilhado (P1–P3)" e ADR-012.

### Relevant Files
- `/root/dev/prosio/packages/contracts/src/messaging.ts` (:30) — `MessagingSendRequestSchema`.
- `/root/dev/prosio/packages/contracts/src/mediation.ts` (:471) — `MediationOpenCaseRequestSchema`.
- `/root/dev/prosio/packages/prisma/schema.prisma` — `Tenant` (:93, `chatwootInboxId` :150) e `Conversation`.
- `/root/dev/prosio/apps/worker/src/modules/chatwoot-mirror-consumer/consumer.ts` (:158–175) — escolha da inbox hoje fixa.
- `/root/dev/prosio/apps/api/src/modules/handoff/chatwoot-conversation.ts` (:77) — `teamId` e inbox na criação da conversa.
- `/root/dev/prosio/apps/api/src/modules/atendimento/sso.ts` (:81) e as rotas `/api/v1/atendimento` (`app.ts` :1064–1092) — sessão de login único.
- `/root/dev/prosio/apps/worker/src/modules/whatsapp-outbound-consumer/consumer.ts` — criação e reuso de `Conversation` no envio.
- `/root/dev/prosio/apps/api/openapi.public.json` — especificação pública.

### Dependent Files
- correios-entregas task_02 e task_06 enviam `unidadeRef` (campo opcional; funcionam sem ele em canal exclusivo).

### Related ADRs
- [ADR-012: Topologia mista no Prosio](../adrs/adr-012.md) — motivo e contrato P1–P3.
- [ADR-006: Atendimento no Chatwoot](../adrs/adr-006.md) — isolamento por unidade.

## Deliverables
- Branch e PR no repositório do Prosio com P1–P3.
- Migration aplicável e especificação pública atualizada.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] IT-058 — `unidadeRef` gravado na conversa e inboxes distintas por unidade
- [ ] IT-059 — espelhamento pela inbox da unidade, com inbox padrão como alternativa
- [ ] IT-060 — sessão de atendimento restrita à inbox da unidade

## Success Criteria
- Every assigned test case implemented and passing
- Typecheck e as suítes existentes do Prosio continuam verdes.
- Tenants sem mapa continuam funcionando exatamente como antes.
