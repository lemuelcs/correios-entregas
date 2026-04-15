# Correios Entregas

Aplicação do produto operacional de Correios Entregas.

## Responsabilidade do Repositório

Este repositório concentra o que é específico do produto Correios Entregas:

- regras de triagem, recebimento, despacho, monitoramento e gestão operacional
- backend e frontend do produto
- consumo dos serviços compartilhados providos por `delivyo-services`

## O que Não Deve Ficar Aqui

- infraestrutura compartilhada como gateway, Postgres, Redis, observabilidade, OSRM e VROOM
- microserviços reutilizáveis por mais de um sistema
- duplicação local de domínios já centralizados, como WhatsApp e address engine

## Relação com os Outros Repositórios

- `delivyo-services` é o hub compartilhado e deve ser subido primeiro
- `temelio` é outro produto consumidor do mesmo hub
- a infraestrutura legada local deste repositório deve existir apenas em `profiles: ["legacy"]`
- o domínio de WhatsApp/comunicação é consumido via gateway do hub central, não por implementação local neste repositório

## Endpoints Locais Relevantes

- backend: `http://localhost:3002`
- frontend: `http://localhost:5181`
- serviços compartilhados: `http://localhost/services/*`
