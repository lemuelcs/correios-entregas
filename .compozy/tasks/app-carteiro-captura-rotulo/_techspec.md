# TechSpec: App do carteiro — Módulo A, captura do rótulo de envio

**Data**: 2026-09-30 (revisada no mesmo dia pela ADR-014: alinhamento ao núcleo do monitoramento)
**Entradas**: [`_prd.md`](_prd.md) · [`_user_stories.md`](_user_stories.md) · [`adrs/`](adrs/) (ADR-001–006 de produto; ADR-008–014 técnicas; ADR-007 substituída)
**Contrato de testes**: [`_tests.md`](_tests.md)
**Depende de**: [`../monitoramento-entregas-whatsapp/_techspec.md`](../monitoramento-entregas-whatsapp/_techspec.md), dono do núcleo (Distrito, EscalaDistrito, CargaDistrito, PacoteDia, EventoPacote), da baseline de migrations, do S10 corrigido, de `telefone.ts`, do harness de testes, do módulo `entregas` e do `EntregasShell`.

## Executive Summary

A captura roda como um app web instalável (PWA) na área `/carteiro/captura` do frontend React, sobre um módulo backend novo, `captura`, no Express existente.

No aparelho, o app:
- fotografa um rótulo por vez;
- decodifica ali mesmo, com zxing-wasm, o Code 128 do objeto, o código do CEP e o DataMatrix SIGEP;
- valida o S10;
- guarda foto e metadados numa fila IndexedDB.

Um sincronizador envia a fila em série. O servidor processa cada captura de forma síncrona e idempotente pelo `capturaId` gerado no aparelho:
- consulta o CEP (ViaCEP, com CWS de fallback e cache Redis);
- extrai os campos livres com Gemini flash-lite (`generateObject`, com dúvida por campo);
- concilia com o `PacoteDia` da carga do distrito numa transação ("foto vence", "ausência não apaga", transferência confirmada);
- responde salvo, para conferir ou transferência pendente.

A captura **estende** o núcleo do monitoramento (ADR-014):
- acrescenta `origem`, `codigoDigitado` e `capturadoPorId` a `PacoteDia`, o modelo `Captura` e os campos de senha em `Usuario`;
- cria a `CargaDistrito` do dia quando ela ainda não existe;
- registra o histórico em `EventoPacote`;
- chama o gancho do monitoramento `aoAdicionarPacotesEmCargaLiberada` para que pacotes novos, ou com WhatsApp trocado, em carga liberada sejam avisados na hora.

As fotos ficam num volume de disco atrás de `PhotoStore` e são excluídas por um job BullMQ diário. O supervisor audita a captura por extensões do módulo `entregas` e das telas do `EntregasShell`.

Principais trade-offs:
- Processamento síncrono: requisições de 2–5 s em segundo plano, em troca de um só mecanismo de retry.
- Dependência de ordem: a captura só começa depois da base, do cadastro e da carga do monitoramento.
- A troca de número ou de carteiro num caso de mediação já aberto fica restrita a evento mais aviso, até o contrato de mediação do monitoramento existir.

Correções de pré-requisito que ficam **aqui**: a rotação do refresh token (hoje o segundo refresh desloga) e o fluxo de senha do carteiro. O S10 e a baseline são do monitoramento.

## System Architecture

### Component Overview

**Aparelho (frontend, `frontend/src/features/captura/`)**
- **Páginas**: `CapturaHomePage`, `CameraPage`, `ConferirListPage`, `ConferirPage` ("Confira os dados") e `PacotePage`. Tela cheia, fora do `CarteiroShell` legado (moldura de celular falsa, dados mock).
- **barcode.ts**: zxing-wasm sob demanda; decodifica a foto parada em `{ objeto, cepLinear, dataMatrixRaw, multiplos }`.
- **lib/**: cópias puras de `s10.ts` (regra do monitoramento com `qualquerPais`), `telefone.ts` (do monitoramento) e `sigep-datamatrix.ts` (desta feature), para validar offline.
- **captureQueue.ts**: IndexedDB via `idb`, com os estados `aguardando`, `enviando`, `concluida` e `falhou_definitivo`.
- **captureSync.ts**: envio em série; gatilhos `online`, `visibilitychange` e 30 s; política de retry da ADR-012.
- **captura.store.ts** (zustand): o estado de tela.
- **Service worker** (vite-plugin-pwa): precache do shell `/carteiro/captura` e do WASM; manifest com `start_url=/carteiro/captura` e `scope=/carteiro/`.

**Backend (`backend/src/modules/captura/`)**, no padrão routes → controller → service:
- **captura.routes.ts**: `/api/v1/captura`, com `authenticate` + `requireRole('CARTEIRO')` + `requireSenhaDefinitiva`.
- **captura-supervisao.routes.ts**: montado no router do monitoramento em `/api/v1/entregas/captura`, com JWT e `escopo.ts` do monitoramento.
- **captura.service.ts**: orquestra uma captura.
- **extraction.service.ts**: `LabelExtractor` (`GeminiLabelExtractor`, `FakeLabelExtractor`).
- **cep.service.ts**: `CepService`.
- **conciliacao.service.ts**: as regras sobre `PacoteDia`, a escrita em `EventoPacote` e a chamada do gancho de aviso.
- **distrito-do-dia.service.ts**: `EscalaDistrito`, depois o `Distrito.carteiroPadraoId`; cria a `CargaDistrito` sob demanda.
- **photo-store.ts**: `PhotoStore` com `DiskPhotoStore`.
- **sigep-datamatrix.ts** (em `shared/utils/`): o parser.

**Backend (outros)**:
- `workers/foto-retencao.worker.ts`;
- `modules/auth` (rotação do refresh, troca de senha, bloqueio, TTL do carteiro);
- extensão do `GET /api/v1/entregas/cargas/:cargaId/pacotes` do monitoramento com `origem`, `codigoDigitado` e `temFoto`;
- extensão do `GET /api/v1/entregas/quadro` com `paraConferir` e `transferencias`.

**Frontend (supervisor)**: extensões no `frontend/src/features/entregas/` do monitoramento:
- chips de origem, selo "código digitado", histórico, foto e remover em `DistritoPacotesPage`;
- pendências e transferências no quadro (`CarregarDadosPage`);
- "Definir senha" na aba Carteiros de `CadastroPage`.

### Data flow

1. **Foto**: disparo → `barcode.decode(jpeg)` → S10 válido? → `captureQueue.add({ capturaId, distritoId, data, capturadoEm, jpeg, barcodes })` → câmera pronta.
2. **Sync**: `captureSync` → `POST /captura/capturas` (multipart) → `CapturaService.processar`.
3. **Processar** (servidor):
   1. insere `Captura(PROCESSANDO)`;
   2. `PhotoStore.put`;
   3. `CepService.lookup`;
   4. `LabelExtractor.extract` (só os campos que o DataMatrix não cobriu);
   5. `montarCampos`;
   6. `Conciliacao.aplicar` numa transação (garante a `CargaDistrito` do dia) → `SALVO`, `PARA_CONFERIR`, `TRANSFERENCIA_PENDENTE` ou `RECUSADO`;
   7. grava o resultado;
   8. **depois do commit**, chama `aoAdicionarPacotesEmCargaLiberada([pacoteId])` quando a regra 5 manda.
4. **Resposta**: o aparelho atualiza a store (aviso "Salvo · desfazer", contadores).
5. **Conferência**: `POST /captura/capturas/:id/confirmar` → a mesma `Conciliacao.aplicar`, com os campos editados.
6. **Retenção**: o job diário → `PhotoStore.delete` + `Captura.fotoExcluidaEm`.

### External systems

- **Gemini** (AI SDK, `@ai-sdk/google`): visão para os campos livres.
- **ViaCEP** e **Correios CWS** (opcional): endereço por CEP.
- **Redis** (existente): cache de CEP e BullMQ.
- **Postgres** (existente).
- **Monitoramento** (mesmo backend): o gancho de aviso e o módulo `entregas`.

## Implementation Design

### Core Interfaces

```typescript
// backend/src/modules/captura/captura.types.ts
export type Fonte = 'DATAMATRIX' | 'BARRAS' | 'CEP' | 'LLM' | 'DIGITADO' | 'CARTEIRO';
export interface Campo { valor: string | null; duvida: boolean; motivo?: string; fonte: Fonte }
export interface CamposLidos {
  codigo: Campo; nome: Campo; whatsapp: Campo; cep: Campo;
  logradouro: Campo; numero: Campo; complemento: Campo;
  bairro: Campo; cidade: Campo; uf: Campo;
}
export type ResultadoCaptura =
  | { tipo: 'SALVO'; pacoteId: string; atualizado: boolean }
  | { tipo: 'PARA_CONFERIR'; campos: CamposLidos; motivos: string[] }
  | { tipo: 'TRANSFERENCIA_PENDENTE'; campos: CamposLidos; distritoOrigem: string }
  | { tipo: 'RECUSADO'; codigo: RecusaCaptura };
export type RecusaCaptura = 'DV_INVALIDO' | 'MULTIPLOS_ROTULOS' | 'OUTRA_UNIDADE'
  | 'JA_ENTREGUE' | 'SEM_DISTRITO' | 'FOTO_INVALIDA';
```

```typescript
// extraction.service.ts / cep.service.ts / photo-store.ts
export interface LabelExtractor {
  extract(jpeg: Buffer, pedir: Array<keyof CamposLidos>, signal: AbortSignal):
    Promise<{ campos: Partial<CamposLidos>; uso: { inputTokens: number; outputTokens: number } }>;
}
export interface CepInfo { cep: string; logradouro: string | null; bairro: string | null; cidade: string; uf: string }
export interface CepService { lookup(cep: string): Promise<CepInfo | 'NAO_ENCONTRADO' | 'INDISPONIVEL'> }
export interface PhotoStore {
  put(key: string, jpeg: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
```

```typescript
// conciliacao.service.ts
export interface AplicarInput {
  capturaId: string; carteiroId: string; distritoId: string; data: Date; // dia civil SP
  campos: CamposLidos; codigoDigitado: boolean;
  confirmarTransferencia?: boolean;
}
export interface ConciliacaoService {
  aplicar(input: AplicarInput): Promise<{ resultado: ResultadoCaptura; avisar: string[] }>;
  desfazer(capturaId: string, carteiroId: string): Promise<void>;
  remover(pacoteId: string, ator: { usuarioId: string; role: Role }): Promise<void>;
}
// gancho do monitoramento (task_04 de lá): aoAdicionarPacotesEmCargaLiberada(pacoteIds: string[]): Promise<void>
```

```typescript
// frontend/src/features/captura/captureQueue.ts
export interface CapturaLocal {
  capturaId: string; distritoId: string; data: string; capturadoEm: string; // ISO
  jpeg: Blob;
  barcodes: { objeto: string | null; cepLinear: string | null; dataMatrixRaw: string | null; multiplos: boolean };
  codigoDigitado: boolean;
  estado: 'aguardando' | 'enviando' | 'concluida' | 'falhou_definitivo';
  tentativas: number; ultimoErro?: string;
}
```

**Convenção de erros.** O `AppError(status, message, details)` existente vale para as recusas de requisição, com `details.code` estável: `captura_em_processamento`, `transferencia_concorrente`, `remocao_nao_permitida`, `foto_muito_grande`, `foto_invalida`, `captura_ja_resolvida` e `distrito_nao_autorizado`. Uma captura válida sempre volta como 200 com `ResultadoCaptura`.

**Regras de `Conciliacao.aplicar`** (normativas):

0. Garante a `CargaDistrito(distritoId, data)` (cria com status CARREGADO se não existir). "Liberada" = status ∈ {LIBERADO, EM_ENTREGA, CONCLUIDO}.
1. O mínimo (código válido por `validateS10(c, {qualquerPais: true})`, nome, logradouro, número ou "S/N", cidade, UF e CEP de 8 dígitos) falhou, ou algum campo tem `duvida=true` → `PARA_CONFERIR`. Nada muda no `PacoteDia`.
2. Existe `PacoteDia(codigo, data)` em outra carga:
   - de outra unidade → `RECUSADO/OUTRA_UNIDADE`;
   - `status = ENTREGUE` → `RECUSADO/JA_ENTREGUE`;
   - sem `confirmarTransferencia` → `TRANSFERENCIA_PENDENTE`;
   - com a confirmação → troca o `cargaId`, se ainda for o de origem esperado (senão 409 `transferencia_concorrente`), e grava `EventoPacote` `TRANSFERIDO` `{de, para, origemLiberada, carteiroAnterior}`.
3. Existe na mesma carga → para cada campo com `valor != null && !duvida` e diferente do atual, sobrescreve. Um campo nulo mantém o atual. Guarda `pacoteAntes` na `Captura`. A origem `PLANILHA` vira `PLANILHA_FOTO`. Grava `CAPTURA_ATUALIZADO` com `{campo: {antes, depois}}` e, se o E.164 mudou, `WHATSAPP_ALTERADO`. O `status` só muda de SEM_WHATSAPP para AGUARDANDO_LIBERACAO quando o WhatsApp passa a existir e a carga não está liberada.
4. Não existe → cria o `PacoteDia` com origem `FOTO` e `status` SEM_WHATSAPP ou AGUARDANDO_LIBERACAO, e grava `CAPTURA_CRIADO`.
5. `avisar` = `[pacoteId]` quando a carga está liberada **e** (pacote criado com WhatsApp, ou WhatsApp alterado). O `CapturaService` chama `aoAdicionarPacotesEmCargaLiberada(avisar)` depois do commit. Uma falha do gancho não desfaz a captura; é registrada em log e em métrica (a janela 0h–6h, o descadastro e o reenvio são regras do monitoramento).

### Data Models

Adições ao schema do monitoramento (`backend/prisma/schema.prisma`), numa migration própria **depois** da migration da feature do monitoramento:

```prisma
enum OrigemPacote { PLANILHA FOTO PLANILHA_FOTO }
enum ResultadoCapturaTipo { PROCESSANDO SALVO PARA_CONFERIR TRANSFERENCIA_PENDENTE RECUSADO DESCARTADO DESFEITO }

// campos novos em PacoteDia (modelo do monitoramento)
//   origem         OrigemPacote @default(PLANILHA)
//   codigoDigitado Boolean      @default(false)
//   capturadoPorId String?      // Carteiro.id da última captura
//   telefoneOutro  String?      // fixo lido do rótulo (não é WhatsApp)

model Captura {
  id String @id                 // capturaId do aparelho
  carteiroId String
  distritoId String
  data DateTime @db.Date
  cargaId String?
  codigo String?
  resultado ResultadoCapturaTipo
  recusa String?
  pacoteId String?
  campos Json?                  // CamposLidos
  pacoteAntes Json?             // snapshot para desfazer
  cargaOrigemId String?         // se TRANSFERENCIA_PENDENTE
  fotoKey String?  fotoExcluidaEm DateTime?
  llmInputTokens Int?  llmOutputTokens Int?
  capturadoEm DateTime  recebidoEm DateTime @default(now())  processadoEm DateTime?
  @@index([carteiroId, resultado])
  @@index([cargaId, resultado])
  @@map("capturas")
}
```

**`Usuario`:** `senhaTemporaria Boolean @default(false)`, `tentativasFalhas Int @default(0)`, `bloqueadoAte DateTime?`.

**Carteiro com login.** No monitoramento, `Carteiro.usuarioId` é opcional (carteiro sem login). "Definir senha" cria o `Usuario` (role CARTEIRO, matrícula do `Carteiro`, `unidadeId`) quando ainda não existe, e o vincula ao `Carteiro`.

**`EventoPacote`** (monitoramento) recebe os tipos `CAPTURA_CRIADO`, `CAPTURA_ATUALIZADO`, `WHATSAPP_ALTERADO`, `TRANSFERIDO`, `REMOVIDO` e `DESFEITO`, com os `dados` descritos nas regras. Na remoção física de um `PacoteDia`, o `REMOVIDO` guarda o snapshot. Se `EventoPacote.pacoteId` tiver FK no schema final do monitoramento, a remoção preserva os eventos (FK `onDelete: SetNull` ou sem FK); a task_01 confere e ajusta isso.

**IndexedDB** (aparelho), banco `captura`: store `fila` (chave `capturaId`, índice `estado`) e store `recentes` (os últimos 20 resultados).

### API Endpoints

**Carteiro**: `/api/v1/captura`, com `authenticate` + `requireRole('CARTEIRO')` + `requireSenhaDefinitiva` (403 `troca_de_senha_obrigatoria`).

| Método e caminho | Descrição | Sucesso | Falhas |
|---|---|---|---|
| `GET /hoje` | Distrito(s) do dia (escala ou padrão), status da carga, contadores e recentes | 200 `{ distritos: [{distritoId, codigo, nome, cargaStatus}], ativo, contadores, recentes }` | 200 com `distritos: []` |
| `PUT /hoje/ativo` | `{ distritoId }` quando há mais de um | 204 | 403 |
| `POST /capturas` | multipart: `foto` (image/jpeg ≤2 MB) + `meta` (`capturaId` uuid, `distritoId`, `data`, `capturadoEm`, `barcodes`, `codigoDigitado`, `codigo`) | 200 `ResultadoCaptura` | 400 · 403 `distrito_nao_autorizado` · 409 `captura_em_processamento` · 413 `foto_muito_grande` · 415 `foto_invalida` |
| `GET /conferir` | PARA_CONFERIR e TRANSFERENCIA_PENDENTE do carteiro, as mais antigas primeiro | 200 lista | — |
| `GET /capturas/:id/foto` | JPEG da captura | 200 | 404 · 410 `foto_excluida` |
| `POST /capturas/:id/confirmar` | `{ campos, confirmarTransferencia? }` | 200 `ResultadoCaptura` | 400 · 404 · 409 `transferencia_concorrente` · 409 `captura_ja_resolvida` |
| `POST /capturas/:id/descartar` | Descarta uma pendente e exclui a foto | 204 | 404 · 409 `captura_ja_resolvida` |
| `POST /capturas/:id/desfazer` | Desfaz um SALVO | 204 | 404 · 409 `remocao_nao_permitida` |
| `PATCH /pacotes/:id` | Edita pacote que ele capturou (campos de contato e endereço; não o código) | 200 | 400 · 403 · 404 |
| `DELETE /pacotes/:id` | Remove (carga não liberada, origem ≠ PLANILHA; em PLANILHA_FOTO, desfaz a foto) | 204 | 403 `remocao_nao_permitida` · 404 |
| `GET /cep/:cep` | Consulta de CEP | 200 `CepInfo` | 404 `cep_nao_encontrado` · 503 `cep_indisponivel` |

**Supervisor**: extensões do módulo `entregas` do monitoramento, com JWT e `escopo.ts` (outra unidade → 404).

| Método e caminho | Descrição |
|---|---|
| `GET /api/v1/entregas/cargas/:cargaId/pacotes` (existente, estendido) | Cada item ganha `origem`, `codigoDigitado` e `temFoto` |
| `GET /api/v1/entregas/quadro` (existente, estendido) | Cada distrito ganha `paraConferir` (capturas pendentes do carteiro do dia no distrito) e `transferencias: {entrada[], saida[]}` com `{codigo, distrito, carteiro, hora, origemLiberada}` |
| `GET /api/v1/entregas/captura/pacotes/:id/historico` | `EventoPacote` do pacote, com os campos antes e depois |
| `GET /api/v1/entregas/captura/pacotes/:id/foto` | JPEG da última captura com foto; 410 com `fotoExcluidaEm` |
| `DELETE /api/v1/entregas/captura/pacotes/:id` | Remove em qualquer status, exceto ENTREGUE (409 `pacote_entregue`); evento REMOVIDO |
| `PUT /api/v1/entregas/captura/carteiros/:id/senha` | Define ou redefine a senha temporária (cria o `Usuario` se preciso; revoga os refresh tokens; 409 `matricula_ausente`; 400 `senha_fraca`) |

**Auth (alterações):**
- `POST /auth/refresh` passa a devolver `{ accessToken, refreshToken }` (rotação);
- novo `POST /auth/trocar-senha` `{ senhaAtual, novaSenha }`;
- 5 falhas seguidas → `bloqueadoAte = now + 15 min` (423 `acesso_bloqueado`);
- inativo → 403 `acesso_desativado`, reaproveitando o `authenticate` que recusa inativo (task_03 do monitoramento);
- a mesma mensagem para matrícula inexistente e senha errada;
- o refresh do CARTEIRO vale 30 dias, o dos demais 7 dias.

## Integration Points

- **Gemini via AI SDK** (ADR-008):
  - variáveis `CAPTURA_AI_PROVIDER` (`google` | `fake`), `CAPTURA_AI_MODEL` (padrão `gemini-3.1-flash-lite`) e `CAPTURA_AI_API_KEY`;
  - timeout de 15 s, sem retry no servidor;
  - um erro vira `PARA_CONFERIR` com `extracao_indisponivel`.
- **ViaCEP e CWS** (ADR-009): `VIACEP_URL` com timeout de 3 s; o CWS só quando `CORREIOS_CWS_USERNAME` está preenchido; cache Redis `cep:<8>` com 30 dias ou 1 dia.
- **BullMQ**: a fila `foto-retencao` (repetição às 03:00, America/Sao_Paulo) registrada em `workers/index.ts`.
- **Monitoramento (mesmo processo)**:
  - `aoAdicionarPacotesEmCargaLiberada(pacoteIds)`: interface criada na task_04 de lá e implementada na task_06 de lá. Até a task_06 existir, a implementação vazia mantém a captura funcional, sem avisos;
  - `escopo.ts` e o router `/api/v1/entregas`;
  - `validateS10` e `normalizarTelefone`;
  - as fábricas de teste `__tests__/fixtures/entregas.ts`.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `backend/prisma/schema.prisma` + `migrations/` | modified | Migration da captura depois da do monitoramento: campos em `PacoteDia` e `Usuario`, modelo `Captura`, enums. Risco baixo | Gerar só depois da migration do monitoramento |
| `backend/src/modules/auth/*` | modified | Rotação do refresh, troca de senha, bloqueio, TTL do carteiro. Risco médio: todos os logins | Testes de regressão |
| `backend/src/modules/captura/` | new | Módulo da captura e as rotas de supervisor da captura | — |
| `backend/src/modules/entregas/*` (monitoramento) | modified | A lista de pacotes e o quadro ganham campos; o router monta `/captura`. Risco médio: código de outra feature | Mudanças aditivas nas respostas; testes do monitoramento continuam passando |
| `backend/src/shared/utils/sigep-datamatrix.ts` | new | Parser | — |
| `backend/src/workers/foto-retencao.worker.ts`, `queue.ts`, `workers/index.ts` | new/modified | Job diário | — |
| `frontend/src/services/api.ts` | modified | Gravar o refresh rotacionado; `FormData` já vem do monitoramento (task_07 de lá) ou é adicionado se ausente | — |
| `frontend/src/pages/LoginPage.tsx` | modified | CARTEIRO → `/carteiro/captura`; tela "Crie sua senha" | Coordenar com o redirecionamento por papel da task_07 do monitoramento |
| `frontend/src/features/captura/` | new | App do carteiro | — |
| `frontend/src/features/entregas/*` (monitoramento) | modified | Chips, histórico, foto, remover, pendências, transferências, senha do carteiro | Depois da task_07 do monitoramento |
| `frontend/vite.config.ts`, `public/manifest.json` | modified | vite-plugin-pwa, ícones, scope `/carteiro/` | — |
| `backend/package.json` / `frontend/package.json` | modified | `ai`, `@ai-sdk/google` / `zxing-wasm`, `idb`, `vite-plugin-pwa`, Vitest + Testing Library + `fake-indexeddb` (se o monitoramento não tiver adicionado) | — |
| `docker-compose.yml` | modified | Volume `correios_fotos` em `/data/fotos`; `CAPTURA_AI_*`, `FOTO_*` | — |
| `.github/workflows/ci.yml` | modified | As jornadas da captura no job `e2e-ui` do monitoramento | — |
| `Objeto` e telas SGPD v2 | unchanged | — | — |

## Testing Approach

Conforme a ADR-013, adaptada à ADR-014; os casos estão em [`_tests.md`](_tests.md).

- **Harness do monitoramento**: `TEST_DATABASE_URL` com a trava `_test`, projetos Jest `unit` e `integration`, e as fábricas `__tests__/fixtures/entregas.ts`, que esta feature estende com `captura`, `escala` e `pacoteCapturado`.
- **Unit (backend)**:
  - `sigep-datamatrix`, `mesmoNumero`, `montarCampos`, `avaliarMinimo`;
  - `CepService` com fetch falso;
  - `GeminiLabelExtractor` com `generateObject` falso;
  - `DiskPhotoStore`, retenção, distrito do dia e auth.
- **Integração (backend)**: supertest em processo, banco `_test`, `FakeLabelExtractor`, CEP falso, `DiskPhotoStore` em diretório temporário, e o gancho `aoAdicionarPacotesEmCargaLiberada` substituído por um espião.
- **Unit (frontend, Vitest)**: fila com `fake-indexeddb`, sync com fetch falso, `barcode.decode` sobre fixtures, componentes.
- **E2E (Playwright)**: as 3 jornadas da captura no job `e2e-ui`, com a câmera substituída por `?e2eImage=<fixture>` (só em build de teste) e `CAPTURA_AI_PROVIDER=fake`.
- **Fixtures de rótulo**: sintéticas, geradas com `bwip-js` (Code 128 e DataMatrix SIGEP), com dados fictícios e DV válido (`AA123456785BR`, `OY716488072BR`).

## Development Sequencing

### Build Order

0. **Pré-requisitos do monitoramento**: tasks 01 (base, S10, telefone, harness), 03 (cadastro, escala, `authenticate` recusa inativo) e 04 (módulo `entregas`, `escopo.ts`, carga, lista, gancho de aviso vazio).
1. **Extensões de dados e auth**: migration da captura; rotação do refresh, troca de senha, bloqueio e TTL; parser SIGEP; `mesmoNumero`; distrito do dia.
2. **CepService**, **LabelExtractor** e **PhotoStore**: independentes entre si; dependem de 1 só pelo módulo.
3. **ConciliacaoService** (depende de 1).
4. **CapturaService**, rotas `/captura` e worker de retenção (dependem de 2 e 3).
5. **Extensões do supervisor** em `entregas` (dependem de 4).
6. **Frontend: fundação** (api.ts, login e troca de senha, fila, sync, barcode, PWA) (depende de 1).
7. **Frontend: telas da captura** e E2E (dependem de 4 e 6).
8. **Frontend: extensões do supervisor** (dependem de 5, 6 e da task_07 do monitoramento).

### Technical Dependencies

- As tasks 01, 03 e 04 do monitoramento concluídas antes da task_01 da captura; a task_07 do monitoramento antes da task_06 da captura. O Compozy não expressa arestas entre workflows, então isso fica anotado nas próprias tasks.
- A chave do Gemini (`CAPTURA_AI_API_KEY`; hoje `GOOGLE_AI_API_KEY` está vazia).
- Rótulos reais anonimizados para confirmar o layout SIGEP (ADR-011).
- A validação jurídica e os prazos de retenção (Open Questions do PRD); os padrões ficam configuráveis.

## Monitoring and Observability

- **Métricas**:
  - `captura_processadas_total{resultado}`;
  - `captura_duracao_segundos{etapa}`;
  - `captura_llm_tokens_total{tipo}`;
  - `captura_llm_falhas_total{motivo}`;
  - `cep_lookup_total{fonte,resultado}`;
  - `captura_gancho_aviso_falhas_total`;
  - `fotos_armazenadas_bytes`;
  - `fotos_excluidas_total{motivo}`.
- **Logs** com `capturaId`, `carteiroId`, `distritoId`, `cargaId`, `resultado`, `duracaoMs` e `fontes`. Nunca nome, telefone, endereço, bytes da foto ou texto do LLM. Telefone só mascarado, como no monitoramento.
- **Alertas** (manuais):
  - `PARA_CONFERIR` acima de 50% em 1 h;
  - `captura_llm_falhas_total` crescendo;
  - `captura_gancho_aviso_falhas_total` acima de 0;
  - fotos acima de 5 GB.

## Technical Considerations

### Key Decisions

- **Estender o núcleo do monitoramento e chamar o gancho de aviso** (ADR-014, que substitui a ADR-007).
- **Gemini flash-lite direto, com dúvida por campo** (ADR-008).
- **ViaCEP + CWS + cache** (ADR-009).
- **Disco + `PhotoStore` + job diário; a expiração conta de `PacoteDia.data`** (ADR-010, ADR-014).
- **zxing-wasm nos três códigos; DataMatrix primeiro** (ADR-011).
- **Síncrono e idempotente** (ADR-012).
- **Testes com banco `_test` travado** (ADR-013), com o harness do monitoramento.
- **Refresh rotativo com TTL de 30 dias para carteiro**: a sessão longa do PRD, que também corrige o logout no segundo refresh.
- **Foto parada e rotas fora do `CarteiroShell`**.

### Known Risks

- **Ordem entre workflows** (alta): a captura depende de 3 tasks do monitoramento. Mitigação: a task_01 da captura verifica os pré-requisitos no início e para com uma mensagem clara se faltarem.
- **Caso de mediação já aberto** (média): a troca de WhatsApp ou a transferência de um pacote com `mediacaoCaseId` exige atualizar o caso no Prosio (`atualizarFatosCaso` ou fechar e abrir). Aqui ficam só o `EventoPacote` e o gancho de aviso. A atualização do caso é uma pendência a levar ao monitoramento quando o contrato R1–R7 estiver definido.
- **Posições do DataMatrix SIGEP** (média): confirmar com rótulos reais; um parser que falha cai para linear mais LLM.
- **Armazenamento do navegador no iOS** (média): `navigator.storage.persist()` e envio rápido.
- **Aposentadoria do id do Gemini** (baixa a média): o id fica no ambiente, e a falha vira Para conferir.
- **Mudanças aditivas no módulo `entregas`** (média): tocam código de outra feature; mantê-las aditivas e rodar a suíte do monitoramento.
- **ESM do AI SDK no Jest** (baixa).

## Architecture Decision Records

- [ADR-001: A foto é mais uma fonte da lista do distrito; dedup por código e "foto vence"](adrs/adr-001.md)
- [ADR-002: Dois códigos de barras, endereço pelo CEP e extração só dos campos livres; revisão só quando há dúvida](adrs/adr-002.md)
- [ADR-003: Captura sem sinal com fila no aparelho; extração ao reconectar](adrs/adr-003.md)
- [ADR-004: App web instalável na área /carteiro, com login por matrícula e senha](adrs/adr-004.md)
- [ADR-005: Captura depois da liberação, reaviso na troca de WhatsApp e janela de correção](adrs/adr-005.md)
- [ADR-006: Foto do rótulo retida até o fim do fluxo mais um prazo curto, com exclusão automática](adrs/adr-006.md)
- [ADR-007: Núcleo do distrito do dia nesta TechSpec](adrs/adr-007.md). **Substituída pela ADR-014.**
- [ADR-008: Extração com Gemini flash-lite direto do backend, dúvida por campo](adrs/adr-008.md)
- [ADR-009: Endereço pelo CEP via ViaCEP, CWS de fallback, cache Redis](adrs/adr-009.md)
- [ADR-010: Fotos em volume de disco atrás de PhotoStore, exclusão por job diário](adrs/adr-010.md)
- [ADR-011: Três códigos lidos no aparelho com zxing-wasm; DataMatrix > linear > OCR](adrs/adr-011.md)
- [ADR-012: Processamento síncrono e idempotente por capturaId](adrs/adr-012.md)
- [ADR-013: Testes com banco _test travado, Vitest e Playwright](adrs/adr-013.md)
- [ADR-014: A captura estende o núcleo do monitoramento e usa os ganchos dele](adrs/adr-014.md). `PacoteDia` + `Captura`; gancho de aviso no lugar do outbox.

## Story Mapping

| Story | Components |
|---|---|
| US-001 | auth (login, bloqueio, troca de senha), `api.ts`, LoginPage |
| US-002 | `PUT /entregas/captura/carteiros/:id/senha`, aba Carteiros de `CadastroPage` |
| US-003 | `distrito-do-dia.service`, `GET /captura/hoje`, `PUT /hoje/ativo`, CapturaHomePage |
| US-004 | CameraPage, `barcode.ts`, `lib/s10`, `sigep-datamatrix`, captureQueue |
| US-005 | CapturaService, Conciliação (regras 3 e 4), `desfazer`, aviso na store |
| US-006 | Regra 1, `GET /conferir`, ConferirPage, `POST /confirmar`, `GET /cep/:cep` |
| US-007 | CameraPage (digitar), `codigoDigitado` |
| US-008 | CepService, LabelExtractor, regra de dúvida |
| US-009 | `normalizarTelefone`, "ausência não apaga" (regra 3) |
| US-010, US-012 | Regra 3, idempotência por `capturaId` |
| US-011 | Regra 2, `confirmarTransferencia`, `EventoPacote` TRANSFERIDO |
| US-013, US-014 | captureQueue, captureSync, service worker, contadores |
| US-015, US-016 | Regra 5 → gancho `aoAdicionarPacotesEmCargaLiberada` (os avisos são do monitoramento) |
| US-017 | `PATCH`/`DELETE /captura/pacotes/:id`, PacotePage |
| US-018 | `DELETE /entregas/captura/pacotes/:id` |
| US-019 | Lista estendida, `/historico`, `/foto`, DistritoPacotesPage estendida |
| US-020 | Quadro estendido (`transferencias`), `EventoPacote` TRANSFERIDO |
| US-021 | Quadro estendido (`paraConferir`) |
| US-022 | Worker `foto-retencao`, exclusão imediata em descartar, desfazer e remover |
