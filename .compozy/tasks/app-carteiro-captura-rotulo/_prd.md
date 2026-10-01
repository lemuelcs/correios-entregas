# PRD: App do carteiro — Módulo A, captura do rótulo de envio

**Status**: Rascunho para revisão do proprietário do produto
**Data**: 2026-09-30
**Companheiros**: [`_user_stories.md`](_user_stories.md) (catálogo canônico de comportamento) · [`adrs/`](adrs/) (decisões) · [`prototipo/`](prototipo/) (telas de referência)
**Protótipo**: https://claude.ai/artifact/T3HneV28vRrr9cKPbTKbFV (artboards "App do carteiro — captura de rótulo", "Carregar pacotes do distrito", "Distrito D-01 — pacotes")
**Depende de**: [`../monitoramento-entregas-whatsapp/_prd.md`](../monitoramento-entregas-whatsapp/_prd.md), que define Cadastro, a lista do dia, a liberação, os avisos e a mediação. Este PRD acrescenta uma segunda fonte à lista do dia.
**Escopo**: o módulo (a) do app do carteiro. O módulo (b), Navegador de paradas, fica para um PRD próprio.

---

## Overview

Hoje a lista de pacotes de cada distrito só entra no sistema pela planilha que o supervisor sobe em Monitoramento › Carregar Dados. A planilha costuma chegar incompleta, sobretudo sem o WhatsApp do destinatário. Quando isso acontece, o pacote fica fora do aviso "saiu para entrega", e a tentativa frustrada volta a ser o desperdício do dia. O pacote físico, com o rótulo que traz os dados reais, passa pelas mãos do carteiro na triagem, mas nada do que está no rótulo chega ao sistema.

O app do carteiro resolve isso. Na triagem, o carteiro fotografa o rótulo de cada pacote. O app lê os dois códigos de barras do rótulo (o código do objeto e o CEP), resolve o endereço pelo CEP e extrai do rótulo o nome, o telefone, o número e o complemento. O pacote entra, ou é atualizado, na lista do distrito do dia, a mesma que alimenta os avisos e a mediação pelo WhatsApp.

O app é para o carteiro, que passa a ter acesso próprio, e para o supervisor, que ganha uma lista mais completa e visibilidade do que chegou por foto. O destinatário se beneficia indiretamente: é avisado no número certo.

## Goals

- O carteiro monta ou completa a lista do distrito do dia fotografando rótulos, um pacote por foto, sem digitar quando a leitura é segura.
- Um pacote que entrou pela planilha sem WhatsApp passa a ser avisado quando o rótulo traz o telefone.
- A lista reflete o rótulo físico: a foto vence a planilha nos campos que leu, e o pacote fica no distrito de quem o fotografou.
- A captura nunca trava por falta de sinal na unidade.
- Um pacote achado depois da saída do carteiro também é avisado.
- O supervisor sabe a origem de cada pacote, vê a foto enquanto ela é retida e acompanha transferências e pendências.
- A foto do rótulo é excluída automaticamente quando deixa de ser necessária.

## User Stories

Índice do catálogo canônico: [histórias completas](_user_stories.md).

- US-001–US-003: acesso. Login por matrícula e senha, senha gerida pelo supervisor, app aberto no distrito do dia.
- US-004–US-009: captura. Leitura dos dois códigos de barras, salvamento sem revisão, conferência dos duvidosos, código digitado, endereço quando o CEP não resolve a rua, pacote sem WhatsApp.
- US-010–US-012: conciliação com a lista. A foto vence a planilha, transferência de outro distrito, refotografia sem duplicar.
- US-013–US-014: sem sinal. Fila no aparelho, envio ao reconectar, contadores.
- US-015–US-016: depois da liberação. Aviso na hora, reaviso na troca de WhatsApp.
- US-017–US-018: correção. Janela do carteiro, remoção pelo supervisor.
- US-019–US-021: visão do supervisor. Origem e foto, transferências, pendências.
- US-022: privacidade. Exclusão automática da foto.

## Core Features

### F1. Acesso do carteiro

- O carteiro entra com matrícula e senha. O supervisor define a senha inicial no Cadastro do carteiro e pode redefini-la; o carteiro troca a senha no primeiro acesso.
- A sessão persiste no aparelho até expirar ou até o carteiro sair.
- O app abre no distrito do dia do carteiro. Vale a designação do supervisor ("carteiro do dia", inclusive "trocar só hoje"). Sem designação, vale o distrito padrão do carteiro, e a lista do dia desse distrito é criada na primeira foto salva.
- A tela inicial mostra o distrito, a data, o total capturado por ele no dia, o botão "Fotografar rótulo", os contadores Para conferir e Aguardando envio, e os capturados recentes com o chip "Completo" ou "Sem WhatsApp".

### F2. Captura do rótulo

- Uma foto, um rótulo. A câmera tem moldura e a instrução "Enquadre o rótulo inteiro dentro da moldura".
- O app lê os dois códigos de barras do rótulo: o do objeto (S10) e o do CEP. O código precisa passar no dígito verificador.
- A câmera fica pronta para o próximo pacote assim que os códigos são lidos. O restante corre em segundo plano:
  - a consulta de CEP resolve logradouro, bairro, cidade e UF;
  - a extração lê do rótulo nome, telefone, número e complemento;
  - se o CEP não resolve o logradouro, a extração também lê logradouro e bairro, e esses campos ficam duvidosos.
- Resultado da extração:
  - **Sem dúvida**: o pacote entra na lista, e aparece "Pacote <código> salvo no <distrito> · desfazer".
  - **Com dúvida**: o pacote vai para **Para conferir**.
- **Conferência** ("Confira os dados"): mostra código, destinatário, WhatsApp, endereço e CEP, com a foto disponível. Os campos duvidosos ficam destacados com o motivo. Tem "Salvar no <distrito>" e "Refazer foto".
- Se o código de barras não é lido, o carteiro digita o código. O dígito verificador tem que conferir, e o pacote fica marcado como "código digitado".

### F3. Conciliação com a lista do distrito

- Planilha e foto somam na mesma lista. O código do objeto é a chave única da lista do dia.
- **A foto vence**: um campo lido sem dúvida na foto sobrescreve o valor existente. **Ausência não apaga**: um campo ausente ou ilegível no rótulo mantém o valor existente.
- Código hoje em outro distrito da mesma unidade: o app pergunta "Este pacote está no D-01 hoje. Trazer para o D-03?". Com a confirmação, o pacote muda de distrito (e o caso de mediação muda de carteiro, se já existir), e o supervisor é informado.
- Refotografar um código já capturado atualiza o pacote e nunca o duplica.

### F4. Captura sem sinal

- Sem rede, a leitura dos códigos e a validação do dígito verificador acontecem no aparelho, e a foto entra em Aguardando envio.
- Com a rede de volta, a fila é enviada sozinha e cada pacote segue F2 (salvo ou Para conferir).
- A fila sobrevive ao fechamento do app e à reinicialização do aparelho. Sair da conta com fila pendente exige confirmação.

### F5. Captura depois da liberação e correções

- A captura é permitida antes e depois da liberação.
- Pacote que entra num distrito já liberado recebe o aviso na hora (regra do PRD de monitoramento).
- A foto que troca o WhatsApp de um pacote já avisado passa o caso ao número novo, que recebe o aviso. O número antigo não recebe mais mensagens sobre esse pacote.
- Antes da liberação, o carteiro edita e remove os pacotes que capturou. Depois da liberação, ele edita, mas remover é só do supervisor. O carteiro nunca remove pacotes vindos só da planilha; em "planilha + foto", remover desfaz apenas a foto.

### F6. Visão do supervisor

- Na lista do distrito, cada pacote mostra a origem (planilha, foto, planilha + foto), se o código foi digitado e quais campos a foto sobrescreveu, com o valor anterior.
- A foto do rótulo pode ser aberta enquanto estiver retida.
- O quadro mostra as transferências entre distritos, com código, carteiro e hora, e o total de pacotes "para conferir no app do carteiro".
- O supervisor define e redefine a senha dos carteiros da sua unidade (F1).

### F7. Retenção da foto

- A foto é retida enquanto o pacote está no fluxo, mais um prazo curto para contestação, e depois é excluída automaticamente.
- Um prazo máximo absoluto, contado da captura, cobre pacotes que nunca recebem status final.
- Fotos de capturas desfeitas, removidas ou recusadas não são retidas.

### Interação entre as features

- F1 determina o distrito em que F2 grava.
- F2 produz pacotes que F3 concilia com a lista do PRD de monitoramento (F2 daquele PRD).
- F4 adia F2 sem mudar suas regras.
- F5 conecta a captura à liberação e à mediação (F3 e F8 do PRD de monitoramento).
- F6 expõe ao supervisor o que F2 a F5 mudaram.
- F7 limita a vida da foto que F2 cria e que F6 exibe.

## Business Rules

### Invariantes

- Um código de objeto pertence a exatamente um distrito por dia (regra do PRD de monitoramento). A captura nunca duplica: ela cria, atualiza ou transfere.
- Uma foto gera no máximo um pacote.
- Um pacote só entra na lista com o mínimo: **código válido, nome e endereço** (logradouro e número, com "S/N" aceito; cidade e UF; CEP de 8 dígitos). Pacotes abaixo do mínimo ficam em Para conferir ou em Aguardando envio, fora da lista.
- O carteiro captura apenas no distrito do dia dele e apenas em distritos da sua unidade.

### Validação

- **Código S10**: duas letras, oito dígitos de série, um dígito verificador e duas letras de país (qualquer país, ADR-007 do PRD de monitoramento). Pesos 8, 6, 4, 2, 3, 5, 9, 7; DV = 11 − (soma mod 11); resto 0 → DV 5; resto 1 → DV 0. Minúsculas, espaços e hífens são normalizados. Código inválido nunca é salvo.
- **CEP**: 8 dígitos. O CEP vem do código de barras do CEP; se ele não for lido, vem do texto do rótulo e fica duvidoso.
- **Endereço**: logradouro, bairro, cidade e UF vêm da consulta de CEP quando ela os resolve; número e complemento vêm do rótulo. Em divergência entre o logradouro do CEP e o do rótulo, vale o do CEP, e o do rótulo aparece como referência na conferência.
- **WhatsApp**: mesma normalização do PRD de monitoramento (E.164 brasileiro, com ou sem +55, nono dígito). Ausente → "Sem WhatsApp". Parcialmente ilegível → vai para conferência, nunca vira "sem WhatsApp" em silêncio. Malformado na conferência → corrigir ou deixar em branco.
- **Nome**: obrigatório. É exibido como lido, sem completar letras que não foram lidas.

### Conciliação

- Um campo lido sem dúvida sobrescreve o existente. Um campo duvidoso nunca sobrescreve sem conferência. Um campo ausente mantém o existente.
- A origem do pacote é registrada: planilha, foto ou planilha + foto. Cada sobrescrita guarda o valor anterior, visível ao supervisor.
- Transferência entre distritos: exige confirmação do carteiro; só dentro da mesma unidade; recusada se o pacote já consta como entregue; orientações pendentes acompanham o pacote; o supervisor é informado; em concorrência, vale a primeira confirmação.

### Avisos e mediação

- Nenhum aviso sai de um distrito não liberado.
- Pacote que entra num distrito liberado é avisado na hora. As regras do PRD de monitoramento continuam valendo: sem envio entre 0h e 6h (agendado para 06:05) e respeito ao descadastro.
- Troca de WhatsApp em pacote já avisado: o caso passa ao número novo, que recebe o aviso. O número antigo deixa de receber mensagens desse pacote. Uma orientação já dada continua valendo até o número novo dar outra, e o carteiro é informado da troca. Um número igual ao anterior (só formatado diferente) não é troca.

### Permissões

- **Carteiro**:
  - vê e captura apenas no seu distrito do dia;
  - edita os pacotes que capturou;
  - remove apenas os pacotes que capturou e só antes da liberação;
  - vê a foto dos pacotes do seu distrito enquanto retida.
- **Supervisor**:
  - vê origem, foto, transferências e pendências da sua unidade;
  - remove pacotes a qualquer momento, exceto pacotes entregues;
  - define e redefine senhas dos carteiros da sua unidade;
  - é o único que libera distritos.
- Ninguém de outra unidade vê pacotes nem fotos.

### Estados de um pacote capturado (no aparelho e na lista)

- **Aguardando envio** (fila local, sem rede) → **Processando** → **Salvo** (na lista) ou **Para conferir** (fora da lista).
- **Para conferir** → **Salvo** (o carteiro salva) ou **Descartado** (o carteiro descarta).
- **Salvo** → **Desfeito** (pelo "desfazer" ou por remoção dentro das permissões).
- Depois de salvo, o pacote segue os status do PRD de monitoramento (sem WhatsApp, aguardando liberação, enviado, lido, interagindo, insucesso, entregue).

### Acesso

- Senha inicial definida pelo supervisor, com troca obrigatória no primeiro acesso.
- A redefinição encerra as sessões abertas.
- Tentativas erradas repetidas bloqueiam temporariamente.
- Carteiro desativado perde o acesso na próxima ação.

### Retenção da foto

- Retida até o pacote sair do fluxo (entregue ou insucesso final), mais o prazo de contestação, com um prazo máximo absoluto contado da captura. Os valores exatos estão em Open Questions.
- Não retida para capturas desfeitas, removidas ou recusadas.

## User Experience

### Personas

- **Carteiro**: uma mão, pressa, dezenas de pacotes, muitas vezes sem sinal na triagem. Quer fotografar em sequência e só parar quando o app realmente precisa dele.
- **Supervisor**: quer uma lista confiável antes de liberar e entender o que mudou por foto.
- **Destinatário**: não vê o app. Recebe o aviso no número certo.

### Fluxo principal: triagem

1. O carteiro abre o app, já logado, e vê o seu distrito do dia com o contador.
2. Toca "Fotografar rótulo", enquadra o rótulo e tira a foto.
3. Os códigos são lidos, e a câmera fica pronta para o próximo pacote.
4. Aparece "Pacote … salvo · desfazer", ou o contador Para conferir aumenta.
5. Ao terminar a sequência, abre Para conferir, confere os campos destacados e salva.
6. O supervisor libera o distrito. Os pacotes com WhatsApp recebem o aviso.

### Fluxos secundários

- **Pacote de outro distrito**: pergunta de transferência, confirmação e aviso ao supervisor.
- **Sem sinal**: indicador de desconexão, contador Aguardando envio, envio automático ao reconectar.
- **Pacote achado na rua**: captura depois da liberação e aviso na hora.
- **Correção**: abrir um pacote capturado, editar, ou remover antes da liberação.

### UI e acessibilidade

- Seguir o protótipo (`prototipo/AppCaptura.dc.html`): cabeçalho com carteiro, unidade, distrito e contador; botão principal grande; lista de recentes com chips; câmera escura com moldura e disparador grande; conferência com campos rotulados e destaque de dúvida em âmbar com a explicação.
- Alvos de toque de pelo menos 44 px e disparador bem maior.
- Contraste AA. O destaque de dúvida não depende só de cor: tem texto explicativo.
- Campos reais com rótulo (acessíveis por leitor de tela).
- Mensagens em linguagem de carteiro, curtas e sem jargão técnico.

### Primeiro uso

- O supervisor cria o acesso no Cadastro do carteiro e passa a matrícula e a senha inicial.
- O carteiro abre o link, instala o app na tela inicial, troca a senha e permite a câmera. Se a permissão de câmera for negada, o app explica como liberar e oferece a digitação do código.

## High-Level Technical Constraints

- **Integrações obrigatórias**:
  - lista do dia, liberação, avisos e mediação do PRD `monitoramento-entregas-whatsapp` (este PRD não cria uma lista paralela);
  - consulta de CEP do Prosio, indicada pelo dono do produto (a localização exata da API fica para a TechSpec; o correios-entregas também tem `buscarCep` do CWS dos Correios);
  - autenticação existente de matrícula e senha com o papel CARTEIRO;
  - área `/carteiro` do frontend.
- **Plataforma**: app web instalável, sem loja, em Android e iPhone. A leitura de código de barras precisa funcionar nos dois, inclusive no iPhone, onde o navegador não a oferece nativamente.
- **Offline**: a leitura dos códigos, a validação do dígito verificador e a fila precisam funcionar sem rede, e a fila precisa ser persistente.
- **Desempenho percebido**: a câmera fica pronta para o próximo pacote logo após a leitura dos códigos, sem esperar a extração. A extração nunca bloqueia a captura.
- **Correção prévia**: o validador S10 atual (`backend/src/shared/utils/s10.ts`) inverte os restos 0 e 1 e aceita só o sufixo BR. Precisa seguir a regra de Business Rules antes que a captura (ou a planilha) valide códigos reais.
- **Privacidade (LGPD)**:
  - a foto é dado pessoal de terceiro: minimização, exclusão automática e acesso restrito por unidade;
  - o provedor de extração não pode reter a imagem além do processamento;
  - nenhuma foto ou dado extraído aparece em log.
- **Extração**: não inventa dados; um campo que não foi lido fica vazio ou duvidoso, nunca preenchido por suposição.

## Non-Goals (Out of Scope)

- **Navegador de paradas** (módulo b): PRD próprio.
- **Vários rótulos por foto**: uma foto, um rótulo (ADR-002).
- **Extração inteira no aparelho, sem rede**: offline só lê os códigos e enfileira (ADR-003).
- **App nativo nas lojas**: fica para quando o Navegador exigir (ADR-004).
- **Liberação do distrito pelo carteiro**: continua sendo do supervisor.
- **Substituir o WhatsApp do carteiro**: orientações e mediação continuam pelo WhatsApp; o app não mostra orientações nem conversas neste PRD.
- **Retenção longa da foto como prova de entrega**: não é comprovante de entrega (ADR-006).
- **Login por código no WhatsApp**: decidido matrícula e senha (ADR-004).

## Architecture Decision Records

- [ADR-001: A foto é mais uma fonte da lista do distrito; dedup por código e "foto vence"](adrs/adr-001.md). Planilha e foto somam; campos lidos sobrescrevem, ausentes não apagam; transferência confirmada de outro distrito.
- [ADR-002: Dois códigos de barras, endereço pelo CEP e extração só dos campos livres; revisão só quando há dúvida](adrs/adr-002.md). Mínimo: código, nome e endereço; câmera nunca espera a extração.
- [ADR-003: Captura sem sinal com fila no aparelho; extração ao reconectar](adrs/adr-003.md)
- [ADR-004: App web instalável na área /carteiro, com login por matrícula e senha](adrs/adr-004.md)
- [ADR-005: Captura depois da liberação, reaviso na troca de WhatsApp e janela de correção](adrs/adr-005.md)
- [ADR-006: Foto do rótulo retida até o fim do fluxo mais um prazo curto, com exclusão automática](adrs/adr-006.md)

## Open Questions

- **Base jurídica**: o carteiro, como empregado dos Correios, pode lançar dados do destinatário num sistema de terceiros? Quem é o controlador? Isso precisa de validação jurídica antes de ir a produção.
- **Prazos de retenção da foto**: o prazo de contestação depois do fim do fluxo, e o prazo máximo absoluto contado da captura.
- **API de CEP do Prosio**: o dono do produto indicou a consulta de CEP do Prosio, mas ela não foi encontrada no código do Prosio (`/root/dev/prosio`). É preciso confirmar onde ela está, ou usar o `buscarCep` do CWS dos Correios que já existe no correios-entregas.
- **DataMatrix**: o rótulo dos Correios traz um DataMatrix com DDD e telefone do destinatário. Usá-lo como fonte do telefone, antes do OCR, pode aumentar a confiança. A TechSpec decide.
- **Planilha depois da foto**: se o supervisor sobe uma planilha depois da captura com o mesmo código, a regra de soma do PRD de monitoramento pode sobrescrever os campos que a foto leu. Qual fonte vale nesse caso?
- **Dependência de implementação**: o PRD de monitoramento (distrito, lista do dia, liberação) ainda não está implementado. Este módulo só funciona depois dele, ou a TechSpec precisa ordenar as tarefas juntas.
- **Cadastro do carteiro**: o PRD de monitoramento define o carteiro sem login (nome, matrícula e WhatsApp). O Cadastro precisa ganhar a gestão de senha (F1), o que altera aquele PRD.
- **CEP fora da área do distrito**: um pacote com CEP que não pertence à área do distrito deve ser sinalizado? Hoje não existe mapeamento de CEP por distrito.
