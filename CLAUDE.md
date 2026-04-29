# Correios Entregas - Sistema de Gestao de Entregas dos Correios

## Sobre o Projeto

Sistema de gestao logistica para operacoes de entrega dos Correios brasileiros. Cobre o fluxo completo: recebimento, triagem, roteirizacao, despacho, entrega pelo carteiro e interacao com destinatarios via WhatsApp. Multi-ator: gestores, carteiros, destinatarios.

## Arquitetura

- **Monorepo Turbo**: 2 workspaces (backend, frontend)
- **Backend**: Express 4 + TypeScript + Prisma 6 + PostgreSQL 18 (TimescaleDB)
- **Frontend**: React 19 + Vite 6 + Tailwind CSS 4 + Zustand 5
- **WhatsApp**: consome o hub centralizado em `delivyo-services/microservices/ms-whatsapp` via `/api/v1/comunicacao/*` (proxy HTTP). Nao ha mais fork local.
- **Auth**: JWT + refresh tokens
- **Jobs assincronos**: BullMQ (Redis) — VROOM, PyVRP, geocoding, DnE sync, NPS
- **Real-time**: SSE (Server-Sent Events) para monitoramento ao vivo
- **Routing engines**: OSRM + VROOM + PyVRP (otimizacao de rotas)
- **Infraestrutura compartilhada**: consome servicos do `delivyo-services` (gateway, Postgres, Redis, OSRM, VROOM)

## Estrutura de Diretorios

```
backend/src/
  modules/              # 12 modulos de feature
    auth/               # JWT login, refresh, logout
    unidade/            # Gestao de unidades/instalacoes
    recebimento/        # Recebimento de objetos
    triagem/            # Triagem manual/PTL/ADTA
    roteirizacao/       # Otimizacao de rotas (VROOM/PyVRP)
    despacho/           # Despacho de rotas
    carteiro/           # App do carteiro (coleta, entrega)
    destinatario/       # Portal do destinatario (rastreio, reagendamento)
    monitoramento/      # Monitoramento em tempo real + SSE
    reconciliacao/      # Reconciliacao de entregas
    gestao/             # Administracao/sede
    unitizadores/       # Gestao de containers/sacas
  integrations/         # Clientes de APIs externas
    vroom/              # VROOM VRP solver
    pyvrp/              # PyVRP solver
    osrm/               # OSRM routing
    correios-cws/       # API CWS dos Correios
    dne/                # Base de enderecos DNE
    sgod/               # Exportacao SGOD
  workers/              # Processadores BullMQ
    vroom.worker.ts
    pyvrp.worker.ts
    geocoder.worker.ts
    dne-sync.worker.ts
    nps-notify.worker.ts
  shared/               # Utilitarios comuns
    middleware/          # Auth, error handling, rate limit
    utils/              # Prisma, Redis, CEP, logging
    types/              # Interfaces TypeScript
  app.ts                # Setup Express (rotas, middleware)
  server.ts             # Entry point
  queue.ts              # Definicoes de filas BullMQ

frontend/src/
  features/             # Organizacao por feature
    unidade/            # Paginas + layout da unidade
    carteiro/           # App do carteiro (fluxo de entrega)
    destinatario/       # Portal do destinatario
    gestao/             # Paginas de administracao
  pages/                # Paginas top-level (LoginPage)
  components/           # Componentes React compartilhados
  services/             # API client (api.ts com auto refresh)
  stores/               # Zustand stores por feature
  hooks/                # Custom hooks
  utils/                # Helpers (date-helpers.ts)
  types/                # Definicoes TypeScript
  shared/               # Componentes UI globais
  main.tsx              # Entry point React

infra/                  # Configs de infra compartilhada
osrm/                   # Docker files OSRM
vroom/                  # Docker files VROOM
redis/                  # Docker files Redis
temp/                   # Codigo experimental
docs/                   # Documentacao
```

## Comandos Essenciais

```bash
# Root (Turbo)
npm run dev                  # Todos os servicos em watch mode
npm run build                # Build de todos os pacotes
npm run lint                 # Lint de todos os pacotes
npm run test                 # Testes (backend)
npm run dev:backend          # Apenas backend
npm run dev:frontend         # Apenas frontend
npm run db:migrate           # Prisma migrations
npm run db:seed              # Seed do banco
npm run db:studio            # Prisma Studio GUI

# Docker
npm run docker:up            # Subir containers com rebuild
npm run docker:down          # Parar containers
npm run docker:logs          # Logs dos containers
npm run docker:up:infra      # Apenas infra compartilhada
npm run docker:down:infra    # Parar infra compartilhada

# Backend
cd backend && npm run dev              # tsx watch src/server.ts
cd backend && npm run build            # tsc
cd backend && npm run test             # jest
cd backend && npm run lint             # eslint src/
cd backend && npm run db:generate      # prisma generate

# Frontend
cd frontend && npm run dev             # Vite (porta 5180)
cd frontend && npm run build           # tsc && vite build
cd frontend && npm run lint            # eslint src/
```

## Padroes de Codigo

### Backend

- **Modulos**: cada modulo tem `module.controller.ts`, `module.service.ts`, `module.routes.ts`
- **Controllers**: try/catch com `next(err)`, delegam para services
- **Services**: toda logica de negocio, acesso ao banco via Prisma
- **Validacao**: schemas Zod nos controllers antes de passar para services
- **Auth middleware**: `authenticate` extrai JWT e popula `req.user`
- **Erros**: classe `AppError` com statusCode, middleware centralizado
- **DB**: Prisma client singleton importado de `shared/utils`
- **Jobs**: BullMQ workers para operacoes longas (roteirizacao, geocoding, sync)
- **Path aliases**: `@/*` mapeado para `src/*` via tsconfig

### Frontend

- **Feature-based**: cada feature (unidade, carteiro, destinatario, gestao) tem paginas, componentes, stores proprios
- **State**: Zustand stores (auth.store, roteirizacao.store, etc.) — NAO usa Redux
- **API**: classe `ApiClient` centralizada em `services/api.ts` com auto token refresh
- **Rotas**: React Router v7 com rotas aninhadas por perfil (gestao, unidade, carteiro, destinatario)
- **UI**: Tailwind CSS v4, Lucide icons, componentes shared customizados
- **Real-time**: SSE via endpoint `/events` (auth obrigatorio)

### API REST

- Versionamento: `/api/v1/{modulo}/{endpoint}`
- Health check: `GET /health`
- SSE stream: `GET /events`
- Resposta: JSON com `{data}` ou `{error, details}`
- Status codes: 200, 400 (validacao), 401, 403, 404, 409, 503

## Database

- **PostgreSQL 18** com extensao **TimescaleDB** (dados time-series)
- **ORM**: Prisma v6.7.0
- **Schema**: `backend/prisma/schema.prisma` com 30+ modelos
- **Modelos principais**: Usuario, Unidade, Carteiro, Objeto, Unitizador, Rota, Parada, ObjetoEvento, Conversa, Mensagem
- **Migrations**: Prisma migrate (sem SQL manual)
- **Seed**: `backend/prisma/seed.ts`

## Infraestrutura Docker

- `osrm` — Open Street Routing Machine (perfil legacy)
- `vroom` — VROOM VRP solver (perfil legacy)
- `backend` — Express API (porta 3002)
- `frontend` — Vite dev server (porta 5181)

**Servicos consumidos do hub `delivyo-services` (rede `delivyo-services_delivyo_network`):**
- `postgres` — TimescaleDB PostgreSQL 18
- `redis` — Redis 7 (cache + fila de jobs)
- `ms-whatsapp` — WhatsApp/Evolution centralizado (via `http://host.docker.internal/services/whatsapp`)

**Perfis Docker:**
- Sem perfil = sempre ativo (backend, frontend)
- `legacy` = servicos opcionais locais (osrm, vroom)

## Variaveis de Ambiente

```
# Database
DATABASE_URL              # Connection string PostgreSQL

# Cache/Jobs
REDIS_URL                 # Connection Redis

# Auth
JWT_SECRET                # Chave HS256 (min 32 chars)
JWT_REFRESH_SECRET        # Chave refresh token

# APIs externas
CORREIOS_CWS_URL          # API CWS Correios
VIACEP_URL                 # Fallback de enderecos

# Routing/VRP
OSRM_URL                  # OSRM endpoint
VROOM_URL                 # VROOM endpoint
PYVRP_URL                 # PyVRP endpoint

# WhatsApp Hub (proxy para delivyo-services/ms-whatsapp)
WHATSAPP_HUB_BASE_URL      # Ex: http://host.docker.internal/services/whatsapp
WHATSAPP_HUB_API_PREFIX    # Ex: /api/comunicacao
WHATSAPP_HUB_TIMEOUT_MS    # Ex: 10000
WHATSAPP_HUB_TENANT_ID     # Ex: CORREIOS

# App
PORT=3002                 # Porta backend
NODE_ENV                  # development/production
FRONTEND_URL              # CORS origin
```

## Testes

- **Framework**: Jest v29 com ts-jest
- **Localizacao**: `__tests__/` ao lado do source (ex: `src/__tests__/app.health.test.ts`)
- **Padrao**: `*.test.ts`
- **Frontend**: sem setup de testes configurado

## Requisitos

- Node.js >= 22.0.0
- npm >= 10.9.2
- Docker + Docker Compose

## Regras Importantes

- Nao criar arquivos .md de documentacao a menos que solicitado
- O projeto consome servicos compartilhados do `delivyo-services` — NAO duplicar infra aqui
- Perfil `legacy` no docker-compose e para servicos que estao migrando para `delivyo-services`
- Zustand para state management, NAO Redux
- Validacao com Zod, NAO Joi/Yup
- BullMQ para jobs assincronos, NAO cron/setInterval
