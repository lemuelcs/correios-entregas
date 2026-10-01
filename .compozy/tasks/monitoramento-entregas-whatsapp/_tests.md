# Test Specification: Entregas Mediadas via WhatsApp

Contrato canônico de testes da feature. Companheiro de `_techspec.md`.
Derivado de `_user_stories.md` (comportamento) e `_techspec.md` (componentes).

Códigos S10 de referência:

| Código | Situação |
|---|---|
| `AA123456785BR` | válido |
| `AA100000025BR` | resto 0 → dígito 5 |
| `AA100000140BR` | resto 1 → dígito 0 |
| `AB123456789BR` | inválido |
| `OY526018152BR` | válido |
| `QB908301669BR` | válido |

## Strategy

- **Frameworks e harness:**
  - **Backend:** Jest + ts-jest + supertest sobre o `app` exportado.
  - **Falsificações de rede:** Prosio e Seu Rastreio só nas bordas de I/O, por servidores HTTP falsos em processo (`backend/src/__tests__/fakes/prosio.fake.ts`, `seu-rastreio.fake.ts`). Eles gravam as requisições, respondem conforme o roteiro do teste e sabem assinar callbacks com HMAC.
  - **Relógio:** `now()` injetável nos serviços; `jest.useFakeTimers` nos workers.
  - **UI:** Playwright (Chromium) contra o frontend servido pelo Vite e o backend em modo de teste com as mesmas falsificações.
- **Execução:**
  - **Unitários:** `cd backend && npm test -- --selectProjects unit` (sem banco).
  - **Integração e E2E de API:**
    - usam o banco dedicado `correiosentregas_test`, criado pelo `globalSetup`;
    - o `globalSetup` recusa rodar se o nome do banco não terminar em `_test` e roda `prisma migrate reset --force --skip-seed`;
    - usam o Redis de teste (serviço do CI);
    - os workers são drenados explicitamente.
  - **UI:** `npx playwright test` no job `e2e-ui`.
- **Convenções:**
  - arquivos `*.test.ts` em `__tests__/` ao lado do código;
  - casos tabelados com `it.each`;
  - fábricas de dados em `__tests__/fixtures/entregas.ts`;
  - um banco limpo por arquivo de teste (truncate das tabelas `entregas`);
  - nomes dos testes começam pelo ID (`UT-001 …`).
- **Fora deste repositório:** o comportamento do bot de mediação no Prosio (perguntas, confirmação, moderação, janela de cortesia) é da dependência externa R1–R7. Aqui se testa o **nosso lado do contrato** (abertura de caso, fatos, desfecho, escalonamento). As linhas da matriz marcadas "Prosio (R*)" apontam o caso de contrato correspondente. Os casos IT-058–IT-060 rodam no repositório do Prosio (tarefas P1–P3, vitest).

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001 | Gestão cadastra unidade com tipo e canal | — | IT-001, IT-002 | E2E-010 |
| US-001.EC-1 | Nome ou tipo em branco → recusado | — | IT-002 | — |
| US-001.EC-2 | Canal oficial sem configuração → recusado | UT-090 | IT-002 | — |
| US-001.EC-3 | Supervisor no cadastro de unidades → negado | — | IT-003 | — |
| US-001.EC-4 | Edição concorrente → 409 com dados atuais | — | IT-004 | — |
| US-001.EC-5 | Unidade desativada não libera | — | IT-005 | — |
| US-002 | Gestão cadastra supervisores | — | IT-061 | E2E-010 |
| US-002.EC-1 | Matrícula já usada (supervisor ou carteiro) | UT-084 | IT-061 | — |
| US-002.EC-2 | WhatsApp inválido | UT-008, UT-009 | IT-061 | — |
| US-002.EC-3 | Supervisor desativado perde acesso | — | IT-006 | — |
| US-002.EC-4 | Unidade sem supervisor sinalizada | — | IT-062 | — |
| US-002.EC-5 | Supervisor movido vê só a nova unidade | — | IT-063 | — |
| US-003 | Cadastrar distritos | — | IT-007 | E2E-008 |
| US-003.EC-1 | Código repetido na unidade → 409; em outra unidade ok | — | IT-007 | — |
| US-003.EC-2 | Unidade sem distritos → atalho | — | IT-049 | E2E-013 |
| US-003.EC-3 | Distritos de outra unidade → 404 | — | IT-008 | — |
| US-003.EC-4 | Desativar distrito liberado hoje → 409 | — | IT-009 | — |
| US-003.EC-5 | 100 distritos → paginação e busca | — | IT-010 | — |
| US-004 | Cadastrar carteiros | — | IT-011 | E2E-008 |
| US-004.EC-1 | WhatsApp inválido | UT-008 | IT-011 | — |
| US-004.EC-2 | Matrícula existente | UT-084 | IT-011 | — |
| US-004.EC-3 | Carteiro de outra unidade | — | IT-011 | — |
| US-004.EC-4 | Desativar carteiro escalado em distrito liberado | — | IT-012 | — |
| US-004.EC-5 | WhatsApp repetido | UT-085 | IT-011 | — |
| US-005 | Carteiro do dia | — | IT-013 | — |
| US-005.EC-1 | Distrito sem carteiro não libera | — | IT-026 | E2E-007 |
| US-005.EC-2 | Mesmo carteiro em dois distritos → aviso | — | IT-013 | — |
| US-005.EC-3 | Carteiro padrão desativado → distrito sem carteiro | — | IT-012 | — |
| US-005.EC-4 | Troca de carteiro durante envio → vai a quem era; resumo ao novo | — | IT-014 | — |
| US-006 | Agências e lockers | UT-081, UT-082 | IT-015 | E2E-008 |
| US-006.EC-1 | Sem agência ativa → opção some | UT-043 | IT-024 | — |
| US-006.EC-2 | 11º ativo → recusado | UT-082 | IT-015 | — |
| US-006.EC-3 | Nome > 24 → recusado | UT-081 | IT-015 | — |
| US-006.EC-4 | Ponto desativado após escolha → orientação mantida, marcada | UT-091 | IT-037 | — |
| US-006.EC-5 | Ponto de outra unidade → 404 | — | IT-015 | — |
| US-007 | Subir planilha (desde o ADR-019, "Adicionar pacotes" numa rota) | UT-014, UT-015 | IT-016, IT-085 | — |
| US-007.EC-1 | Outro formato → 415 | — | IT-016 | — |
| US-007.EC-2 | Vazio → nenhuma encomenda | UT-024 | — | — |
| US-007.EC-3 | Coluna obrigatória ausente / WhatsApp ausente | UT-017, UT-018 | — | — |
| US-007.EC-4 | Mais de 500 linhas | UT-019 | IT-016 | — |
| US-007.EC-5 | Várias abas → primeira + aviso | UT-015 | — | — |
| US-007.EC-6 | Conteúdo hostil como texto | UT-021 | — | — |
| US-007.EC-7 | Queda no envio → nada gravado | — | IT-018 | — |
| US-007.EC-8 | Distrito de outra unidade → 404 | — | IT-022 | — |
| US-008 | Colar linhas | UT-016 | IT-017 | — |
| US-008.EC-1 | Campos a menos → inválida | UT-023 | — | — |
| US-008.EC-2 | Linhas em branco ignoradas | UT-020 | — | — |
| US-008.EC-3 | Espaços extras removidos | UT-022 | — | — |
| US-008.EC-4 | Mais de 500 coladas | UT-019 | IT-017 | — |
| US-009 | Prévia classificada e correção | UT-026–UT-032 | IT-016, IT-019 | — |
| US-009.EC-1 | Dígito errado | UT-003 | — | — |
| US-009.EC-2 | Minúsculas normalizadas | UT-005 | — | — |
| US-009.EC-3 | WhatsApp normalizado; sem DDD para corrigir | UT-006, UT-007, UT-008, UT-029 | — | — |
| US-009.EC-3b | WhatsApp vazio aceito | UT-028 | IT-019 | — |
| US-009.EC-4 | Duplicado na planilha | UT-026 | — | — |
| US-009.EC-5 | Já em outro distrito hoje | UT-027 | IT-021 | — |
| US-009.EC-6 | Mesmo WhatsApp em várias encomendas | UT-032 | IT-024 | — |
| US-009.EC-7 | Todas inválidas → confirmar desabilitado | — | — | (withdrawn: E2E-006) |
| US-009.EC-8 | Fechar antes de confirmar → nada gravado | — | IT-018 | — |
| US-009.EC-9 | Confirmações concorrentes | — | IT-020 | — |
| US-010 | Orientação guardada reaplicada | UT-052 | IT-023 | E2E-002 |
| US-010.EC-1 | Acompanha a encomenda em outro distrito | UT-052 | IT-023 | — |
| US-010.EC-2 | Ponto desativado → marcada | UT-091 | — | — |
| US-010.EC-3 | Guardada persiste por dias | UT-092 | — | — |
| US-011 | Liberar e disparar | UT-048 | IT-024 | E2E-001, E2E-007 |
| US-011.EC-1 | Liberação repetida não duplica | UT-048 | IT-025 | — |
| US-011.EC-2 | Entre 0h e 6h → agendado 06h05 | UT-046, UT-047 | IT-027 | — |
| US-011.EC-3 | Limite do canal → não enviado e reenfileirado | UT-039 | IT-028 | — |
| US-011.EC-4 | Sem WhatsApp → sinalizado | UT-028 | IT-024 | — |
| US-011.EC-5 | Descadastrado não recebe | UT-030 | IT-030 | E2E-004 |
| US-011.EC-6 | Sem carteiro bloqueia | — | IT-026 | — |
| US-011.EC-7 | Falha temporária → retries → falha no envio | — | IT-029 | — |
| US-011.EC-8 | Lista vazia bloqueia | — | IT-026 | — |
| US-012 | Aviso com texto e opções | UT-041, UT-045 | IT-024 | E2E-001 |
| US-012.EC-1 | Sem agência/locker → opção omitida | UT-043 | — | — |
| US-012.EC-2 | Nome em maiúsculas → primeiro nome capitalizado | UT-041 | — | — |
| US-012.EC-3 | Nome vazio → "Olá," | UT-042 | — | — |
| US-012.EC-4 | Três encomendas → três avisos | — | IT-024 | — |
| US-012.EC-5 | Sem resposta → nada acontece | — | IT-024 | — |
| US-012.EC-6 | Texto fora da lista | Prosio (bot do tenant): fora deste repositório | — | — |
| US-013 | Tentar amanhã | UT-061 | IT-036 | E2E-002 |
| US-013.EC-1 | Escolha repetida idempotente | — | IT-039 | — |
| US-013.EC-2 | Depois da tentativa → US-019 | UT-064 | IT-040 | — |
| US-013.EC-3 | Sexta → segunda | UT-061, UT-062 | — | — |
| US-013.EC-4 | Limite de tentativas → escalonado | UT-063 | IT-064 | — |
| US-014 | Deixar com vizinho | UT-071 | IT-041, IT-043 | E2E-003 |
| US-014.EC-1 | Nome inválido, 3 falhas → transfere | Prosio (R4/R7); nosso lado: IT-065 | — | — |
| US-014.EC-2 | CPF ou telefone do vizinho não repassados | UT-093 | IT-043 | — |
| US-014.EC-3 | Abandonou → resposta incompleta | Prosio (R3); sem desfecho, nada criado: IT-066 | — | — |
| US-014.EC-4 | Nega a confirmação | Prosio (R4): fora deste repositório | — | — |
| US-015 | Deixar na agência | UT-094 | IT-037 | E2E-001 |
| US-015.EC-1 | Única agência → confirmação direta | UT-070 | IT-067 | — |
| US-015.EC-2 | Agência desativada entre sub-lista e escolha | UT-069 | IT-037 | — |
| US-015.EC-3 | Linha de sub-lista antiga vale para a encomenda dela | — | IT-068 | — |
| US-016 | Deixar no locker | UT-094 | IT-037 | — |
| US-016.EC-1 | Único locker → confirmação direta | UT-070 | IT-067 | — |
| US-016.EC-2 | Locker desativado → reenvia sub-lista | UT-069 | — | — |
| US-016.EC-3 | Locker cheio (carteiro) → destinatário avisado e escalonado | UT-095 | IT-042 | — |
| US-017 | Outra opção | UT-072, UT-074 | IT-041, IT-043 | E2E-003 |
| US-017.EC-1 | Não entende → transfere | Prosio (R4/R7); nosso lado: IT-065 | — | — |
| US-017.EC-2 | Duas negativas → transfere | Prosio (R4/R7); nosso lado: IT-065 | — | — |
| US-017.EC-3 | Fora do escopo → transfere | Prosio (R7); nosso lado: IT-065 | — | — |
| US-017.EC-4 | Injeção de instruções | Prosio (R6): fora deste repositório | — | — |
| US-017.EC-5 | Áudio ou imagem | Prosio: fora deste repositório | — | — |
| US-017.EC-6 | Texto longo → instrução ≤ 300 | UT-053, UT-096 | — | — |
| US-018 | Atendimento humano quando o bot não resolve | — | IT-041, IT-065 | — |
| US-018.EC-1 | Fora do horário | Prosio/Chatwoot (handoff): fora deste repositório | — | — |
| US-018.EC-2 | Sem unidade identificável → triagem | — | IT-059 | — |
| US-018.EC-3 | Nova mensagem enquanto aguarda | Prosio (handoff): fora deste repositório | — | — |
| US-019 | Resposta tardia | UT-064, UT-065 | IT-040 | E2E-002 |
| US-019.EC-1 | Rastreio indisponível → usa confirmação do carteiro | UT-066, UT-067 | IT-040 | — |
| US-019.EC-2 | Rastreio e carteiro divergem → transfere | UT-068 | — | — |
| US-019.EC-3 | Não confirma "vale para amanhã" → nada guardado | — | IT-040 | — |
| US-019.EC-4 | Nova escolha no dia seguinte substitui | UT-050 | — | — |
| US-020 | Parar de receber | — | IT-034 | E2E-004 |
| US-020.EC-1 | Descadastrado na nova lista → marcado, não avisado | UT-030 | IT-030 | — |
| US-020.EC-2 | "sair" em minúsculas | Prosio (opt-out do broker): fora deste repositório | — | — |
| US-021 | Orientação ao carteiro | UT-049 | IT-037 | E2E-001 |
| US-021.EC-1 | Carteiro sem WhatsApp → sinalizado | UT-060 | IT-055 | — |
| US-021.EC-2 | Várias orientações em ordem | — | IT-069 | — |
| US-021.EC-3 | Orientação alterada → "ATUALIZADA" | UT-050 | — | — |
| US-022 | Carteiro confirma | UT-055, UT-058 | IT-042 | E2E-001 |
| US-022.EC-1 | Toque repetido | UT-057 | IT-042 | — |
| US-022.EC-2 | Número que não é o carteiro → ignorado | UT-056 | IT-042 | — |
| US-022.EC-3 | "Feito" após rastreio de insucesso → divergência | UT-059 | — | — |
| US-023 | Resumo na saída | UT-083 | IT-054 | E2E-002 |
| US-023.EC-1 | Mais de 20 → mensagens de 20 | UT-083 | IT-054 | — |
| US-024 | (withdrawn) | — | — | — |
| US-024.EC-1..4 | (withdrawn; ver US-039) | — | — | — |
| US-025 | (withdrawn) | — | — | — |
| US-025.EC-1..2 | (withdrawn) | — | — | — |
| US-026 | Orientação manual | — | IT-046 | E2E-016 |
| US-026.EC-1 | Encomenda entregue → bloqueado | UT-054 | IT-046 | E2E-016 |
| US-026.EC-2 | Vazia ou > 300 → recusada | UT-053 | IT-046 | E2E-016 |
| US-026.EC-3 | Registros concorrentes → a mais recente vale | — | IT-046 | — |
| US-027 | Chatwoot incorporado com login único | UT-089 | IT-048 | E2E-009 |
| US-027.EC-1 | Carteiro ou destinatário → negado | — | IT-048 | — |
| US-027.EC-2 | Indisponível → mensagem + nova aba | — | IT-048 | E2E-009 |
| US-027.EC-3 | Link reutilizado ou expirado → clicar de novo gera novo | — | IT-048 | — |
| US-027.EC-4 | Sessão expirada → login | — | — | E2E-014 |
| US-028 | Só conversas da própria unidade | UT-089 | IT-060 | — |
| US-028.EC-1 | Supervisor movido | — | IT-063 | — |
| US-028.EC-2 | Destinatário em duas unidades → conversa na unidade da encomenda | — | IT-058 | — |
| US-029 | Gestão vê todas e a triagem | UT-089 | IT-060 | E2E-010 |
| US-029.EC-1 | Mover conversa da triagem | Chatwoot (ação nativa): fora deste repositório | — | — |
| US-030 | Carteiro aciona destinatário | — | IT-057 | — |
| US-030.EC-1 | Várias encomendas → pergunta qual | Prosio (R5); nosso lado: IT-057 (resumo enviado) | — | — |
| US-030.EC-2 | Encomenda fora do distrito | Prosio (resolução por participação): caso só existe para o carteiro do dia, IT-057 | — | — |
| US-030.EC-3 | Áudio | Prosio: fora deste repositório | — | — |
| US-030.EC-4 | Pede telefone | Prosio (R6): fora deste repositório | — | — |
| US-030.EC-5 | Destinatário descadastrado | — | IT-070 | — |
| US-030.EC-6 | Encomenda entregue → caso cancelado | — | IT-056 | — |
| US-030.EC-7 | Número que não é carteiro | Prosio (sem participação): fora deste repositório | — | — |
| US-031 | Destinatário responde em texto livre | Prosio (relay): fora deste repositório | IT-043 (desfecho) | — |
| US-031.EC-1 | Dado sensível → só o efeito | Prosio (R6) | — | — |
| US-031.EC-2 | Ofensivo | Prosio (R6) | — | — |
| US-031.EC-3 | Pagamento | Prosio (R6) | — | — |
| US-032 | Não divulgação de contato | UT-093 | IT-043 | — |
| US-032.EC-1 | Número por extenso | Prosio (R6) | — | — |
| US-032.EC-2 | Falso positivo informado | Prosio (R6) | — | — |
| US-033 | Supervisor lê e assume uma ponta | — | IT-048 | — |
| US-033.EC-1 | Outra unidade → não encontrado | — | IT-060 | — |
| US-033.EC-2 | Assumiu e não respondeu → alerta | Chatwoot/Prosio (SLA de handoff): fora deste repositório | — | — |
| US-034 | Configuração da mediação do tenant | — | IT-071 | — |
| US-034.EC-1 | Sem declaração → casos abrem, avisos retidos | — | IT-071 | — |
| US-034.EC-2 | Empresa divergente → abertura recusada, motivo visível | — | IT-072 | — |
| US-034.EC-3 | Envelope versionado | Prosio (admin da mediação): fora deste repositório | — | — |
| US-035 | Um caso por encomenda | UT-097 | IT-057 | — |
| US-035.EC-1 | Nova tentativa → caso novo | UT-097 | IT-057 | — |
| US-035.EC-2 | Janela de cortesia | Prosio (R3): fora deste repositório | — | — |
| US-036 | Entrar pelos três módulos | — | — | E2E-005, E2E-010 |
| US-036.EC-1 | Papéis legados → área própria (`CARTEIRO` → `/carteiro/captura`) | — | — | E2E-015 |
| US-036.EC-2 | Sessão expirada → volta ao módulo | — | — | E2E-014 |
| US-036.EC-3 | Tela estreita → menu recolhido | — | — | E2E-011 |
| US-037 | SGPD v2 | — | — | E2E-005 |
| US-037.EC-1 | Faixa "Protótipo" | — | — | E2E-005 |
| US-037.EC-2 | Favorito antigo funciona | — | — | E2E-015 |
| US-037.EC-3 | Sem permissão → item oculto | — | — | E2E-015 |
| US-038 | Status de cada pacote no distrito | UT-038 | IT-050 | E2E-012 |
| US-038.EC-1 | Não liberado → "Lista pronta" | UT-034 | IT-050 | — |
| US-038.EC-2 | 500 pacotes → paginação e filtro | — | IT-050 | — |
| US-038.EC-3 | Outra unidade → 404 | — | IT-050 | — |
| US-039 | Quadro por saída: abas, resumo, filtros e cartão da rota | UT-033–UT-037, UT-106, UT-108 | IT-049, IT-082 | E2E-012, E2E-017 |
| US-039.AC-7 | Aba "Sem saída" só quando há carga fora de saída | UT-106 | IT-080 | — |
| US-039.EC-1 | (withdrawn) Sem distritos → atalho. Agora: quadro pronto para importar | — | — | E2E-013 |
| US-039.EC-2 | Sem carteiro → sinalizado | — | IT-049 | — |
| US-039.EC-3 | Data anterior → leitura | — | IT-049 | — |
| US-039.EC-4 | 60 distritos → filtro e busca | — | IT-049 | — |
| US-039.EC-5 | Outra unidade → 404 | — | IT-049 | — |
| US-040 | Pacotes sem WhatsApp e "X de Y" | UT-040 | IT-019, IT-074 | E2E-017 |
| US-040.EC-1 | Nenhum com WhatsApp → pede confirmação | — | IT-073 | E2E-007 |
| US-040.EC-2 | WhatsApp adicionado depois → aviso na hora | — | IT-032 | — |
| US-041 | Importar o arquivo da saída (direto) | UT-100, UT-109, UT-110 | IT-074 | E2E-017 |
| US-041.AC-2, EC-9 | Carteiro pela coluna do arquivo; valor não encontrado | UT-104 | IT-077 | E2E-017 |
| US-041.AC-3 | Rota fora do Cadastro é criada | — | IT-076 | E2E-017 |
| US-041.EC-1 | Sem horário → mensagem, nada enviado | UT-109 | IT-075 | E2E-017 |
| US-041.EC-2, EC-3 | Sem coluna `rota`; formato e limites | UT-101, UT-102 | IT-075 | — |
| US-041.EC-4, EC-5 | Limite de 500 por rota; rota em outra saída | — | IT-079 | E2E-017 |
| US-041.EC-6 | Rota desativada | — | IT-076 | — |
| US-041.EC-7, EC-8 | Saída fora de ordem; data anterior | — | IT-075 | — |
| US-041.EC-10 | Carga sem saída adotada; pacote da foto mantido | — | IT-080 | — |
| US-041.EC-11 | Importações simultâneas | — | IT-086 | — |
| US-042 | "N aceitos, M descartados" e a lista das recusadas | UT-110 | IT-074 | E2E-017 |
| US-042.EC-1 | Resumo sem nome nem telefone | UT-103 | IT-074 | E2E-017 |
| US-042.EC-2, EC-3 | Motivos de descarte | UT-107 | IT-074 | E2E-017 |
| US-043 | Reimportar só as rotas não liberadas | UT-109 | IT-078 | E2E-019 |
| US-044 | Modal "Atribuir carteiros" | UT-113 | IT-084 | E2E-018 |
| US-045 | Liberação em lote | UT-107, UT-111 | IT-083 | E2E-018 |
| US-045.AC-4 | Diálogo da rota única | UT-112 | — | E2E-007 |
| US-046 | Gestão: todas as unidades (leitura) e unidade para importar | UT-114 | IT-081, IT-082 | E2E-020 |
| Texto "rota" ao carteiro | Resumo da troca fala em rota | UT-105 | — | — |
| Compatibilidade (ADR-019) | Lista por rota e `GET /quadro` seguem valendo | — | IT-085 | — |
| S10 (`s10.ts`) | Dígito UPU, qualquer país | UT-001–UT-005 | — | — |
| Telefone (`telefone.ts`) | E.164 BR | UT-006–UT-010 | — | — |
| Cripto (`cripto.ts`) | Segredos dos canais | UT-011–UT-013 | IT-001 | — |
| Parser (`planilha.parser.ts`) | CSV, XLSX e texto | UT-014–UT-025 | IT-016, IT-017 | — |
| Validação de linhas | Classificação | UT-026–UT-032 | IT-019 | — |
| Derivação de status | Quadro e pacote | UT-033–UT-040 | IT-049 | — |
| Texto do aviso | Mensagem e botões | UT-041–UT-045 | IT-024 | — |
| Liberação | Agendamento e idempotência | UT-046–UT-048 | IT-024–IT-032 | — |
| OrientacaoService | Máquina de estados | UT-049–UT-060, UT-091–UT-096 | IT-036–IT-046 | — |
| Calendário | Próximo dia útil | UT-061, UT-062 | — | — |
| Ação CE_OP/CE_PT/CE_SN/CE_CT | Decisões e respostas | UT-063–UT-070 | IT-035–IT-042 | — |
| Mapeamento do desfecho | `mediation.outcome` → orientação | UT-071–UT-074 | IT-043, IT-044 | — |
| Verificação de HMAC | Webhook | UT-075–UT-077 | IT-033, IT-051 | — |
| RastreioClient | Classificação | UT-078–UT-080 | IT-047 | — |
| ProsioClient | HTTP, erros, idempotência | UT-086–UT-088, UT-098 | IT-024 | — |
| Atendimento | Papel e unidadeRef | UT-089 | IT-048 | — |
| RastreioWorker | Seleção adaptativa | UT-099 | IT-047 | — |
| Migrations / CI | Schema do zero, health | — | IT-052, IT-053 | — |
| Prosio P1–P3 (repositório Prosio) | unidadeRef e inbox | — | IT-058–IT-060 | — |

## Unit Tests

### S10 (TechSpec: Utilitários)

- **UT-001** (happy): `calculateS10CheckDigit('12345678')` retorna `5`; `validateS10('AA123456785BR').valid` é `true`.
- **UT-002** (boundary): `calculateS10CheckDigit('10000002')` (soma ponderada 22, resto 0) retorna `5`; `calculateS10CheckDigit('10000014')` (resto 1) retorna `0`; `validateS10('AA100000025BR')` e `validateS10('AA100000140BR')` são válidos.
- **UT-003** (error): `validateS10('AB123456789BR')` retorna `{ valid: false }`.
- **UT-004** (happy): `validateS10('LB390996032CN', { qualquerPais: true })` é válido; sem a opção, é inválido.
- **UT-005** (boundary): `validateS10('aa 123456785 br')` normaliza para `AA123456785BR` e é válido.

### Telefone (TechSpec: Utilitários)

- **UT-006** (happy): `normalizarTelefone('(61) 99812-4412')` retorna `+5561998124412`.
- **UT-007** (boundary): `normalizarTelefone('61 9812-4412')` (8 dígitos, começa com 9) retorna `+5561998124412` (nono dígito inserido).
- **UT-008** (error): `normalizarTelefone('98876-1102')` lança `TelefoneInvalido('sem_ddd')`.
- **UT-009** (error): `normalizarTelefone('61 9abc-4412')` lança `TelefoneInvalido('formato')`.
- **UT-010** (happy): `normalizarTelefone('+55 (61) 99812-4412')` retorna `+5561998124412`.

### Cripto (TechSpec: Utilitários)

- **UT-011** (happy): `decifrar(cifrar('psk_live_abc'))` retorna `psk_live_abc`, e dois `cifrar` do mesmo valor produzem textos diferentes (IV aleatório).
- **UT-012** (error): um byte alterado no texto cifrado faz `decifrar` lançar `CriptoErro('integridade')`.
- **UT-013** (error): `ENTREGAS_CRYPTO_KEY` ausente ou com menos de 32 bytes faz `carregarChave()` lançar na inicialização.

### Parser de planilha (TechSpec: Carga)

- **UT-014** (happy): um CSV com `;` e cabeçalhos `rastreio;destinatario;celular;rua;numero;bairro;cidade;uf;cep` devolve linhas com `codigo`, `nome` e `whatsapp` mapeados.
- **UT-015** (happy): um XLSX com duas abas lê só a primeira e devolve `avisos: ['varias_abas']`.
- **UT-016** (happy): o texto `OY526018152BR\tMaria Souza\t61 99812-4412\tQNA 12 Casa 45` devolve uma linha com `enderecoTexto = 'QNA 12 Casa 45'`.
- **UT-017** (error): um CSV sem coluna de código lança `ParserErro('coluna_ausente', { coluna: 'codigo' })`.
- **UT-018** (boundary): um CSV sem coluna de WhatsApp devolve as linhas com `whatsapp = null` e `avisos: ['sem_coluna_whatsapp']`.
- **UT-019** (boundary): 500 linhas passam; 501 linhas lançam `ParserErro('limite_linhas', { max: 500 })`, tanto em CSV quanto em texto colado.
- **UT-020** (boundary): linhas totalmente em branco no meio são ignoradas e não contam no limite.
- **UT-021** (error): a célula `=HYPERLINK("http://x","y")` é lida como o texto literal, sem avaliação.
- **UT-022** (happy): `'  OY526018152BR  '` e `'Maria   Souza '` são aparados para `OY526018152BR` e `Maria Souza`.
- **UT-023** (error): uma linha colada só com o código devolve `situacao: 'invalida', motivo: 'faltam_campos'`.
- **UT-024** (boundary): arquivo com só o cabeçalho lança `ParserErro('nenhuma_encomenda')`.
- **UT-025** (happy): a coluna única `endereco` vai para `enderecoTexto`; colunas separadas vão para os campos estruturados.

### Arquivo da saída e importação (TechSpec: Saídas, ADR-019)

- **UT-100** (happy): o arquivo da saída lê `rota` e `carteiro` pelos cabeçalhos equivalentes ("Rota", "Distrito", "código da rota"; "Carteiro", "Matrícula", "nome do carteiro"), em CSV e XLSX; a rota numérica do Excel vira texto.
- **UT-101** (error): arquivo da saída sem a coluna `rota` lança `ParserErro('coluna_ausente', { coluna: 'rota' })`; a lista por rota continua sem exigir a coluna e sem as chaves `rota`/`carteiro`.
- **UT-102** (boundary): 5.000 linhas passam; 5.001 lançam `limite_linhas` com `max: 5000`; a lista por rota segue em 500.
- **UT-103** (state): `normalizarRota` devolve o código em maiúsculas; `codigoParaDescarte` só devolve o que tem cara de código (nome ou telefone numa coluna trocada viram vazio).
- **UT-104** (state): `casarCarteiro` casa por matrícula (com ou sem máscara) ou por nome completo sem acento; nome repetido na unidade, nome parcial e desconhecido não casam.
- **UT-105** (happy): `montarResumoCarteiro(..., { troca: true })` começa por "Você assumiu a rota hoje." e não contém "distrito".

### Tela das saídas (Vitest; TechSpec: Frontend Entregas, ADR-019)

- **UT-106** (state): `abasDoDia` devolve uma aba por saída importada, a próxima como "Aguardando arquivo e horário" e "Sem saída" só quando há rota fora de saída; em data passada não há próxima; na visão agregada a aba soma as unidades.
- **UT-107** (state): `rotasLiberaveis` só leva rota carregada, com carteiro e com alguém a avisar; `motivoDoDescarte` traduz os motivos (com a rota ou a saída do detalhe).
- **UT-108** (happy): a tela mostra as abas, o resumo da saída, os filtros com contagem e o cartão da rota (código, carteiro, "N pacotes", "Carregada"); rota sem carteiro mostra "Sem carteiro definido" e "Definir carteiro", sem "Liberar rota"; nenhuma menção a "distrito" nem a "Pendente de upload"; supervisor sem seletor de unidade.
- **UT-109** (error): importar sem horário mostra "Confirme o horário da Saída N antes de importar." e não chama a API; escolher uma saída já importada preenche o horário e mostra o aviso de reimportação.
- **UT-110** (happy): a importação envia `numero`, `horario` e `arquivo`, abre a aba da saída e mostra "5 aceitos, 3 descartados" com a tabela das linhas recusadas; saída sem descartes mostra "N aceitos, nenhum descartado".
- **UT-111** (happy): "Liberar 2 rotas carregadas" abre o diálogo com os totais e "Rotas 503, 505." e envia só as cargas dessas rotas.
- **UT-112** (happy): "Liberar rota" mantém o diálogo "Liberar rota 503 · <carteiro>?".
- **UT-113** (happy): "Definir carteiro" abre o modal com as rotas sem carteiro (a do cartão primeiro), só carteiros ativos, e grava `{distritoId, carteiroId, definirPadrao}`.
- **UT-114** (state): Gestão vê o seletor com "Todas as unidades"; nessa visão importar, liberar e definir carteiro ficam indisponíveis; com a unidade escolhida, importa.

### Validação de linhas (TechSpec: Carga)

- **UT-026** (error): duas linhas com `NL131860912BR` → a segunda recebe `motivo: 'duplicado_planilha'`.
- **UT-027** (error): uma linha com código já presente no D-01 hoje (consulta falsa) → `motivo: 'ja_no_distrito', detalhe: 'D-01'`.
- **UT-028** (boundary): WhatsApp vazio → `situacao: 'sem_whatsapp'`, aceita.
- **UT-029** (boundary): `98876-1102` → `situacao: 'corrigir', motivo: 'sem_ddd'`; na confirmação sem correção, entra como `sem_whatsapp`.
- **UT-030** (state): um WhatsApp em `DescadastroWhatsapp` → aceita com `descadastrado: true`.
- **UT-031** (state): um código com `Orientacao` `GUARDADA` → `orientacaoGuardada: { tipo, texto }`.
- **UT-032** (happy): o mesmo WhatsApp em 3 códigos distintos → 3 linhas válidas.

### Derivação de status (TechSpec: Data Models)

- **UT-033** (state): distrito sem carga no dia → `PENDENTE_UPLOAD`.
- **UT-034** (state): carga `CARREGADO` → quadro `DADOS_CARREGADOS`; pacotes `AGUARDANDO_LIBERACAO` exibidos como "Lista pronta".
- **UT-035** (state): carga liberada com todos os pacotes `AGENDADO` → `LIBERADO`.
- **UT-036** (state): carga liberada com 1 pacote `ENVIADO` → `EM_ENTREGA`.
- **UT-037** (state): todos os pacotes `ENTREGUE` ou `INSUCESSO` → `CONCLUIDO`.
- **UT-038** (ordering): pacote `INTERAGINDO` que recebe callback `read` continua `INTERAGINDO`; `ENTREGUE` não regride com `delivered`.
- **UT-039** (error): callback `failed` com `failureReason: 'daily_cap'` → `NAO_ENVIADO` com `naoEnviadoMotivo: 'limite_canal'` e `reenfileirar: true`.
- **UT-040** (happy): 37 pacotes, 28 com WhatsApp → `{ total: 37, comWhatsapp: 28 }`.

### Texto do aviso (TechSpec: AvisoWorker)

- **UT-041** (happy): `montarAviso({ nome: 'MARIA APARECIDA', codigo: 'OY526018152BR' })` produz o corpo começando com `Olá, Maria, sua encomenda OY526018152BR já saiu para entrega.`.
- **UT-042** (boundary): nome vazio → o corpo começa com `Olá, sua encomenda`.
- **UT-043** (state): unidade sem agência ativa → os botões são `AMANHA`, `VIZINHO`, `LOCKER` e `OUTRA`, com ids `CE_OP:<pacoteId>.<OPCAO>`.
- **UT-044** (state): com orientação guardada, o corpo contém `Vamos seguir sua orientação: Deixar com Dona Célia, casa 47`.
- **UT-045** (error): nenhum texto gerado (aviso, sub-listas, confirmações, carteiro) contém `http`, `pix` ou `pagamento`, verificado por `it.each` em todos os geradores.

### Liberação (TechSpec: Liberação)

- **UT-046** (boundary): liberação às 03:10 America/Sao_Paulo → atraso até 06:05 do mesmo dia.
- **UT-047** (boundary): liberação às 06:00 → sem atraso; às 23:59 → sem atraso (a janela do Prosio só bloqueia de 0h a 6h).
- **UT-048** (idempotency): `jobsDaLiberacao(carga)` gera ids `aviso:<pacoteId>` e `resumo:<cargaId>:<carteiroId>` estáveis entre chamadas.

### OrientacaoService (TechSpec: Orientação)

- **UT-049** (happy): `registrar({ tipo: 'AGENCIA', pontoRetiradaId })` com pacote em rota → estado `ENVIADA` e uma mensagem ao carteiro com botões `CE_CT:<id>.VI`, `.FEITO` e `.NAO`.
- **UT-050** (state): uma nova orientação para o mesmo código marca a anterior `SUBSTITUIDA`, e a mensagem ao carteiro começa com `ATUALIZADA:`.
- **UT-051** (state): `valeParaAmanha: true` → `GUARDADA` com `valeAPartirDe` = próximo dia útil, sem mensagem ao carteiro.
- **UT-052** (state): `reaplicarGuardadas(cargaNova)` vincula a orientação `GUARDADA` do código à nova carga (mesmo em outro distrito) e devolve `1`.
- **UT-053** (error): texto com 301 caracteres → `AppError(400, 'orientacao_longa')`; vazio → `AppError(400, 'orientacao_vazia')`.
- **UT-054** (error): pacote `ENTREGUE` → `AppError(409, 'pacote_entregue')`.
- **UT-055** (happy): `registrarRespostaCarteiro(id, telCarteiro, 'FEITO')` → `FEITA` com `respondidoEm`.
- **UT-056** (error): resposta de um telefone diferente do carteiro da orientação → estado inalterado; retorna a mensagem neutra.
- **UT-057** (idempotency): `VI` duas vezes → uma transição e um evento.
- **UT-058** (happy): `NAO` → retorna a mensagem de motivos com botões `NAO_ATENDEU`, `ENDERECO`, `RECUSOU`, `FECHADO` e `OUTRO`; o motivo escolhido → `NAO_FOI_POSSIVEL` com `respostaCarteiro`.
- **UT-059** (state): `FEITO` quando o último rastreio do pacote é insucesso → evento `divergencia` e sinalização no pacote.
- **UT-060** (error): carteiro sem `whatsappE164` → a orientação fica `ENVIADA` com sinal `nao_entregue_carteiro`; nenhuma chamada ao Prosio.
- **UT-091** (state): ponto desativado depois da orientação → a orientação mantém `pontoRetiradaId`, e a leitura devolve `pontoDesativado: true`.
- **UT-092** (state): `GUARDADA` criada há 5 dias continua vigente se não houver `ENTREGUE` do código.
- **UT-093** (error): um desfecho com `condicao.local` contendo `CPF 123.456.789-09` ou `61 99999-0000` → o texto ao carteiro tem os números substituídos por `[removido]`.
- **UT-094** (happy): orientação `LOCKER` produz ao destinatário a confirmação com nome, endereço e horário do ponto.
- **UT-095** (state): carteiro responde `NAO` + `FECHADO` numa orientação `LOCKER` → mensagem ao destinatário "a encomenda seguirá para a unidade" e pacote `escalonado: true`.
- **UT-096** (boundary): o texto do desfecho com 1200 caracteres é truncado para 300 na orientação, com reticências.

### Calendário (TechSpec: Orientação)

- **UT-061** (boundary): `proximoDiaDeEntrega(sexta 2026-10-02)` → segunda `2026-10-05`.
- **UT-062** (happy): `proximoDiaDeEntrega(quinta 2026-10-01)` → `2026-10-02`.

### Ações de botão (TechSpec: Entrada Prosio)

- **UT-063** (state): `CE_OP ...AMANHA` para um código com 2 dias anteriores em `INSUCESSO` → resposta "ficará disponível na unidade" e `escalonar: true`, sem orientação.
- **UT-064** (state): rastreio falso com "Carteiro não atendido" hoje às 11:20 → resposta `Hoje já tentamos entregar às 11h20, sem sucesso. …` e mensagem com botões `CE_SN:<orientacaoId>.SIM` e `.NAO`.
- **UT-065** (state): rastreio "Objeto entregue ao destinatário" às 10:05 → resposta `Sua encomenda foi entregue às 10h05`, sem orientação.
- **UT-066** (error): rastreio com tempo esgotado e última resposta do carteiro `NAO_ATENDEU` → tratado como tentativa sem sucesso (mesma resposta do UT-064).
- **UT-067** (error): rastreio com tempo esgotado e sem resposta do carteiro → orientação enviada na hora.
- **UT-068** (state): rastreio "entregue" e carteiro `NAO_FOI_POSSIVEL` → resposta de transferência e `escalonar: true`.
- **UT-069** (state): `CE_PT <pacote>.<pontoDesativado>` → resposta "Essa agência não está mais disponível" e nova sub-lista só com os ativos.
- **UT-070** (boundary): `CE_OP ...AGENCIA` com uma única agência ativa → mensagem de confirmação `CE_SN` com o nome da agência, sem sub-lista.

### Mapeamento do desfecho (TechSpec: Integration Points › mediação)

- **UT-071** (happy): `{ motivo: 'entrega_indireta', condicao: { local: 'Dona Célia, casa 47' }, disposition: 'decidido' }` → `NovaOrientacao { tipo: 'VIZINHO', texto: 'Deixar com Dona Célia, casa 47', origem: 'MEDIACAO' }`.
- **UT-072** (happy): `{ motivo: 'outro', condicao: { local: 'portaria com o Seu João', ate: '2026-09-30T21:00:00Z' } }` → `tipo: 'OUTRA'`, `texto: 'Deixar na portaria com o Seu João; até 18h'`.
- **UT-073** (state): `disposition: 'proposto'` → nenhuma orientação; evento `desfecho_proposto` e `escalonado: true`.
- **UT-074** (error): um motivo desconhecido `'cachorro'` → tratado como `OUTRA`.
- **UT-097** (happy): `externalRefDoCaso('OY526018152BR', 2026-09-30)` → `OY526018152BR@2026-09-30`; outro dia → outro `externalRef`.

### Verificação de HMAC (TechSpec: Entrada Prosio)

- **UT-075** (happy): corpo `{"a":1}`, segredo `s3cr3t-s3cr3t-16`, assinatura `sha256=<hmac correto>` → `true`.
- **UT-076** (error): assinatura de outro corpo → `false`.
- **UT-077** (error): header sem o prefixo `sha256=`, ou com hex de tamanho errado → `false`, sem exceção.

### RastreioClient (TechSpec: Integration Points › Seu Rastreio)

- **UT-078** (happy): `classificarEvento('Objeto entregue ao destinatário')` → `ENTREGUE`.
- **UT-079** (happy): `classificarEvento('Carteiro não atendido - Entrega não realizada')` → `INSUCESSO`.
- **UT-080** (boundary): `classificarEvento('Objeto em trânsito - por favor aguarde')` → `null`.
- **UT-099** (state): `selecionarParaConsulta({ hora: 14 })` inclui só pacotes do dia em `LIDO` ou `INTERAGINDO` de cargas liberadas; `{ hora: 20, varredura: true }` inclui todos os que ainda não chegaram a um estado final.

### Cadastro (TechSpec: Cadastro)

- **UT-081** (error): ponto com nome de 25 caracteres → `AppError(400, 'nome_longo')`.
- **UT-082** (boundary): o 10º ponto ativo do tipo passa; o 11º → `AppError(409, 'limite_pontos')`.
- **UT-084** (error): matrícula `8.301.552-0` já em `Usuario` → criar carteiro com ela lança `AppError(409, 'matricula_em_uso')` (e vice-versa).
- **UT-085** (error): WhatsApp de outro carteiro → `AppError(409, 'whatsapp_em_uso')`.
- **UT-090** (error): unidade com canal `WABA` cujo `CanalProsio.tipo` é `WAHA`, ou canal inativo → `AppError(400, 'canal_indisponivel')`.

### Resumo ao carteiro (TechSpec: Liberação)

- **UT-083** (boundary): 20 orientações → 1 mensagem; 25 → 2 mensagens (20 + 5), numeradas "1/2" e "2/2"; 0 → nenhuma mensagem.

### ProsioClient (TechSpec: Core Interfaces)

- **UT-086** (happy): `enviarMensagem` envia `Authorization: Bearer <apiKey decifrada>`, `Idempotency-Key: aviso:<id>` e o corpo com `buttons` e `reference`.
- **UT-087** (error): 429 → `ProsioError(429, 'rate_limited')` marcado como tentável de novo; 422 `invalid_phone` → não tentável.
- **UT-088** (happy): `abrirCaso` com resposta 200 (caso existente) → `{ created: false }`; com 201 → `{ created: true }`.
- **UT-098** (error): 503 `chatwoot_indisponivel` em `criarSessaoAtendimento` → `ProsioError(503, 'chatwoot_indisponivel')`.

### Atendimento (TechSpec: Atendimento)

- **UT-089** (happy): GESTAO → `papel: 'administrador'` sem `unidadeRef`; UNIDADE em canal compartilhado → `papel: 'agente'` com `unidadeRef` da unidade; UNIDADE em canal exclusivo → `agente` sem `unidadeRef`.

## Integration Tests

### Cadastro e Gestão

- **IT-001**: `POST /api/v1/gestao/canais-prosio` (GESTAO) → 201 com `tokenEntrada` presente uma única vez; o `GET` seguinte não devolve `apiKey`, `callbackSecret` nem `tokenEntrada`; no banco, `apiKeyCifrada ≠ apiKey`.
- **IT-002**: `POST /api/v1/gestao/unidades`:
  - sem `nome` → 400 com o campo;
  - com canal compartilhado e sem `prosioUnidadeRef` → 400 `unidade_ref_obrigatoria`;
  - com canal WABA inexistente → 400 `canal_indisponivel`.
- **IT-003**: usuário `UNIDADE` em `GET /api/v1/gestao/unidades` → 403.
- **IT-004**: dois `PUT /gestao/unidades/:id` com o mesmo `atualizadoEm` → o primeiro 200; o segundo 409 `alterado_por_outro` com os dados atuais.
- **IT-005**: unidade `ativa=false` → `POST /entregas/cargas/:id/liberar` de um supervisor dela → 409 `unidade_inativa`.
- **IT-006**: usuário desativado com token ainda válido → a próxima requisição autenticada responde 401 (cache de 60 s avançado no relógio falso).
- **IT-007**: `POST /entregas/cadastro/distritos` `{codigo:'D-01'}` duas vezes na mesma unidade → 201 e 409; `D-01` em outra unidade → 201.
- **IT-008**: supervisor da unidade A → `GET /entregas/cadastro/distritos/<idDaUnidadeB>` → 404.
- **IT-009**: distrito com carga liberada hoje → `PUT` com `ativo:false` → 409 `distrito_em_operacao`.
- **IT-010**: 100 distritos → `GET /entregas/cadastro/distritos?pagina=2&tamanho=50` devolve 50; `?busca=Norte` filtra por nome.
- **IT-011**: carteiro:
  - `POST` com WhatsApp `98876-1102` → 400;
  - matrícula repetida → 409;
  - WhatsApp repetido → 409;
  - carteiro já em outra unidade (mesma matrícula) → 409 com `detalhe: 'unidade'`.
- **IT-012**: desativar carteiro escalado em distrito liberado hoje → 409. Desativar um carteiro que é só o padrão de um distrito não liberado → 200, e o quadro mostra o distrito "Sem carteiro".
- **IT-013**: `PUT /entregas/cadastro/distritos/:id/escala/2026-09-30` troca o carteiro → o quadro do dia mostra o novo; o de 2026-10-01, o padrão. O mesmo carteiro em dois distritos → 200 com `avisos: ['carteiro_em_dois_distritos']`.
- **IT-014**: troca de carteiro após a liberação → o Prosio falso recebe um resumo para o novo carteiro. Uma orientação criada antes da troca permanece com `carteiroId` antigo.
- **IT-015**: pontos:
  - 11º ativo → 409;
  - nome de 25 caracteres → 400;
  - `PUT` de ponto de outra unidade → 404.
- **IT-061**: `POST /gestao/usuarios` `{role:'UNIDADE', unidadeId, matricula, telefoneCelular}` → o supervisor faz login e `GET /entregas/quadro` só devolve a unidade dele. Matrícula de carteiro existente → 409; telefone inválido → 400.
- **IT-062**: `GET /gestao/unidades` marca `semSupervisor: true` numa unidade sem usuário `UNIDADE` ativo.
- **IT-063**: supervisor movido da unidade A para B → as rotas `entregas` passam a responder só dados de B, e `POST /entregas/atendimento/sessao` envia a `unidadeRef` de B.

### Carga

- **IT-016**: `POST /entregas/cargas/:distritoId/previa` em multipart:
  - CSV válido com 40 linhas → 200 com 40 linhas classificadas;
  - PDF → 415;
  - 501 linhas → 413.
- **IT-017**: `POST .../previa` com `{texto}` de 2 linhas → 200; 501 linhas → 413.
- **IT-018**: depois de `previa`, a contagem de `PacoteDia` e `CargaDistrito` não muda. Uma requisição de `confirmar` interrompida (conexão fechada antes da resposta, com rollback simulado por erro no meio) não deixa nenhum pacote.
- **IT-019**: `POST .../confirmar` com 36 válidas, das quais 9 sem WhatsApp, mais 1 para corrigir e 3 inválidas → `{aceitos: 37, descartados: 3}`. O quadro mostra `28 de 37`.
- **IT-020**: duas `confirmar` concorrentes para o mesmo distrito com códigos que se sobrepõem → a união sem duplicatas; nenhum 500.
- **IT-021**: código já no D-01 hoje, confirmado no D-02 → descartado com `ja_no_distrito`.
- **IT-022**: `confirmar` em distrito de outra unidade → 404.
- **IT-023**: `Orientacao` `GUARDADA` de ontem para `QB908301669BR` → `confirmar` hoje (em outro distrito) → `GET pacotes` mostra `orientacaoVigente.tipo = 'VIZINHO'`.
- **IT-049**: `GET /entregas/quadro`:
  - `porStatus` e `comWhatsapp` corretos para 3 distritos em estados distintos;
  - unidade sem distritos → `{distritos: [], semDistritos: true}`;
  - distrito sem carteiro → `semCarteiro: true`;
  - `?data=` de ontem → dados de ontem com `somenteLeitura: true`;
  - `?status=CARREGADO&busca=D-0` filtra;
  - `?unidadeId=<outra>` por um supervisor → 404.
- **IT-050**: `GET /entregas/cargas/:id/pacotes`:
  - 500 pacotes → página de 50;
  - `?status=LIDO` filtra;
  - carga não liberada → todos "Lista pronta";
  - carga de outra unidade → 404.
- **IT-073**: `liberar` numa carga sem nenhum WhatsApp e sem `confirmarSemAvisos: true` → 409 `nenhum_destinatario`; com a flag → 202 com `avisosAgendados: 0`.

### Saídas (ADR-019)

- **IT-074**: `POST /entregas/saidas/importar` com 9 linhas (4 válidas, 1 duplicada, 1 com dígito errado, 1 com WhatsApp sem DDD, 1 sem rota, 1 sem nome) → 201 `{aceitos: 4, descartados: 5}` com `descartes` `{n, rota, codigo, motivo}`; os pacotes estão gravados; a `Saida` guarda o mesmo resumo, sem nome nem telefone.
- **IT-075**: sem `horario` (ou inválido) → 400 `horario_obrigatorio`; sem arquivo → 400; sem a coluna `rota` → 400 `coluna_ausente`; PDF → 415; saída 2 sem a 1 → 409 `saida_fora_de_ordem`; data anterior → 409 `somente_leitura`. Nada é gravado.
- **IT-076**: rota que não existe no Cadastro → criada como `Rota <código>`, ativa e sem carteiro (`rotasCriadas`, `rotasSemCarteiro`); rota desativada → linhas descartadas com `rota_inativa`.
- **IT-077**: carteiro em três níveis — coluna `carteiro` casada por matrícula ou nome vira `EscalaDistrito`; sem valor fica o padrão do Cadastro; valor que não casa (carteiro de outra unidade) é devolvido em `carteirosNaoEncontrados`; rota nova sem valor fica sem carteiro.
- **IT-078**: reimportação — na rota não liberada o pacote que continua é atualizado com o mesmo `id` (a orientação presa a ele permanece), o novo é criado, o que saiu é apagado e o que mudou de rota é movido; a rota liberada fica idêntica e as linhas dela voltam com `rota_liberada`; continua existindo uma `Saida` só, com o arquivo e o horário novos.
- **IT-079**: rota já carregada na Saída 1, enviada na Saída 2 → `rota_em_outra_saida` com `detalhe: '1'`; rota com 502 linhas → 500 gravadas e 2 descartadas com `limite_rota`.
- **IT-080**: carga sem saída (captura do rótulo) aparece em `GET /saidas` com `saidaNumero: null`; a importação que traz a rota adota a carga; o pacote de origem `FOTO` não é alterado; o pacote de foto que está em outra rota descarta a linha com `ja_no_distrito`.
- **IT-081**: escopo da importação — supervisor em outra unidade → 404; Gestão sem `unidadeId` ou com `todas` → 400 `unidade_obrigatoria`; Gestão com a unidade → 201 nela; `CARTEIRO` → 403.
- **IT-082**: `GET /entregas/saidas` — supervisor recebe só a sua unidade, com `descartes`, `proximaSaida` e as rotas com `saidaNumero`; rota do Cadastro sem carga não aparece; outra unidade ou `todas` → 404; Gestão sem `unidadeId` ou com `todas` → agregado sem `descartes`; data anterior → `somenteLeitura: true`.
- **IT-083**: `POST /entregas/saidas/liberar` com 5 cargas → 2 liberadas (avisos `AGENDADO`, snapshot do carteiro), `sem_carteiro`, `nenhum_destinatario` e `nao_encontrado` (carga de outra unidade) por item; repetir → `jaLiberada` e nenhum job novo; Gestão → 403; lista vazia → 400.
- **IT-084**: `PUT /entregas/saidas/carteiros` grava o carteiro do dia e, com `definirPadrao`, o padrão da rota; carteiro desativado e rota de outra unidade falham só no item; Gestão sem unidade → 400, com unidade → grava.
- **IT-085**: depois de importar a saída, `POST /cargas/:distritoId/confirmar` soma o pacote à rota e `GET /quadro` responde no formato de antes (sem `saidaNumero`).
- **IT-086**: duas importações simultâneas da mesma saída → as duas respondem 201, uma como reimportação; uma `Saida`, uma carga e 30 pacotes.

### Liberação e envio

- **IT-024**: `liberar` numa carga com 3 pacotes com WhatsApp, 1 sem e unidade sem agência ativa → 202. Depois de drenar a fila:
  - o Prosio falso recebeu 3 `POST /api/v1/messages`, cada um com `buttons` sem `AGENCIA`, `reference=<pacoteId>` e `Idempotency-Key=aviso:<pacoteId>`;
  - o pacote sem WhatsApp segue `SEM_WHATSAPP`;
  - um destinatário com 3 códigos recebe 3 mensagens;
  - sem nenhuma ação posterior, nada mais é enviado.
- **IT-025**: `liberar` duas vezes → o Prosio falso recebe 3 mensagens, não 6.
- **IT-026**: `liberar` sem carteiro → 409 `sem_carteiro`; sem pacotes → 409 `carga_vazia`.
- **IT-027**: relógio às 03:00 → `liberar` → pacotes `AGENDADO` e nenhuma chamada ao Prosio; relógio às 06:05 → envios feitos.
- **IT-028**: o Prosio falso aceita e envia callback `failed` com `daily_cap` → pacote `NAO_ENVIADO` com motivo `limite_canal`; novo job agendado para 30 min depois; às 20h01, não reagenda.
- **IT-029**: o Prosio falso responde 500 em todas as tentativas → após 5 tentativas, pacote `NAO_ENVIADO` com motivo `falha_envio`.
- **IT-030**: telefone em `DescadastroWhatsapp` → nenhum envio para ele; pacote sinalizado `descadastrado`.
- **IT-031**: `confirmar` numa carga já liberada com 2 pacotes novos com WhatsApp → 2 avisos enviados na hora.
- **IT-032**: `PATCH /entregas/pacotes/:id` `{whatsapp}` num pacote `SEM_WHATSAPP` de carga liberada → 1 aviso enviado; status `AGENDADO`, depois `ENVIADO`.
- **IT-054**: `liberar` com 25 orientações guardadas → o Prosio falso recebe 2 mensagens de resumo para o carteiro (20 + 5); sem orientações → nenhuma.
- **IT-055**: carteiro do dia sem WhatsApp → a liberação procede, e o resumo não é enviado; as orientações criadas ficam com o sinal `nao_entregue_carteiro`.
- **IT-057**: unidade com `mediacaoAtiva=true` → a liberação chama `POST /api/v1/mediation/cases` para cada pacote com WhatsApp, com `externalRef=<codigo>@<data>`, `providerPhone` do carteiro do dia e `resumo='<primeiro nome> · <endereço curto>'`; o `caseId` fica gravado. No dia seguinte, o mesmo código abre um caso novo. Com `mediacaoAtiva=false`, nenhuma chamada.
- **IT-070**: destinatário descadastrado → nenhum caso de mediação aberto para o pacote.
- **IT-071**: o Prosio falso responde à abertura de caso com `firstContact: 'blocked'` (sem declaração) → pacote sinalizado `retido_consentimento`, visível na lista.
- **IT-072**: o Prosio falso responde 422 `optin_company_mismatch` → a liberação segue com os avisos, e os pacotes são sinalizados `caso_recusado:optin_company_mismatch`.

### Entrada do Prosio

- **IT-033**: `POST /entregas/prosio/:canalId/webhook`:
  - status `read` com assinatura válida → 204 e pacote `LIDO`;
  - assinatura inválida → 401 e nenhuma mudança;
  - o mesmo callback de novo → 204 sem novo `EventoPacote`.
- **IT-034**: callback com `recipientOptOut: { optedOut: true }` → `DescadastroWhatsapp` criado; a próxima prévia marca o telefone como descadastrado.
- **IT-035**: `POST /entregas/prosio/:canalId/acao/CE_OP` sem `Authorization` → 401; com o token de outro canal → 401.
- **IT-036**: `CE_OP` `{acao:'<pacote>.AMANHA'}` com `x-actor-phone` igual ao do pacote (quinta-feira) →
  - 200 `{mensagem}` citando `sexta-feira (02/10)`;
  - `Orientacao` `GUARDADA`;
  - o carteiro recebe `Não tentar hoje: <código>`;
  - pacote `INTERAGINDO`.
- **IT-037**: `CE_OP ...AGENCIA` → o Prosio falso recebe uma mensagem com botões `CE_PT:<pacote>.<pontoId>` das agências ativas. `CE_PT` → orientação `ENVIADA` e mensagem ao carteiro. Se o ponto for desativado depois, a orientação continua com `pontoDesativado: true`. `CE_PT` para ponto já inativo → a sub-lista é reenviada.
- **IT-038**: `x-actor-phone` diferente do telefone do pacote → 200 com a mensagem neutra, sem orientação.
- **IT-039**: `CE_OP ...AGENCIA` duas vezes → uma única sub-lista.
- **IT-040**: rastreio falso com insucesso hoje:
  - `CE_OP ...AMANHA` → mensagem com `CE_SN`;
  - `CE_SN ...SIM` → `GUARDADA`, sem mensagem ao carteiro;
  - `CE_SN ...NAO` → nenhuma orientação;
  - com o rastreio falso em tempo esgotado e resposta `NAO_ATENDEU` do carteiro → mesmo fluxo.
- **IT-041**: com `mediacaoAtiva=true`, `CE_OP ...VIZINHO` → o Prosio falso recebe `atualizarFatosCaso` com `motivoRelatado: 'entrega_indireta'` e a pergunta, e a resposta é `Qual o nome do vizinho e o número da casa ou apartamento?`. Com `mediacaoAtiva=false` → resposta de atendimento humano e `escalonado: true`.
- **IT-042**: `CE_CT`:
  - `...VI`, depois `...FEITO` → `VISTA`, depois `FEITA`;
  - `...NAO` → mensagem de motivos;
  - `...FECHADO` numa orientação `LOCKER` → mensagem ao destinatário e `escalonado`;
  - `...FEITO` repetido → sem novo evento;
  - `x-actor-phone` de outro carteiro → sem efeito.
- **IT-043**: webhook `mediation.outcome` assinado com `entrega_indireta` e `local: 'Dona Célia, casa 47, CPF 123.456.789-09'` →
  - `Orientacao` `VIZINHO` `ENVIADA` com o CPF removido;
  - mensagem ao carteiro;
  - o mesmo `deliveryId` de novo → sem efeito.
- **IT-044**: `mediation.outcome` de um pacote já `ENTREGUE` → sem orientação; `EventoPacote` `desfecho_ignorado`.
- **IT-045** (withdrawn): o sinal de escalonamento vindo do Prosio passou a ser o IT-065 (requisito R7).
- **IT-046**: `POST /entregas/pacotes/:id/orientacao`:
  - `{texto:'Deixar na portaria', valeParaAmanha:false}` → 201 e mensagem ao carteiro;
  - pacote `ENTREGUE` → 409;
  - texto de 301 caracteres → 400;
  - duas requisições simultâneas → as duas registradas, e a mais recente é a vigente (a outra, `SUBSTITUIDA`).
- **IT-051**: numa mesma instância do `app`, o webhook com corpo cru e HMAC válido responde 204, e um `POST /api/v1/gestao/unidades` JSON continua sendo interpretado (ordem dos middlewares).
- **IT-056**: o rastreio marca `ENTREGUE` num pacote com `mediacaoCaseId` → `POST /api/v1/mediation/cases/:id/cancel` chamado uma vez.
- **IT-064**: `CE_OP ...AMANHA` para um código com 2 cargas anteriores em `INSUCESSO` → resposta "disponível na unidade", `escalonado: true`, sem orientação.
- **IT-065**: webhook `mediation.escalated` (R7) → pacote `escalonado: true` e sinal no quadro; repetido → sem efeito.
- **IT-066**: caso de mediação expirado sem desfecho (nenhum callback) → no fim do dia o pacote continua sem orientação.
- **IT-067**: unidade com uma só agência → `CE_OP ...AGENCIA` envia a confirmação `CE_SN` com o nome da agência; `SIM` → orientação `AGENCIA`.
- **IT-068**: destinatário com 2 pacotes toca `CE_PT` da sub-lista do pacote A depois da do pacote B → a orientação vai para A.
- **IT-069**: três orientações confirmadas em sequência → o Prosio falso recebe três mensagens ao carteiro, na ordem de criação.

### Rastreio

- **IT-047**: o job de hora em hora às 14h consulta no rastreio falso só os pacotes `LIDO` e `INTERAGINDO`:
  - "entregue" → `ENTREGUE`;
  - descrição não mapeada → status inalterado e log `entregas.rastreio.nao_mapeado`.

  A varredura das 20h consulta todos os pacotes liberados que ainda não chegaram a um estado final.

### Atendimento

- **IT-048**: `POST /entregas/atendimento/sessao`:
  - UNIDADE → o Prosio falso recebe `POST /api/v1/atendimento/sessoes` com `papel: 'agente'` e a `unidadeRef` do canal compartilhado; a resposta devolve `{url, expiraEm}`;
  - uma segunda chamada gera uma nova URL;
  - usuário `CARTEIRO` → 403;
  - o Prosio falso responde 503 → 503 `atendimento_indisponivel`.

### Migrations e CI

- **IT-052**: `prisma migrate deploy` num banco vazio cria todas as tabelas, inclusive `pacotes_dia` e `orientacoes`; `migrate status` fica limpo.
- **IT-053**: `supertest(app).get('/health')` → 200 com `status: 'ok'`, sem servidor externo.

### Prosio P1–P3 (repositório do Prosio, vitest)

- **IT-058**: `POST /api/v1/messages` com `unidadeRef: 'cdd-tag'` → a `Conversation` criada guarda `unidadeRef`; uma segunda mensagem ao mesmo contato com outra `unidadeRef` abre ou marca a conversa correta. Um destinatário com pacotes em duas unidades gera espelhamentos em inboxes distintas.
- **IT-059**: `chatwoot-mirror-consumer` com `Tenant.chatwootInboxesPorUnidade = {'cdd-tag': 41}` espelha a conversa `cdd-tag` na inbox 41; conversa sem `unidadeRef` → inbox padrão (triagem).
- **IT-060**: `POST /api/v1/atendimento/sessoes` com `unidadeRef: 'cdd-tag'` adiciona o agente só à inbox 41; `papel: 'administrador'` sem `unidadeRef` → em todas as inboxes do mapa e na padrão.

## End-to-End Tests

### Jornada do supervisor, do cadastro à confirmação do carteiro (US-003–US-012, US-015, US-021, US-022)

- **E2E-001** (API, supertest + falsificações):
  1. Login de supervisor.
  2. Cria distrito, carteiro e duas agências.
  3. `previa` e `confirmar` de uma planilha com `OY526018152BR` (com WhatsApp).
  4. `liberar`: o Prosio falso recebe o aviso com botões.
  5. Simula `CE_OP ...AGENCIA` e depois `CE_PT`.
  6. O Prosio falso recebe a orientação ao carteiro.
  7. Simula `CE_CT ...FEITO` e o webhook `read`.

  Resultado: `GET pacotes` mostra a orientação `FEITA` e o status `INTERAGINDO`.

### Resposta tardia e orientação no dia seguinte (US-010, US-013, US-019, US-023)

- **E2E-002** (API):
  1. Rastreio falso com insucesso às 11:20.
  2. `CE_OP ...AMANHA`: a resposta cita 11h20; `CE_SN SIM`.
  3. Relógio avança para o próximo dia útil.
  4. `confirmar` a mesma planilha: a prévia marca a orientação guardada.
  5. `liberar`.

  Resultado: o resumo ao carteiro contém a orientação guardada, e o aviso ao destinatário contém `Vamos seguir sua orientação`.

### Vizinho pela mediação (US-014, US-017)

- **E2E-003** (API):
  1. Unidade com `mediacaoAtiva`; `liberar` abre o caso no Prosio falso.
  2. `CE_OP ...VIZINHO` atualiza os fatos do caso.
  3. O Prosio falso envia o webhook `mediation.outcome` (`entrega_indireta`, "Dona Célia, casa 47").

  Resultado: o carteiro recebe `Deixar com Dona Célia, casa 47` com os botões `CE_CT`.

### Descadastro (US-011.EC-5, US-020)

- **E2E-004** (API):
  1. Webhook de status com `recipientOptOut`.
  2. No dia seguinte, `previa` com o mesmo telefone mostra `descadastrado`.
  3. `liberar`.

  Resultado: o Prosio falso não recebe aviso para esse telefone.

### Interface do supervisor (Playwright)

- **E2E-005**: login `UNIDADE` → a URL é `/entregas/carregar`, e o menu mostra Carregar Dados, Rotas (em breve), Atendimento, Cadastro e SGPD v2. Clicar Rotas → "Em breve". Clicar SGPD v2 → `/unidade` com a faixa "Protótipo — dados de demonstração". Clicar "Voltar aos módulos" → `/entregas/carregar`.
- **E2E-006** (withdrawn): a prévia com correção por linha deixou de ser o caminho da carga do dia (ADR-019); a importação direta é coberta pelo E2E-017. Passos antigos, para referência:
  1. No quadro, clica no distrito "Pendente de upload".
  2. Envia `aguas-claras-sul.xlsx` (40 linhas): a prévia mostra "36 válidos", "1 para corrigir" e "3 inválidos".
  3. Uma planilha só com linhas inválidas deixa "Confirmar" desabilitado.
  4. Confirma a planilha válida.

  Resultado: o cartão do distrito mostra "28 de 37 pacotes com WhatsApp".
- **E2E-007**:
  1. "Liberar rota" abre o diálogo "Liberar rota D-03 · Renato Alves Costa?" com "28 destinatários" e "9 pacotes sem WhatsApp".
  2. "Liberar e enviar avisos" deixa o cartão "Liberada".

  Numa rota sem carteiro, o cartão mostra "Sem carteiro definido" e "Definir carteiro", sem "Liberar rota". Numa rota com 0 WhatsApp, o diálogo pede confirmação explícita.
- **E2E-008**: Cadastro › Distritos › "Novo distrito" `D-09 · Taguatinga Oeste` → aparece na tabela. As abas Carteiros e Agências e lockers criam um registro cada.
- **E2E-009**: Atendimento → o `iframe` tem `src` igual à URL devolvida pelo backend falso. Com o backend falso respondendo 503 → a área mostra "Atendimento indisponível no momento" e o botão "Abrir em nova aba".
- **E2E-010**: login `GESTAO` → `/entregas/cadastro`. Cria um canal Prosio (o token é exibido uma vez), uma unidade vinculada e um supervisor. Esse supervisor faz login e vê só a própria unidade.
- **E2E-011**: viewport 390×844 → o menu lateral vira botão; ao abrir, mostra os mesmos itens; a página não tem rolagem horizontal.
- **E2E-012**: com o quadro aberto, o teste envia um webhook `read` para um pacote → em até 35 s o cartão do distrito atualiza a contagem de "Lido" sem recarregar. O mesmo vale para a lista do distrito.
- **E2E-013**: supervisor de unidade sem rotas → o quadro mostra o controle "Importar arquivo da saída" e "Saída 1 ainda não foi importada". (withdrawn: "Cadastre distritos" com o link para o Cadastro — a rota nasce do arquivo, ADR-019.)
- **E2E-014**: com o token expirado (e o refresh também), clicar em Atendimento → tela de login; depois do login, volta para `/entregas/atendimento`.
- **E2E-015**:
  - login de um usuário `CARTEIRO` → a área `/carteiro`, sem os três módulos. Desde a captura do rótulo (app-carteiro-captura-rotulo) a página inicial do carteiro é o app `/carteiro/captura`, não mais o shell legado; abrir `/entregas/carregar` devolve o carteiro a `/carteiro/captura`;
  - um favorito `/unidade/despacho` aberto por supervisor → a tela antiga, com a faixa de protótipo;
  - um usuário `CARTEIRO` não vê o item SGPD v2 nem "Carregar Dados" (não tem o shell novo).
- **E2E-016**: na lista de pacotes do distrito, "Registrar orientação" abre o diálogo (foco no texto, contador `0/300`, Esc fecha e devolve o foco). Vazia ou acima de 300 → aviso no diálogo, sem mensagem ao carteiro. Com texto válido → o diálogo fecha, a linha mostra a orientação e o Prosio falso recebe a mensagem ao carteiro. Com "Vale também para amanhã" → a linha mostra "Orientação guardada para DD/MM" e nenhuma mensagem sai hoje. Um texto de 300 caracteres com telefone → 400 `orientacao_longa` do servidor aparece no diálogo. Pacote entregue enquanto o diálogo está aberto → 409 `pacote_entregue` aparece no diálogo e a ação some da linha.
- **E2E-017**: com a Saída 1 já importada, o supervisor abre a aba da Saída 2 ("ainda não foi importada"). Importar sem horário → "Confirme o horário da Saída 2 antes de importar.", nada gravado. Com o horário e `saida-2.xlsx` → a aba "Saída 2 · 14:00" abre com as rotas 509 (carteiro do arquivo) e 510 ("Sem carteiro definido"), "Rotas criadas no Cadastro: 509, 510." e o bloco "6 aceitos, 4 descartados"; "Ver linhas descartadas (4)" lista linha, rota, código e motivo, sem nome nem telefone. Depois de recarregar, o resultado continua na aba.
- **E2E-018**: na rota sem carteiro, "Definir carteiro" abre o modal "Atribuir carteiros"; escolher o carteiro e marcar o padrão → o cartão passa a mostrar o carteiro e "Liberar rota". "Liberar 2 rotas carregadas" → diálogo "Liberar 2 rotas da Saída 2?" com os totais e "Rotas 509, 510." → as duas ficam "Liberada"; a Saída 1 não muda; o padrão da rota fica gravado no Cadastro.
- **E2E-019**: depois de liberar a rota 509, escolher "Saída 2 (reimportar)" preenche o horário e mostra o aviso de substituição. A reimportação troca os pacotes da 510 (3 pacotes) e mantém a 509 liberada como estava (4 pacotes), com "3 aceitos, 2 descartados" e o motivo "Rota já liberada".
- **E2E-020**: a Gestão vê o seletor de unidade; em "Todas as unidades" a aba mostra "1 unidade · 4 rotas", o cartão mostra a unidade e importar, liberar e definir carteiro ficam indisponíveis. Escolhendo outra unidade, a Gestão importa a Saída 1 dela ("7 aceitos, 3 descartados"); o agregado passa a ter 2 saídas e 7 rotas.
