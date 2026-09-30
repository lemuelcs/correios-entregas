---
status: pending
title: "Carga do dia: planilha, prévia, confirmação e quadro"
type: backend
complexity: high
---

# Task 4: Carga do dia: planilha, prévia, confirmação e quadro

## Overview
Entrega a API da etapa Monitoramento › Carregar Dados:
- leitura de planilha (CSV ou XLSX) e de texto colado;
- prévia classificada sem gravar nada;
- confirmação transacional das linhas válidas;
- o quadro de distritos do dia com seus status;
- a lista de pacotes de cada distrito.

É o que o supervisor usa todo dia antes de liberar os distritos.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST ler o arquivo no backend: `multer` em memória (até 2 MB), `exceljs` para XLSX (só a primeira aba, com aviso), `papaparse` para CSV e texto (separador tab, `;` ou `,`). Células são texto, fórmulas nunca são avaliadas, e o limite é de 500 linhas não vazias.
- MUST reconhecer os cabeçalhos equivalentes da seção "Validação da lista" do PRD e as duas formas de endereço (colunas separadas ou uma coluna livre em `enderecoTexto`).
- MUST classificar cada linha com os motivos de `_tests.md`: `valida`, `sem_whatsapp`, `corrigir`/`sem_ddd`, `invalida` com `digito_invalido`, `duplicado_planilha`, `ja_no_distrito` ou `faltam_campos`. Também marcar `descadastrado` e `orientacaoGuardada`.
- MUST implementar `POST /api/v1/entregas/cargas/:distritoId/previa` (multipart ou `{texto}`, sem gravar) e `POST .../confirmar`:
  - revalida tudo no servidor e grava numa transação;
  - `@@unique([codigo, data])` garante um distrito por código por dia, e o conflito descarta a linha sem erro 500;
  - JSON até 1 MB só nessa rota.
- MUST, na confirmação, vincular a orientação `GUARDADA` do código ao novo pacote (consulta direta ao modelo `Orientacao`).
- MUST criar o módulo `entregas`: `entregas.routes.ts` montado em `app.ts` sob `/api/v1/entregas` (JWT obrigatório) e o helper `escopo.ts`, que resolve a unidade efetiva. `UNIDADE` fica restrito a `req.user.unidadeId`, e o recurso de outra unidade responde 404; `GESTAO` usa `?unidadeId=`. As tasks 03, 05 e 06 reutilizam os dois.
- MUST implementar `GET /api/v1/entregas/quadro` e `GET /api/v1/entregas/cargas/:cargaId/pacotes`, com a derivação de status de "Data Models" do TechSpec, filtros, busca, paginação (50), `somenteLeitura` para datas anteriores e escopo por unidade.
- MUST implementar `PATCH /api/v1/entregas/pacotes/:id` (WhatsApp e endereço) sem disparar aviso. O aviso para carga já liberada é plugado pela task_06 por meio de um gancho `aoAdicionarPacotesEmCargaLiberada(pacoteIds)`, com implementação vazia aqui.
- MUST expor a derivação de status como funções puras reutilizáveis (`derivarStatusCarga`, `avancarStatusPacote`), usadas pelas tasks 05 e 06.
</requirements>

## Subtasks
- [ ] 4.0 Criar o módulo `entregas` (roteador montado em `app.ts`) e o helper de escopo por unidade.
- [ ] 4.1 Adicionar as dependências de leitura (`exceljs`, `papaparse`) e o middleware de upload restrito à rota de prévia.
- [ ] 4.2 Implementar o parser de planilha e de texto com limites e cabeçalhos equivalentes.
- [ ] 4.3 Implementar a validação e classificação das linhas (S10, telefone, duplicidade, outro distrito, descadastro, orientação guardada).
- [ ] 4.4 Implementar a prévia sem estado.
- [ ] 4.5 Implementar a confirmação transacional e a vinculação de orientações guardadas.
- [ ] 4.6 Implementar a derivação de status (carga e pacote) como funções puras.
- [ ] 4.7 Implementar o quadro do dia e a lista de pacotes com filtros e paginação.
- [ ] 4.8 Implementar a edição de pacote com o gancho para a task_06.

## Implementation Details
Novos arquivos em `backend/src/modules/entregas/`: `planilha.parser.ts`, `carga.validacao.ts`, `carga.service.ts`, `carga.controller.ts` e `status.ts`, além de `entregas.routes.ts` e `escopo.ts` (esta tarefa cria o módulo; as tasks 03, 05 e 06 acrescentam rotas agrupadas por área). Ver TechSpec: "API Endpoints › Carga", "Data Models" (derivação de status) e ADR-017.

### Relevant Files
- `backend/src/shared/utils/s10.ts`, `telefone.ts` (task_01) — validação de código e WhatsApp.
- `backend/prisma/schema.prisma` — `CargaDistrito`, `PacoteDia`, `Orientacao`, `DescadastroWhatsapp` (task_01).
- `backend/src/app.ts` — monta `/api/v1/entregas`; o `express.json()` global tem limite de 100 kb, e a rota de confirmação precisa de limite próprio.
- `backend/package.json` — `multer ^1.4.5-lts.1` já instalado.
- `backend/src/modules/recebimento/recebimento.service.ts` — exemplo de transação Prisma em lote.

### Dependent Files
- task_06 pluga o envio de aviso nos ganchos de confirmação e edição de pacote.
- task_05 e task_06 usam `status.ts`.
- task_07 consome quadro, prévia, confirmação e lista.

### Related ADRs
- [ADR-017: Planilha no backend](../adrs/adr-017.md) — prévia sem estado, confirmação idempotente.
- [ADR-010: Módulos redefinidos](../adrs/adr-010.md) — WhatsApp opcional, endereço, quadro.
- [ADR-007: Validação S10 e texto neutro](../adrs/adr-007.md).
- [ADR-013: Modelo de dados e migrations](../adrs/adr-013.md) — `PacoteDia` único por código e dia.

## Deliverables
- Prévia, confirmação, quadro, lista de pacotes e edição de pacote funcionando.
- `status.ts` com a derivação de status reutilizável.
- Módulo `entregas` (roteador + `escopo.ts`) pronto para as outras tarefas.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-014, UT-015, UT-016, UT-017, UT-018, UT-019, UT-020, UT-021, UT-022, UT-023, UT-024, UT-025 — parser
- [ ] UT-026, UT-027, UT-028, UT-029, UT-030, UT-031, UT-032 — classificação das linhas
- [ ] UT-033, UT-034, UT-035, UT-036, UT-037, UT-038, UT-039, UT-040 — derivação de status
- [ ] IT-016, IT-017, IT-018 — prévia (multipart, texto, nada gravado)
- [ ] IT-019, IT-020, IT-021, IT-022, IT-023 — confirmação (contagens, concorrência, outro distrito, outra unidade, orientação guardada)
- [ ] IT-049, IT-050 — quadro e lista de pacotes

## Success Criteria
- Every assigned test case implemented and passing
- Uma planilha de 500 linhas gera a prévia em até 5 s no ambiente de teste.
- Nenhuma chamada de prévia altera o banco.
