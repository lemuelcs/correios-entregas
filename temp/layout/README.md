# Correios Entregas — Interface JSX

Protótipos de interface em React + Tailwind CSS para os 3 ambientes do sistema.

---

## 📁 Estrutura de Arquivos

```
correios-jsx/
│
├── tailwind.config.js          # Tokens de cor Correios + tipografia
├── postcss.config.js           # Integração Tailwind + Vite
├── package.json                # Dependências (React 18, Vite, Tailwind 3)
│
├── src/
│   ├── shared/                 # Compartilhado entre os 3 ambientes
│   │   ├── globals.css         # Variáveis CSS, fonte Plus Jakarta Sans
│   │   └── components/
│   │       ├── Badge.jsx       # Pill de status (success/warning/danger/info...)
│   │       ├── KpiCard.jsx     # Card de métrica com bordinha colorida no topo
│   │       ├── ProgressBar.jsx # Barra de progresso reutilizável
│   │       └── Alert.jsx       # Faixa de alerta colorida
│   │
│   ├── gestao/                 # 🖥️  Desktop — Gestor da Unidade
│   │   ├── App.jsx             # Roteamento entre páginas + layout principal
│   │   ├── components/
│   │   │   ├── Sidebar.jsx     # Navegação lateral fixa (azul Correios)
│   │   │   └── Header.jsx      # Barra superior com título e notificações
│   │   └── pages/
│   │       ├── Dashboard.jsx           # KPIs, mapa, rotas do dia, previsão
│   │       ├── Recebimento.jsx         # Scanner de unitizadores + lista esperados
│   │       ├── Triagem.jsx             # Sort wall visual + plano de triagem
│   │       ├── Roteirizacao.jsx        # Config solver + resultado de otimização
│   │       ├── Despacho_Monitor_Reconcilia.jsx
│   │       │   ├── Despacho           # Liberar rotas para campo
│   │       │   ├── Monitoramento      # Scatter planejado×executado + alertas
│   │       │   └── Reconciliacao      # Scan retorno + objetos pendentes
│   │       └── Cadastros_Config.jsx
│   │           ├── Previsao           # Gráfico 14 dias + simulador dimensionamento
│   │           ├── Unitizadores       # CRUD bags/sacas/palletes
│   │           ├── Veiculos           # Gestão de frota
│   │           ├── Carteiros          # Equipe + import CSV
│   │           ├── Ponto              # Presença diária
│   │           └── Configuracoes      # Dados unidade, CEPs, integrações
│   │
│   ├── carteiro/               # 📱 Mobile PWA — Carteiro em campo
│   │   ├── App.jsx             # Phone frame + roteamento entre telas
│   │   ├── components/
│   │   │   ├── TopBar.jsx      # Barra superior azul com botão voltar
│   │   │   └── BottomNav.jsx   # 4 tabs: Início / Rota / Coleta / Histórico
│   │   └── screens/
│   │       └── Screens.jsx     # 8 telas em um único arquivo:
│   │           ├── Home           # Status dia, CTA rota, SPH
│   │           ├── Coleta         # Scan QR unitizadores
│   │           ├── Rota           # Parada atual + próximas paradas
│   │           ├── Entrega        # Steps: Foto POD → Scan → Confirmar
│   │           ├── EntregaOk      # Feedback sucesso + próxima parada
│   │           ├── Insucesso      # Motivos BDE_02/04/07/10
│   │           ├── Resumo         # Stats finais + scan chegada unidade
│   │           └── Historico      # 30 dias, FADR, SPH médio
│   │
│   └── destinatario/           # 📱 Mobile PWA — Destinatário
│       ├── App.jsx             # Phone frame + roteamento
│       ├── components/
│       │   ├── TopBar.jsx
│       │   └── BottomNav.jsx   # 4 tabs: Objetos / Rastrear / Ajuda / Conta
│       └── screens/
│           └── Screens.jsx     # 6 telas:
│               ├── Login          # CPF/email + rastrear sem login
│               ├── Objetos        # Lista com status coloridos
│               ├── Detalhe        # Stepper progresso + timeline SRO
│               ├── Interacao      # 5 opções: reagendar/terceiro/redirecionar...
│               ├── Reagendar      # Mini calendário + turno
│               └── Nps            # Grid 0-10 detrator/neutro/promotor
```

---

## 🚀 Como rodar

### Pré-requisitos
- Node.js 18+
- npm 9+

### Instalação

```bash
cd correios-jsx
npm install
```

### Rodar em desenvolvimento

Cada ambiente tem seu próprio servidor de desenvolvimento:

```bash
# Gestão Desktop (abre em http://localhost:5173)
npm run dev:gestao

# App Carteiro Mobile (abre em http://localhost:5174)
npm run dev:carteiro

# App Destinatário Mobile (abre em http://localhost:5175)
npm run dev:destinatario
```

> Os apps mobile simulam um phone frame (390×844px) visível no desktop.
> Em produção/mobile real, o frame some e o app ocupa a tela inteira.

---

## 🎨 Design System

### Cores (definidas em `tailwind.config.js` e `globals.css`)

| Token               | Valor     | Uso |
|---------------------|-----------|-----|
| `correios-blue`     | `#003399` | Cor primária — sidebar, botões, destaques |
| `correios-yellow`   | `#FFD600` | Cor acento — CTAs, badges especiais |
| `correios-blue-50`  | `#E6EBF7` | Fundo de cards/badges azuis suaves |
| success             | `#16A34A` | Status entregue / ok |
| warning             | `#D97706` | Insucesso / atenção |
| danger              | `#DC2626` | Erro / bloqueado |

### Tipografia
**Plus Jakarta Sans** — importada do Google Fonts em `globals.css`.

---

## 📦 Componentes compartilhados

| Componente      | Props principais                          |
|-----------------|-------------------------------------------|
| `<Badge>`       | `variant`, `size`, `dot`                  |
| `<KpiCard>`     | `label`, `value`, `unit`, `delta`, `accent` |
| `<ProgressBar>` | `value (0-100)`, `color`, `size`, `label` |
| `<Alert>`       | `variant`, `title`, `onClose`             |

---

## 📋 Cobertura de regras de negócio

- Máx. 2 tentativas de entrega por objeto
- Eventos SRO: OEC, BDE_01/02/04/07/10/21, FC_45, RO, CTE
- FADR (Fator de Aproveitamento da Distribuição) exibido no histórico
- SPH (Objetos por Hora) calculado e exibido na rota e histórico
- PTL / Manual / ADTA como modos de triagem
- Solvers VROOM e PyVRP com modos Absoluto / LargeVan / Balanceado
- NPS 0-10 com classificação detrator/neutro/promotor

---

## 🔧 Próximos passos sugeridos

1. **Separar arquivos grandes** — `Screens.jsx` pode ser dividido em um arquivo por tela
2. **React Router** — substituir o `useState` de roteamento por `react-router-dom`
3. **API Integration** — conectar `fetch` ao backend Express/Prisma
4. **PWA** — adicionar `vite-plugin-pwa` para Service Worker e instalação offline
5. **Testes** — Vitest + Testing Library para componentes críticos
