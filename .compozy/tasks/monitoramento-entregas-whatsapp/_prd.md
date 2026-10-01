# PRD: Entregas Mediadas via WhatsApp (Cadastro e Atendimento)

**Status**: Rascunho para revisão do proprietário do produto
**Data**: 2026-09-30
**Companheiros**: [`_user_stories.md`](_user_stories.md) (catálogo canônico de comportamento) · [`adrs/`](adrs/) (decisões)
**Auditoria do código atual**: https://claude.ai/artifact/CLW4pmrMRtsTCUTXetwF5r
**Escopo**: navegação da aplicação e os módulos Cadastro, Atendimento e Monitoramento › Carregar Dados (ADR-010). Ficam para PRDs próprios: Monitoramento › Rotas (v2, estilo Delivyo) e o app do carteiro (captura de rótulo, depois navegador).

---

## Overview

Nas unidades de distribuição dos Correios (CDD e CEE), a tentativa de entrega frustrada é o desperdício mais comum: o carteiro chega, o destinatário não está, a encomenda volta à unidade e ninguém sabe o que o destinatário preferia. O supervisor não tem canal com o destinatário no dia da entrega, e o carteiro na rua não recebe informação nova depois de sair.

Esta feature dá ao supervisor um fluxo diário simples:

1. Ele sobe a lista das encomendas de cada distrito, com nome, WhatsApp e código.
2. Quando o carteiro sai, ele libera o distrito.
3. Cada destinatário recebe no WhatsApp, via Prosio, o aviso de que a encomenda saiu, com opções para quando não puder receber: tentar amanhã, deixar com um vizinho, deixar numa agência, deixar num locker ou descrever outra solução.
4. A escolha vira uma orientação que chega ao WhatsApp do carteiro, e o carteiro confirma o que fez.
5. As exceções são atendidas no Chatwoot, com login único a partir do correios-entregas.

Toda conversa entre carteiro e destinatário passa pelo módulo de mediação entre partes do Prosio (ADR-008):
- Cada encomenda é um caso. O carteiro também pode acionar o destinatário da rua ("estou na portaria, ninguém atende").
- Um lado nunca vê o telefone do outro, e o bot só repassa o que foi decidido.
- O supervisor opera acima das duas pontas: lê o teor, recebe os escalonamentos e assume uma ponta quando precisa.

A aplicação passa a abrir em três módulos (ADR-009, ADR-010):
1. **Cadastro**: unidades de distribuição, supervisores, distritos, carteiros, agências e lockers.
2. **Atendimento**: o Chatwoot incorporado na tela (iframe), onde o supervisor acompanha as trocas mediadas pelo bot.
3. **Monitoramento**, em duas etapas:
   - **Carregar Dados** (este PRD): quadro de distritos, carregamento dos pacotes com endereço completo, liberação do distrito e status de cada pacote até a entrega.
   - **Rotas** (v2, PRD próprio): painel de rotas no estilo do Delivyo.

As telas atuais do correios-entregas, que são protótipos, continuam acessíveis pelo item "SGPD v2" do menu lateral.

Valor: menos tentativas perdidas, orientação do destinatário aproveitada no mesmo dia ou no seguinte, e visibilidade do supervisor sobre cada distrito.

## Goals

- O supervisor sobe a lista do dia de um distrito e dispara os avisos com um clique quando o carteiro sai.
- O destinatário escolhe, dentro do WhatsApp e sem link, o que fazer com a encomenda se não puder recebê-la.
- O carteiro recebe no WhatsApp cada orientação confirmada pelo destinatário e registra o cumprimento com um toque.
- Uma orientação dada depois da tentativa do dia não se perde: fica guardada e é reaplicada na próxima lista em que a encomenda aparecer.
- O supervisor vê num quadro todos os distritos do dia com seu status (pendente de upload, dados carregados, liberado, avisos enviados, lidos, interagindo, insucessos, entregues) e abre cada distrito até o status de cada pacote.
- Ao entrar, supervisor e Gestão veem os módulos Cadastro, Atendimento e Monitoramento; as telas antigas ficam em "SGPD v2".
- O supervisor atende no Chatwoot sem sair da aplicação.
- O supervisor atende destinatários no Chatwoot sem outra senha e sem ver dados de outras unidades.
- O carteiro fala com o destinatário a partir da rua, mediado pelo bot, sem que um veja o número do outro.
- Uma pessoa com várias encomendas tem uma conversa por encomenda; uma orientação nunca é aplicada à encomenda errada.
- Nenhum aviso é enviado sobre um código com dígito verificador inválido, e nenhum aviso contém link ou pedido de pagamento.

## User Stories

Índice do catálogo canônico ([histórias completas](_user_stories.md)):

- US-001–US-002 — Cadastros da sede: unidades (tipo e canal) e supervisores.
- US-003–US-006 — Cadastros da unidade: distritos, carteiros, carteiro do dia, agências e lockers.
- US-007–US-010 — Lista do dia: planilha, colar, prévia validada, orientações guardadas.
- US-011–US-012 — Liberação do distrito e aviso "saiu para entrega".
- US-013–US-020 — Respostas do destinatário: as cinco opções, atendimento humano, resposta tardia, descadastro.
- US-021–US-023 — Carteiro: orientação, confirmação, resumo na saída.
- US-024–US-025 — (withdrawn) Painel e linha do tempo: substituídos pelo quadro de distritos (US-039) e pelo monitoramento de rotas (v2).
- US-026 — Orientação manual pelo supervisor (módulo Atendimento).
- US-027–US-029 — Atendimento no Chatwoot com login único e isolamento por unidade.
- US-030–US-035 — Mediação carteiro ↔ destinatário: acionamento pelo carteiro, texto livre, não divulgação de contato, supervisor assumindo uma ponta, configuração do tenant, um caso por encomenda.
- US-036–US-038 — Navegação: os três módulos, "SGPD v2" e o status de cada pacote no distrito.
- US-039–US-040 — Monitoramento › Carregar Dados: quadro de distritos com status; pacotes sem WhatsApp.

## Core Features

### F0. Navegação da aplicação

- Menu lateral com **Cadastro**, **Atendimento** e **Monitoramento** para supervisor e Gestão.
- **Monitoramento** tem dois subitens: **Carregar Dados** (este PRD) e **Rotas** ("em breve", v2).
- Item **"SGPD v2"** no menu lateral abre a interface atual (protótipos de tela), sem alteração de comportamento.
- Após o login, o supervisor cai em Monitoramento › Carregar Dados; a Gestão, no Cadastro.

### F1. Estrutura operacional da unidade

Cadastros que ligam cada encomenda a um carteiro:

- **Unidade** (Gestão): nome, tipo (CDD ou CEE), endereço, horário de atendimento e canal de WhatsApp (número atual ou número oficial; ADR-002).
- **Supervisor** (Gestão): nome, matrícula, WhatsApp e e-mail de acesso; pertence a uma unidade; uma unidade tem um ou mais supervisores.
- **Distrito** (Supervisor): código e nome; pertence a uma unidade; tem carteiro padrão.
- **Carteiro** (Supervisor): nome, matrícula e WhatsApp; pertence a uma unidade; não precisa de login.
- **Carteiro do dia** (Supervisor): por padrão, o carteiro padrão do distrito; pode ser trocado só para hoje.
- **Agências e lockers** (Supervisor): nome, endereço e horário; por unidade, valendo para todos os distritos (ADR-003).

### F2. Carregar Dados: arquivo da saída (Monitoramento)

> Redesenhado em 2026-10-01 (ADR-019). "Rota" é o nome, na interface, do que os cadastros chamavam de "distrito".

- A carga do dia é organizada por **saída** da unidade: número (1, 2, …) e **horário obrigatório**. Sem o horário, a importação não acontece: "Confirme o horário da Saída N antes de importar."
- **Um arquivo por unidade por saída**, CSV ou XLSX, com **todas as rotas**: colunas rota, código, nome, WhatsApp e endereço completo (logradouro, número, complemento, bairro, cidade, UF, CEP), mais as opcionais carteiro (matrícula ou nome), referência e observação (ADR-019).
- **Importação direta, sem prévia**: importar grava na hora as linhas válidas. O quadro mostra "N aceitos, M descartados" e a lista consultável das linhas recusadas (linha, rota, código e motivo), que fica gravada com a saída.
- Pacote sem WhatsApp é aceito e fica fora do aviso; a rota mostra "X de Y pacotes com WhatsApp".
- **Reimportar** uma saída já importada substitui os dados das rotas ainda não liberadas (a tela avisa antes); as rotas liberadas ficam intocadas e as linhas delas são recusadas com o motivo.
- A rota do arquivo que não existe no Cadastro é criada automaticamente.
- **Carteiro da rota**: o da coluna "carteiro" do arquivo (carteiro do dia); senão o carteiro padrão da rota no Cadastro; senão a rota fica sem carteiro e o quadro oferece o modal "Atribuir carteiros".
- Na lista de pacotes de uma rota, "Adicionar pacotes" continua aceitando planilha ou linhas coladas com prévia e correção (o fluxo anterior, agora só para complementar uma rota).
- Encomendas com orientação guardada de outro dia chegam marcadas com essa orientação.
- (withdrawn) O supervisor escolhe o distrito no quadro e envia a planilha daquele distrito; uma prévia classifica cada linha antes de gravar. Substituído pelo arquivo da saída com importação direta (ADR-019).

### F3. Liberação e aviso ao destinatário

- "Liberar rota" envia, pelo canal da unidade, um aviso por encomenda: "Olá, <primeiro nome>, sua encomenda <código> já saiu para entrega. Se tiver alguma dificuldade para receber sua encomenda, nos avise."
- O aviso traz as opções numa lista: "Tentar novamente amanhã", "Deixar com meu vizinho", "Deixar na agência", "Deixar no locker", "Outra opção".
- Encomendas com orientação guardada recebem o aviso com "Vamos seguir sua orientação: <orientação>" e mantêm as opções.
- Na liberação, o carteiro recebe o resumo das orientações já conhecidas do distrito.
- Encomendas adicionadas a uma rota já liberada são avisadas na hora.
- **Liberação em lote**: "Liberar N rotas carregadas" libera de uma vez as rotas carregadas com carteiro da saída, depois de um diálogo com os totais e a lista das rotas; cada rota segue as mesmas regras da liberação individual e o resultado vem por rota (ADR-019).

### F4. Respostas do destinatário

- **Tentar novamente amanhã**: confirma ao destinatário, orienta o carteiro a não tentar hoje e guarda a orientação para o próximo dia.
- **Deixar com meu vizinho**: pergunta nome do vizinho e casa/apartamento, confirma e repassa.
- **Deixar na agência / no locker**: mostra a sub-lista das agências ou lockers ativos da unidade, confirma com endereço e horário e repassa.
- **Outra opção**: o agente de IA resume o texto livre numa instrução, pede confirmação e só então repassa. Se não entender, se for negada duas vezes ou se o pedido estiver fora do escopo, transfere ao supervisor (ADR-004).
- **Resposta tardia**: antes de repassar, consulta o rastreio. Se já houve tentativa sem sucesso hoje, informa a hora e pede confirmação de que a orientação vale para amanhã. Se já foi entregue, informa a entrega. Caso contrário, repassa na hora (ADR-005).
- **Descadastro**: "SAIR" interrompe os avisos para o número; "VOLTAR" retoma.

### F5. Orientação ao carteiro

- Cada orientação confirmada chega ao WhatsApp do carteiro do distrito com código, nome do destinatário, orientação e botões "Vi", "Feito" e "Não foi possível".
- "Não foi possível" pede um motivo curto e alerta o supervisor no painel.
- Orientações alteradas chegam marcadas "ATUALIZADA".

### F6. Quadro das saídas e status dos pacotes (Monitoramento › Carregar Dados)

- **Controle de importação** no topo do quadro: número da saída (as já importadas aparecem com "(reimportar)"), horário, área para soltar o arquivo e o botão "Importar Saída N".
- **Uma aba por saída**: "Saída 1 · 10:00 — Importada às 08h47 · 13 rotas". A próxima saída aparece como "Aguardando arquivo e horário", com a instrução de como importar. Cargas fora de uma saída (fotos de rótulo do app do carteiro, lista carregada direto na rota) aparecem numa aba "Sem saída", só quando existem.
- **Resumo da saída**: rotas nesta saída, pacotes, com WhatsApp, entregues e insucessos. **Filtros**: Todas, Carregada, Liberada, Em entrega, Concluída.
- **Cartão da rota**: código da rota em destaque, o nome do carteiro como título ("Sem carteiro definido", em vermelho, quando falta) e "N pacotes".
- **Status da rota**, nesta ordem:
  1. **Carregada**: "X de Y pacotes com WhatsApp", pronta para liberar.
  2. **Liberada**: avisos em envio ou agendados.
  3. **Em entrega**: avisos enviados e o dia em andamento.
  4. **Concluída**: todos os pacotes entregues ou com insucesso.
  - (withdrawn) **Pendente de upload**: a rota só existe no quadro quando um arquivo a trouxe (ADR-019).
- **Escopo**: o supervisor vê só a própria unidade, sem seletor. A Gestão tem o seletor de unidade com "Todas as unidades" (soma das unidades, só leitura) e precisa escolher uma unidade para importar.
- **Status de cada pacote**: sem WhatsApp · aguardando liberação · enviado com sucesso · lido/recebido · interagindo (conversa em andamento ou orientação dada) · insucesso (não entregue) · entregue. São ainda sinalizados à parte: não enviado (com motivo), descadastrado, escalonamento aberto e orientação guardada para o próximo dia.
- O quadro mostra, por rota, a contagem de pacotes em cada status; o botão **Liberar rota** fica no cartão da rota carregada com carteiro, e **Definir carteiro** (que abre o modal "Atribuir carteiros") no cartão da rota sem carteiro.
- **Entregue** e **insucesso** vêm do rastreio (Seu Rastreio) e da confirmação do carteiro. Em divergência, o pacote é sinalizado para o supervisor.
- Nas histórias, "painel" designa este quadro e a lista de pacotes da rota.

### F7. Atendimento no Chatwoot

- O módulo Atendimento mostra o Chatwoot **incorporado na tela (iframe)**, já autenticado por login único, na conta onde o Prosio registra as conversas do tenant Correios (ADR-006, ADR-010).
- Cada unidade tem sua caixa/time; o supervisor vê só as conversas da sua unidade; a Gestão vê todas e a caixa de triagem.
- Transferências chegam com código, distrito, carteiro, opção escolhida e texto do destinatário.
- O supervisor **acompanha no Chatwoot todas as trocas mediadas** da sua unidade (as duas pontas de cada caso), não só os escalonamentos.
- O supervisor registra, a partir do Atendimento, uma orientação manual para a encomenda, que vai ao carteiro como qualquer outra (US-026).

### F8. Mediação carteiro ↔ destinatário (Prosio)

- **Caso = encomenda**, aberto na liberação do distrito, com o carteiro do dia como prestador e o destinatário como recebedor. Nova tentativa em outro dia abre caso novo.
- **Destinatário → carteiro**: as respostas ao aviso (F4) são desfechos do caso e chegam ao carteiro como instrução.
- **Carteiro → destinatário**: o carteiro escreve ao número da unidade, o bot identifica a encomenda (ou pergunta qual), aciona o destinatário e devolve ao carteiro a instrução resultante.
- **Não divulgação**: nenhuma ponta vê o telefone, documento ou nome completo da outra. Contatos digitados são removidos antes de atravessar.
- **Envelope de autonomia todo automático**: todo desfecho confirmado pelo destinatário vai direto ao carteiro. O supervisor atua só nos escalonamentos.
- **Supervisor como operador**: lê o teor mediado na linha do tempo (com registro de acesso), recebe escalonamentos no Chatwoot da unidade e pode assumir uma ponta sem silenciar a outra.
- O desfecho estruturado de cada caso atualiza a orientação da encomenda, o painel e a orientação guardada para o próximo dia.

### Interação entre as features

F0 organiza tudo em módulos: F1–F3 e F6 formam o Cadastro; F7 e o registro manual formam o Atendimento. F8 é o transporte de F3, F4 e F5: aviso, respostas e orientações acontecem dentro do caso da encomenda. F1 alimenta F2 (distritos) e F3/F4 (carteiro do dia, agências, lockers, canal). F2 produz a lista que F3 dispara. F4 gera orientações que F5 entrega e F6 exibe. F4 e F6 alimentam F7 com transferências, e F7 volta a F5 pelo registro manual de orientação (F6).

## Business Rules

### Estrutura e vínculo

- Toda encomenda de uma lista pertence a exatamente um distrito naquele dia; o carteiro responsável é o carteiro do distrito no dia.
- Um código só pode estar em um distrito por dia. Em dias diferentes, pode estar em distritos diferentes.
- Um distrito só pode ser liberado se tiver carteiro no dia e ao menos uma encomenda.
- Matrícula é única entre supervisores e carteiros. O WhatsApp de um carteiro é único entre carteiros.
- Um carteiro pertence a uma unidade só.

### Validação da lista

- Colunas obrigatórias: código e nome. WhatsApp e endereço (logradouro, número, complemento, bairro, cidade, UF, CEP) são esperados e, quando faltam, o pacote é aceito com a marcação "sem WhatsApp" ou "sem endereço". Cabeçalhos equivalentes aceitos: "telefone", "celular" e "whatsapp"; "código", "objeto" e "rastreio"; "endereço", "logradouro" e "rua".
- **Endereço**: CEP com 8 dígitos. Aceita endereço numa coluna só (texto livre) ou em colunas separadas.
- **Código**: 2 letras + 8 dígitos + dígito verificador + 2 letras, com dígito verificador por módulo 11 (pesos 8, 6, 4, 2, 3, 5, 9, 7; resto 0 → 5; resto 1 → 0; senão 11 − resto). Normalizado para maiúsculas. Qualquer sufixo de país é aceito (ADR-007).
- **WhatsApp**: número brasileiro com DDD, normalizado para E.164 (+55…); aceita com ou sem +55, parênteses, espaços, traços e nono dígito. Um número malformado é sinalizado para correção. Se o supervisor não corrigir, o pacote entra como "sem WhatsApp".
- **Nome**: não vazio. A mensagem usa o primeiro nome, com a primeira letra maiúscula.
- Máximo de 500 linhas por rota. O arquivo da saída aceita até 5.000 linhas e 5 MB (ADR-019).
- **Arquivo da saída**: a coluna rota é obrigatória (cabeçalhos equivalentes: "rota", "código da rota", "distrito"); a coluna carteiro é opcional ("carteiro", "matrícula", "nome do carteiro"). Linha sem rota, de rota já liberada, de rota já carregada em outra saída do dia ou de rota desativada é descartada com o motivo.
- No arquivo da saída não há correção na tela: a linha com WhatsApp malformado é descartada com o motivo (WhatsApp vazio continua aceito como "sem WhatsApp").
- Linhas inválidas nunca entram na lista; a importação grava só as válidas e informa "N aceitos, M descartados", com a lista das recusadas (linha, rota, código e motivo). O resumo gravado não guarda nome nem telefone.

### Envio

- Avisos só saem na liberação do distrito (ou na hora, para encomendas adicionadas a distrito já liberado).
- Nunca há dois avisos iniciais para a mesma encomenda no mesmo dia.
- Não há envio entre 0h e 6h (horário de Brasília): avisos liberados nesse intervalo são agendados para 06:05.
- Os limites do canal da unidade (aquecimento e proporção de respostas do número atual) são respeitados: o excedente fica como "Não enviado — limite do canal" e é enviado quando houver capacidade no mesmo dia.
- Números descadastrados não recebem avisos.
- Nenhuma mensagem ao destinatário contém link, pedido de pagamento ou pedido de dados pessoais além do necessário à orientação.
- Agências e lockers: no máximo 10 ativos por tipo por unidade; nome com até 24 caracteres. Tipo sem nenhum ativo → a opção correspondente não aparece.

### Orientação

- Estados da orientação: **Aguardando confirmação do destinatário** → **Enviada ao carteiro** → **Vista** → **Feita** ou **Não foi possível**. Ou então: **Guardada para o próximo dia** → reaplicada na próxima lista → **Enviada ao carteiro** → …
- Uma orientação pode ser **Substituída** por outra mais recente da mesma encomenda. Só a mais recente vale.
- Uma encomenda entregue não aceita orientação nova.
- Instrução ao carteiro tem no máximo 300 caracteres.
- Dados do vizinho repassados ao carteiro: só nome e casa/apartamento.
- "Tentar novamente amanhã" usa o próximo dia de entrega da unidade.
- Orientação guardada permanece até a encomenda ser entregue ou devolvida.
- Fluxo de resposta abandonado por 2 horas sem retorno do destinatário é encerrado como "Resposta incompleta", sem orientação.

### Resposta tardia (rastreio)

- Tentativa sem sucesso registrada hoje → informar hora, pedir confirmação para amanhã, guardar se confirmada, não avisar o carteiro de hoje.
- Entregue → informar a entrega, sem orientação.
- Sem tentativa e sem entrega → repassar ao carteiro na hora.
- Rastreio indisponível → usar a última confirmação do carteiro sobre a encomenda; sem ela, repassar ao carteiro.
- Rastreio e carteiro divergentes → transferir ao supervisor.

### Agente de IA

- Atua só em "Outra opção" e nas perguntas de esclarecimento; as quatro opções fixas não passam por IA.
- Só pode: resumir orientação de entrega, consultar agências, lockers e rastreio da encomenda da conversa, registrar a orientação confirmada e transferir ao supervisor.
- Nunca repassa orientação sem confirmação explícita do destinatário.
- Transfere ao supervisor quando: não entende, recebe duas negativas, o pedido está fora do escopo (endereço, reclamação, cobrança, outra encomenda) ou recebe áudio/imagem repetidamente.

### Mediação

- Uma encomenda tem no máximo um caso aberto por vez; o caso pertence a exatamente um distrito e um carteiro do dia.
- O telefone de uma ponta nunca aparece em mensagem, tela ou registro destinado à outra, inclusive em falha.
- Telefone, documento, e-mail e chave de pagamento digitados por qualquer ponta são substituídos por marcador antes do repasse e antes da gravação; quem enviou é informado.
- Dado sensível dito em conversa não é gravado: registra-se o efeito ("não pode receber hoje"), nunca a causa.
- Conteúdo ofensivo e tentativa de combinar pagamento não atravessam.
- Todos os desfechos confirmados pelo destinatário estão no envelope automático (decisão do tenant, com alerta de posse física aceito e registrado).
- Mensagem de ponta depois do encerramento do caso: dentro da janela de cortesia do módulo (padrão 30 minutos) reabre o caso; depois, o bot informa que o assunto foi encerrado, com protocolo.
- O carteiro só pode acionar destinatários das encomendas do seu distrito no dia.
- Sem declaração de consentimento válida no Prosio, o caso abre mas nenhum contato proativo sai.

### Permissões e visibilidade

| Persona | Pode |
|---|---|
| Gestor | Cadastrar unidades e supervisores; ver as listas e as conversas de todas as unidades e a triagem; importar o arquivo da saída e atribuir carteiros numa unidade escolhida (ADR-019). A liberação continua sendo do supervisor. |
| Supervisor | Cadastrar distritos, carteiros, agências e lockers da própria unidade; subir listas, liberar distritos, registrar orientação manual; ver listas e conversas só da própria unidade. |
| Carteiro | Receber orientações, confirmar e acionar destinatários das encomendas do seu distrito pelo WhatsApp, mediado. Sem acesso ao sistema, ao Chatwoot nem ao contato do destinatário. |
| Destinatário | Interagir pelo WhatsApp sobre as encomendas vinculadas ao seu número. Sem acesso ao sistema, ao Chatwoot nem ao contato do carteiro. |

- Um toque de confirmação vindo de número que não é o carteiro do distrito é ignorado.
- Uma conversa sem encomenda identificável vai para a caixa de triagem, visível só à Gestão.

## User Experience

### Personas

- **Supervisor**: começa o dia montando as listas no Cadastro e acompanha as conversas no Atendimento durante a saída dos carteiros. Precisa de rapidez e de ver as exceções de imediato.
- **Destinatário**: recebe uma mensagem inesperada. Precisa confiar nela e resolver em poucos toques.
- **Carteiro**: está na rua, com o celular na mão. Precisa de mensagens curtas e de confirmar com um toque.
- **Gestor**: acompanha a operação consolidada e resolve o que não tem dono.

### Fluxo do supervisor

1. Entra no correios-entregas e cai em Monitoramento › Carregar Dados, no quadro das saídas do dia.
2. Escolhe o número da saída, informa o horário, seleciona o arquivo da unidade e clica "Importar Saída N".
3. Confere "N aceitos, M descartados"; se houve descartes, abre a lista, corrige o arquivo e reimporta.
4. Confere o carteiro de cada rota; nas que estão "Sem carteiro definido", abre "Atribuir carteiros".
5. Quando os carteiros saem, clica "Liberar rota" ou "Liberar N rotas carregadas".
6. Acompanha a situação de cada encomenda na lista do distrito e abre o módulo Atendimento para acompanhar as conversas e responder escalonamentos.
7. Registra orientações manuais quando resolve um caso no Chatwoot.
8. Quando precisa de uma tela antiga, abre "SGPD v2" no menu lateral.

### Fluxo do destinatário

1. Recebe o aviso com código e opções.
2. Toca uma opção; o bot faz no máximo duas perguntas curtas e pede confirmação.
3. Recebe a confirmação final com o que será feito (e endereço/horário, no caso de agência ou locker).
4. Se o bot não resolver, é atendido por uma pessoa na mesma conversa.

### Fluxo do carteiro

1. Na liberação, recebe o resumo das orientações já conhecidas.
2. Durante a rota, recebe cada orientação nova e toca "Vi".
3. Na porta, com problema, escreve ao número da unidade; o bot aciona o destinatário e devolve a instrução.
4. Ao cumprir, toca "Feito" ou "Não foi possível" (com motivo).

### Considerações de interface

- Prévia da lista com contagem de válidas/inválidas no topo e linhas inválidas primeiro.
- Situação de cada encomenda em forma de etiqueta (Agendado, Enviado, Lido, Falha, Escalonamento aberto), não só em texto.
- Telas do supervisor utilizáveis em celular e computador.
- Mensagens de WhatsApp curtas, em português simples, sem jargão interno (sem "SRO", "CDD", "distrito" para o destinatário).
- Acessibilidade: contraste AA, navegação por teclado, rótulos em todos os campos.

### Descoberta

- Menu lateral com Cadastro, Atendimento, Monitoramento (Carregar Dados; Rotas em breve) e "SGPD v2".
- Unidade sem distritos, carteiros ou pontos de retirada vê um passo a passo do que falta cadastrar.

## High-Level Technical Constraints

- **Prosio** é o canal obrigatório de WhatsApp para destinatários e carteiros (API de mensagens com opções, ações de botão, ferramentas de IA do tenant, callback de status, descadastro, transbordo ao Chatwoot). O tenant Correios já existe no Prosio.
- **Canal por unidade** (ADR-002): o número atual (WAHA) funciona já; o número oficial (WABA) depende de o Prosio passar a enviar modelos aprovados e listas por esse canal. A primeira mensagem deve ser redigida para caber num modelo de categoria "utilidade".
- **Rastreio** (ADR-005): usar a mesma fonte configurada hoje no tenant Correios do Prosio (integração `rastrear_encomenda`, API Seu Rastreio, autenticada por token), consumida diretamente pelo correios-entregas. O token é segredo de ambiente e nunca é versionado.
- **Mediação entre partes do Prosio** (ADR-008): o fluxo usa `/api/v1/mediation` (casos, desfecho por callback assinado, opt-out, decisão) e a configuração do tenant (rótulos, envelope, declaração de consentimento, retenção). A superfície pública depende da flag `PUBLIC_MESSAGING_API_ENABLED`, a mesma da API de mensagens.
- **Primeiro contato da mediação**: o módulo gera uma primeira mensagem padronizada (identidade, protocolo, escopo e saída) sem opções customizadas. O aviso com as 5 opções exige extensão no Prosio ou composição com a API de mensagens; o TechSpec decide sem mudar o texto e as opções definidos aqui.
- **Chatwoot** (ADR-006): o login único deve apontar para a instância e conta em que o Prosio registra as conversas do tenant Correios, e as conversas mediadas das duas pontas devem estar visíveis ali para o supervisor da unidade. O login único existente no correios-entregas aponta para outra instância e não restringe papel.
- **Desempenho percebido**: prévia de 500 linhas em até 5 segundos; avisos de um distrito de 150 encomendas enviados em até 10 minutos após a liberação, respeitados os limites do canal; orientação no WhatsApp do carteiro em até 1 minuto após a confirmação do destinatário; situação da encomenda na lista atualizada em até 1 minuto.
- **Privacidade (LGPD)**: nome e telefone do destinatário são usados só para esta entrega; dados de vizinho limitados a nome e casa/apartamento; supervisores veem só a própria unidade; o prazo de retenção está em Open Questions.
- **Estado atual do código**: a auditoria de 30/09/2026 mostra que o correios-entregas não tem entrada de objetos fora do seed, não processa `InteracaoObjeto`, não usa `LockerCorreios`, não emite eventos em tempo real e tem falhas de autorização por dono. Esta feature não pode depender dessas partes como estão.

## Non-Goals (Out of Scope)

- Sugerir agência ou locker mais próximo do endereço do destinatário: a lista não traz endereço (ADR-003).
- Cadastro de agências ou lockers por distrito: o cadastro é por unidade (ADR-003).
- Disparo automático pelo evento de rastreio sem liberação do supervisor (ADR-001).
- Uso do app do carteiro do correios-entregas para receber orientações: o canal do carteiro é o WhatsApp.
- Aprovação do supervisor para cada instrução de "Outra opção" (ADR-004).
- Mudança de endereço de entrega, cobrança ou pagamento pelo WhatsApp.
- Tratamento "Sr./Sra." na mensagem (ADR-007).
- Aprovação do supervisor para "deixar com vizinho" ou qualquer outro desfecho: o envelope é todo automático (ADR-008).
- Contato direto entre carteiro e destinatário (ligação ou WhatsApp pessoal): toda conversa é mediada (ADR-008).
- **Monitoramento › Rotas** (painel de rotas estilo Delivyo: progresso de paradas, ritmo, retorno projetado, DCR, insucessos): v2 com PRD próprio (ADR-010).
- **App do carteiro**: captura de rótulo por foto (PRD próprio, enfileirado) e navegador de paradas (depois) (ADR-010).
- Corrigir ou remover as telas atuais: ficam intactas atrás de "SGPD v2" (ADR-009).
- Correção dos fluxos existentes do correios-entregas (roteirização, recebimento, app do carteiro, portal do destinatário) que não são usados por esta feature.

## Architecture Decision Records

- [ADR-001: Direção do produto](adrs/adr-001.md) — Aviso "saiu para entrega" com opções dentro do WhatsApp, orientação ao carteiro e painel da unidade, sem link.
- [ADR-002: Canal por unidade](adrs/adr-002.md) — Cada unidade escolhe número atual (WAHA) ou oficial (WABA); começa no atual e migra por configuração.
- [ADR-003: Estrutura operacional](adrs/adr-003.md) — Unidade → distritos → carteiro do dia; lista do supervisor como fonte; agências e lockers por unidade; cadastros divididos entre sede e supervisor.
- [ADR-004: "Outra opção" com IA](adrs/adr-004.md) — IA resume, destinatário confirma, transbordo ao supervisor quando não resolve.
- [ADR-005: Resposta tardia](adrs/adr-005.md) — Consulta ao rastreio decide entre repassar, informar entrega ou guardar a orientação para o próximo dia.
- [ADR-006: Atendimento no Chatwoot](adrs/adr-006.md) — Login único na conta do tenant Correios no Chatwoot do Prosio, isolado por unidade.
- [ADR-007: Validação S10 e texto neutro](adrs/adr-007.md) — Dígito verificador obrigatório; saudação "Olá, <primeiro nome>".
- [ADR-008: Mediação entre partes do Prosio](adrs/adr-008.md) — Caso por encomenda, carteiro ↔ destinatário mediados nos dois sentidos, supervisor como operador, envelope todo automático.
- [ADR-009: Três módulos e "SGPD v2"](adrs/adr-009.md) — Cadastro, Atendimento e Monitoramento; telas atuais atrás do item "SGPD v2".
- [ADR-010: Módulos redefinidos](adrs/adr-010.md) — Chatwoot em iframe; Monitoramento › Carregar Dados neste PRD com quadro de distritos e endereço completo; Rotas v2 e app do carteiro em PRDs próprios.
- [ADR-019: Carga do dia por saída](adrs/adr-019.md) — Saídas com horário, um arquivo por unidade com todas as rotas, importação direta com "N aceitos, M descartados", reimportação só das rotas não liberadas, "rota" no lugar de "distrito" e carteiro da rota em três níveis.

## Open Questions

- **Chatwoot em iframe**: incluir o domínio do correios-entregas na lista de incorporação do Prosio, e tratar o bloqueio de cookies de terceiros no Safari.
- **Endereço obrigatório?** Assumido como esperado mas não obrigatório. Deve bloquear a liberação quando falta?

- **Conversas mediadas no Chatwoot**: o Prosio hoje espelha no Chatwoot as conversas escalonadas. Para o supervisor acompanhar todas as trocas mediadas, as duas pontas de cada caso precisam aparecer na caixa da unidade. Isso exige trabalho no Prosio, a ser confirmado no TechSpec.
- **"SGPD v2" para quais papéis**: supervisor e Gestão, como assumido aqui, ou só a Gestão?

- **Prazo de retenção** de nome, telefone e orientações (LGPD): quanto tempo após a entrega ou devolução os dados permanecem?
- **Volume no número atual**: o aquecimento do WAHA começa em 20 envios/dia. Quais unidades e quantos distritos entram no piloto, para caber nesse teto até a migração para o número oficial?
- **Número oficial**: quem conduz a verificação da conta e a aprovação do modelo "utilidade" na Meta, e em nome de qual empresa?
- **Mensagem ao carteiro**: sai do mesmo número da unidade que fala com os destinatários ou de um número separado?
- **Confiança do destinatário**: a mensagem deve incluir algum elemento de verificação (nome da unidade, últimos dígitos do CEP) para diferenciá-la de golpes?
- **Horário de atendimento humano**: fora do horário da unidade, a transferência só avisa o destinatário ou também oferece voltar às opções?
- **Declaração de consentimento**: a mediação exige origem, data e empresa em nome da qual o consentimento do destinatário foi coletado. De onde vem esse consentimento no caso dos Correios (remetente, loja, cadastro do destinatário)?
- **Conhecimento durável por endereço**: o módulo propõe o que a conversa revelou sobre o local (portaria, horário), mas a lista do supervisor não traz endereço. Essas propostas devem ser ignoradas, guardadas por encomenda ou motivar uma coluna de endereço na lista?
- **Prazo de resposta do destinatário** quando o carteiro aciona da porta: quantos minutos o carteiro espera antes de receber "Sem resposta"?
- **Rastreio**: a API Seu Rastreio é de terceiros; o limite de consultas do plano contratado suporta uma consulta por resposta de destinatário no volume esperado?
