---
status: pending
title: Clientes Prosio e Seu Rastreio
type: backend
complexity: medium
---

# Task 2: Clientes Prosio e Seu Rastreio

## Overview
Cria as duas bordas externas da feature: o `ProsioClient` (API de mensagens, mediação e sessão de atendimento, com credenciais por `CanalProsio`) e o `RastreioClient` (Seu Rastreio com classificação de eventos). Também cria a verificação de HMAC dos callbacks e os servidores falsos que todas as tarefas de integração usam nos testes. Isolar essas bordas numa tarefa deixa cadastro, orientação e liberação avançarem contra um contrato estável.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST implementar a interface `ProsioClient` exatamente como em "Core Interfaces" do TechSpec: `enviarMensagem`, `abrirCaso`, `atualizarFatosCaso`, `cancelarCaso` e `criarSessaoAtendimento`.
- MUST resolver as credenciais a partir de um `CanalProsio` (apiKey e callbackSecret decifrados com `cripto.ts` da task_01) num tipo `CanalResolvido`, sem nunca registrar o segredo em log.
- MUST mandar `Authorization: Bearer <apiKey>` e `Idempotency-Key` quando informado, e mapear as respostas de erro para `ProsioError(status, code)`, marcando 429 e 5xx como tentáveis de novo e 4xx de validação como definitivos.
- MUST implementar `verificarAssinatura(corpoCru: Buffer, header: string, segredo: string): boolean` para o formato `sha256=<hex>`, com comparação em tempo constante e sem lançar exceção em entrada malformada.
- MUST implementar o `RastreioClient.consultar(codigo)` contra `GET https://seurastreio.com.br/api/public/rastreio/{codigo}` com `SEU_RASTREIO_TOKEN`, limite de 3 s e o formato de resposta `{status, eventoMaisRecente{data,local,destino,descricao}}`; e `classificarEvento(descricao)` → `'ENTREGUE' | 'INSUCESSO' | null`, com a lista de padrões versionada no código.
- MUST criar os servidores HTTP falsos `backend/src/__tests__/fakes/prosio.fake.ts` e `seu-rastreio.fake.ts`: sobem em porta aleatória, gravam as requisições, respondem conforme o roteiro do teste e sabem enviar callbacks assinados para uma URL.
- MUST NOT exigir `abrirCaso` ou `atualizarFatosCaso` do Prosio real nos testes: o contrato da mediação (R1–R7) é dependência externa; o falso implementa o formato previsto no TechSpec.
- SHOULD expor o `unidadeRef` opcional em `enviarMensagem`, `abrirCaso` e `criarSessaoAtendimento` (contrato P1–P3 da task_08).
</requirements>

## Subtasks
- [ ] 2.1 Resolver o canal (decifrar credenciais) e montar o cliente HTTP do Prosio com tempo limite e mapeamento de erros.
- [ ] 2.2 Implementar os métodos de mensagem, mediação e sessão de atendimento.
- [ ] 2.3 Implementar a verificação de assinatura HMAC dos callbacks.
- [ ] 2.4 Implementar o cliente do Seu Rastreio e a classificação dos eventos.
- [ ] 2.5 Criar os servidores falsos do Prosio e do Seu Rastreio para os testes de integração.

## Implementation Details
Arquivos novos em `backend/src/integrations/prosio/` (`prosio.client.ts`, `prosio.types.ts`, `assinatura.ts`) e `backend/src/integrations/seu-rastreio/` (`rastreio.client.ts`, `classificacao.ts`). Ver TechSpec: "Core Interfaces", "Integration Points" (as quatro subseções do Prosio e a do Seu Rastreio).

### Relevant Files
- `backend/src/integrations/correios-cws/cws.client.ts` — padrão de cliente HTTP existente (axios, 503 sem credencial).
- `backend/src/modules/communication/services/chatwoot/chatwoot-http.client.ts` — padrão de retry em 5xx e mapeamento para `AppError`.
- `backend/src/shared/middleware/error-handler.middleware.ts` — `AppError`.
- `backend/src/shared/utils/cripto.ts` (task_01) — decifra as credenciais.
- `/root/dev/prosio/packages/contracts/src/messaging.ts` (:30, :173) — formato de `POST /api/v1/messages` e do callback de status.
- `/root/dev/prosio/packages/contracts/src/mediation.ts` (:397, :471, :1129) — abertura de caso e callback `mediation.outcome`.
- `/root/dev/prosio/apps/api/src/modules/atendimento/` — `POST /api/v1/atendimento/sessoes` (`{usuario:{idExterno,nome,email,papel}, dominio?}` → `{url, expiraEm}`).

### Dependent Files
- task_03 (sessão de atendimento), task_05 (webhook, ações, rastreio) e task_06 (avisos, casos) consomem esses clientes e os servidores falsos.

### Related ADRs
- [ADR-011: Integração híbrida com o Prosio](../adrs/adr-011.md) — quais APIs do Prosio o cliente cobre.
- [ADR-014: Entrada do Prosio](../adrs/adr-014.md) — formato da assinatura.
- [ADR-016: Rastreio adaptativo e S10](../adrs/adr-016.md) — fonte do rastreio e classificação.

## Deliverables
- `ProsioClient`, `verificarAssinatura`, `RastreioClient` e `classificarEvento`.
- Servidores falsos reutilizáveis do Prosio e do Seu Rastreio.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-075, UT-076, UT-077 — verificação de HMAC
- [ ] UT-078, UT-079, UT-080 — classificação dos eventos do rastreio
- [ ] UT-086, UT-087, UT-088, UT-098 — ProsioClient: cabeçalhos, erros, abertura de caso, sessão indisponível

## Success Criteria
- Every assigned test case implemented and passing
- Nenhum segredo aparece em log (verificável por teste do logger).
- Os servidores falsos sobem e descem limpos em cada arquivo de teste, sem porta fixa.
