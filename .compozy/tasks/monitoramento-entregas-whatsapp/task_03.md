---
status: completed
title: Cadastro, Gestão estendida e Atendimento
type: backend
complexity: medium
---

# Task 3: Cadastro, Gestão estendida e Atendimento

## Overview
Entrega a API do módulo Cadastro e a do módulo Atendimento.

**Gestão (sede):** canais Prosio (credenciais cifradas e token de entrada), unidades com canal e mediação, e supervisores.

**Supervisor:** distritos, carteiros, carteiro do dia e pontos de retirada (agências e lockers), com escopo por unidade.

**Atendimento:** abre a sessão de login único do Chatwoot pelo Prosio e devolve a URL que o frontend coloca no iframe.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST implementar as rotas de cadastro de "API Endpoints" do TechSpec: `/api/v1/entregas/cadastro/{distritos,carteiros,pontos}` e `PUT /cadastro/distritos/:id/escala/:data`, mais a extensão de `/api/v1/gestao/unidades` e as rotas novas `/api/v1/gestao/canais-prosio`.
- MUST aplicar o escopo por unidade: `UNIDADE` só enxerga `req.user.unidadeId`, e recurso de outra unidade responde 404; `GESTAO` passa `?unidadeId=`. Usar o helper `escopo.ts` criado pela task_04 (onda anterior).
- MUST devolver o `tokenEntrada` do canal uma única vez, na criação, guardando só o hash sha256. `apiKey` e `callbackSecret` são cifrados e nunca voltam em GET.
- MUST validar as regras de negócio:
  - matrícula única entre `Usuario` e `Carteiro`;
  - WhatsApp de carteiro único e normalizado;
  - no máximo 10 pontos ativos por tipo e nome com até 24 caracteres;
  - código de distrito único por unidade;
  - bloqueio de desativação de distrito ou carteiro em operação hoje;
  - canal compatível e ativo;
  - `prosioUnidadeRef` obrigatório quando o canal é compartilhado.
- MUST implementar a concorrência otimista nos `PUT` de unidade (`atualizadoEm` → 409 `alterado_por_outro` com os dados atuais).
- MUST fazer o `authenticate` recusar usuário `ativo=false`, com cache de 60 s por usuário.
- MUST marcar `semSupervisor` na listagem de unidades da Gestão.
- MUST implementar `POST /api/v1/entregas/atendimento/sessao`:
  - GESTAO → `papel: 'administrador'`; UNIDADE → `agente`, com a `unidadeRef` quando o canal é compartilhado;
  - outros papéis → 403;
  - falha do Prosio → 503 `atendimento_indisponivel`.
- MUST NOT alterar o SSO antigo `/api/v1/comunicacao/chatwoot/sso` nem as rotas legadas.
- SHOULD, na troca de carteiro do dia de um distrito já liberado, chamar um gancho de reenvio de resumo exposto como interface (`notificarTrocaCarteiro`) com implementação vazia. A task_06 implementa o reenvio e o teste IT-014.
</requirements>

## Subtasks
- [x] 3.1 Registrar as rotas de cadastro e atendimento no roteador `entregas` (criado pela task_04), usando o helper de escopo.
- [x] 3.2 CRUD de canais Prosio na Gestão, com cifra e token de entrada.
- [x] 3.3 Estender o cadastro de unidades (canal, referência, mediação, concorrência otimista, sinal de sem supervisor) e validar supervisores.
- [x] 3.4 Fazer o `authenticate` recusar usuário desativado.
- [x] 3.5 CRUD de distritos, com paginação e busca.
- [x] 3.6 CRUD de carteiros e o carteiro do dia (escala).
- [x] 3.7 CRUD de pontos de retirada com os limites.
- [x] 3.8 Sessão de atendimento via `ProsioClient.criarSessaoAtendimento`.

## Implementation Details
Novos arquivos em `backend/src/modules/entregas/` (`cadastro.controller.ts`, `cadastro.service.ts`, `atendimento.controller.ts`, `atendimento.service.ts`, `cadastro.schemas.ts`); estende `entregas.routes.ts` (criado pela task_04). Extensões em `backend/src/modules/gestao/`. Ver TechSpec: "API Endpoints" (Cadastro e Atendimento), "Core Interfaces" (convenções de erro), "Integration Points › Chatwoot".

### Relevant Files
- `backend/src/modules/gestao/gestao.routes.ts`, `unidades-gestao.{controller,service}.ts`, `usuarios-gestao.{controller,service}.ts`, `gestao.schemas.ts` — padrão controller/service/zod a estender.
- `backend/src/shared/middleware/auth.middleware.ts` (:13, :30) — `authenticate`, `requireRole` e o payload `{sub, role, unidadeId}`.
- `backend/src/app.ts` (:53–66) — montagem das rotas `/api/v1/*`.
- `backend/src/integrations/prosio/prosio.client.ts` (task_02) — sessão de atendimento.
- `backend/src/shared/utils/telefone.ts`, `cripto.ts` (task_01).

### Dependent Files
- `backend/src/modules/entregas/entregas.routes.ts` — recebe as rotas de cadastro e atendimento.
- A task_06 implementa o gancho `notificarTrocaCarteiro`.
- task_07 consome essas rotas.

### Related ADRs
- [ADR-012: Topologia mista no Prosio](../adrs/adr-012.md) — canal exclusivo ou compartilhado, `prosioUnidadeRef`.
- [ADR-013: Modelo de dados e migrations](../adrs/adr-013.md) — `Carteiro` sem login.
- [ADR-006: Atendimento no Chatwoot](../adrs/adr-006.md) e [ADR-010](../adrs/adr-010.md) — login único, iframe, isolamento.
- [ADR-003: Estrutura operacional](../adrs/adr-003.md) — divisão dos cadastros entre sede e supervisor.

## Deliverables
- Rotas de cadastro e de atendimento funcionando com escopo por unidade.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-081, UT-082, UT-084, UT-085, UT-090 — validações de cadastro
- [x] UT-089 — papel e `unidadeRef` da sessão de atendimento
- [x] IT-001, IT-002, IT-003, IT-004, IT-005, IT-006 — canais, unidades, permissões, concorrência, unidade inativa, usuário desativado
- [x] IT-007, IT-008, IT-009, IT-010 — distritos
- [x] IT-011, IT-012, IT-013 — carteiros e escala
- [x] IT-015 — pontos de retirada
- [x] IT-048 — sessão de atendimento
- [x] IT-061, IT-062, IT-063 — supervisores, unidade sem supervisor, supervisor movido

## Success Criteria
- Every assigned test case implemented and passing
- Nenhuma rota de cadastro responde dados de outra unidade para um supervisor.
- Segredos de canal nunca aparecem em resposta HTTP nem em log.
