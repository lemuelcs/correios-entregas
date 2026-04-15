# Módulo de Comunicação WhatsApp (WPP-PILOT) — Guia de Migração

> Documentação completa para copiar o módulo de comunicação do projeto **Temelio** para o projeto **Correios-Entregas**.

---

## 1. Visão Geral do Módulo

O módulo de comunicação implementa integração WhatsApp via **Evolution API** (Baileys) com:

- **Bot conversacional** multi-idioma (pt_BR, en_US, es_ES) com keywords e fallback LLM
- **Proxy anônimo** motorista ↔ destinatário (criptografia AES-256-GCM, LGPD)
- **Dispatcher humano** — agente entra/sai de conversas silenciando o bot
- **Dashboard em tempo real** com polling (5s conversas, 3s mensagens)
- **Transcrição de áudio** (OpenAI Whisper / Groq)
- **Multi-provider LLM** (OpenAI, Anthropic, Google, Groq, OpenRouter)
- **Gerenciamento de instância** Evolution API (criar, conectar via QR, reiniciar, excluir)

### Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ConversacoesPage  │  WhatsApp Settings  │  Dashboard    │
│  (polling 5s/3s)   │  (Bot + LLM tabs)   │  (stats)      │
└──────────┬──────────┴──────────┬──────────┴──────┬───────┘
           │ REST API            │ REST API         │
┌──────────▼──────────────────────▼──────────────────▼──────┐
│                    BACKEND (Express)                       │
│  comunicacao.routes.ts → controllers → services            │
│                                                            │
│  Webhook (HMAC) ← Evolution API                            │
│  ┌─────────────────────────────────────────────┐          │
│  │ webhook.handler.ts                           │          │
│  │  ├→ participant.service (identifica quem é)  │          │
│  │  ├→ session.service (Redis cache)            │          │
│  │  ├→ bot.service (keywords + LLM fallback)    │          │
│  │  ├→ proxy-pilot.service (relay criptografado)│          │
│  │  ├→ dispatcher.service (humano assume)       │          │
│  │  └→ insucesso-wpp.service (fluxo falha)      │          │
│  └─────────────────────────────────────────────┘          │
└───────────────────────────┬───────────────────────────────┘
                            │ HTTP
                 ┌──────────▼──────────┐
                 │   Evolution API      │
                 │   (Baileys/WhatsApp) │
                 └─────────────────────┘
```

---

## 2. Inventário Completo de Arquivos

### 2.1 Backend — `backend/src/modules/communication/`

```
communication.module.ts              # Registro Express (12 linhas)
index.ts                             # Barrel export (10 linhas)

types/
  prisma-extended.ts                 # Tipo CommunicationPrisma + export db (37 linhas)

utils/
  phone.ts                           # Normalização telefone BR/E164 (70 linhas)
  locale.ts                          # Resolução locale/timezone/dspNome (29 linhas)
  delivery-status.ts                 # Mapeamento status Baileys → enum (42 linhas)
  config-loader.ts                   # Helpers getWppPilotConfig/require* (31 linhas)
  evolution-error.ts                 # Tratamento erros Evolution API (58 linhas)

middleware/
  validate.ts                        # Middleware validação Zod (33 linhas)

schemas/
  comunicacao.schemas.ts             # Schemas Zod de todos endpoints (67 linhas)

controllers/
  comunicacao.controller.ts          # Endpoints operacionais (262 linhas)
  comunicacao-admin.controller.ts    # Endpoints admin/config (709 linhas)
  notification.controller.ts         # Endpoints notificações (382 linhas)

routes/
  comunicacao.routes.ts              # Definição thin routes (81 linhas)
  notifications.routes.ts            # Rotas notificações (64 linhas)

services/comunicacao/
  webhook.handler.ts                 # Entrada webhook Evolution API (266 linhas)
  evolution.client.ts                # HTTP client Evolution API (399 linhas)
  evolution-url.ts                   # Resolução URL Evolution (48 linhas)
  bot.service.ts                     # Bot conversacional + keywords (624 linhas)
  session.service.ts                 # Sessões Redis (101 linhas)
  participant.service.ts             # Identificação motorista/destinatário (138 linhas)
  dispatcher.service.ts              # Handoff humano (237 linhas)
  proxy-pilot.service.ts             # Proxy anônimo AES-256-GCM (190 linhas)
  insucesso-wpp.service.ts           # Fluxo falha entrega (251 linhas)
  handoff.service.ts                 # Escalação bot → humano (105 linhas)
  llm-adapter.service.ts             # Multi-provider LLM (273 linhas)
  audio.service.ts                   # Transcrição áudio (127 linhas)
  keywords.ts                        # Keywords + intent matching (171 linhas)
  wpp-outbound.ts                    # Envio + persistência mensagem (107 linhas)
  i18n/
    messages.ts                      # Dicionário multi-idioma bot (221 linhas)
    greetings.ts                     # Saudação por horário (14 linhas)
    index.ts                         # Barrel export (3 linhas)

services/
  notification.service.ts            # Notificações FCM/email/SMS (1083 linhas)
  fcm.service.ts                     # Firebase Cloud Messaging (372 linhas)
  email.service.ts                   # Email service (173 linhas)

public/
  communication.api.ts               # API pública do módulo (46 linhas)
  communication.api.interface.ts     # Interface pública (89 linhas)

subscribers/
  driver-events.subscriber.ts       # Listener eventos motorista (25 linhas)

__tests__/
  utils/phone.test.ts               # 19 testes (99 linhas)
  utils/locale.test.ts              # 14 testes (75 linhas)
  utils/delivery-status.test.ts     # 16 testes (75 linhas)
  utils/evolution-error.test.ts     # 12 testes (122 linhas)
  schemas/comunicacao.schemas.test.ts # 21 testes (192 linhas)
```

### 2.2 Prisma Schema — `backend/prisma/schema/communication.prisma`

**Modelos WPP-PILOT (ativos):**

| Modelo | Propósito |
|--------|-----------|
| `WppPilotConfig` | Config por tenant — instanceName, phone, locale, timezone, LLM |
| `WppPilotSession` | Sessão 1-por-telefone — tipo participante, estado, dispatcher |
| `WppPilotMessage` | Mensagem individual — direction, type, content, delivery status |
| `WppProxyPilotSession` | Proxy anônimo — telefone criptografado AES-256-GCM |
| `WppProxyPilotAudit` | Audit LGPD — apenas hash SHA-256, sem conteúdo |
| `WppInsucessoFluxo` | Fluxo falha entrega — status, resposta destinatário |
| `WppDispatcherSession` | Sessão dispatcher humano — entrada/saída timestamped |
| `WppDispatcherMsg` | Mensagem enviada por humano |

**Modelos WABA (legado, dados existentes):**

| Modelo | Propósito |
|--------|-----------|
| `TenantWhatsAppConfig` | Config legada WABA (manter para migração de dados) |
| `WhatsAppConversation` | Conversas legadas |
| `WhatsAppMessage` | Mensagens legadas |
| `WhatsAppTemplate` | Templates HSM legados |
| `WhatsAppMessageQueue` | Fila mensagens legada |
| `LlmUsageLog` | Log uso LLM (ativo, usado por stats) |
| `ProxyCommunicationSession` | Proxy legado |
| `ProxyMessage` | Mensagens proxy legado |
| `ProxyAuditLog` | Audit proxy legado |
| `WhatsappOptOut` | Opt-out legado |

**Enums necessários** (em `enums.prisma`):

```prisma
enum MessageDirection { INBOUND  OUTBOUND }
enum MessageSenderType { DRIVER  CUSTOMER  BOT  AGENT  SYSTEM }
enum MessageType { TEXT  IMAGE  VIDEO  AUDIO  DOCUMENT  LOCATION  CONTACT  INTERACTIVE  TEMPLATE  REACTION }
enum MessageDeliveryStatus { PENDING  SENT  DELIVERED  READ  FAILED }
enum ConversationStatus { OPEN  PENDING_BOT  PENDING_HUMAN  WITH_AGENT  RESOLVED  EXPIRED }
enum ProxySessionStatus { PENDING_CUSTOMER  ACTIVE  CUSTOMER_DECLINED  RESOLVED  EXPIRED  CANCELLED }
enum DeliveryIssueType { CUSTOMER_NOT_AVAILABLE  WRONG_ADDRESS  ACCESS_DENIED  CONTACT_REQUIRED  OTHER }
enum TemplateCategory { UTILITY  MARKETING  AUTHENTICATION }
enum TemplateStatus { PENDING  APPROVED  REJECTED }
enum QueueStatus { PENDING  PROCESSING  COMPLETED  FAILED  RETRY }
enum WppParticipantType { MOTORISTA  DESTINATARIO  UNKNOWN }
enum WppConversationState { BOT_ACTIVE  PROXY_ACTIVE  DISPATCHER_ACTIVE  CLOSED  OPTED_OUT }
enum WppProxyPilotStatus { ACTIVE  ENDED  EXPIRED }
enum WppInsucessoStatus { AGUARDANDO_RESPOSTA  RETORNO_HOJE  REAGENDADO  SEM_RESPOSTA  SEM_TELEFONE  ERRO_ENVIO }
```

### 2.3 Frontend — Páginas e Componentes

```
pages/comunicacao/
  ConversacoesPage.tsx               # Página principal 3 tabs (193 linhas)
  components/
    DashboardTab.tsx                 # Dashboard stats + seletor período (433 linhas)
    ConversasList.tsx                # Lista conversas ativas (111 linhas)
    MessageThread.tsx                # Thread mensagens + input (255 linhas)
    SendMessageTab.tsx               # Envio mensagem direta (150 linhas)
    conversas.constants.ts           # Labels estado/participante (12 linhas)
  hooks/
    useConversas.ts                  # Polling conversas + mensagens (113 linhas)
    useDashboardStats.ts             # Stats + seletor período (299 linhas)
    useDispatcher.ts                 # Join/leave/send conversa (96 linhas)
    useSendMessage.ts                # Envio notificação (84 linhas)

pages/ajustes/
  WhatsApp.tsx                       # Settings page 2 tabs (117 linhas)
  whatsapp/
    whatsapp.types.ts                # Types formulários (30 linhas)
    hooks/
      useWppPilotConfig.ts           # Config CRUD + lifecycle (195 linhas)
      useLlmConfig.ts                # LLM config save/test (71 linhas)
    components/
      QrCodeModal.tsx                # Modal QR code (50 linhas)

components/ajustes/whatsapp/
  WhatsAppBotTab.tsx                 # UI config bot (474 linhas)
  WhatsAppLlmTab.tsx                 # UI config LLM (143 linhas)
  WhatsAppSections.tsx               # Barrel export (2 linhas)

features/
  whatsapp-admin/
    api/whatsapp.api.ts              # API client admin (162 linhas)
    index.ts                         # Barrel export (36 linhas)
  conversas/
    api/conversas.api.ts             # API client conversas (78 linhas)
  comunicacao/
    index.ts                         # Barrel export (18 linhas)

hooks/whatsapp/
  useWhatsAppBootstrap.ts            # Bootstrap config (30 linhas)

types/
  whatsapp.ts                        # Types compartilhados (27 linhas)
```

---

## 3. Variáveis de Ambiente Necessárias

Adicionar ao `.env` do backend:

```env
# ── Evolution API (WhatsApp) ─────────────────────────────
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_PILOT_URL=http://evolution-api:8080
EVOLUTION_PILOT_API_KEY=sua_api_key_aqui
EVOLUTION_PILOT_WEBHOOK_SECRET=seu_hmac_secret_aqui

# ── LLM Providers (opcional — bot funciona sem LLM) ──────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...

# ── Proxy (LGPD) ─────────────────────────────────────────
PROXY_ENCRYPTION_KEY=hex_encoded_32_byte_key

# ── App ──────────────────────────────────────────────────
APP_URL=http://localhost:3002
DEFAULT_DSP_NOME=CorreiosEntregas
```

---

## 4. Dependências NPM Necessárias

### Backend (`backend/package.json`)

```bash
# Já existem no correios-entregas:
# zod, express, @prisma/client, jsonwebtoken, bcryptjs

# Precisam ser instalados:
npm install axios           # HTTP client para Evolution API
npm install pino pino-pretty # Logger estruturado (ou adaptar para console.log)
```

> **Nota sobre Zod**: O Temelio usa Zod v4 (`^4.3.6`), o Correios-Entregas usa Zod v3 (`^3.24.2`). Os schemas criados são compatíveis com v3, mas a sintaxe de `z.record()` difere: no v3 `z.record(z.unknown())` aceita 1 argumento; no v4 precisa de 2 `z.record(z.string(), z.unknown())`. Ajustar conforme a versão instalada.

### Frontend (`frontend/package.json`)

```bash
# O frontend do Temelio usa MUI + TanStack Query + i18next
# O correios-entregas usa Tailwind + Zustand (sem MUI nem TanStack Query)
# Adaptação necessária — ver Seção 7
```

---

## 5. Infraestrutura Docker — Evolution API

Adicionar ao `docker-compose.yml`:

```yaml
  evolution-api:
    image: atendai/evolution-api:v2.2.3
    container_name: correiosentrega-evolution
    restart: unless-stopped
    environment:
      SERVER_URL: http://evolution-api:8080
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY:-change_me_api_key}
      DATABASE_ENABLED: "false"
      REDIS_ENABLED: "true"
      REDIS_URI: redis://redis:6379/1
      WEBHOOK_GLOBAL_ENABLED: "false"
      LOG_LEVEL: warn
    depends_on:
      redis:
        condition: service_healthy
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8080/ >/dev/null || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 30s
```

E adicionar ao backend service:

```yaml
  backend:
    environment:
      # ... existentes ...
      EVOLUTION_API_URL: http://evolution-api:8080
      EVOLUTION_PILOT_URL: http://evolution-api:8080
      EVOLUTION_API_KEY: change_me_api_key
      EVOLUTION_PILOT_API_KEY: change_me_api_key
      EVOLUTION_PILOT_WEBHOOK_SECRET: change_me_webhook_secret
      APP_URL: http://backend:3002
    depends_on:
      # ... existentes ...
      evolution-api:
        condition: service_healthy
```

---

## 6. Guia Passo a Passo — Instalação no Correios-Entregas

### Passo 1: Adaptar o tipo `prisma-extended.ts`

O Correios-Entregas usa Prisma v6 com `PrismaClient` simples (sem `$extends`). Portanto, o `prisma-extended.ts` precisa ser simplificado — importar o prisma client diretamente do shared e tipar os novos modelos.

Criar `backend/src/modules/communication/types/prisma-extended.ts`:

```typescript
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../../../shared/utils/prisma';

// Após adicionar os modelos WPP ao schema, o PrismaClient
// já terá os delegates tipados. Este wrapper centraliza o acesso.
// Se os delegates não aparecerem (ex: após $extends), adicionar aqui.
export const db = prisma;

// Re-export para uso nos services
export type { PrismaClient, Prisma };
```

### Passo 2: Adaptar Auth Middleware

O Temelio usa `req.dspId` (multi-tenant DSP). O Correios-Entregas usa `req.user.unidadeId`.

**Adaptação necessária nos controllers:**

| Temelio | Correios-Entregas |
|---------|-------------------|
| `req.dspId!` | `req.user!.unidadeId!` |
| `dspId: string` | `unidadeId: string` |
| `authenticate` | `authenticate` (já existe) |
| `extractDspId` | Não necessário (unidadeId já vem no JWT) |

**No Express type augmentation** (`src/shared/types/express.d.ts`), já existe `unidadeId`. Basta usar.

### Passo 3: Adaptar AppError

O Temelio usa `new AppError(message, statusCode)`. O Correios-Entregas usa `new AppError(statusCode, message)`.

**A ordem dos parâmetros é invertida!** Precisa ajustar em:
- `utils/config-loader.ts` — 3 ocorrências
- `controllers/*.ts` — onde `next(new AppError(...))` é usado

### Passo 4: Adaptar Logger

O Temelio usa Pino: `import logger from '../../../../lib/logger'` com `logger.info(...)`.

Opções para o Correios-Entregas:
1. **Instalar Pino** e criar `src/shared/utils/logger.ts`
2. **Usar console** e criar um wrapper:

```typescript
// src/shared/utils/logger.ts
export default {
  info: (data: any, msg?: string) => console.log(`[INFO] ${msg || ''}`, data),
  warn: (data: any, msg?: string) => console.warn(`[WARN] ${msg || ''}`, data),
  error: (data: any, msg?: string) => console.error(`[ERROR] ${msg || ''}`, data),
  debug: (data: any, msg?: string) => console.debug(`[DEBUG] ${msg || ''}`, data),
};
```

### Passo 5: Adaptar Redis

O Temelio usa `config/redis.ts` com `getRedis()` e `isRedisAvailable()`.
O Correios-Entregas usa BullMQ com Redis mas não tem um cliente Redis genérico.

Criar `backend/src/shared/utils/redis.ts`:

```typescript
import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      redis = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
      redis.connect().catch(() => { redis = null; });
    } catch {
      redis = null;
    }
  }
  return redis;
}

export function isRedisAvailable(): boolean {
  return redis?.status === 'ready';
}
```

E instalar: `npm install ioredis`

### Passo 6: Copiar Prisma Schema

Copiar o conteúdo de `communication.prisma` para o schema do Correios-Entregas.

**Opção A** — Schema único: adicionar modelos e enums ao `prisma/schema.prisma` existente.

**Opção B** — Multi-file schema (requer Prisma 5.15+): mover para `prisma/schema/` e ajustar o generator.

**Adaptações no schema:**

1. Substituir `dspId` por `unidadeId` em todos os modelos que referenciam o tenant
2. Substituir relação `motorista` por `carteiro` (modelo equivalente no Correios-Entregas)
3. Substituir `Motorista` por `Carteiro` nas relações
4. Ajustar campo `celular` para o campo de telefone equivalente no modelo `Carteiro`
5. Substituir `PacoteInsucesso` pelo modelo equivalente de objetos com falha

**Mapeamento de modelos Temelio → Correios-Entregas:**

| Temelio | Correios-Entregas | Campo chave |
|---------|-------------------|-------------|
| `DSP` | `Unidade` | `id` |
| `Motorista` | `Carteiro` | `id`, `celular` → `telefone` |
| `PacoteInsucesso` | `Objeto` (com status falha) | `destinatarioTelefone` |
| `Rota` | `Rota` | `id` |
| `dspId` | `unidadeId` | Foreign key |

### Passo 7: Copiar Backend Module

```bash
# Do diretório raiz do correios-entregas
mkdir -p backend/src/modules/communication

# Copiar módulo inteiro
cp -r /Users/lemuelsilva/dev/temelio/backend/src/modules/communication/* \
      backend/src/modules/communication/
```

Depois, ajustar os imports em TODOS os arquivos copiados:

| Import Temelio | Import Correios-Entregas |
|----------------|--------------------------|
| `from '../../../../lib/prisma'` | `from '../../../shared/utils/prisma'` |
| `from '../../../../lib/logger'` | `from '../../../shared/utils/logger'` |
| `from '../../../../config/redis'` | `from '../../../shared/utils/redis'` |
| `from '../../../../middlewares/auth.middleware'` | `from '../../../shared/middleware/auth.middleware'` |
| `from '../../../../middlewares/error.middleware'` | `from '../../../shared/middleware/error-handler.middleware'` |
| `from '../../../middlewares/auth.middleware'` | `from '../../shared/middleware/auth.middleware'` |
| `from '../../../middlewares/rbac.middleware'` | Remover (usar `req.user.unidadeId` direto) |
| `from '../../../middlewares/error.middleware'` | `from '../../shared/middleware/error-handler.middleware'` |
| `from '../../../lib/prisma'` | `from '../../shared/utils/prisma'` |
| `from '../../../lib/logger'` | `from '../../shared/utils/logger'` |

### Passo 8: Registrar Módulo no App

Editar `backend/src/app.ts`:

```typescript
// Adicionar import
import { comunicacaoRoutes } from './modules/communication/routes/comunicacao.routes';

// Adicionar rota (antes do errorHandler)
app.use('/api/v1/comunicacao', comunicacaoRoutes);
```

**Nota:** O módulo do Temelio usa `export default router`. O Correios-Entregas usa `export { router as comunicacaoRoutes }`. Ajustar o export do routes file:

```typescript
// comunicacao.routes.ts — trocar última linha:
// export default router;
export { router as comunicacaoRoutes };
```

### Passo 9: Adaptar Frontend

O frontend do Correios-Entregas **já tem páginas de comunicação** scaffolded com dados mock em:
- `frontend/src/features/gestao/pages/comunicacao/` (6 páginas)
- `frontend/src/stores/comunicacao.store.ts` (Zustand store)
- `frontend/src/types/comunicacao.types.ts` (tipos)

**Estratégia recomendada:** Manter a estrutura frontend existente (Zustand, Tailwind, sem MUI) e conectar ao backend real.

As páginas do Temelio usam MUI + TanStack Query + i18next que **não existem** no Correios-Entregas. Copiar essas páginas diretamente criaria incompatibilidade. Em vez disso:

1. **Manter as 6 páginas existentes** no Correios-Entregas
2. **Atualizar o Zustand store** (`comunicacao.store.ts`) para fazer chamadas reais ao backend:

```typescript
// Exemplo de adaptação do store
fetchConversas: async () => {
  set({ loading: true });
  try {
    const { data } = await api.get('/comunicacao/conversas');
    set({ conversas: data, loading: false });
  } catch (err: any) {
    set({ error: err.message, loading: false });
  }
},
```

3. **Mapeamento de endpoints para o store:**

| Ação Store | Endpoint Backend |
|------------|------------------|
| `fetchConversas` | `GET /api/v1/comunicacao/conversas` |
| `fetchMensagens` | `GET /api/v1/comunicacao/conversas/:id/mensagens` |
| `enviarMensagemGestor` | `POST /api/v1/comunicacao/dispatcher/:id/mensagem` |
| `assumirConversa` | `POST /api/v1/comunicacao/dispatcher/entrar` |
| `encerrarConversa` | `POST /api/v1/comunicacao/dispatcher/:id/sair` |
| `fetchSessoes` | `GET /api/v1/comunicacao/proxy/sessions` |
| `encerrarSessao` | `POST /api/v1/comunicacao/proxy/:id/end` |
| `fetchInstanciaStatus` | `GET /api/v1/comunicacao/status` |
| `conectarInstancia` | `POST /api/v1/comunicacao/admin/instance/conectar` |
| `desconectarInstancia` | `DELETE /api/v1/comunicacao/admin/instance` |
| `fetchTemplates` | (remover — WABA templates não existem mais) |
| Stats/Dashboard | `GET /api/v1/comunicacao/admin/stats?dataInicio=X&dataFim=Y` |
| Config WPP | `GET /api/v1/comunicacao/admin/config` |
| Save Config | `POST /api/v1/comunicacao/admin/config` |
| LLM Config | `GET/PUT /api/v1/comunicacao/admin/llm-config` |
| Test LLM | `POST /api/v1/comunicacao/admin/llm-config/test` |
| Notify | `POST /api/v1/comunicacao/notify` |

### Passo 10: Rodar Migração Prisma

```bash
cd backend
npx prisma generate   # Gerar client com novos modelos
npx prisma migrate dev --name add_communication_module
```

---

## 7. Checklist de Adaptações (Find & Replace)

Execute estas substituições nos arquivos copiados:

### 7.1 Conceito de Tenant

```
# Em TODOS os arquivos do módulo copiado:
dspId           →  unidadeId
req.dspId!      →  req.user!.unidadeId!
dspNome         →  unidadeNome
DSP_NOME        →  UNIDADE_NOME
DEFAULT_DSP_NOME →  DEFAULT_UNIDADE_NOME
'Delivyo'       →  'CorreiosEntregas'
```

### 7.2 Conceito de Participante

```
# Nos services e schemas:
MOTORISTA       →  CARTEIRO
motorista       →  carteiro
motoristaId     →  carteiroId
motoristaPhone  →  carteiroPhone
Motorista       →  Carteiro    (modelo Prisma)
```

### 7.3 AppError (ordem de parâmetros invertida)

```
# Temelio:    new AppError(message, statusCode)
# Correios:   new AppError(statusCode, message)

# Ajustar em config-loader.ts:
new AppError('WppPilotConfig não encontrado...', 404)
→ new AppError(404, 'WppPilotConfig não encontrado...')
```

### 7.4 extractDspId Middleware

O Temelio usa `extractDspId` middleware que popula `req.dspId`. No Correios-Entregas, `unidadeId` já vem no JWT.

```typescript
// comunicacao.routes.ts — REMOVER estas linhas:
import { extractDspId } from '../../shared/middleware/rbac.middleware';
router.use(extractDspId);

// Em TODOS os controllers — SUBSTITUIR:
const dspId: string = req.dspId!;
// POR:
const unidadeId: string = req.user!.unidadeId!;
```

---

## 8. Diagrama de Dependências Externas

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  PostgreSQL  │     │    Redis     │     │ Evolution   │
│  (existente) │     │  (existente) │     │ API v2      │
│              │     │              │     │ (NOVO)      │
└──────┬───────┘     └──────┬───────┘     └──────┬──────┘
       │                    │                    │
       │  Prisma ORM        │  Sessões cache     │  WhatsApp
       │                    │                    │
┌──────▼────────────────────▼────────────────────▼──────┐
│                    Backend Express                      │
│                                                        │
│  Módulos existentes  │  NOVO: communication module     │
└────────────────────────────────────────────────────────┘
       │
       │  Opcional (LLM)
       │
┌──────▼──────────┐
│  OpenAI / etc.  │
│  (se habilitado)│
└─────────────────┘
```

---

## 9. Resumo dos Comandos de Instalação

```bash
cd /Users/lemuelsilva/dev/correios-entregas

# 1. Instalar dependências backend
cd backend
npm install axios ioredis

# 2. Criar logger wrapper (se não instalar Pino)
# → Criar src/shared/utils/logger.ts (ver Passo 4)

# 3. Criar Redis client wrapper
# → Criar src/shared/utils/redis.ts (ver Passo 5)

# 4. Copiar módulo backend
mkdir -p src/modules/communication
cp -r /Users/lemuelsilva/dev/temelio/backend/src/modules/communication/* \
      src/modules/communication/

# 5. Copiar Prisma schema (modelos + enums)
# → Adicionar ao prisma/schema.prisma (ver Passo 6)

# 6. Gerar Prisma client + migração
npx prisma generate
npx prisma migrate dev --name add_communication_module

# 7. Aplicar adaptações (ver Seção 7)
# → Find & Replace dspId → unidadeId, etc.

# 8. Registrar módulo no app.ts
# → Adicionar import + app.use (ver Passo 8)

# 9. Atualizar docker-compose.yml
# → Adicionar serviço evolution-api (ver Seção 5)

# 10. Atualizar .env
# → Adicionar variáveis Evolution API (ver Seção 3)

# 11. Atualizar frontend store
# → Conectar comunicacao.store.ts aos endpoints reais (ver Passo 9)

# 12. Verificar compilação
npx tsc --noEmit

# 13. Subir serviços
cd ..
docker compose up -d
```

---

## 10. Funcionalidades que NÃO se Aplicam

Alguns recursos do Temelio dependem de modelos/conceitos que não existem no Correios-Entregas:

| Recurso | Motivo | Ação |
|---------|--------|------|
| `notification.service.ts` (FCM/email) | Depende de Firebase Admin + modelos Notification | Remover ou adaptar separadamente |
| `fcm.service.ts` | Firebase Cloud Messaging | Remover se não usar push notifications |
| `email.service.ts` | Email transacional | Remover se não usar email |
| `driver-events.subscriber.ts` | EventBus do Temelio | Remover (usar BullMQ workers se necessário) |
| `public/communication.api.*` | API inter-módulos do Temelio | Remover |
| Templates HSM (Meta) | WABA legado removido | Já removido, páginas frontend de templates são mock |
| `insucesso-wpp.service.ts` | Depende de `PacoteInsucesso` | Adaptar para modelo de Objetos com falha |

---

## 11. Teste de Verificação Pós-Instalação

Após concluir todos os passos:

```bash
# 1. Backend compila
cd backend && npx tsc --noEmit

# 2. Testes do módulo passam
npx jest src/modules/communication/__tests__/ --passWithNoTests

# 3. Servidor sobe sem erros
npm run dev

# 4. Health check
curl http://localhost:3002/health

# 5. Status WhatsApp (deve retornar connected: false)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3002/api/v1/comunicacao/status

# 6. Evolution API está acessível
curl http://localhost:8080/

# 7. Criar instância e conectar via QR
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"correios-dev","phoneNumber":"5561999999999"}' \
  http://localhost:3002/api/v1/comunicacao/admin/instance/criar
```
