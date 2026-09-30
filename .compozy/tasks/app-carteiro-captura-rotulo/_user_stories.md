# User Stories: App do carteiro — captura do rótulo de envio

Catálogo canônico de comportamento da feature. Companheiro de `_prd.md`; consumido por
`_techspec.md` (mapeamento de componentes) e `_tests.md` (matriz de cobertura).

Códigos de exemplo válidos (dígito verificador correto pela regra UPU): `AA123456785BR`, `OY716488072BR`.
Protótipo de referência: `prototipo/AppCaptura.dc.html`.

## Personas

- **Carteiro**: faz a entrega de um distrito no dia. Na triagem, dentro do CDD, muitas vezes sem sinal, fotografa o rótulo de cada pacote para montar ou completar a lista do distrito. Usa o celular (em geral Android) com uma mão, com pressa e dezenas de pacotes. Continua recebendo orientações e falando com destinatários pelo WhatsApp (PRD `monitoramento-entregas-whatsapp`).
- **Supervisor**: responsável pela unidade (CDD ou CEE). Designa o carteiro do dia, sobe planilhas, libera distritos e acompanha o painel. Agora também gerencia o acesso dos carteiros ao app e confere o que chegou por foto.
- **Destinatário**: recebe a encomenda. Não usa o app; é afetado quando a captura cria um pacote ou troca o WhatsApp dele.

## Story Index

| ID     | Feature Area             | Persona      | Story |
|--------|--------------------------|--------------|-------|
| US-001 | Acesso                   | Carteiro     | Entrar no app com matrícula e senha |
| US-002 | Acesso                   | Supervisor   | Definir e redefinir a senha do carteiro |
| US-003 | Acesso                   | Carteiro     | Abrir o app no distrito do dia |
| US-004 | Captura                  | Carteiro     | Fotografar o rótulo e ler código e CEP |
| US-005 | Captura                  | Carteiro     | Ver o pacote salvo sem precisar revisar |
| US-006 | Captura                  | Carteiro     | Conferir os pacotes com dúvida |
| US-007 | Captura                  | Carteiro     | Digitar o código quando o código de barras não lê |
| US-008 | Captura                  | Carteiro     | Completar o endereço quando o CEP não resolve a rua |
| US-009 | Captura                  | Carteiro     | Salvar pacote sem WhatsApp |
| US-010 | Conciliação com a lista  | Carteiro     | Atualizar pacote que já veio da planilha |
| US-011 | Conciliação com a lista  | Carteiro     | Trazer para o seu distrito um pacote de outro distrito |
| US-012 | Conciliação com a lista  | Carteiro     | Fotografar de novo um pacote já capturado |
| US-013 | Sem sinal                | Carteiro     | Capturar sem sinal |
| US-014 | Sem sinal                | Carteiro     | Ver os pacotes aguardando envio e o que aconteceu com eles |
| US-015 | Depois da liberação      | Carteiro     | Capturar pacote depois de o distrito ser liberado |
| US-016 | Depois da liberação      | Destinatário | Receber o aviso quando a foto corrige o WhatsApp |
| US-017 | Correção                 | Carteiro     | Editar ou remover pacote capturado |
| US-018 | Correção                 | Supervisor   | Remover pacote de distrito já liberado |
| US-019 | Visão do supervisor      | Supervisor   | Ver a origem do pacote e a foto do rótulo |
| US-020 | Visão do supervisor      | Supervisor   | Ser informado de transferências entre distritos |
| US-021 | Visão do supervisor      | Supervisor   | Ver as pendências de captura do distrito |
| US-022 | Privacidade              | Supervisor   | Ter a foto excluída ao fim do prazo |

## Acesso

### US-001: Entrar no app com matrícula e senha

**As a** carteiro, **I want** entrar no app com minha matrícula e senha, **so that** eu capture pacotes em nome do meu distrito.

Acceptance criteria:

- AC-1: Dado um carteiro cadastrado com senha inicial, quando ele entra pela primeira vez com matrícula e senha, então o app pede uma senha nova antes de mostrar o distrito.
- AC-2: Dada uma senha já trocada, quando o carteiro entra, então o app abre no distrito do dia (US-003).
- AC-3: Dado um login feito, quando o carteiro fecha e reabre o app no mesmo aparelho, então continua logado até a sessão expirar ou ele sair.
- AC-4: Dado um usuário que não é carteiro (supervisor, gestor), quando entra pela área do carteiro, então não vê a captura.

Edge cases:

- EC-1: Matrícula ou senha erradas → a mensagem "Matrícula ou senha incorretas", sem dizer qual das duas.
- EC-2: Campos em branco → o botão Entrar não envia e os campos são destacados.
- EC-3: Tentativas erradas repetidas → o acesso é bloqueado temporariamente e o app diz que é preciso pedir ao supervisor a redefinição.
- EC-4: Carteiro desativado no Cadastro → o login é recusado com "Acesso desativado. Fale com o supervisor."; uma sessão já aberta é encerrada na próxima ação.
- EC-5: Sessão expirada no meio de uma captura → as fotos na fila local são preservadas e enviadas depois do novo login.
- EC-6: Sem sinal no primeiro login → "Sem conexão. O primeiro acesso precisa de internet."
- EC-7: Mesmo carteiro logado em dois aparelhos → os dois capturam no mesmo distrito, e as capturas se somam pelo código (US-012).

### US-002: Definir e redefinir a senha do carteiro

**As a** supervisor, **I want** definir a senha inicial do carteiro e redefini-la quando ele esquecer, **so that** o carteiro acesse o app sem depender de outra área.

Acceptance criteria:

- AC-1: Dado o cadastro de um carteiro, quando o supervisor define uma senha inicial, então o carteiro consegue entrar e é obrigado a trocá-la no primeiro acesso.
- AC-2: Dado um carteiro que esqueceu a senha, quando o supervisor a redefine, então as sessões abertas do carteiro são encerradas e vale a nova senha inicial.
- AC-3: Dado um supervisor, quando abre o cadastro de um carteiro de outra unidade, então não consegue definir a senha dele.

Edge cases:

- EC-1: Senha inicial fora da política mínima → recusada com a regra exibida.
- EC-2: Carteiro sem matrícula cadastrada → não é possível definir a senha até a matrícula ser preenchida.
- EC-3: Dois supervisores redefinindo ao mesmo tempo → vale a última; o carteiro recebe a senha mais recente.
- EC-4: Redefinição enquanto o carteiro tem fila offline → a fila fica no aparelho e é enviada depois do novo login.

### US-003: Abrir o app no distrito do dia

**As a** carteiro, **I want** que o app abra direto no meu distrito de hoje, **so that** eu comece a fotografar sem escolher nada.

Acceptance criteria:

- AC-1: Dado que o supervisor designou o carteiro para o D-03 hoje, quando o carteiro abre o app, então vê "D-03 · Águas Claras Sul", a data de hoje e o total de pacotes capturados por ele.
- AC-2: Dado nenhuma designação para hoje, quando o carteiro abre o app, então o app usa o distrito padrão do carteiro; a lista do dia desse distrito é criada na primeira foto salva.
- AC-3: Dado que o supervisor troca o carteiro do dia ("trocar só hoje") para outro distrito, quando o carteiro reabre o app, então vê o novo distrito.
- AC-4: A tela inicial mostra o botão "Fotografar rótulo", o contador de "Para conferir", o contador de "Aguardando envio" e os capturados recentes, cada um com o chip "Completo" ou "Sem WhatsApp".

Edge cases:

- EC-1: Carteiro sem designação e sem distrito padrão → "Você não tem distrito hoje. Fale com o supervisor."; a câmera não abre.
- EC-2: O mesmo carteiro designado a dois distritos no dia → o app pede para escolher o distrito antes de capturar e mostra qual está ativo.
- EC-3: A designação muda enquanto há pacotes na fila offline → esses pacotes vão para o distrito que estava ativo na hora da foto.
- EC-4: O dia vira (meia-noite) com o app aberto → na próxima ação, o app recarrega o distrito do novo dia.
- EC-5: Distrito com 0 pacotes → a lista mostra "Nenhum pacote ainda" e o botão da câmera.

## Captura

### US-004: Fotografar o rótulo e ler código e CEP

**As a** carteiro, **I want** fotografar o rótulo e ter o código do objeto e o CEP lidos na hora, **so that** eu passe para o próximo pacote sem digitar.

Acceptance criteria:

- AC-1: Dado a câmera aberta, quando o rótulo inteiro está na moldura e o carteiro tira a foto, então o app lê o código de barras do objeto e o do CEP.
- AC-2: Dado um código lido com dígito verificador válido, quando a leitura termina, então a câmera volta pronta para o próximo pacote e o pacote passa à extração (US-005/US-006).
- AC-3: A tela da câmera mostra o distrito e o número do próximo pacote ("D-03 · pacote 14"), e tem Cancelar.
- AC-4: Um pacote por foto: a foto gera no máximo um pacote.

Edge cases:

- EC-1: Código lido com dígito verificador inválido → "Código não confere. Fotografe de novo ou digite." (US-007).
- EC-2: Código lido que não segue o padrão S10 (duas letras, nove dígitos, duas letras) → tratado como não lido.
- EC-3: Mais de um código de objeto na foto (dois rótulos) → "Mais de um rótulo na foto. Fotografe um de cada vez."; nada é salvo.
- EC-4: Nenhum código de barras lido → o app pede nova foto e oferece digitar o código.
- EC-5: CEP ilegível no código de barras → o CEP é lido do texto e marcado como duvidoso.
- EC-6: Permissão de câmera negada → uma explicação e o caminho para liberar; a digitação manual continua disponível.
- EC-7: Foto escura, tremida ou com o rótulo cortado → "Não deu para ler. Enquadre o rótulo inteiro."
- EC-8: O carteiro cancela na câmera → volta ao início sem criar nada.
- EC-9: Sufixo de país diferente de BR (por exemplo, encomenda internacional) → aceito se o dígito verificador conferir.

### US-005: Ver o pacote salvo sem precisar revisar

**As a** carteiro, **I want** que o pacote seja salvo sozinho quando tudo foi lido com segurança, **so that** eu só pare nos casos com dúvida.

Acceptance criteria:

- AC-1: Dado código válido, endereço resolvido e nome e telefone lidos sem dúvida, quando a extração termina, então o pacote entra na lista do distrito e aparece "Pacote OY…BR salvo no D-03 · desfazer".
- AC-2: Dado o aviso de salvo, quando o carteiro toca "desfazer" dentro do tempo do aviso, então o pacote sai da lista (ou volta aos dados anteriores, se já existia).
- AC-3: O contador de capturados do dia sobe a cada pacote salvo.
- AC-4: Enquanto a extração de um pacote corre, o carteiro já pode fotografar o próximo.

Edge cases:

- EC-1: Vários avisos de salvo em sequência → cada um nomeia o código, e o "desfazer" afeta só aquele pacote.
- EC-2: "Desfazer" sem sinal → é enfileirado e aplicado quando a rede voltar; o pacote aparece como "removendo".
- EC-3: "Desfazer" de um pacote que já estava num distrito liberado → segue US-017 e US-018 (depois da liberação, remover é só do supervisor; o desfazer de um dado atualizado restaura o valor anterior).
- EC-4: Extração falha (erro do serviço) → o pacote vai para Para conferir com os campos vazios para preencher.
- EC-5: Extração muito demorada → o pacote aparece como "processando" nos recentes e não bloqueia a câmera.

### US-006: Conferir os pacotes com dúvida

**As a** carteiro, **I want** conferir só os campos que o sistema não leu com segurança, **so that** o pacote entre na lista com dados corretos.

Acceptance criteria:

- AC-1: Dado um pacote com algum campo duvidoso, quando a extração termina, então ele vai para Para conferir e o contador aumenta.
- AC-2: Dado um pacote em Para conferir, quando o carteiro o abre, então vê "Confira os dados" com código, destinatário, WhatsApp, endereço (logradouro, número, complemento, bairro, cidade, UF) e CEP, e os campos duvidosos destacados com o motivo (por exemplo, "Um dígito ficou ilegível. Confira no rótulo ou deixe em branco.").
- AC-3: O código mostra "Dígito verificador confere" quando válido.
- AC-4: Dado os campos corrigidos, quando o carteiro toca "Salvar no D-03", então o pacote entra na lista e sai de Para conferir.
- AC-5: O carteiro pode ver a foto do rótulo durante a conferência e tocar em "Refazer foto".

Edge cases:

- EC-1: Nome apagado ou em branco → Salvar fica bloqueado com "Informe o nome do destinatário".
- EC-2: Endereço sem logradouro ou sem número → Salvar bloqueado (o endereço é obrigatório); "S/N" é aceito como número.
- EC-3: WhatsApp deixado em branco → salva como "Sem WhatsApp" (US-009).
- EC-4: WhatsApp malformado (sem DDD, poucos dígitos) → "Número incompleto: corrija ou deixe em branco"; não salva com o número inválido.
- EC-5: CEP editado para outro CEP válido → logradouro, bairro, cidade e UF são reconsultados, e os campos preenchidos à mão são mantidos se o carteiro confirmar.
- EC-6: CEP inválido (menos de 8 dígitos) → bloqueia com "CEP deve ter 8 dígitos".
- EC-7: Código editado na revisão → o dígito verificador é revalidado, e as regras de duplicidade e outro distrito (US-010, US-011) se aplicam ao novo código.
- EC-8: O carteiro sai da revisão sem salvar → o pacote continua em Para conferir, com as edições feitas até ali.
- EC-9: Para conferir com muitos pacotes (dezenas) → a lista ordena do mais antigo para o mais novo e é paginada ou rolável.
- EC-10: O distrito é liberado enquanto há pacotes em Para conferir → eles continuam pendentes; ao salvar, recebem o aviso na hora (US-015).
- EC-11: Texto com caracteres estranhos ou de escrita duvidosa lido pelo OCR → o nome é mostrado como lido, sem inventar letras; campo marcado como duvidoso.

### US-007: Digitar o código quando o código de barras não lê

**As a** carteiro, **I want** digitar o código do objeto quando o código de barras está danificado, **so that** o pacote não fique de fora.

Acceptance criteria:

- AC-1: Dado que o código não foi lido, quando o carteiro escolhe digitar, então vê um campo de código com a foto do rótulo ao lado.
- AC-2: Dado um código digitado com dígito verificador válido, quando confirma, então o fluxo segue como numa leitura normal.
- AC-3: O pacote registra que o código foi digitado (o supervisor vê isso, US-019).

Edge cases:

- EC-1: Dígito verificador não confere → "Código não confere. Confira no pacote." e não avança.
- EC-2: Minúsculas, espaços ou hífens → normalizados antes da validação.
- EC-3: Menos ou mais caracteres que o S10 → recusado com o formato esperado.
- EC-4: Código digitado já está na lista → segue US-010 ou US-012.

### US-008: Completar o endereço quando o CEP não resolve a rua

**As a** carteiro, **I want** que o endereço seja lido do rótulo quando o CEP não traz a rua, **so that** pacotes de cidade com CEP único ou de grande usuário também entrem completos.

Acceptance criteria:

- AC-1: Dado um CEP que resolve logradouro e bairro, quando a extração termina, então logradouro, bairro, cidade e UF vêm da consulta de CEP, e número e complemento vêm do rótulo.
- AC-2: Dado um CEP que resolve só cidade e UF, quando a extração termina, então logradouro e bairro vêm do rótulo, marcados como duvidosos, e o pacote vai para Para conferir.
- AC-3: Dada uma consulta de CEP indisponível, quando a extração termina, então o endereço inteiro vem do rótulo, marcado como duvidoso.

Edge cases:

- EC-1: CEP inexistente → "CEP não encontrado"; o endereço vem do rótulo e o CEP fica destacado para conferir.
- EC-2: Logradouro do rótulo diferente do logradouro do CEP → vale o do CEP; o do rótulo aparece como referência na conferência.
- EC-3: Complemento longo (bloco, apartamento, ponto de referência) → mantido integralmente.
- EC-4: Rótulo sem número → o campo fica duvidoso, e o carteiro informa o número ou "S/N".

### US-009: Salvar pacote sem WhatsApp

**As a** carteiro, **I want** salvar o pacote mesmo quando o rótulo não traz telefone, **so that** a lista do distrito fique completa.

Acceptance criteria:

- AC-1: Dado um rótulo sem telefone e sem telefone anterior na lista, quando o pacote é salvo, então entra com o chip "Sem WhatsApp" e não recebe aviso.
- AC-2: Dado um rótulo sem telefone e um pacote que já tinha WhatsApp pela planilha, quando o pacote é salvo, então o WhatsApp da planilha é mantido (ausência não apaga).
- AC-3: Um telefone fixo lido do rótulo é guardado, mas o pacote conta como "sem WhatsApp".

Edge cases:

- EC-1: Telefone parcialmente ilegível → vai para Para conferir (US-006) em vez de salvar "sem WhatsApp" em silêncio.
- EC-2: Telefone com DDD de outro estado → aceito.
- EC-3: Telefone sem o nono dígito → normalizado segundo a regra de WhatsApp do PRD de monitoramento.

## Conciliação com a lista

### US-010: Atualizar pacote que já veio da planilha

**As a** carteiro, **I want** que minha foto atualize o pacote que o supervisor já carregou, **so that** a lista reflita o rótulo físico.

Acceptance criteria:

- AC-1: Dado um código já no D-03 vindo da planilha, quando a foto é salva, então cada campo lido na foto substitui o da planilha.
- AC-2: Dado um campo ausente ou ilegível no rótulo, quando a foto é salva, então o valor da planilha é mantido.
- AC-3: O pacote não é duplicado: continua uma linha, agora com origem "planilha + foto".
- AC-4: Os pacotes da planilha que o carteiro ainda não fotografou continuam na lista, sem mudança.

Edge cases:

- EC-1: O supervisor sobe uma planilha depois da foto com o mesmo código → vale a regra de soma do PRD de monitoramento; a TechSpec deve garantir que a planilha posterior não desfaça silenciosamente os campos que a foto leu (ver Open Questions).
- EC-2: A foto troca o WhatsApp de um pacote ainda não avisado → só a troca, sem aviso extra.
- EC-3: A foto troca o WhatsApp de um pacote já avisado → US-016.
- EC-4: Pacote da planilha com "orientação guardada" do dia anterior → a orientação é mantida depois da foto.

### US-011: Trazer para o seu distrito um pacote de outro distrito

**As a** carteiro, **I want** trazer para o meu distrito um pacote que está listado em outro, **so that** a lista reflita com quem o pacote de fato está.

Acceptance criteria:

- AC-1: Dado um código hoje no D-01, quando o carteiro do D-03 o fotografa, então vê "Este pacote está no D-01 hoje. Trazer para o D-03?".
- AC-2: Dada a confirmação, então o pacote sai do D-01, entra no D-03 com os dados da foto (a foto vence), e o supervisor é informado (US-020).
- AC-3: Dada a recusa, então nada muda e a foto é descartada.
- AC-4: Dado o D-01 já liberado, quando a transferência é confirmada, então o caso do pacote passa ao carteiro do D-03, e o carteiro do D-01 deixa de receber orientações desse pacote.

Edge cases:

- EC-1: Pacote do outro distrito já marcado como entregue → a transferência é recusada: "Este pacote já consta como entregue."
- EC-2: Pacote com orientação pendente no D-01 → a orientação acompanha o pacote e chega ao carteiro do D-03.
- EC-3: Dois carteiros tentam trazer o mesmo pacote ao mesmo tempo → vale a primeira confirmação; o segundo vê "Este pacote acabou de ir para o D-0X".
- EC-4: Pacote em distrito de outra unidade → a transferência é recusada: "Este pacote pertence a outra unidade. Fale com o supervisor."
- EC-5: Captura offline de pacote que está em outro distrito → a pergunta aparece quando a fila é processada, em Para conferir.

### US-012: Fotografar de novo um pacote já capturado

**As a** carteiro, **I want** poder fotografar de novo um pacote sem criar duplicata, **so that** um toque repetido ou uma segunda foto melhor não bagunce a lista.

Acceptance criteria:

- AC-1: Dado um código já capturado no D-03, quando é fotografado de novo, então o pacote é atualizado pelas regras da US-010 e aparece "Pacote atualizado".
- AC-2: O contador de capturados não aumenta numa refotografia.

Edge cases:

- EC-1: A mesma foto enviada duas vezes (reenvio da fila após queda de rede) → o resultado é o mesmo de um envio só.
- EC-2: Refotografia com um campo pior lido que antes → a regra "foto vence" se aplica apenas aos campos lidos sem dúvida; campos duvidosos vão para conferência em vez de sobrescrever.
- EC-3: Dois aparelhos do mesmo carteiro com o mesmo código → um pacote só.

## Sem sinal

### US-013: Capturar sem sinal

**As a** carteiro, **I want** continuar fotografando sem sinal, **so that** a triagem não pare.

Acceptance criteria:

- AC-1: Dado o aparelho sem rede, quando o carteiro fotografa, então os códigos são lidos e validados no aparelho, e o pacote entra em Aguardando envio.
- AC-2: Dada a volta da rede, então os pacotes aguardando são enviados automaticamente, sem ação do carteiro.
- AC-3: O app mostra claramente que está sem conexão e quantos pacotes aguardam envio.

Edge cases:

- EC-1: App fechado ou aparelho reiniciado com fila pendente → a fila continua lá ao reabrir.
- EC-2: O carteiro tenta sair (logout) com fila pendente → um aviso: "N pacotes ainda não foram enviados. Sair vai perdê-los?"; não sai sem confirmar.
- EC-3: Rede oscilando no meio do envio → nenhum pacote é enviado duas vezes nem perdido.
- EC-4: Espaço do aparelho acabando → um aviso antes de a câmera parar de guardar fotos.
- EC-5: Fila grande (dezenas de pacotes) → o envio é progressivo, com o contador diminuindo.
- EC-6: Código com dígito verificador inválido lido offline → a recusa é imediata, sem esperar a rede.

### US-014: Ver os pacotes aguardando envio e o que aconteceu com eles

**As a** carteiro, **I want** saber o que foi enviado, salvo ou precisa de conferência, **so that** eu não saia da unidade com pendência sem saber.

Acceptance criteria:

- AC-1: A tela inicial mostra os contadores Aguardando envio e Para conferir.
- AC-2: Depois do processamento, cada pacote ou fica salvo, ou vai para Para conferir.
- AC-3: Tocar num pacote aguardando mostra o código e a hora da foto.

Edge cases:

- EC-1: Um pacote aguardando cuja designação de distrito mudou → segue US-003 EC-3.
- EC-2: Processamento que falha no servidor → o pacote vai para Para conferir com o motivo, sem sumir.

## Depois da liberação

### US-015: Capturar pacote depois de o distrito ser liberado

**As a** carteiro, **I want** capturar pacotes mesmo depois de sair para a rua, **so that** um pacote achado tarde também seja avisado.

Acceptance criteria:

- AC-1: Dado o D-03 liberado, quando um pacote novo com WhatsApp é salvo, então o destinatário recebe o aviso "saiu para entrega" na hora e o caso é aberto com o carteiro do dia.
- AC-2: Dado o D-03 ainda não liberado, quando o pacote é salvo, então nenhum aviso sai até a liberação.

Edge cases:

- EC-1: Pacote salvo entre 0h e 6h num distrito liberado → o aviso é agendado para 06:05 (regra existente).
- EC-2: Destinatário descadastrado das mensagens → sem aviso; o pacote é marcado como descadastrado.
- EC-3: Pacote salvo "sem WhatsApp" depois da liberação → sem aviso.

### US-016: Receber o aviso quando a foto corrige o WhatsApp

**As a** destinatário, **I want** receber o aviso no meu número mesmo quando a planilha trazia outro, **so that** eu possa orientar a entrega.

Acceptance criteria:

- AC-1: Dado um pacote já avisado no número antigo, quando a foto salva um WhatsApp diferente, então o número novo recebe o aviso e o caso passa a esse número.
- AC-2: O número antigo não recebe mais mensagens sobre esse pacote.
- AC-3: O supervisor vê no histórico do caso a troca de número e a conversa anterior.

Edge cases:

- EC-1: O número antigo já tinha dado uma orientação → a orientação continua valendo até o número novo dar outra; o carteiro é informado da troca de número.
- EC-2: O número novo está descadastrado → sem aviso; o pacote é marcado como descadastrado.
- EC-3: Troca de número durante a janela sem envio (0h–6h) → o aviso é agendado para 06:05.
- EC-4: A foto traz o mesmo número (apenas formatado diferente) → nenhuma troca e nenhum aviso.

## Correção

### US-017: Editar ou remover pacote capturado

**As a** carteiro, **I want** corrigir ou remover um pacote que eu capturei, **so that** um engano não siga para a rua.

Acceptance criteria:

- AC-1: Dado um pacote capturado por mim num distrito não liberado, quando o abro, então posso editar os campos e removê-lo.
- AC-2: Dado um distrito liberado, quando abro um pacote que capturei, então posso editar, mas não aparece Remover ("Para remover, fale com o supervisor").
- AC-3: Dado um pacote que veio só da planilha, então não aparece Remover para o carteiro.

Edge cases:

- EC-1: Remover um pacote com origem "planilha + foto" antes da liberação → a foto é desfeita e o pacote volta aos dados da planilha, sem sair da lista.
- EC-2: Edição do WhatsApp depois da liberação → segue US-016.
- EC-3: O supervisor libera o distrito enquanto o carteiro está removendo → a remoção é recusada com a mensagem da AC-2.
- EC-4: Edição do código → tratada como remoção mais nova captura (as regras de dígito verificador e duplicidade se aplicam).

### US-018: Remover pacote de distrito já liberado

**As a** supervisor, **I want** remover um pacote de um distrito já liberado, **so that** um engano de captura não siga como encomenda do dia.

Acceptance criteria:

- AC-1: Dado um distrito liberado, quando o supervisor remove um pacote, então ele sai da lista e o caso é encerrado sem nova mensagem ao destinatário.
- AC-2: O carteiro vê o pacote sumir da sua lista no app.

Edge cases:

- EC-1: Pacote com orientação já enviada ao carteiro → o carteiro recebe "Pacote OY…BR removido do seu distrito".
- EC-2: Pacote já entregue → a remoção é recusada.

## Visão do supervisor

### US-019: Ver a origem do pacote e a foto do rótulo

**As a** supervisor, **I want** ver se cada pacote veio da planilha, da foto ou dos dois, e ver a foto, **so that** eu confira divergências.

Acceptance criteria:

- AC-1: Na lista do distrito, cada pacote mostra a origem: planilha, foto ou planilha + foto.
- AC-2: Num pacote com foto, o supervisor abre a foto do rótulo enquanto ela estiver retida (US-022).
- AC-3: O pacote indica quando o código foi digitado pelo carteiro, e quais campos a foto sobrescreveu, com o valor anterior.

Edge cases:

- EC-1: Foto já excluída pelo prazo → "Foto excluída em DD/MM (prazo de retenção)".
- EC-2: Supervisor de outra unidade → não vê o pacote nem a foto.

### US-020: Ser informado de transferências entre distritos

**As a** supervisor, **I want** ver quando um carteiro traz um pacote de outro distrito, **so that** eu entenda as mudanças da minha lista.

Acceptance criteria:

- AC-1: Quando uma transferência é confirmada, o quadro de distritos mostra-a no distrito de origem e no de destino, com código, carteiro e hora.
- AC-2: O pacote transferido indica o distrito de origem na lista do destino.

Edge cases:

- EC-1: Várias transferências do mesmo pacote no dia → todas ficam no histórico, em ordem.
- EC-2: Transferência saindo de um distrito liberado → o supervisor vê que o caso trocou de carteiro.

### US-021: Ver as pendências de captura do distrito

**As a** supervisor, **I want** ver quantos pacotes o carteiro ainda tem em Para conferir, **so that** eu saiba se a lista está completa antes de liberar.

Acceptance criteria:

- AC-1: O cartão do distrito mostra "N para conferir no app do carteiro" quando há pendências.
- AC-2: A liberação continua permitida com pendências; o supervisor vê o aviso antes de liberar.

Edge cases:

- EC-1: Pacotes ainda no aparelho, sem sinal → o supervisor não os vê (ainda não chegaram); o app do carteiro é quem mostra.
- EC-2: Pendências zeradas → o aviso some.

## Privacidade

### US-022: Ter a foto excluída ao fim do prazo

**As a** supervisor, **I want** que as fotos de rótulo sejam excluídas automaticamente, **so that** a unidade não acumule dado pessoal de destinatários.

Acceptance criteria:

- AC-1: Dado um pacote que saiu do fluxo (entregue ou insucesso final), quando o prazo de retenção termina, então a foto é excluída sem ação de ninguém.
- AC-2: Os dados extraídos do pacote seguem as regras de retenção do PRD de monitoramento; só a foto é afetada por esta regra.

Edge cases:

- EC-1: Pacote que nunca sai do fluxo (sem status final) → a foto é excluída por um prazo máximo absoluto contado da captura.
- EC-2: Foto de um pacote removido ou de uma captura desfeita → excluída logo após a remoção.
- EC-3: Foto de captura recusada (dois rótulos, outra unidade, recusa de transferência) → não é retida.
