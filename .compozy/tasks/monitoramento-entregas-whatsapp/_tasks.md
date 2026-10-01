---
schema_version: "compozy.tasks/v2"
workflow: monitoramento-entregas-whatsapp
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
    - id: task_07
      file: task_07.md
    - id: task_08
      file: task_08.md
  edges:
    - from: task_01
      to: task_02
    - from: task_01
      to: task_04
    - from: task_01
      to: task_03
    - from: task_02
      to: task_03
    - from: task_04
      to: task_03
    - from: task_01
      to: task_05
    - from: task_02
      to: task_05
    - from: task_04
      to: task_05
    - from: task_03
      to: task_06
    - from: task_04
      to: task_06
    - from: task_05
      to: task_06
    - from: task_03
      to: task_07
    - from: task_04
      to: task_07
    - from: task_06
      to: task_07
---

# Entregas Mediadas via WhatsApp — Task List

| Tarefa | Título | Tipo | Complexidade | Depende de | Onda |
|---|---|---|---|---|---|
| [task_01](task_01.md) | Base: migrations, utilitários e harness de testes | infra | critical | — | 1 |
| [task_02](task_02.md) | Clientes Prosio e Seu Rastreio | backend | medium | 01 | 2 |
| [task_03](task_03.md) | Cadastro, Gestão estendida e Atendimento | backend | medium | 01, 02, 04 | 3 |
| [task_04](task_04.md) | Carga do dia: planilha, prévia, confirmação e quadro | backend | high | 01 | 2 |
| [task_05](task_05.md) | Orientações, entrada do Prosio e rastreio | backend | critical | 01, 02, 04 | 3 |
| [task_06](task_06.md) | Liberação do distrito e avisos | backend | high | 03, 04, 05 | 4 |
| [task_07](task_07.md) | Frontend Entregas | frontend | high | 03, 04, 06 | 5 |
| [task_08](task_08.md) | Prosio: roteamento por unidade em tenant compartilhado (P1–P3) | backend | medium | — | 1 |

A `task_08` roda no repositório `/root/dev/prosio`; todas as outras rodam em `/root/dev/correios-entregas`. A ligação da mediação no Prosio (requisitos R1–R7 do TechSpec) é dependência externa, entregue em outra sessão, e não tem tarefa aqui.
