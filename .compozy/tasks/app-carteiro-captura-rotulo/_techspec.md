# TechSpec: App do carteiro — Módulo A, captura do rótulo de envio

**Data**: 2026-09-30
**Entradas**: [`_prd.md`](_prd.md) · [`_user_stories.md`](_user_stories.md) · [`adrs/`](adrs/) (ADR-001–006 de produto, ADR-007–013 técnicas)
**Contrato de testes**: [`_tests.md`](_tests.md)

## Executive Summary

A captura roda como um app web instalável (PWA) na área `/carteiro/captura` do frontend React existente, sobre um módulo backend novo, `captura`, no Express existente.

No aparelho, o app:
- fotografa um rótulo por vez;
- decodifica ali mesmo, com zxing-wasm, o Code 128 do objeto, o código do CEP e o DataMatrix SIGEP;
- valida o S10;
- guarda foto e metadados numa fila IndexedDB.

Um sincronizador envia a fila em série. O servidor processa cada captura de forma síncrona e idempotente pelo `capturaId` gerado no aparelho:
- consulta o CEP (ViaCEP, com CWS de fallback e cache Redis);
- extrai os campos livres com Gemini flash-lite (`generateObject`, com dúvida por campo);
- concilia com a lista do distrito do dia numa transação ("foto vence", "ausência não apaga", transferência confirmada);
- responde salvo, para conferir ou transferência pendente.

O núcleo de dados do distrito do dia (`Distrito`, `DistritoDia`, `Pacote`) nasce aqui e é compartilhado com o PRD de monitoramento, que ainda não está implementado. Toda mudança de pacote grava um evento em outbox (`PacoteEvento`), que o monitoramento vai consumir para avisos e mediação. As fotos ficam num volume de disco atrás de `PhotoStore` e são excluídas por um job BullMQ diário.

Principais trade-offs:
- Processamento síncrono: requisições de 2–5 s em segundo plano, em troca de um só mecanismo de retry.
- O núcleo definido antes do monitoramento: o monitoramento herda os nomes daqui.
- Os avisos de US-015/US-016 entregues como eventos: a mensagem só sai quando o consumidor existir.

Correções pré-requisito no código existente:
- o validador S10 (restos invertidos, sufixo só BR);
- o refresh token, que não rotaciona e desloga no segundo refresh;
- a falta de migrations do Prisma.

## System Architecture

### Component Overview

**Aparelho (frontend, `frontend/src/features/captura/`)**
- **CapturaShell e páginas**:
  - `CapturaHomePage`: distrito do dia, contadores e recentes;
  - `CameraPage`;
  - `ConferirListPage` e `ConferirPage`: a tela "Confira os dados";
  - `PacotePage`: editar ou remover.
  - Tela cheia, sem a moldura de celular falsa do `CarteiroShell`.
- **barcode.ts**: carrega zxing-wasm sob demanda e decodifica a foto parada; devolve `{ objeto, cepLinear, dataMatrixRaw }`.
- **sigep-datamatrix.ts** (compartilhado com o backend): `parseSigepDataMatrix`.
- **s10.ts** (compartilhado): validação UPU corrigida.
- **captureQueue.ts**: fila IndexedDB (via `idb`) com os estados `aguardando`, `enviando`, `concluida` e `falhou_definitivo`.
- **captureSync.ts**: envio em série; gatilhos `online`, `visibilitychange` e intervalo de 30 s; política de retry (ADR-012).
- **captura.store.ts** (zustand): o estado de tela (distrito, contadores, recentes, avisos de salvo).
- **Service worker** (vite-plugin-pwa): precache do shell `/carteiro/captura` e do WASM; manifest com `start_url=/carteiro/captura` e `scope=/carteiro/`.

**Backend (`backend/src/modules/captura/`)**, no padrão routes → controller → service do repositório:
- **captura.routes.ts**: `authenticate` + `requireRole('CARTEIRO')`.
- **captura.controller.ts**: schemas zod e multer em memória.
- **captura.service.ts**: orquestra o processamento de uma captura.
- **extraction.service.ts**: `LabelExtractor` (implementações `GeminiLabelExtractor` e `FakeLabelExtractor`).
- **cep.service.ts**: `CepService` (ViaCEP, fallback CWS, cache Redis).
- **conciliacao.service.ts**: regras "foto vence", "ausência não apaga", duplicidade, transferência, desfazer e remoção, com a escrita dos eventos.
- **distrito-dia.service.ts**: resolve o distrito do dia do carteiro (designação, depois distrito padrão).
- **photo-store.ts**: `PhotoStore` com `DiskPhotoStore`.

**Backend (`backend/src/modules/supervisao/`)**, para o supervisor (papel UNIDADE):
- o cadastro mínimo de distritos e a designação do carteiro do dia (API do núcleo, que o monitoramento reutiliza);
- a lista do distrito do dia com origem e histórico;
- a foto, as transferências e as pendências;
- a remoção de pacote;
- a senha do carteiro.

**Backend (outros)**:
- **workers/foto-retencao.worker.ts**: job repetível diário.
- **modules/auth**: rotação do refresh token, troca de senha obrigatória e bloqueio por tentativas.
- **shared/utils/s10.ts**: correção UPU e qualquer sufixo.

**Frontend (supervisor)**: `frontend/src/features/supervisao-captura/`:
- `DistritosDiaPage` (distritos do dia, com pendências e transferências);
- `DistritoPacotesPage` (origem, código digitado, histórico e foto);
- a senha do carteiro no cadastro existente de carteiros.

### Data flow

1. **Foto**: disparo → `barcode.decode(jpeg)` → S10 válido? → `captureQueue.add({ capturaId, distritoDiaId, capturadoEm, jpeg, barcodes })` → câmera pronta.
2. **Sync**: `captureSync` → `POST /captura/capturas` (multipart) → `CapturaService.processar`.
3. **Processar** (servidor):
   1. insere `Captura(PROCESSANDO)`, com o id duplicado tratado como idempotência;
   2. `PhotoStore.put`;
   3. `CepService.lookup`;
   4. `LabelExtractor.extract` (pulado para os campos cobertos pelo DataMatrix);
   5. monta os `CamposLidos` com a fonte e a dúvida de cada campo;
   6. `Conciliacao.aplicar` numa transação, que devolve `SALVO`, `PARA_CONFERIR` ou `TRANSFERENCIA_PENDENTE`;
   7. grava o resultado na `Captura`.
4. **Resposta**: o aparelho atualiza a store (aviso "Salvo · desfazer", contadores).
5. **Conferência**: `POST /captura/capturas/:id/confirmar` → a mesma `Conciliacao.aplicar`, com os campos editados e sem dúvida.
6. **Eventos**: cada mudança de `Pacote` → `PacoteEvento` na mesma transação → consumido depois pelo monitoramento (avisos e mediação).
7. **Retenção**: o job diário → `PhotoStore.delete` + `Captura.fotoExcluidaEm`.

### External systems

- **Gemini** (AI SDK, `@ai-sdk/google`): visão para os campos livres.
- **ViaCEP**: endereço por CEP.
- **Correios CWS** (opcional): fallback de CEP.
- **Redis** (existente): cache de CEP e BullMQ.
- **Postgres** (existente).

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
  capturaId: string; carteiroId: string; distritoDiaId: string;
  campos: CamposLidos; codigoDigitado: boolean;
  confirmarTransferencia?: boolean; // só na conferência
}
export interface ConciliacaoService {
  aplicar(input: AplicarInput): Promise<ResultadoCaptura>;           // transacional
  desfazer(capturaId: string, carteiroId: string): Promise<void>;     // restaura pacoteAntes
  remover(pacoteId: string, ator: { id: string; role: Role }): Promise<void>;
}
```

```typescript
// frontend/src/features/captura/captureQueue.ts
export interface CapturaLocal {
  capturaId: string; distritoDiaId: string; capturadoEm: string; // ISO
  jpeg: Blob; barcodes: { objeto: string | null; cepLinear: string | null; dataMatrixRaw: string | null };
  codigoDigitado: boolean;
  estado: 'aguardando' | 'enviando' | 'concluida' | 'falhou_definitivo';
  tentativas: number; ultimoErro?: string;
}
```

**Convenção de erros.** O `AppError(status, message, details)` existente vale para as recusas de requisição; o `details.code` leva um código estável (`captura_em_processamento`, `transferencia_concorrente`, `remocao_nao_permitida`, `foto_muito_grande`, `foto_invalida`). O resultado de negócio de uma captura válida sempre volta como 200 com `ResultadoCaptura`, e a recusa de negócio vem como `RECUSADO`.

**Regras de `Conciliacao.aplicar`** (normativas):
1. O mínimo (código válido, nome, logradouro, número ou "S/N", cidade, UF e CEP de 8 dígitos) falhou, ou algum campo tem `duvida=true` → `PARA_CONFERIR`. Nada muda no `Pacote`.
2. Existe `Pacote(data, codigo)` noutro `DistritoDia`:
   - de outra unidade → `RECUSADO/OUTRA_UNIDADE`;
   - `statusFinalEm` preenchido com entrega → `RECUSADO/JA_ENTREGUE`;
   - sem `confirmarTransferencia` → `TRANSFERENCIA_PENDENTE`;
   - com a confirmação → move o pacote se ele ainda estiver no distrito de origem esperado. Se outro carteiro o moveu antes, dá 409 `transferencia_concorrente`. Grava o evento TRANSFERIDO.
3. Existe no mesmo `DistritoDia` → para cada campo com `valor != null && !duvida` e diferente do atual, sobrescreve. Um campo nulo mantém o atual. Guarda `pacoteAntes` na `Captura`. A origem vira `PLANILHA_FOTO` se era `PLANILHA`. Grava ATUALIZADO, com `{campo: {antes, depois}}`, e WHATSAPP_ALTERADO se o E.164 mudou.
4. Não existe → cria o `Pacote` com origem `FOTO` e grava CRIADO.
5. Em 2 a 4, se o `DistritoDia.status = LIBERADO`, o evento leva `distritoLiberado: true`, que é o sinal do "avisar na hora" para o consumidor.

### Data Models

Prisma, adicionado a `backend/prisma/schema.prisma`:

```prisma
enum StatusDistritoDia { ABERTO LIBERADO }
enum OrigemPacote { PLANILHA FOTO PLANILHA_FOTO }
enum ResultadoCapturaTipo { PROCESSANDO SALVO PARA_CONFERIR TRANSFERENCIA_PENDENTE RECUSADO DESCARTADO DESFEITO }
enum TipoPacoteEvento { CRIADO ATUALIZADO WHATSAPP_ALTERADO TRANSFERIDO REMOVIDO DESFEITO }

model Distrito {
  id String @id @default(uuid())
  unidadeId String
  codigo String            // "D-03"
  nome String
  carteiroPadraoId String?
  ativo Boolean @default(true)
  @@unique([unidadeId, codigo])
  @@map("distritos")
}
model DistritoDia {
  id String @id @default(uuid())
  distritoId String
  data DateTime @db.Date   // dia civil America/Sao_Paulo
  carteiroId String?       // designação; nulo = carteiro padrão do distrito
  status StatusDistritoDia @default(ABERTO)
  liberadoEm DateTime?
  @@unique([distritoId, data])
  @@map("distritos_dia")
}
```

```prisma
model Pacote {
  id String @id @default(uuid())
  distritoDiaId String
  unidadeId String
  data DateTime @db.Date
  codigo String            // S10 normalizado
  nome String
  whatsappE164 String?
  telefoneOutro String?    // fixo ou não-WhatsApp
  cep String @db.Char(8)
  logradouro String?  numero String?  complemento String?
  bairro String?  cidade String?  uf String? @db.Char(2)
  origem OrigemPacote
  codigoDigitado Boolean @default(false)
  capturadoPorId String?   // Carteiro.id da última captura
  statusFinalEm DateTime?  // preenchido pelo monitoramento
  statusFinal String?      // ENTREGUE | INSUCESSO_FINAL
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  @@unique([data, codigo])
  @@index([distritoDiaId])
  @@map("pacotes")
}
```

`logradouro` e `cidade` são opcionais no banco porque a planilha pode trazer "sem endereço" (PRD de monitoramento). O mínimo da captura é imposto na conciliação, não no schema.

```prisma
model Captura {
  id String @id                // capturaId do aparelho
  carteiroId String
  distritoDiaId String
  codigo String?
  resultado ResultadoCapturaTipo
  recusa String?
  pacoteId String?
  campos Json?                 // CamposLidos
  pacoteAntes Json?            // snapshot para desfazer
  distritoOrigemId String?     // se TRANSFERENCIA_PENDENTE
  fotoKey String?  fotoExcluidaEm DateTime?
  llmInputTokens Int?  llmOutputTokens Int?
  capturadoEm DateTime  recebidoEm DateTime @default(now())  processadoEm DateTime?
  @@index([carteiroId, resultado])
  @@map("capturas")
}
model PacoteEvento {
  id String @id @default(uuid())
  pacoteId String              // sem FK: sobrevive à remoção
  codigo String  data DateTime @db.Date
  distritoDiaId String
  tipo TipoPacoteEvento
  payload Json                 // campos antes/depois, origem/destino, snapshot, distritoLiberado
  atorUsuarioId String
  capturaId String?
  createdAt DateTime @default(now())
  consumidoEm DateTime?
  @@index([consumidoEm, createdAt])
  @@index([pacoteId, createdAt])
  @@map("pacote_eventos")
}
```

**Alterações em `Usuario`:**
- `senhaTemporaria Boolean @default(false)`;
- `tentativasFalhas Int @default(0)`;
- `bloqueadoAte DateTime?`.

**Migrations.** `backend/prisma/migrations/` não existe. A primeira task cria a baseline `0000_baseline` a partir do schema atual (`prisma migrate diff --from-empty`), marca-a como aplicada no banco de dev (`prisma migrate resolve --applied`) e só então gera a migration desta feature.

**IndexedDB** (aparelho), banco `captura`:
- store `fila`, com chave `capturaId` e índice `estado`;
- store `recentes`, com os últimos 20 resultados, para a tela inicial offline.

### API Endpoints

**Carteiro**: `/api/v1/captura`, com `authenticate` + `requireRole('CARTEIRO')`. Um carteiro com `senhaTemporaria` recebe 403 `troca_de_senha_obrigatoria` em tudo, menos `/auth/trocar-senha`.

| Método e caminho | Descrição | Sucesso | Falhas |
|---|---|---|---|
| `GET /hoje` | Distrito(s) do dia, contadores (capturados, para conferir) e recentes | 200 `{ distritos: [{distritoDiaId, codigo, nome, status}], ativo, contadores, recentes }` | 200 com `distritos: []` (sem distrito) |
| `POST /capturas` | multipart: `foto` (image/jpeg ≤2 MB) + `meta` (JSON: `capturaId` uuid, `distritoDiaId`, `capturadoEm`, `barcodes`, `codigoDigitado`, `codigo`) | 200 `ResultadoCaptura` | 400 validação · 403 distrito não é do carteiro · 409 `captura_em_processamento` · 413 `foto_muito_grande` · 415 `foto_invalida` |
| `GET /conferir` | Capturas `PARA_CONFERIR` e `TRANSFERENCIA_PENDENTE` do carteiro, as mais antigas primeiro | 200 lista | — |
| `GET /capturas/:id/foto` | JPEG da captura, se retido | 200 image/jpeg | 404 · 410 `foto_excluida` |
| `POST /capturas/:id/confirmar` | `{ campos: CamposEditados, confirmarTransferencia?: boolean }` | 200 `ResultadoCaptura` | 400 · 404 · 409 `transferencia_concorrente` · 409 `captura_ja_resolvida` |
| `POST /capturas/:id/descartar` | Descarta uma pendente (e exclui a foto) | 204 | 404 · 409 `captura_ja_resolvida` |
| `POST /capturas/:id/desfazer` | Desfaz um SALVO (remove o pacote criado ou restaura `pacoteAntes`) | 204 | 404 · 409 `remocao_nao_permitida` (criado + distrito liberado) |
| `PATCH /pacotes/:id` | Edita um pacote capturado por ele (mesmas validações) | 200 pacote | 403 · 404 · 400 |
| `DELETE /pacotes/:id` | Remove (só antes da liberação e se a origem ≠ `PLANILHA`; em `PLANILHA_FOTO`, desfaz a foto) | 204 | 403 `remocao_nao_permitida` · 404 |
| `GET /cep/:cep` | Consulta de CEP para a conferência | 200 `CepInfo` | 404 `cep_nao_encontrado` · 503 `cep_indisponivel` |
| `PUT /hoje/ativo` | `{ distritoDiaId }` quando há mais de um distrito no dia | 204 | 403 |

**Supervisor**: `/api/v1/supervisao`, com `authenticate` + `requireRole('UNIDADE')`. Tudo é filtrado por `req.user.unidadeId`, e outra unidade dá 404.

| Método e caminho | Descrição |
|---|---|
| `GET/POST/PATCH /distritos` | Cadastro mínimo de distritos (código, nome, carteiro padrão, ativo) |
| `PUT /distritos/:id/dia/:data/carteiro` | Designa o carteiro do dia (cria o `DistritoDia` se preciso) |
| `GET /distritos-dia?data=AAAA-MM-DD` | Distritos do dia com contagens, `paraConferir` (capturas pendentes do carteiro designado) e transferências de entrada e saída |
| `GET /distritos-dia/:id/pacotes` | Pacotes com origem, `codigoDigitado`, se tem foto e o último ATUALIZADO |
| `GET /pacotes/:id/historico` | Eventos do pacote (inclusive campos antes e depois) |
| `GET /pacotes/:id/foto` | JPEG da última captura com foto retida (410 se excluída, com a data) |
| `DELETE /pacotes/:id` | Remove (409 `pacote_entregue` se entregue); evento REMOVIDO |
| `PUT /carteiros/:id/senha` | Define ou redefine a senha temporária: `senhaTemporaria=true`, revoga os refresh tokens |

**Auth (alterações):**
- `POST /auth/refresh` passa a devolver `{ accessToken, refreshToken }` (rotação), e o frontend grava o novo;
- novo `POST /auth/trocar-senha` `{ senhaAtual, novaSenha }`;
- no login: 5 falhas seguidas → `bloqueadoAte = now + 15 min`, 423 `acesso_bloqueado`; `ativo=false` → 403 `acesso_desativado`;
- o refresh token de carteiro passa a valer 30 dias (sessão longa, PRD F1).

## Integration Points

- **Gemini via AI SDK** (ADR-008):
  - variáveis `CAPTURA_AI_PROVIDER` (`google` | `fake`), `CAPTURA_AI_MODEL` e `CAPTURA_AI_API_KEY`;
  - timeout de 15 s com `AbortSignal`, sem retry no servidor (o retry é a fila do aparelho);
  - um erro vira `PARA_CONFERIR` com o motivo `extracao_indisponivel`;
  - só pede os campos que o DataMatrix não cobriu.
- **ViaCEP e CWS** (ADR-009):
  - `VIACEP_URL` (existente) com timeout de 3 s;
  - o CWS só se `CORREIOS_CWS_USERNAME` estiver preenchido (o `cwsClient` existente);
  - cache Redis `cep:<8dígitos>`, 30 dias para encontrado e 1 dia para `NAO_ENCONTRADO`.
- **Redis e BullMQ**: a nova fila `foto-retencao` em `queue.ts` e um worker registrado em `workers/index.ts` com `repeat: { pattern: '0 3 * * *', tz: 'America/Sao_Paulo' }`.
- **Monitoramento (futuro consumidor)**: lê `PacoteEvento` com `consumidoEm IS NULL` em ordem de `createdAt` e marca `consumidoEm`. O contrato de payload por tipo está na seção Data Models; `distritoLiberado=true` significa aviso imediato.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `backend/prisma/schema.prisma` + `migrations/` | modified/new | 5 modelos e 4 enums novos; campos em `Usuario`; primeira baseline de migrations. Risco médio: o dev foi criado por `db push` | Baseline + `resolve --applied` no dev antes da migration da feature |
| `backend/src/shared/utils/s10.ts` | modified | Restos 0→5 e 1→0, qualquer sufixo de 2 letras. Risco baixo: sem chamadores críticos hoje | Corrigir + testes com vetores UPU |
| `backend/src/modules/auth/*` | modified | Rotação de refresh, troca de senha, bloqueio, TTL de carteiro. Risco médio: afeta todos os logins | Testes de regressão de login e refresh |
| `frontend/src/services/api.ts` | modified | Envio multipart; gravar o refresh rotacionado. Risco médio | Testes do wrapper |
| `backend/src/modules/captura/` | new | Módulo da captura | — |
| `backend/src/modules/supervisao/` | new | API do supervisor e núcleo de distritos | — |
| `backend/src/workers/foto-retencao.worker.ts`, `queue.ts`, `workers/index.ts` | new/modified | Job diário | — |
| `backend/src/app.ts` | modified | Montar `/api/v1/captura` e `/api/v1/supervisao` | — |
| `frontend/src/features/captura/`, `features/supervisao-captura/` | new | App do carteiro e telas do supervisor | — |
| `frontend/src/main.tsx` | modified | Rotas `/carteiro/captura/*` (fora do `CarteiroShell`) e `/unidade/captura/*` | — |
| `frontend/vite.config.ts`, `public/manifest.json`, `index.html` | modified | vite-plugin-pwa, ícones, scope `/carteiro/` | — |
| `backend/package.json` | modified | `ai`, `@ai-sdk/google`, `idb`/zxing no front; remove `@google/generative-ai` não usado (opcional) | — |
| `frontend/package.json` | modified | `zxing-wasm`, `idb`, `vite-plugin-pwa`; dev: `vitest`, `@testing-library/react`, `fake-indexeddb`, `jsdom`, `@playwright/test` | — |
| `docker-compose.yml` | modified | Volume `correios_fotos` montado em `/data/fotos` no backend; variáveis `CAPTURA_AI_*` e `FOTO_*` | — |
| `.github/workflows/ci.yml` | modified | Banco `correiosentregas_test`; job de Playwright | — |
| `Objeto` e as telas SGPD v2 | unchanged | Não tocados | — |

## Testing Approach

Conforme a ADR-013; os casos estão em [`_tests.md`](_tests.md).

- **Unit (backend, Jest)**:
  - `s10`, `parseSigepDataMatrix`, normalização de telefone;
  - montagem de `CamposLidos` por precedência de fonte;
  - as regras de `Conciliacao.aplicar` com Prisma real no banco _test, ou com um repositório falso onde for puro;
  - `CepService` com fetch falso;
  - `GeminiLabelExtractor` com `generateObject` falso;
  - o cálculo de retenção.
- **Unit (frontend, Vitest)**:
  - `captureQueue` com `fake-indexeddb`;
  - `captureSync` com fetch falso e a política de retry;
  - `barcode.decode` sobre imagens de fixture;
  - componentes de conferência com Testing Library.
- **Integração (backend, Jest + supertest)**: o app Express em processo, Postgres `_test` (com a trava do `globalSetup`), Redis real (CI) ou `ioredis-mock` localmente, `FakeLabelExtractor`, CEP falso, `DiskPhotoStore` num diretório temporário.
- **E2E (Playwright)**:
  - o frontend (vite preview) e o backend com `CAPTURA_AI_PROVIDER=fake`, contra o banco `_test` semeado;
  - a câmera é substituída: com `?e2eImage=<fixture>`, só em build de teste, o `CameraPage` usa a imagem no lugar do `getUserMedia`;
  - o offline vem de `context.setOffline(true)`.
- **Fixtures**: rótulos sintéticos gerados com `bwip-js` (já nas deps) para Code 128 e DataMatrix, com dados fictícios e códigos com DV válido (`AA123456785BR`, `OY716488072BR`). Rótulos reais só anonimizados, para validar o parser SIGEP.

## Development Sequencing

### Build Order

1. **Baseline de migrations e correção do S10**: nenhuma dependência.
2. **Auth**: rotação de refresh, troca de senha, bloqueio e TTL (depende de 1 pela migration de `Usuario`).
3. **Núcleo de dados**: `Distrito`, `DistritoDia`, `Pacote`, `Captura`, `PacoteEvento` e a migration (depende de 1).
4. **Parser SIGEP DataMatrix e normalização de telefone** (compartilhados): depende de 1 (s10).
5. **CepService** com cache (depende de nada além do Redis existente).
6. **LabelExtractor** (Gemini e fake) (independente).
7. **PhotoStore** em disco e volume no compose (independente).
8. **ConciliacaoService** (depende de 3 e 4).
9. **CapturaService e rotas `/captura`** (depende de 2 e 5–8).
10. **API `/supervisao`** (depende de 3 e 8).
11. **Worker de retenção** (depende de 3 e 7).
12. **Frontend**: api.ts (multipart e rotação), troca de senha no login (depende de 2).
13. **Frontend**: barcode (zxing-wasm), fila IndexedDB e sync (depende de 4 para o parser compartilhado).
14. **Frontend**: telas da captura e PWA (depende de 9, 12 e 13).
15. **Frontend**: telas do supervisor e senha do carteiro (depende de 10).
16. **E2E Playwright e CI** (banco `_test`, job de e2e) (depende de 14).

### Technical Dependencies

- A chave do Gemini para o correios-entregas (`CAPTURA_AI_API_KEY`; hoje `GOOGLE_AI_API_KEY` está vazia). Pode ser uma chave própria ou a mesma conta do Prosio.
- Um banco `correiosentregas_test` no Postgres de dev (host) e na CI.
- Rótulos reais anonimizados para confirmar as posições do DataMatrix SIGEP (ADR-011).
- A validação jurídica e os prazos de retenção (PRD, Open Questions): os valores padrão ficam configuráveis até lá.

## Monitoring and Observability

- **Métricas** (prom-client existente):
  - `captura_processadas_total{resultado}`;
  - `captura_duracao_segundos` (histograma, por etapa: cep, llm, conciliação);
  - `captura_llm_tokens_total{tipo}`;
  - `captura_llm_falhas_total{motivo}`;
  - `cep_lookup_total{fonte,resultado}`;
  - `fotos_armazenadas_bytes`;
  - `fotos_excluidas_total{motivo}`;
  - `pacote_eventos_pendentes` (gauge, outbox não consumido).
- **Logs** (`shared/utils/logger.ts`), com campos estruturados `capturaId`, `carteiroId`, `distritoDiaId`, `resultado`, `duracaoMs` e `fontes`. **Nunca** nome, telefone, endereço, bytes da foto ou texto do LLM.
- **Alertas** (manuais, até existir alerting):
  - taxa de `PARA_CONFERIR` acima de 50% em 1 h (qualidade de leitura ou modelo aposentado);
  - `captura_llm_falhas_total` crescendo;
  - `fotos_armazenadas_bytes` acima de 5 GB.

## Technical Considerations

### Key Decisions

- **Núcleo aqui, eventos em outbox** (ADR-007): a captura funciona já; o monitoramento consome depois. Trade-off: o monitoramento herda os nomes daqui.
- **Gemini flash-lite direto, dúvida por campo** (ADR-008): o sinal explícito que a regra de revisão exige; o provedor é trocável por ambiente.
- **ViaCEP + CWS + cache** (ADR-009): funciona sem credenciais oficiais.
- **Disco + `PhotoStore` + job diário** (ADR-010): o mínimo operacional numa VPS única.
- **zxing-wasm nos três códigos; DataMatrix primeiro** (ADR-011): menos dúvida e menos custo; um caminho só em Android e iPhone.
- **Síncrono e idempotente** (ADR-012): uma fila só, a do aparelho.
- **Testes com banco `_test` travado** (ADR-013).
- **Refresh rotativo e TTL de 30 dias para carteiro**: requisito da sessão longa. A rotação corrige o bug atual de logout no segundo refresh.
- **Foto parada, não detecção contínua**: determinística e testável com imagens; o preview só enquadra.
- **Rotas fora do `CarteiroShell`**: o shell atual desenha uma moldura de celular e uma status bar falsa, e usa dados mock. A captura usa a tela cheia real.

### Known Risks

- **Posições do DataMatrix SIGEP** (média): validar com rótulos reais; um parser que falha cai para linear mais LLM.
- **Qualidade de foto em aparelho fraco ou luz ruim** (média): orientação na câmera, "Refazer foto", e a revisão como rede de segurança.
- **Armazenamento do navegador no iOS** (média): o Safari pode despejar o armazenamento de um PWA não usado. Mitigação: a fila é pequena, o envio acontece assim que há rede, e o `navigator.storage.persist()` é pedido.
- **Aposentadoria do id do modelo Gemini** (baixa a média): o id fica no ambiente, a métrica de falhas e o fallback para Para conferir.
- **A baseline de migrations sobre um banco criado por `db push`** (média): diferença entre o schema e o banco. Mitigação: `migrate diff` contra o banco de dev antes do `resolve`.
- **Concorrência na transferência** (baixa): a checagem otimista do distrito de origem na transação dá 409.
- **ESM/CJS do AI SDK no Jest** (baixa): configurar `transformIgnorePatterns` ou importar dinamicamente; validar na task 6.

## Architecture Decision Records

- [ADR-001: A foto é mais uma fonte da lista do distrito; dedup por código e "foto vence"](adrs/adr-001.md)
- [ADR-002: Dois códigos de barras, endereço pelo CEP e extração só dos campos livres; revisão só quando há dúvida](adrs/adr-002.md)
- [ADR-003: Captura sem sinal com fila no aparelho; extração ao reconectar](adrs/adr-003.md)
- [ADR-004: App web instalável na área /carteiro, com login por matrícula e senha](adrs/adr-004.md)
- [ADR-005: Captura depois da liberação, reaviso na troca de WhatsApp e janela de correção](adrs/adr-005.md)
- [ADR-006: Foto do rótulo retida até o fim do fluxo mais um prazo curto, com exclusão automática](adrs/adr-006.md)
- [ADR-007: O núcleo do distrito do dia nasce nesta TechSpec, com eventos em outbox](adrs/adr-007.md). Distrito, DistritoDia, Pacote e PacoteEvento, compartilhados com o monitoramento.
- [ADR-008: Extração com Gemini flash-lite direto do backend, dúvida por campo](adrs/adr-008.md). AI SDK `generateObject`; provedor por ambiente; falha vira Para conferir.
- [ADR-009: Endereço pelo CEP via ViaCEP, CWS de fallback, cache Redis](adrs/adr-009.md)
- [ADR-010: Fotos em volume de disco atrás de PhotoStore, exclusão por job diário](adrs/adr-010.md)
- [ADR-011: Três códigos lidos no aparelho com zxing-wasm; DataMatrix > linear > OCR](adrs/adr-011.md)
- [ADR-012: Processamento síncrono e idempotente por capturaId; fila do aparelho é o único retry](adrs/adr-012.md)
- [ADR-013: Testes com banco _test travado, Vitest no front e Playwright com rótulos de exemplo](adrs/adr-013.md)

## Story Mapping

| Story | Components |
|---|---|
| US-001 | auth (login, bloqueio, troca de senha), `api.ts`, LoginPage |
| US-002 | `/supervisao/carteiros/:id/senha`, tela de carteiro |
| US-003 | `distrito-dia.service`, `GET /captura/hoje`, `PUT /hoje/ativo`, CapturaHomePage |
| US-004 | CameraPage, `barcode.ts`, `s10.ts`, `sigep-datamatrix.ts`, captureQueue |
| US-005 | CapturaService, ConciliacaoService (regra 4 e 3), `desfazer`, aviso na store |
| US-006 | Regra 1, `GET /conferir`, ConferirPage, `POST /confirmar`, `GET /cep/:cep` |
| US-007 | CameraPage (digitar), `codigoDigitado` |
| US-008 | CepService, LabelExtractor (logradouro e bairro), regra de dúvida |
| US-009 | normalização de telefone, "ausência não apaga" (regra 3) |
| US-010, US-012 | Regra 3, idempotência por `capturaId` |
| US-011 | Regra 2, `confirmarTransferencia`, evento TRANSFERIDO |
| US-013, US-014 | captureQueue, captureSync, service worker, contadores |
| US-015, US-016 | Regra 5 (`distritoLiberado`), evento WHATSAPP_ALTERADO (consumidor do monitoramento) |
| US-017 | `PATCH`/`DELETE /captura/pacotes/:id`, PacotePage |
| US-018 | `DELETE /supervisao/pacotes/:id` |
| US-019 | `/supervisao/distritos-dia/:id/pacotes`, `/historico`, `/foto` |
| US-020 | `GET /supervisao/distritos-dia` (transferências), evento TRANSFERIDO |
| US-021 | `GET /supervisao/distritos-dia` (`paraConferir`) |
| US-022 | worker `foto-retencao`, exclusão imediata em descartar, desfazer e remover |
