---
schema_version: "compozy.tasks/v2"
workflow: app-carteiro-captura-rotulo
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
    - id: task_04
      file: task_04.md
    - id: task_05
      file: task_05.md
    - id: task_06
      file: task_06.md
  edges:
    - from: task_01
      to: task_02
    - from: task_01
      to: task_04
    - from: task_02
      to: task_03
    - from: task_02
      to: task_05
    - from: task_04
      to: task_05
    - from: task_03
      to: task_06
    - from: task_04
      to: task_06
---

# App do carteiro — captura do rótulo: Task List

| Task | Title | Type | Complexity | Depends on | Tests |
|------|-------|------|------------|------------|-------|
| [task_01](task_01.md) | Fundação: migrations, núcleo de dados, auth e infra de teste | backend | critical | — | 33 UT · 4 IT |
| [task_02](task_02.md) | Módulo de captura no backend | backend | high | task_01 | 38 UT · 83 IT |
| [task_03](task_03.md) | API do supervisor | backend | medium | task_02 | 23 IT |
| [task_04](task_04.md) | Fundação do app no aparelho | frontend | high | task_01 | 29 UT |
| [task_05](task_05.md) | Telas da captura e E2E | frontend | high | task_02, task_04 | 21 UT · 3 E2E |
| [task_06](task_06.md) | Telas do supervisor | frontend | medium | task_03, task_04 | 4 UT |

Ondas: 01 → (02 ∥ 04) → (03 ∥ 05) → 06.

**Pré-requisitos fora do grafo (ADR-014):** as tasks 01, 03 e 04 de `monitoramento-entregas-whatsapp` antes da task_01 daqui, e a task_07 de lá antes da task_06 daqui.
