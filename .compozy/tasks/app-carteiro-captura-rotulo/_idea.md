# Ideia: App do carteiro — Módulo A, captura do rótulo de envio

**Status**: PRD escrito em 2026-09-30 (`_prd.md`, `_user_stories.md`, ADR-001–006); próximo passo cy-create-techspec
**Relacionado**: `../monitoramento-entregas-whatsapp/_prd.md` (ADR-010)

## O que o dono do produto pediu

Um app para o carteiro, com dois módulos no futuro:

- **(a) Captura de rótulo** (este PRD): o carteiro tira foto do rótulo de envio (shipping label) de cada pacote. O sistema processa a imagem e extrai o código do objeto, o nome e o telefone do destinatário, o endereço completo e demais dados. Com isso, abastece a lista de pacotes do distrito do dia, a mesma que o supervisor hoje carrega por planilha em Monitoramento › Carregar Dados.
- **(b) Navegador** (depois): guia o carteiro pelas paradas e entregas.

## Contexto que já existe

- No PRD de entregas mediadas, a lista do distrito é a fonte dos avisos de WhatsApp via Prosio, e o carteiro fala com o destinatário mediado pelo bot.
- Hoje o carteiro não tem login no fluxo novo: recebe orientações só pelo WhatsApp. O app muda isso.
- O Prosio já faz OCR de imagem recebida no WhatsApp (memória "Áudio e OCR do Prosio"), e o Dokimo tem um pipeline de visão com LLM. Há candidatos a reaproveitar.
- O correios-entregas já valida o código S10 com dígito verificador (`backend/src/shared/utils/s10.ts`).

## Perguntas a resolver na ideação

- Quem abre a lista do distrito: o supervisor, o carteiro ao iniciar a captura, ou os dois somando?
- A foto substitui a planilha ou a complementa (deduplicação por código)?
- O que fazer quando a extração tem baixa confiança: revisão manual no app, ou envio ao supervisor?
- Dados obrigatórios extraídos e o que acontece quando o rótulo não traz telefone.
- Captura offline (sem sinal na unidade) e fila de envio.
- Guarda da foto: descartar após extrair (LGPD) ou reter como prova?
- Um pacote por foto, ou vários rótulos numa foto?
- Plataforma: PWA no celular do carteiro ou app nativo?

## Protótipo de referência

Canvas "Correios Entregas — Protótipo": https://claude.ai/artifact/T3HneV28vRrr9cKPbTKbFV
(cópia das telas relevantes em `prototipo/`, versão 1790798127-6a4b, lida em 2026-09-30).

- `AppCaptura.dc.html`: início do distrito (D-03, contador), câmera com moldura, revisão "Confira os dados" (S10 validado, dígito ilegível no telefone em destaque, "deixe em branco"), salvar no distrito. Lista com chip "Completo" / "Sem WhatsApp".
- `Upload.dc.html` / `Distrito.dc.html`: a lista que a captura abastece (validações: DV do S10, duplicado, "já está em outro distrito hoje", sem WhatsApp entra sem aviso).
- `WhatsCarteiro.dc.html` / `WhatsDestinatario.dc.html`: o fluxo mediado que consome a lista.

O protótipo já sugere respostas (a confirmar na ideação): um pacote por foto; revisão manual no próprio app; telefone ausente ou ilegível não bloqueia o salvamento.
