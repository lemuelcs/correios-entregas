---
status: completed
title: Módulo de captura no backend
type: backend
complexity: high
---

# Task 2: Módulo de captura no backend

## Overview

Esta tarefa entrega o servidor da captura de ponta a ponta:
- recebe a foto e os códigos lidos no aparelho;
- consulta o CEP e extrai os campos livres com o LLM;
- concilia com o `PacoteDia` da carga do distrito do monitoramento ("foto vence", "ausência não apaga", transferência, desfazer, remoção), registrando cada mudança em `EventoPacote` e chamando o gancho de aviso do monitoramento quando a carga já foi liberada (ADR-014);
- guarda a foto com retenção automática.

É o coração da feature: todas as regras de negócio da captura vivem aqui.

**Pré-requisito entre workflows**: a task **04 de `monitoramento-entregas-whatsapp`** mergeada (módulo `entregas`, `escopo.ts` e a interface `aoAdicionarPacotesEmCargaLiberada`). Verifique no início e pare se faltar.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST implementar `CepService` (ViaCEP, com fallback CWS só quando configurado, cache Redis com 30 dias para encontrado e 1 dia para não encontrado, timeout de 3 s, e Redis indisponível sem falhar), conforme a ADR-009.
- MUST implementar `LabelExtractor` com `GeminiLabelExtractor` (AI SDK `generateObject`, schema com `{valor, duvida, motivo}` por campo, timeout de 15 s, pós-validação que força dúvida) e `FakeLabelExtractor`, selecionados por `CAPTURA_AI_PROVIDER`; MUST pedir ao LLM só os campos que o DataMatrix não cobriu.
- MUST implementar `PhotoStore` com `DiskPhotoStore` (`FOTOS_DIR`, recusa de chave com `..`) e o volume `correios_fotos` no `docker-compose.yml`.
- MUST implementar `montarCampos` (precedência DataMatrix > linear > LLM, CEP para rua, bairro, cidade e UF) e `avaliarMinimo` como funções puras.
- MUST implementar `ConciliacaoService.aplicar` com as regras 0–5 de TechSpec › Core Interfaces sobre `CargaDistrito`/`PacoteDia`: em transação, com a escrita de `EventoPacote` na mesma transação, a checagem otimista de transferência (409 `transferencia_concorrente`), o snapshot `pacoteAntes` e o `status` inicial (SEM_WHATSAPP/AGUARDANDO_LIBERACAO).
- MUST chamar `aoAdicionarPacotesEmCargaLiberada(avisar)` do monitoramento SOMENTE após o commit; uma falha do gancho não desfaz a captura (log + métrica `captura_gancho_aviso_falhas_total`).
- MUST implementar `desfazer` e `remover` (remoção pelo carteiro com as regras da US-017; `remover` também é usado pelo supervisor na task_03), com a exclusão imediata da foto.
- MUST implementar `CapturaService.processar` idempotente por `capturaId` (reenvio devolve o mesmo resultado; 409 `captura_em_processamento`; reprocessa PROCESSANDO com mais de 2 min).
- MUST expor todas as rotas `/api/v1/captura` de TechSpec › API Endpoints (Carteiro), com `authenticate`, `requireRole('CARTEIRO')` e `requireSenhaDefinitiva`, multer em memória (≤2 MB, magic bytes JPEG) e códigos de erro estáveis em `details.code`.
- MUST implementar o worker `foto-retencao` (BullMQ repetível às 03:00 America/Sao_Paulo), registrado em `workers/index.ts`. Expiração: `PacoteDia.data + FOTO_RETENCAO_DIAS_APOS_FIM` (30); captura sem pacote: `FOTO_RETENCAO_MAX_DIAS` (90) contados da captura.
- MUST registrar as métricas de TechSpec › Monitoring e NUNCA logar nome, telefone, endereço, bytes da foto ou texto do LLM.
- SHOULD validar cedo a compatibilidade ESM do AI SDK com o Jest (risco em TechSpec › Known Risks).
</requirements>

## Subtasks
- [x] 2.1 Consulta de CEP com fallback e cache.
- [x] 2.2 Extrator de rótulo (Gemini e fake) com dúvida por campo.
- [x] 2.3 Armazenamento de fotos em disco e volume no compose.
- [x] 2.4 Montagem de campos por fonte e avaliação do mínimo.
- [x] 2.5 Conciliação com a lista (criar, atualizar, transferir), outbox, desfazer e remover.
- [x] 2.6 Processamento idempotente da captura e rotas `/captura` (hoje, capturas, conferir, confirmar, descartar, desfazer, pacotes, cep, foto, ativo).
- [x] 2.7 Job diário de retenção das fotos.
- [x] 2.8 Métricas e logs sem dado pessoal; variáveis novas no compose e no `.env.example`.
- [x] 2.9 Todos os testes atribuídos passando.

## Implementation Details

Os padrões estão em TechSpec › Component Overview (Backend), Core Interfaces (as regras normativas de `Conciliacao.aplicar`), API Endpoints, Integration Points e Monitoring. Arquivos novos ficam em `backend/src/modules/captura/`: `captura.routes.ts`, `captura.controller.ts`, `captura.service.ts`, `conciliacao.service.ts`, `cep.service.ts`, `extraction.service.ts`, `photo-store.ts` e `captura.types.ts`. O worker fica em `backend/src/workers/foto-retencao.worker.ts`. A montagem das rotas vai em `backend/src/app.ts`.

### Relevant Files
- `backend/src/app.ts` — montagem de `/api/v1/*` (:53-67).
- `backend/src/queue.ts`, `backend/src/workers/index.ts` — o padrão BullMQ e o registro de workers.
- `backend/src/workers/geocoder.worker.ts` — o uso existente de `VIACEP_URL`.
- `backend/src/integrations/correios-cws/cws.client.ts` — `buscarCep` (:119) e `CepResponse` em `cws.types.ts`.
- `backend/src/shared/utils/redis.ts` — o ioredis genérico, para o cache.
- `backend/src/shared/utils/logger.ts` — o logger.
- `backend/src/shared/middleware/metrics.middleware.ts` — prom-client.
- `backend/src/modules/carteiro/carteiro.controller.ts` — `resolveCarteiroId` (:52-62).
- `/root/dev/prosio/apps/api/src/modules/ai-engine/ocr-extraction.ts` — referência de `generateObject` com schema zod.
- `docker-compose.yml` — o volume e as variáveis `CAPTURA_AI_*` e `FOTO_*`.

### Dependent Files
- `backend/package.json` — adiciona `ai` e `@ai-sdk/google`.
- `backend/src/modules/captura/captura-supervisao.routes.ts` — reutiliza `ConciliacaoService.remover`, `PhotoStore` e os eventos (task_03).
- `backend/src/modules/entregas/*` (monitoramento) — o gancho `aoAdicionarPacotesEmCargaLiberada` é chamado daqui; não alterar a implementação dele.
- `frontend/src/features/captura/*` — consome as rotas (task_05).

### Related ADRs
- [ADR-001: Foto vence, dedup, transferência](adrs/adr-001.md) — as regras de conciliação.
- [ADR-002: Códigos de barras, CEP, revisão só com dúvida](adrs/adr-002.md) — o mínimo e a dúvida.
- [ADR-005: Pós-liberação, reaviso e correção](adrs/adr-005.md) — `distritoLiberado` e a remoção.
- [ADR-006: Retenção da foto](adrs/adr-006.md), [ADR-010: Disco + PhotoStore](adrs/adr-010.md)
- [ADR-014: Estender o núcleo do monitoramento e usar o gancho de aviso](adrs/adr-014.md), [ADR-008: Gemini flash-lite](adrs/adr-008.md), [ADR-009: ViaCEP + CWS](adrs/adr-009.md), [ADR-012: Síncrono e idempotente](adrs/adr-012.md)

## Deliverables
- O módulo `backend/src/modules/captura/` completo e montado em `/api/v1/captura`.
- O worker `foto-retencao` registrado.
- O volume de fotos e as variáveis novas no compose e no `.env.example`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-018, UT-019, UT-020, UT-021, UT-022, UT-023, UT-024, UT-025 — `montarCampos`
- [x] UT-026, UT-027, UT-028, UT-029, UT-030, UT-031, UT-032, UT-033, UT-126 — `avaliarMinimo`
- [x] UT-034, UT-035, UT-036, UT-037, UT-038, UT-039, UT-040, UT-041 — `CepService`
- [x] UT-042, UT-043, UT-044, UT-045, UT-046, UT-047 — `GeminiLabelExtractor`
- [x] UT-048, UT-049, UT-050, UT-051 — `DiskPhotoStore`
- [x] UT-052, UT-053, UT-054, UT-055 — cálculo de retenção
- [x] IT-001, IT-002, IT-004, IT-005, IT-006 — distrito do dia via `/captura/hoje`
- [x] IT-007, IT-008, IT-009, IT-010, IT-011, IT-012, IT-013, IT-014, IT-015, IT-016, IT-017, IT-018, IT-019, IT-020, IT-021, IT-022, IT-023, IT-024, IT-025, IT-026, IT-027, IT-028, IT-029, IT-030, IT-031, IT-032, IT-033, IT-034, IT-035, IT-036, IT-037, IT-038, IT-039 — captura, conciliação, conferência, CEP e planilha × foto
- [x] IT-040, IT-041 — senha temporária bloqueia `/captura` até a troca
- [x] IT-052, IT-053, IT-054, IT-055, IT-056, IT-057, IT-058, IT-059, IT-060, IT-061, IT-062, IT-063, IT-064, IT-065, IT-066, IT-067, IT-068, IT-069, IT-070, IT-071, IT-072, IT-073, IT-074, IT-075, IT-076 — troca de WhatsApp, transferência, idempotência, pós-liberação e correção pelo carteiro
- [x] IT-090, IT-091, IT-092, IT-093 — retenção e exclusão imediata
- [x] IT-094, IT-095, IT-096, IT-097, IT-098, IT-099, IT-100, IT-101, IT-102, IT-103, IT-104, IT-105 — falhas documentadas dos endpoints `/captura`
- [x] IT-109, IT-111 — eventos na transação, gancho só após o commit, e falha do gancho

## Success Criteria
- Every assigned test case implemented and passing
- `POST /api/v1/captura/capturas` com o fixture `rotulo-completo.jpg` e o extrator fake responde `SALVO` e grava exatamente um `EventoPacote` `CAPTURA_CRIADO`
- Nenhuma linha de log contém nome, telefone ou endereço do destinatário (verificado por teste que captura a saída do logger)
- `npm run lint` e `npm run build` passam no backend
