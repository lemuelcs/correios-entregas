# User Stories: Monitoramento de Entregas via WhatsApp

Catálogo canônico de comportamento da feature. Companheiro de `_prd.md`; consumido por
`_techspec.md` (mapeamento de componentes) e `_tests.md` (matriz de cobertura).

Códigos de exemplo válidos (dígito verificador correto): `AA123456785BR`, `OY716488072BR`.

## Personas

> Nas histórias abaixo, "painel" designa o quadro de distritos e a lista de pacotes do distrito em Monitoramento › Carregar Dados (US-038, US-039).

- **Gestor (sede)** — usuário da Gestão. Cadastra unidades e supervisores, vê todas as unidades e atende conversas sem unidade identificada.
- **Supervisor** — responsável por um CDD ou CEE. Cadastra distritos, carteiros, agências e lockers da unidade; sobe a lista do dia, libera distritos, acompanha o painel e atende destinatários no Chatwoot.
- **Destinatário** — pessoa que vai receber a encomenda. Só interage pelo WhatsApp, sem conta no sistema.
- **Carteiro** — faz a entrega do distrito no dia. Recebe orientações, confirma o cumprimento e aciona o destinatário quando precisa, sempre pelo WhatsApp e mediado pelo bot, sem precisar do app e sem expor o próprio número.

## Story Index

| ID     | Feature Area            | Persona      | Story |
|--------|-------------------------|--------------|-------|
| US-001 | Cadastros da sede       | Gestor       | Cadastrar unidade com tipo e canal de WhatsApp |
| US-002 | Cadastros da sede       | Gestor       | Cadastrar supervisores de uma unidade |
| US-003 | Cadastros da unidade    | Supervisor   | Cadastrar distritos da unidade |
| US-004 | Cadastros da unidade    | Supervisor   | Cadastrar carteiros da unidade |
| US-005 | Cadastros da unidade    | Supervisor   | Definir o carteiro do distrito no dia |
| US-006 | Cadastros da unidade    | Supervisor   | Cadastrar agências e lockers oferecidos |
| US-007 | Lista do dia            | Supervisor   | Subir a lista do dia por planilha |
| US-008 | Lista do dia            | Supervisor   | Colar a lista do dia como texto |
| US-009 | Lista do dia            | Supervisor   | Revisar a prévia validada antes de confirmar |
| US-010 | Lista do dia            | Supervisor   | Ver orientações guardadas reaplicadas à lista |
| US-011 | Liberação e aviso       | Supervisor   | Liberar o distrito e disparar os avisos |
| US-012 | Liberação e aviso       | Destinatário | Receber o aviso "saiu para entrega" com opções |
| US-013 | Resposta do destinatário| Destinatário | Escolher "Tentar novamente amanhã" |
| US-014 | Resposta do destinatário| Destinatário | Escolher "Deixar com meu vizinho" |
| US-015 | Resposta do destinatário| Destinatário | Escolher "Deixar na agência" |
| US-016 | Resposta do destinatário| Destinatário | Escolher "Deixar no locker" |
| US-017 | Resposta do destinatário| Destinatário | Descrever "Outra opção" em texto livre |
| US-018 | Resposta do destinatário| Destinatário | Ser atendido por uma pessoa quando o bot não resolve |
| US-019 | Resposta do destinatário| Destinatário | Responder depois da tentativa do dia |
| US-020 | Resposta do destinatário| Destinatário | Parar de receber mensagens |
| US-021 | Carteiro                | Carteiro     | Receber a orientação no WhatsApp |
| US-022 | Carteiro                | Carteiro     | Confirmar o cumprimento da orientação |
| US-023 | Carteiro                | Carteiro     | Receber o resumo de orientações ao sair |
| US-024 | Painel                  | Supervisor   | (withdrawn) Acompanhar distritos do dia no painel — movida para o PRD de Monitoramento |
| US-025 | Painel                  | Supervisor   | (withdrawn) Ver a linha do tempo de uma encomenda — movida para o PRD de Monitoramento |
| US-026 | Atendimento             | Supervisor   | Registrar orientação manualmente para o carteiro |
| US-027 | Atendimento             | Supervisor   | Entrar no Chatwoot sem senha a partir do sistema |
| US-028 | Atendimento             | Supervisor   | Atender só conversas da própria unidade |
| US-029 | Atendimento             | Gestor       | Ver todas as unidades e a triagem |
| US-030 | Mediação                | Carteiro     | Acionar o destinatário a partir da rua |
| US-031 | Mediação                | Destinatário | Responder ao carteiro em texto livre |
| US-032 | Mediação                | Destinatário | Não ver nem expor o contato da outra ponta |
| US-033 | Mediação                | Supervisor   | Ler o teor do caso e assumir uma ponta |
| US-034 | Mediação                | Gestor       | Configurar a mediação do tenant Correios |
| US-035 | Mediação                | Destinatário | Ter várias encomendas sem que as conversas se misturem |
| US-036 | Navegação               | Supervisor   | Entrar na aplicação pelos três módulos |
| US-037 | Navegação               | Supervisor   | Abrir as telas antigas em "SGPD v2" |
| US-038 | Navegação               | Supervisor   | Ver o status de cada pacote no distrito |
| US-039 | Carregar Dados          | Supervisor   | Ver o quadro de distritos do dia com status |
| US-040 | Carregar Dados          | Supervisor   | Carregar pacotes sem WhatsApp e ver "X de Y" |

## Cadastros da sede

### US-001: Cadastrar unidade com tipo e canal de WhatsApp

**As a** Gestor, **I want** cadastrar uma unidade de distribuição com tipo e canal de envio, **so that** os supervisores dela possam operar o fluxo.

Acceptance criteria:

- AC-1: Given o Gestor na tela de unidades, when salva uma unidade com nome, tipo (CDD ou CEE), endereço e canal (número atual ou número oficial), then a unidade aparece na lista com esses dados.
- AC-2: Given uma unidade existente, when o Gestor troca o canal de número atual para número oficial, then os avisos liberados a partir desse momento saem pelo número oficial e os já enviados mantêm seu histórico.

Edge cases:

- EC-1: Nome ou tipo em branco → formulário recusa com o campo indicado.
- EC-2: Canal "número oficial" escolhido sem o canal configurado para o tenant → salvamento recusado com "Número oficial ainda não disponível para esta unidade".
- EC-3: Supervisor tenta acessar o cadastro de unidades → acesso negado.
- EC-4: Dois gestores editam a mesma unidade ao mesmo tempo → a segunda gravação avisa que a unidade mudou e mostra os dados atuais.
- EC-5: Unidade desativada → some das escolhas e seus supervisores não liberam distritos; histórico permanece consultável pela Gestão.

### US-002: Cadastrar supervisores de uma unidade

**As a** Gestor, **I want** cadastrar supervisores com nome, matrícula e WhatsApp vinculados a uma unidade, **so that** cada unidade tenha quem opere o fluxo.

Acceptance criteria:

- AC-1: Given uma unidade, when o Gestor cadastra um supervisor com nome, matrícula, WhatsApp e e-mail de acesso, then o supervisor consegue entrar no sistema e vê apenas a própria unidade.
- AC-2: Given uma unidade com um supervisor, when o Gestor cadastra um segundo, then os dois veem os mesmos distritos, listas e conversas da unidade.

Edge cases:

- EC-1: Matrícula já usada por outro supervisor ou carteiro → recusado com "Matrícula já cadastrada".
- EC-2: WhatsApp em formato inválido (sem DDD, com letras) → recusado com o formato esperado.
- EC-3: Supervisor desativado com sessão aberta → a próxima ação é negada e ele perde o acesso ao Chatwoot.
- EC-4: Unidade sem nenhum supervisor ativo → a Gestão vê o alerta "Unidade sem supervisor" na lista de unidades.
- EC-5: Supervisor movido de unidade → passa a ver só a nova unidade; conversas da unidade antiga deixam de aparecer para ele.

## Cadastros da unidade

### US-003: Cadastrar distritos da unidade

**As a** Supervisor, **I want** cadastrar os distritos da minha unidade, **so that** eu possa vincular cada lista do dia a um distrito.

Acceptance criteria:

- AC-1: Given a tela de distritos, when o supervisor cadastra um distrito com código e nome, then ele aparece para escolha ao subir listas.
- AC-2: Given um distrito com histórico, when o supervisor o desativa, then ele não aparece mais para novas listas e o histórico continua no painel.

Edge cases:

- EC-1: Código de distrito repetido na mesma unidade → recusado; o mesmo código em outra unidade é permitido.
- EC-2: Unidade sem distritos → a tela de lista do dia mostra "Cadastre ao menos um distrito" com atalho.
- EC-3: Supervisor tenta ver distritos de outra unidade (por link ou id) → acesso negado.
- EC-4: Desativar distrito com lista liberada hoje → recusado com "Distrito em operação hoje".
- EC-5: Unidade com 100 distritos → lista paginada e com busca por código ou nome.

### US-004: Cadastrar carteiros da unidade

**As a** Supervisor, **I want** cadastrar carteiros com nome, matrícula e WhatsApp, **so that** eles recebam as orientações dos destinatários.

Acceptance criteria:

- AC-1: Given a tela de carteiros, when o supervisor cadastra nome, matrícula e WhatsApp, then o carteiro fica disponível para ser o carteiro de um distrito.
- AC-2: Given um carteiro cadastrado, when o supervisor altera o WhatsApp, then as próximas orientações vão para o novo número.

Edge cases:

- EC-1: WhatsApp inválido → recusado com o formato esperado.
- EC-2: Matrícula já existente → recusado.
- EC-3: Carteiro já cadastrado em outra unidade → recusado com "Carteiro vinculado à unidade X; peça transferência à Gestão".
- EC-4: Desativar carteiro que é carteiro de distrito liberado hoje → recusado até o distrito ser encerrado ou o carteiro ser trocado.
- EC-5: Mesmo WhatsApp em dois carteiros → recusado.

### US-005: Definir o carteiro do distrito no dia

**As a** Supervisor, **I want** indicar qual carteiro faz cada distrito hoje, **so that** as orientações cheguem a quem está na rua.

Acceptance criteria:

- AC-1: Given um distrito, when o supervisor define o carteiro padrão, then esse carteiro é pré-selecionado em todos os dias.
- AC-2: Given o dia de hoje, when o supervisor troca o carteiro de um distrito, then a troca vale só para hoje e as orientações seguintes vão ao novo carteiro.
- AC-3: Given um distrito já liberado, when o carteiro é trocado, then o novo carteiro recebe o resumo das orientações pendentes do distrito (US-023) e o anterior não recebe mais nada desse distrito.

Edge cases:

- EC-1: Distrito sem carteiro no dia → não pode ser liberado; a tela indica o motivo.
- EC-2: Mesmo carteiro em dois distritos no mesmo dia → permitido com aviso (carteiro dobrando).
- EC-3: Carteiro desativado como padrão → o distrito aparece sem carteiro até nova escolha.
- EC-4: Troca de carteiro enquanto uma orientação está sendo enviada → a orientação vai a quem era o carteiro no momento do envio e aparece como reenviada ao novo carteiro no resumo.

### US-006: Cadastrar agências e lockers oferecidos

**As a** Supervisor, **I want** cadastrar as agências e os lockers da minha unidade, **so that** o destinatário possa escolher onde retirar a encomenda.

Acceptance criteria:

- AC-1: Given a tela de pontos de retirada, when o supervisor cadastra uma agência com nome, endereço e horário, then ela aparece na sub-lista da opção "Deixar na agência" para todos os distritos da unidade.
- AC-2: Given a mesma tela, when o supervisor cadastra um locker com nome, endereço e horário, then ele aparece na sub-lista da opção "Deixar no locker".
- AC-3: Given uma agência ou locker, when o supervisor a desativa, then ela sai das sub-listas enviadas a partir desse momento.

Edge cases:

- EC-1: Unidade sem nenhuma agência ativa → a opção "Deixar na agência" não aparece no aviso; o mesmo vale para locker.
- EC-2: Mais de 10 agências (ou 10 lockers) ativas → a 11ª ativação é recusada com "Máximo de 10 por tipo no WhatsApp".
- EC-3: Nome de agência com mais de 24 caracteres → recusado com o limite, porque a linha da lista do WhatsApp o trunca.
- EC-4: Agência desativada depois de escolhida por um destinatário → a orientação já registrada se mantém e o painel marca "ponto desativado".
- EC-5: Supervisor tenta editar agência de outra unidade → acesso negado.

## Lista do dia

### US-007: Subir a lista do dia por planilha

**As a** Supervisor, **I want** subir uma planilha com nome, WhatsApp e código de cada encomenda e escolher o distrito, **so that** o sistema saiba quem avisar.

Acceptance criteria:

- AC-1: Given o quadro de distritos, when o supervisor abre um distrito e envia um arquivo CSV ou XLSX com as colunas código, nome, WhatsApp e endereço completo, then o sistema mostra a prévia com todas as linhas classificadas (US-009).
- AC-2: Given uma planilha com colunas em outra ordem ou com cabeçalhos equivalentes ("telefone", "celular", "objeto", "rastreio"), when enviada, then as colunas são reconhecidas.
- AC-3: Given o supervisor confirmou uma lista para o distrito, when sobe outra planilha para o mesmo distrito e dia, then as novas linhas são somadas à lista existente.

Edge cases:

- EC-1: Arquivo de outro formato (PDF, imagem) → recusado com "Envie CSV ou XLSX".
- EC-2: Arquivo vazio ou só com cabeçalho → "Nenhuma encomenda encontrada".
- EC-3: Coluna obrigatória (código ou nome) ausente → recusado indicando qual coluna falta; colunas WhatsApp ou endereço ausentes → aceito com aviso "pacotes sem WhatsApp não serão avisados".
- EC-4: Mais de 500 linhas → recusado com "Máximo de 500 encomendas por distrito por envio".
- EC-5: Planilha com várias abas → usa a primeira e avisa.
- EC-6: Conteúdo hostil (fórmulas, scripts) → tratado como texto; nada é executado.
- EC-7: Queda de conexão no envio → nada é gravado; o supervisor reenvia.
- EC-8: Supervisor tenta subir lista para distrito de outra unidade → negado.

### US-008: Colar a lista do dia como texto

**As a** Supervisor, **I want** colar linhas de texto com nome, WhatsApp e código, **so that** eu adicione encomendas rapidamente sem montar planilha.

Acceptance criteria:

- AC-1: Given a tela de lista do dia, when o supervisor cola linhas separadas por tabulação, ponto e vírgula ou vírgula, then cada linha vira uma encomenda na prévia.
- AC-2: Given uma lista já confirmada, when o supervisor cola novas linhas, then elas são somadas à lista do distrito.

Edge cases:

- EC-1: Linha com campos a menos → marcada como inválida com "Faltam campos".
- EC-2: Linhas em branco no meio → ignoradas.
- EC-3: Texto colado de outra ferramenta com espaços extras → espaços removidos antes da validação.
- EC-4: Mais de 500 linhas coladas → recusado com o limite.

### US-009: Revisar a prévia validada antes de confirmar

**As a** Supervisor, **I want** ver cada linha classificada como válida ou inválida com o motivo, **so that** eu corrija antes de confirmar.

Acceptance criteria:

- AC-1: Given uma prévia, when há linhas inválidas, then cada uma mostra o motivo (código inválido, dígito verificador errado, WhatsApp inválido, nome vazio, duplicada, já em outro distrito hoje).
- AC-2: Given uma prévia, when o supervisor corrige uma linha inválida na própria tela, then ela é revalidada na hora.
- AC-3: Given uma prévia com linhas válidas, when o supervisor confirma, then só as linhas válidas entram na lista do distrito e as inválidas são descartadas com um resumo "N aceitas, M descartadas".

Edge cases:

- EC-1: Código `AB123456789BR` (dígito verificador errado) → inválida com "Dígito verificador não confere".
- EC-2: Código em minúsculas → normalizado para maiúsculas e aceito se válido.
- EC-3: WhatsApp com +55, com parênteses, com ou sem nono dígito → normalizado; sem DDD → sinalizado para correção; se não corrigido, entra como "sem WhatsApp".
- EC-3b: WhatsApp vazio → aceito como "sem WhatsApp" e contado no "X de Y".
- EC-4: Mesmo código duas vezes na lista → a segunda marcada como duplicada.
- EC-5: Código já em lista de outro distrito hoje → inválida com "Já está no distrito X hoje".
- EC-6: Mesmo WhatsApp em várias encomendas → aceito; cada encomenda gera seu próprio aviso.
- EC-7: Todas as linhas inválidas → botão de confirmar desabilitado.
- EC-8: Supervisor fecha a tela antes de confirmar → nada é gravado.
- EC-9: Dois supervisores confirmam listas do mesmo distrito ao mesmo tempo → as duas são somadas; duplicadas entre elas são descartadas.

### US-010: Ver orientações guardadas reaplicadas à lista

**As a** Supervisor, **I want** que encomendas com orientação guardada de um dia anterior venham marcadas, **so that** o carteiro siga o que o destinatário pediu.

Acceptance criteria:

- AC-1: Given uma encomenda com orientação guardada (US-019), when ela aparece na lista de um novo dia, then a prévia mostra a orientação ("Deixar com vizinho: Maria, apto 302").
- AC-2: Given essa lista confirmada e liberada, when o carteiro recebe o resumo (US-023), then a orientação guardada está nele.

Edge cases:

- EC-1: Encomenda com orientação guardada vai para outro distrito → a orientação acompanha a encomenda.
- EC-2: Orientação para agência ou locker que foi desativado → marcada "ponto desativado"; o supervisor decide no painel.
- EC-3: Encomenda com orientação guardada não aparece em nenhuma lista por dias → a orientação permanece até a encomenda ser entregue ou devolvida.

## Liberação e aviso

### US-011: Liberar o distrito e disparar os avisos

**As a** Supervisor, **I want** liberar o distrito quando o carteiro sai, **so that** os destinatários sejam avisados só quando a encomenda realmente saiu.

Acceptance criteria:

- AC-1: Given um distrito com lista confirmada e carteiro no dia, when o supervisor clica "Liberar distrito", then cada encomenda da lista recebe um aviso no WhatsApp pelo canal da unidade e o painel mostra o distrito como "Em rota".
- AC-2: Given um distrito liberado, when o supervisor adiciona encomendas à lista, then os novos destinatários são avisados na hora.

Edge cases:

- EC-1: Clique duplo ou nova liberação do mesmo distrito → nenhum aviso é repetido.
- EC-2: Liberação entre 0h e 6h → avisos ficam agendados para 06:05 e o painel mostra "Agendado".
- EC-3: Canal da unidade atingiu o limite diário → os excedentes aparecem como "Não enviado — limite do canal" e são enviados automaticamente quando houver capacidade no mesmo dia; ao fim do dia, ficam como não enviados.
- EC-4: Número do destinatário sem WhatsApp → encomenda marcada "Sem WhatsApp" no painel.
- EC-5: Destinatário que pediu para parar (US-020) → não recebe aviso; painel mostra "Descadastrado".
- EC-6: Distrito sem carteiro → liberação bloqueada.
- EC-7: Falha temporária no envio → novas tentativas automáticas; após esgotá-las, "Falha no envio" no painel.
- EC-8: Lista vazia → liberação bloqueada com "Distrito sem encomendas".

### US-012: Receber o aviso "saiu para entrega" com opções

**As a** Destinatário, **I want** saber que minha encomenda saiu e ter opções se não puder receber, **so that** eu não perca a entrega.

Acceptance criteria:

- AC-1: Given um distrito liberado, when o aviso chega, then o texto é "Olá, <primeiro nome>, sua encomenda <código> já saiu para entrega. Se tiver alguma dificuldade para receber sua encomenda, nos avise." seguido de uma lista com: "Tentar novamente amanhã", "Deixar com meu vizinho", "Deixar na agência", "Deixar no locker", "Outra opção".
- AC-2: Given a encomenda tem orientação guardada de outro dia, when o aviso chega, then ele diz "Vamos seguir sua orientação: <orientação>" e mantém as opções para mudar.
- AC-3: Given qualquer aviso, then ele não contém link nem pedido de pagamento.

Edge cases:

- EC-1: Unidade sem agências ou sem lockers → a opção correspondente não aparece.
- EC-2: Nome com uma palavra só ou em maiúsculas → usa a palavra com a primeira letra maiúscula.
- EC-3: Nome vazio (não deveria passar na validação) → "Olá," sem nome.
- EC-4: Destinatário com três encomendas → três avisos, cada um com seu código.
- EC-5: Destinatário não responde → nada acontece; o carteiro segue a rota normal.
- EC-6: Destinatário responde com texto fora da lista (ex.: "ok", "obrigado") → o bot agradece e lembra que pode escolher uma opção.

## Resposta do destinatário

### US-013: Escolher "Tentar novamente amanhã"

**As a** Destinatário, **I want** pedir nova tentativa amanhã, **so that** a encomenda não volte à unidade como ausente.

Acceptance criteria:

- AC-1: Given o aviso de hoje, when o destinatário escolhe "Tentar novamente amanhã", then o bot confirma "Combinado, tentaremos amanhã", o carteiro recebe a orientação de não tentar hoje e a orientação fica guardada para a lista de amanhã.

Edge cases:

- EC-1: Escolha repetida → não gera nova orientação; o bot confirma a mesma.
- EC-2: Escolha depois de o carteiro já ter tentado → segue US-019.
- EC-3: Escolha em uma sexta-feira → "amanhã" significa o próximo dia de entrega da unidade; o bot informa a data.
- EC-4: Encomenda já no limite de tentativas ou de prazo de guarda → o bot informa que a encomenda ficará disponível na unidade e a conversa vai ao supervisor.

### US-014: Escolher "Deixar com meu vizinho"

**As a** Destinatário, **I want** autorizar a entrega a um vizinho, **so that** eu receba mesmo ausente.

Acceptance criteria:

- AC-1: Given o aviso, when o destinatário escolhe "Deixar com meu vizinho", then o bot pergunta o nome do vizinho e depois o número da casa ou apartamento.
- AC-2: Given as duas respostas, when o bot confirma "Deixar com <nome>, <casa/apto>. Confirma?" e o destinatário confirma, then a orientação vai ao carteiro.

Edge cases:

- EC-1: Resposta vazia ou só números no nome → o bot pede de novo; na terceira falha, transfere ao supervisor.
- EC-2: Destinatário manda CPF ou telefone do vizinho → o bot não repassa esses dados ao carteiro.
- EC-3: Destinatário some no meio (só deu o nome) → nenhuma orientação é enviada; após 2 horas sem resposta o fluxo é abandonado e o painel mostra "Resposta incompleta".
- EC-4: Destinatário nega a confirmação → o bot pergunta de novo o nome.

### US-015: Escolher "Deixar na agência"

**As a** Destinatário, **I want** escolher uma agência para retirar depois, **so that** eu busque quando puder.

Acceptance criteria:

- AC-1: Given o aviso, when o destinatário escolhe "Deixar na agência", then recebe uma sub-lista com as agências ativas da unidade (nome e endereço resumido).
- AC-2: Given a sub-lista, when escolhe uma agência, then o bot confirma a escolha com endereço e horário de funcionamento e a orientação vai ao carteiro.

Edge cases:

- EC-1: Uma única agência ativa → o bot pula a sub-lista e pede confirmação direta.
- EC-2: Agência desativada entre a sub-lista e a escolha → o bot informa e reenvia a sub-lista atual.
- EC-3: Destinatário escolhe uma linha de sub-lista antiga (de outra encomenda) → a escolha vale para a encomenda daquela sub-lista.

### US-016: Escolher "Deixar no locker"

**As a** Destinatário, **I want** escolher um locker para retirar depois, **so that** eu retire a qualquer hora.

Acceptance criteria:

- AC-1: Given o aviso, when o destinatário escolhe "Deixar no locker", then recebe a sub-lista de lockers ativos da unidade.
- AC-2: Given a escolha, when confirmada, then o bot informa endereço e horário do locker e a orientação vai ao carteiro.

Edge cases:

- EC-1: Um único locker ativo → confirmação direta.
- EC-2: Locker desativado entre a sub-lista e a escolha → o bot informa e reenvia a sub-lista.
- EC-3: Carteiro informa que o locker estava cheio (US-022) → o destinatário é avisado de que a encomenda seguirá para a unidade e a conversa vai ao supervisor.

### US-017: Descrever "Outra opção" em texto livre

**As a** Destinatário, **I want** explicar com minhas palavras como quero receber, **so that** o carteiro atenda um caso que as opções não cobrem.

Acceptance criteria:

- AC-1: Given o aviso, when o destinatário escolhe "Outra opção", then o bot pede "Conte como prefere receber".
- AC-2: Given o texto, when o agente de IA entende, then o bot responde "Entendi: <instrução resumida>. Confirma?" e, confirmada, a instrução vai ao carteiro.
- AC-3: Given uma instrução como "deixa com o porteiro Zé até as 18h", then o carteiro recebe "Deixar com o porteiro Zé; até 18h".

Edge cases:

- EC-1: Texto que o agente não entende → transfere ao supervisor (US-018).
- EC-2: Destinatário nega a confirmação duas vezes → transfere ao supervisor.
- EC-3: Pedido fora do escopo (mudar endereço, reclamação, cobrança, dados de outra encomenda) → o bot diz que vai chamar um atendente e transfere.
- EC-4: Texto tentando mudar o comportamento do bot ("ignore as instruções") → tratado como texto comum; o agente só registra orientação de entrega.
- EC-5: Áudio ou imagem em vez de texto → o bot pede que escreva; se insistir, transfere.
- EC-6: Texto muito longo (mais de 1000 caracteres) → o agente resume; a instrução ao carteiro tem no máximo 300 caracteres.

### US-018: Ser atendido por uma pessoa quando o bot não resolve

**As a** Destinatário, **I want** falar com uma pessoa quando o bot não entende, **so that** meu caso seja resolvido.

Acceptance criteria:

- AC-1: Given uma transferência, when ela ocorre, then o destinatário recebe "Vou chamar um atendente da unidade" e a conversa aparece no Chatwoot da unidade com código, distrito, carteiro, opção escolhida e o texto do destinatário.
- AC-2: Given o supervisor responde no Chatwoot, then a resposta chega ao destinatário no mesmo WhatsApp.

Edge cases:

- EC-1: Transferência fora do horário da unidade → o destinatário é avisado de que o atendimento responde no próximo horário.
- EC-2: Encomenda sem unidade identificável (destinatário escreve do nada) → conversa vai à caixa de triagem da Gestão.
- EC-3: Destinatário manda nova mensagem enquanto aguarda → entra na mesma conversa, sem nova transferência.

### US-019: Responder depois da tentativa do dia

**As a** Destinatário, **I want** que minha resposta tardia valha para a próxima tentativa, **so that** eu não precise repetir amanhã.

Acceptance criteria:

- AC-1: Given o rastreio mostra tentativa sem sucesso hoje às HH:MM, when o destinatário escolhe uma opção, then o bot informa "Hoje já tentamos entregar às HH:MM, sem sucesso. Na próxima tentativa o carteiro seguirá sua orientação: <orientação>. Confirma que vale para amanhã?".
- AC-2: Given a confirmação, then a orientação fica guardada na encomenda, aparece no painel e é reaplicada na próxima lista (US-010), sem aviso ao carteiro de hoje.
- AC-3: Given o rastreio mostra a encomenda entregue, when o destinatário escolhe uma opção, then o bot informa "Sua encomenda foi entregue às HH:MM" e nenhuma orientação é criada.
- AC-4: Given o rastreio não mostra tentativa nem entrega, then a orientação vai ao carteiro na hora.

Edge cases:

- EC-1: Rastreio indisponível → o sistema usa a última confirmação do carteiro (US-022) sobre a encomenda; sem ela, repassa ao carteiro.
- EC-2: Rastreio diz "entregue" mas o carteiro marcou "não foi possível" → o bot não afirma nada e transfere ao supervisor.
- EC-3: Destinatário não confirma "vale para amanhã" → nada é guardado.
- EC-4: Nova escolha no dia seguinte → substitui a orientação guardada.

### US-020: Parar de receber mensagens

**As a** Destinatário, **I want** parar de receber avisos, **so that** eu controle o uso do meu número.

Acceptance criteria:

- AC-1: Given qualquer conversa, when o destinatário envia "SAIR", then recebe a confirmação e não recebe mais avisos de nenhuma unidade.
- AC-2: Given o descadastro, when o destinatário envia "VOLTAR", then volta a receber avisos.

Edge cases:

- EC-1: Descadastrado aparece numa nova lista → a prévia marca "Descadastrado" e ele não é avisado.
- EC-2: "sair" em minúsculas ou com espaços → reconhecido.

## Carteiro

### US-021: Receber a orientação no WhatsApp

**As a** Carteiro, **I want** receber no WhatsApp a orientação de cada destinatário, **so that** eu saiba o que fazer antes de chegar.

Acceptance criteria:

- AC-1: Given uma orientação confirmada, then o carteiro do distrito recebe uma mensagem com código, nome do destinatário, orientação e botões "Vi", "Feito" e "Não foi possível".

Edge cases:

- EC-1: Carteiro sem WhatsApp válido → orientação fica "Não entregue ao carteiro" no painel com destaque para o supervisor.
- EC-2: Várias orientações seguidas → cada uma em mensagem própria, na ordem em que foram confirmadas.
- EC-3: Orientação alterada pelo destinatário → o carteiro recebe "ATUALIZADA: <nova orientação>" e a anterior é marcada substituída.

### US-022: Confirmar o cumprimento da orientação

**As a** Carteiro, **I want** confirmar com um toque o que fiz, **so that** o supervisor e o destinatário saibam o resultado.

Acceptance criteria:

- AC-1: Given uma orientação, when o carteiro toca "Vi", "Feito" ou "Não foi possível", then o status aparece no painel com a hora.
- AC-2: Given "Não foi possível", then o carteiro escolhe o motivo numa lista curta (ninguém atendeu, endereço não encontrado, vizinho recusou, local fechado, outro) e o supervisor é alertado no painel. (Ajustado no TechSpec, ADR-011: texto livre do carteiro cairia na desambiguação da mediação.)

Edge cases:

- EC-1: Toque repetido → registra só a primeira vez de cada botão.
- EC-2: Toque de um número que não é o carteiro do distrito → ignorado.
- EC-3: "Feito" depois de o rastreio mostrar tentativa sem sucesso → o painel mostra divergência para o supervisor.

### US-023: Receber o resumo de orientações ao sair

**As a** Carteiro, **I want** receber, na liberação, o resumo das orientações já conhecidas do meu distrito, **so that** eu planeje a rota.

Acceptance criteria:

- AC-1: Given a liberação de um distrito com orientações guardadas, then o carteiro recebe um resumo com código, nome e orientação de cada uma.
- AC-2: Given nenhuma orientação guardada, then nenhum resumo é enviado.

Edge cases:

- EC-1: Mais de 20 orientações → o resumo é dividido em mensagens de até 20 itens.

## Painel

### US-024: Acompanhar distritos do dia no painel (withdrawn)

> Retirada deste PRD em 2026-09-30: o módulo de Monitoramento terá PRD próprio (ADR-009). Mantida como insumo para aquele PRD.


**As a** Supervisor, **I want** ver por distrito quantos foram avisados, responderam e o que o carteiro confirmou, **so that** eu aja nas exceções.

Acceptance criteria:

- AC-1: Given o painel do dia, then cada distrito mostra: carteiro, situação (Lista pronta, Agendado, Em rota, Encerrado), encomendas, avisos enviados, entregues ao WhatsApp, lidos, respostas por opção, orientações pendentes de confirmação do carteiro, transferências abertas e falhas.
- AC-2: Given uma mudança (resposta, confirmação, falha), then o painel reflete em até 1 minuto sem recarregar a página.
- AC-3: Given um filtro por distrito ou por situação da encomenda, then o painel mostra só o filtrado.

Edge cases:

- EC-1: Dia sem listas → painel mostra "Nenhum distrito liberado hoje" com atalho para a lista do dia.
- EC-2: Supervisor tenta ver painel de outra unidade → negado.
- EC-3: Dia anterior → painel consultável por data.
- EC-4: Unidade com 60 distritos e 6000 encomendas → painel carrega o resumo por distrito e só detalha ao abrir o distrito.

### US-025: Ver a linha do tempo de uma encomenda (withdrawn)

> Retirada deste PRD em 2026-09-30: o módulo de Monitoramento terá PRD próprio (ADR-009). Mantida como insumo para aquele PRD.


**As a** Supervisor, **I want** ver tudo o que aconteceu com uma encomenda, **so that** eu responda ao destinatário com segurança.

Acceptance criteria:

- AC-1: Given uma encomenda, then a linha do tempo mostra: entrada na lista, aviso enviado/entregue/lido, escolha e confirmação do destinatário, orientação enviada ao carteiro, confirmação do carteiro, eventos de rastreio consultados e transferências.
- AC-2: Given busca por código, then a encomenda é encontrada em qualquer data.

Edge cases:

- EC-1: Código de outra unidade → não encontrado para o supervisor; a Gestão encontra.
- EC-2: Código inexistente → "Encomenda não encontrada".

### US-026: Registrar orientação manualmente para o carteiro

**As a** Supervisor, **I want** registrar uma orientação para uma encomenda, **so that** eu feche um atendimento vindo do Chatwoot.

Acceptance criteria:

- AC-1: Given uma encomenda em rota, when o supervisor registra uma orientação a partir do módulo Atendimento, then ela vai ao carteiro como qualquer outra e aparece na linha do tempo como "registrada pelo supervisor <nome>".
- AC-2: Given a opção "vale para amanhã", then a orientação fica guardada como em US-019.

Edge cases:

- EC-1: Encomenda já entregue → registro bloqueado.
- EC-2: Orientação vazia ou acima de 300 caracteres → recusada.
- EC-3: Dois supervisores registram ao mesmo tempo → as duas vão, na ordem, e a mais recente vale.

## Atendimento

### US-027: Entrar no Chatwoot sem senha a partir do sistema

**As a** Supervisor, **I want** abrir o Chatwoot com um clique a partir do correios-entregas, **so that** eu atenda sem outra senha.

Acceptance criteria:

- AC-1: Given um supervisor logado, when clica "Atendimento", then o Chatwoot aparece incorporado na tela (iframe), já autenticado na conta do tenant Correios.
- AC-2: Given o primeiro acesso, then o usuário do supervisor é criado no Chatwoot com o time da unidade.

Edge cases:

- EC-1: Carteiro ou destinatário tentam o mesmo acesso → negado.
- EC-2: Chatwoot indisponível ou incorporação recusada → a área mostra "Atendimento indisponível no momento" e um botão "Abrir em nova aba".
- EC-3: Link de acesso reutilizado ou aberto depois de 5 minutos → recusado pelo Chatwoot; o supervisor clica de novo.
- EC-4: Sessão do correios-entregas expirada → pede login antes.

### US-028: Atender só conversas da própria unidade

**As a** Supervisor, **I want** ver só as conversas da minha unidade, **so that** eu não acesse dados de outros CDDs.

Acceptance criteria:

- AC-1: Given conversas de várias unidades, then o supervisor vê no Chatwoot apenas as da própria unidade.

Edge cases:

- EC-1: Supervisor movido de unidade → na próxima entrada, só vê a nova.
- EC-2: Destinatário com encomendas em duas unidades → cada conversa transferida aparece na unidade da encomenda em questão.

### US-029: Ver todas as unidades e a triagem

**As a** Gestor, **I want** ver o painel e as conversas de todas as unidades e da triagem, **so that** eu acompanhe a operação e trate o que não tem unidade.

Acceptance criteria:

- AC-1: Given um gestor, then o painel permite escolher qualquer unidade ou ver o consolidado.
- AC-2: Given o Chatwoot, then o gestor vê todas as caixas, inclusive a triagem.

Edge cases:

- EC-1: Conversa na triagem que se descobre de uma unidade → o gestor move para a caixa da unidade.

## Mediação

A conversa entre carteiro e destinatário usa o módulo de mediação entre partes do Prosio (ADR-008): um caso por encomenda, o carteiro como prestador, o destinatário como recebedor e o supervisor como operador que lê e pode assumir.

### US-030: Acionar o destinatário a partir da rua

**As a** Carteiro, **I want** avisar o destinatário de um problema na porta pelo WhatsApp, **so that** eu resolva a entrega sem ligar do meu celular.

Acceptance criteria:

- AC-1: Given um distrito liberado, when o carteiro escreve ao número da unidade "estou no 45, ninguém atende", then o bot identifica a encomenda, aciona o destinatário com a pergunta ("O carteiro está no seu endereço e ninguém atendeu. Como prefere?") e as opções do aviso.
- AC-2: Given a resposta do destinatário, then o carteiro recebe a instrução resultante ("Autorizado deixar com Maria, apto 302"), não o texto do destinatário.
- AC-3: Given o destinatário não responde no prazo de resposta configurado, then o carteiro recebe "Sem resposta do destinatário" e segue o procedimento padrão.

Edge cases:

- EC-1: O carteiro tem várias encomendas abertas e a mensagem não deixa claro de qual fala → o bot pergunta qual, listando código e primeiro nome do destinatário.
- EC-2: O carteiro escreve sobre encomenda que não é do seu distrito hoje → o bot responde que não encontrou a encomenda na sua lista.
- EC-3: O carteiro manda áudio → o bot transcreve e trata como texto; se não entender, pede de novo.
- EC-4: O carteiro pede o telefone do destinatário → recusado; o bot explica que a conversa acontece ali.
- EC-5: O destinatário está descadastrado → o bot informa ao carteiro que não pode acionar o destinatário.
- EC-6: Encomenda já entregue → o bot informa ao carteiro e não aciona o destinatário.
- EC-7: Número que não é carteiro cadastrado → tratado como contato comum, sem acesso a encomendas.

### US-031: Responder ao carteiro em texto livre

**As a** Destinatário, **I want** responder ao carteiro com minhas palavras, **so that** eu resolva situações que as opções não cobrem.

Acceptance criteria:

- AC-1: Given um acionamento do carteiro, when o destinatário escreve "desço em 5 minutos", then o carteiro recebe "Destinatário desce em 5 minutos".
- AC-2: Given o carteiro responde, then o destinatário recebe a mensagem mediada, sem o número do carteiro.

Edge cases:

- EC-1: Mensagem com dado sensível ("estou no hospital") → o carteiro recebe só o efeito ("não pode receber hoje"); a causa não é gravada.
- EC-2: Mensagem ofensiva → não atravessa; o supervisor vê o incidente no painel.
- EC-3: Tentativa de combinar pagamento → não atravessa; as duas pontas são informadas de que pagamento não se faz ali.

### US-032: Não ver nem expor o contato da outra ponta

**As a** Destinatário, **I want** que o carteiro não veja meu número e eu não veja o dele, **so that** ninguém use o contato fora da entrega.

Acceptance criteria:

- AC-1: Given qualquer mensagem entre as pontas, then telefone, documento, e-mail e chave de pagamento digitados são substituídos por um marcador legível antes de atravessar e antes de ser guardados.
- AC-2: Given qualquer falha do bot, then nenhuma ponta recebe o telefone da outra.

Edge cases:

- EC-1: Número escrito por extenso ou separado por espaços → também substituído.
- EC-2: Moderação substitui algo que não era contato → quem enviou é informado do que foi removido; a mensagem não some em silêncio.

### US-033: Ler o teor do caso e assumir uma ponta

**As a** Supervisor, **I want** ler a conversa de uma encomenda e falar diretamente com uma das pontas, **so that** eu resolva o que o bot não resolveu.

Acceptance criteria:

- AC-1: Given uma encomenda da minha unidade, when abro a conversa no módulo Atendimento, then vejo o teor mediado das duas pontas e os fatos registrados, e meu acesso fica registrado.
- AC-2: Given um escalonamento no Chatwoot, when assumo o lado do destinatário, then o bot silencia só desse lado e continua atendendo o carteiro.
- AC-3: Given assumi uma ponta, when devolvo ao bot, then ele retoma o caso com os fatos atuais.

Edge cases:

- EC-1: Supervisor de outra unidade tenta abrir o caso → "não encontrado".
- EC-2: Supervisor assume e não responde dentro do prazo de atendimento → alerta no painel.

### US-034: Configurar a mediação do tenant Correios

**As a** Gestor, **I want** configurar os rótulos, o envelope de autonomia e a declaração de consentimento do tenant, **so that** a mediação opere dentro das regras do Correios.

Acceptance criteria:

- AC-1: Given a configuração da mediação, then os rótulos são "carteiro", "destinatário" e "encomenda".
- AC-2: Given o envelope, then todos os desfechos confirmados pelo destinatário (tentar amanhã, vizinho, agência, locker, outra opção) estão marcados como automáticos, com o alerta de posse física aceito e registrado com autor e data.
- AC-3: Given a declaração de consentimento (origem, data, empresa em nome da qual foi coletado, texto apresentado), then os casos podem contatar destinatários.

Edge cases:

- EC-1: Declaração ausente ou incompleta → casos abrem, mas nenhum aviso sai; o painel mostra "Retido — consentimento não declarado".
- EC-2: Empresa declarada diverge do remetente → abertura de caso recusada; o painel mostra o motivo.
- EC-3: Alteração do envelope → versionada; casos abertos seguem a versão com que foram abertos.

### US-035: Ter várias encomendas sem que as conversas se misturem

**As a** Destinatário, **I want** que cada encomenda tenha sua própria conversa, **so that** uma orientação não seja aplicada à encomenda errada.

Acceptance criteria:

- AC-1: Given duas encomendas em rota para o mesmo número, when escolho "Deixar na agência" no aviso da primeira, then só a primeira recebe a orientação.
- AC-2: Given uma mensagem livre sem indicação de encomenda e mais de uma aberta, then o bot pergunta a qual encomenda me refiro.

Edge cases:

- EC-1: Mesma encomenda em nova tentativa no dia seguinte → caso novo; a orientação guardada acompanha (US-010).
- EC-2: Mensagem depois de o caso encerrar, dentro da janela de cortesia → reabre o caso; depois dela, o bot responde que o assunto foi encerrado e informa o protocolo.

## Navegação

### US-036: Entrar na aplicação pelos três módulos

**As a** Supervisor, **I want** encontrar Cadastro, Atendimento e Monitoramento no menu, **so that** eu vá direto ao fluxo de entregas mediadas.

Acceptance criteria:

- AC-1: Given um supervisor que faz login, then cai em Monitoramento › Carregar Dados e o menu lateral mostra Cadastro, Atendimento, Monitoramento (Carregar Dados, Rotas) e "SGPD v2". A Gestão cai no Cadastro.
- AC-2: Given o subitem Rotas, when clicado, then mostra "Em breve" até a v2.
- AC-3: Given o item Atendimento, when clicado, then o Chatwoot aparece incorporado na tela, já autenticado (US-027).

Edge cases:

- EC-1: Carteiro ou destinatário com login antigo entram na aplicação → não veem os três módulos; são levados ao "SGPD v2" ou recebem acesso negado, conforme o TechSpec decidir para os papéis legados.
- EC-2: Sessão expirada ao clicar num módulo → volta ao login e, após entrar, ao módulo clicado.
- EC-3: Tela estreita (celular) → o menu recolhe num botão e continua com os mesmos itens.

### US-037: Abrir as telas antigas em "SGPD v2"

**As a** Supervisor, **I want** acessar as telas atuais do sistema por um item do menu, **so that** eu consulte o protótipo do SGPD sem que ele atrapalhe o fluxo novo.

Acceptance criteria:

- AC-1: Given o menu lateral, when clico "SGPD v2", then abre a interface atual (dashboard, recebimento, triagem, roteirização, despacho, monitoramento, reconciliação e cadastros) exatamente como hoje.
- AC-2: Given estou no "SGPD v2", then há um caminho visível de volta aos três módulos.

Edge cases:

- EC-1: Dados fictícios nas telas do "SGPD v2" → a área exibe um aviso fixo "Protótipo — dados de demonstração".
- EC-2: Link direto para uma tela antiga (favorito do navegador) → continua funcionando dentro do "SGPD v2".
- EC-3: Usuário sem permissão para o "SGPD v2" → o item não aparece no menu.

### US-038: Ver o status de cada pacote no distrito

**As a** Supervisor, **I want** ver na lista do dia de cada distrito a situação de cada encomenda, **so that** eu saiba quem foi avisado, quem respondeu e o que o carteiro fez, antes de existir o módulo de Monitoramento.

Acceptance criteria:

- AC-1: Given um distrito liberado, then cada pacote mostra seu status (sem WhatsApp, aguardando liberação, enviado com sucesso, lido/recebido, interagindo, insucesso, entregue), a orientação vigente, a confirmação do carteiro e as sinalizações (não enviado com motivo, descadastrado, escalonamento aberto).
- AC-2: Given uma mudança de situação, then a lista reflete em até 1 minuto sem recarregar a página.
- AC-3: Given uma encomenda com orientação guardada para o próximo dia, then ela aparece marcada.

Edge cases:

- EC-1: Distrito ainda não liberado → situação "Lista pronta" em todas as encomendas.
- EC-2: Distrito com 500 encomendas → a lista pagina e permite filtrar por situação.
- EC-3: Supervisor de outra unidade → não vê a lista.

## Carregar Dados

### US-039: Ver o quadro de distritos do dia com status

**As a** Supervisor, **I want** ver todos os distritos da unidade num quadro com seu status do dia, **so that** eu saiba o que falta carregar, liberar e acompanhar.

Acceptance criteria:

- AC-1: Given o dia de hoje, then o quadro lista cada distrito ativo da unidade com código, carteiro do dia, status (Pendente de upload, Dados carregados, Liberado, Em entrega, Concluído) e contagens de pacotes por status.
- AC-2: Given um distrito "Dados carregados", then o cartão mostra "X de Y pacotes com WhatsApp" e o botão "Liberar distrito".
- AC-3: Given um distrito "Pendente de upload", when clico nele, then abre o carregamento (US-007/US-008).
- AC-4: Given um distrito liberado, when clico nele, then abro a lista de pacotes com status (US-038).
- AC-5: Given mudanças de status, then o quadro reflete em até 1 minuto sem recarregar.

Edge cases:

- EC-1: Unidade sem distritos → o quadro mostra "Cadastre distritos" com atalho para o Cadastro.
- EC-2: Distrito sem carteiro no dia → cartão sinalizado "Sem carteiro", liberação bloqueada.
- EC-3: Data anterior → o quadro é consultável em modo leitura por data.
- EC-4: 60 distritos → o quadro permite filtrar por status e buscar por código.
- EC-5: Supervisor de outra unidade → não vê o quadro.

### US-040: Carregar pacotes sem WhatsApp e ver "X de Y"

**As a** Supervisor, **I want** carregar todos os pacotes do distrito mesmo sem telefone, **so that** o distrito fique completo e eu saiba quantos serão avisados.

Acceptance criteria:

- AC-1: Given uma planilha com 40 pacotes, 31 com WhatsApp, when confirmo, then o distrito mostra "31 de 40 pacotes com WhatsApp" e só os 31 recebem aviso na liberação.
- AC-2: Given um pacote sem WhatsApp, then ele aparece na lista com o status "sem WhatsApp" e continua recebendo "entregue" ou "insucesso" pelo rastreio.

Edge cases:

- EC-1: Nenhum pacote com WhatsApp → a liberação avisa "Nenhum destinatário será avisado" e pede confirmação.
- EC-2: WhatsApp adicionado depois (edição do pacote) em distrito já liberado → o aviso é enviado na hora.
