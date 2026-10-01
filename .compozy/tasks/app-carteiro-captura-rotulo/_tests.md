# Test Specification: App do carteiro — captura do rótulo de envio

Contrato canônico de testes da feature. Companheiro de `_techspec.md`.
Derivado de `_user_stories.md` (comportamento) e `_techspec.md` (componentes).

## Strategy

- **Frameworks e harness**:
  - Backend: Jest + ts-jest + supertest, com o app Express em processo.
  - Frontend: Vitest + Testing Library + jsdom + `fake-indexeddb`.
  - E2E: Playwright, com o frontend em `vite preview` e o backend com `CAPTURA_AI_PROVIDER=fake`.
- **Fakes só nas bordas de I/O**:
  - `FakeLabelExtractor` (respostas por fixture);
  - `FakeCepService` ou fetch falso (ViaCEP/CWS);
  - `DiskPhotoStore` num diretório temporário;
  - relógio injetável (`now()`) para dia civil e retenção.
- **Banco**: Postgres `correiosentregas_test`. O `globalSetup` aborta se o `DATABASE_URL` não terminar em `_test`, roda `prisma migrate deploy` e cada suíte limpa só as linhas que criou. Redis real na CI; `ioredis-mock` local.
- **Fixtures**: `backend/src/__tests__/fixtures/rotulos/` com rótulos sintéticos (bwip-js), com Code 128 e DataMatrix SIGEP e dados fictícios:
  - `rotulo-completo.jpg`: código `OY716488072BR`, CEP 72115040, DataMatrix com número 17 e telefone 61993401287;
  - `rotulo-sem-datamatrix.jpg`: código `AA123456785BR`, CEP 71919360, sem DataMatrix;
  - `rotulo-dm-sem-telefone.jpg`: DataMatrix com telefone `000000000000`;
  - `rotulo-codigo-danificado.jpg`: Code 128 ilegível, DataMatrix ausente;
  - `rotulo-dois.jpg`: dois rótulos na mesma foto;
  - `rotulo-escuro.jpg`: nenhum código decodificável;
  - `rotulo-cep-unico.jpg`: CEP 73800000 (cidade de CEP único).
- **Execução**: `npm test` na raiz (turbo: jest no backend e vitest no frontend); `npm run test:e2e` no frontend (Playwright). A CI roda os dois.
- **Convenções**: testes tabelados para validadores; nome `describe('<Componente>') / it('<ID> <comportamento>')`; o ID do caso aparece no nome do teste.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001 | Login matrícula+senha, troca no 1º acesso, sessão longa | UT-062, UT-063, UT-115, UT-116 | IT-040, IT-041, IT-042 | E2E-001 |
| US-001.EC-1 | Credenciais erradas, mensagem genérica | UT-064 | IT-043 | — |
| US-001.EC-2 | Campos em branco | UT-117 | — | — |
| US-001.EC-3 | Bloqueio por tentativas | UT-065, UT-066 | IT-044 | — |
| US-001.EC-4 | Carteiro desativado | UT-067 | IT-045 | — |
| US-001.EC-5 | Sessão expira com fila → fila preservada | UT-083 | — | — |
| US-001.EC-6 | 1º login sem sinal | UT-118 | — | — |
| US-001.EC-7 | Dois aparelhos, mesmo distrito, soma por código | — | IT-016 | — |
| US-002 | Supervisor define/redefine senha | — | IT-046, IT-047 | — |
| US-002.EC-1 | Senha fora da política | UT-068 | IT-048 | — |
| US-002.EC-2 | Carteiro sem matrícula | — | IT-049 | — |
| US-002.EC-3 | Redefinições concorrentes, vale a última | — | IT-050 | — |
| US-002.EC-4 | Redefinição com fila offline | UT-083 | — | — |
| US-002.AC-3 | Outra unidade | — | IT-051 | — |
| US-003 | Abrir no distrito do dia | UT-056, UT-057, UT-101 | IT-001, IT-002 | E2E-001 |
| US-003.AC-3 | Troca "só hoje" reflete no app | UT-058 | IT-003 | — |
| US-003.EC-1 | Sem distrito → câmera bloqueada | UT-059, UT-102 | IT-004 | — |
| US-003.EC-2 | Dois distritos no dia → escolher | UT-060, UT-103 | IT-005 | — |
| US-003.EC-3 | Designação muda com fila → vai ao distrito da foto | — | IT-006 | — |
| US-003.EC-4 | Virada do dia | UT-061 | — | — |
| US-003.EC-5 | Distrito vazio | UT-104 | — | — |
| US-004 | Foto → códigos lidos → câmera pronta | UT-086, UT-106 | IT-007 | E2E-001 |
| US-004.EC-1 | DV inválido | UT-002, UT-107 | IT-008 | — |
| US-004.EC-2 | Código fora do padrão S10 | UT-004 | — | — |
| US-004.EC-3 | Dois rótulos na foto | UT-087 | IT-009 | — |
| US-004.EC-4 | Nenhum código lido → digitar | UT-088, UT-108 | — | — |
| US-004.EC-5 | CEP ilegível no código → do texto, com dúvida | UT-020 | IT-010 | — |
| US-004.EC-6 | Câmera negada | UT-109 | — | — |
| US-004.EC-7 | Foto escura/cortada | UT-088 | — | — |
| US-004.EC-8 | Cancelar na câmera | UT-110 | — | — |
| US-004.EC-9 | Sufixo diferente de BR | UT-003 | IT-011 | — |
| US-004.AC-4 | Uma foto, um pacote | — | IT-009 | — |
| US-005 | Salvo sem revisão + desfazer | UT-105 | IT-012, IT-013 | E2E-001 |
| US-005.EC-1 | Avisos em sequência, desfazer só o seu | UT-105 | IT-014 | — |
| US-005.EC-2 | Desfazer sem sinal | UT-084 | — | — |
| US-005.EC-3 | Desfazer após liberação | — | IT-015 | — |
| US-005.EC-4 | Extração falha → para conferir vazio | UT-045 | IT-017 | — |
| US-005.EC-5 | Extração demorada não bloqueia câmera | UT-085 | — | — |
| US-006 | Conferir campos duvidosos | UT-026–UT-033, UT-091 | IT-018, IT-019 | E2E-002 |
| US-006.EC-1 | Nome vazio bloqueia | UT-092 | IT-020 | — |
| US-006.EC-2 | Endereço sem rua/número bloqueia, "S/N" aceito | UT-029, UT-093 | IT-021 | — |
| US-006.EC-3 | WhatsApp em branco → sem WhatsApp | UT-094 | IT-022 | — |
| US-006.EC-4 | WhatsApp malformado | UT-095 | IT-023 | — |
| US-006.EC-5 | CEP editado → reconsulta | UT-096 | IT-024 | — |
| US-006.EC-6 | CEP inválido | UT-097 | IT-025 | — |
| US-006.EC-7 | Código editado → revalida e concilia | UT-098 | IT-026 | — |
| US-006.EC-8 | Sai sem salvar, edições preservadas | UT-099 | — | — |
| US-006.EC-9 | Muitas pendências, ordem antiga→nova | — | IT-027 | — |
| US-006.EC-10 | Liberação com pendências, salvar depois → aviso | — | IT-028 | — |
| US-006.EC-11 | OCR não inventa letras | UT-044 | — | — |
| US-007 | Digitar código | UT-108 | IT-029 | — |
| US-007.EC-1 | DV digitado inválido | UT-107 | IT-008 | — |
| US-007.EC-2 | Normalização de minúsculas/espaços | UT-005 | — | — |
| US-007.EC-3 | Tamanho errado | UT-006 | — | — |
| US-007.EC-4 | Digitado já na lista | — | IT-030 | — |
| US-008 | CEP resolve rua, rótulo dá número | UT-021 | IT-031 | — |
| US-008.AC-2 | CEP só cidade → rua do rótulo com dúvida | UT-022 | IT-032 | — |
| US-008.AC-3 | CEP indisponível → endereço do rótulo com dúvida | UT-023, UT-037 | IT-033 | — |
| US-008.EC-1 | CEP inexistente | UT-036 | IT-034 | — |
| US-008.EC-2 | Rua do rótulo ≠ rua do CEP | UT-024 | — | — |
| US-008.EC-3 | Complemento longo | UT-025 | — | — |
| US-008.EC-4 | Sem número → dúvida | UT-030 | — | — |
| US-009 | Salvar sem WhatsApp | UT-013 | IT-035 | — |
| US-009.AC-2 | Ausência não apaga WhatsApp da planilha | — | IT-036 | — |
| US-009.AC-3 | Fixo guardado, conta como sem WhatsApp | UT-014 | — | — |
| US-009.EC-1 | Telefone parcialmente ilegível → conferir | UT-031 | — | — |
| US-009.EC-2 | DDD de outro estado | UT-015 | — | — |
| US-009.EC-3 | Sem nono dígito | UT-016 | — | — |
| US-010 | Foto vence planilha | — | IT-037 | — |
| US-010.AC-2 | Ausente mantém | — | IT-036 | — |
| US-010.AC-3 | Sem duplicar, origem PLANILHA_FOTO | — | IT-037 | — |
| US-010.AC-4 | Não fotografados intactos | — | IT-038 | — |
| US-010.EC-1 | Planilha posterior (Open Question do PRD) | — | — | — (regra de planilha pertence ao PRD de monitoramento; registrado em Known Risks) |
| US-010.EC-2 | Troca de WhatsApp antes da liberação, sem aviso | — | IT-039 | — |
| US-010.EC-3 | Troca após aviso | — | IT-052 | — |
| US-010.EC-4 | Orientação guardada preservada | — | — | — (orientação não existe neste escopo; a regra 3 só toca campos de endereço/contato; coberto por IT-037, que verifica que nenhum campo fora de CamposLidos muda) |
| US-011 | Transferência confirmada | — | IT-053, IT-054 | — |
| US-011.AC-3 | Recusa mantém tudo | — | IT-055 | — |
| US-011.AC-4 | Origem liberada → evento com troca de carteiro | — | IT-056 | — |
| US-011.EC-1 | Já entregue → recusa | — | IT-057 | — |
| US-011.EC-2 | Orientação acompanha (evento TRANSFERIDO com pacoteId estável) | — | IT-054 | — |
| US-011.EC-3 | Concorrência, primeira vence | — | IT-058 | — |
| US-011.EC-4 | Outra unidade → recusa | — | IT-059 | — |
| US-011.EC-5 | Offline → pergunta em Para conferir | — | IT-060 | — |
| US-012 | Refotografar atualiza sem duplicar | — | IT-061 | — |
| US-012.EC-1 | Reenvio da mesma captura é idempotente | — | IT-062, IT-063 | — |
| US-012.EC-2 | Campo pior lido não sobrescreve | — | IT-064 | — |
| US-012.EC-3 | Dois aparelhos, mesmo código | — | IT-016 | — |
| US-013 | Capturar sem sinal | UT-071, UT-077 | — | E2E-003 |
| US-013.EC-1 | Fila sobrevive a reabrir | UT-072 | — | — |
| US-013.EC-2 | Logout com fila pede confirmação | UT-119 | — | — |
| US-013.EC-3 | Rede oscilando, sem duplicar/perder | UT-078, UT-079 | IT-062 | — |
| US-013.EC-4 | Espaço acabando | UT-073 | — | — |
| US-013.EC-5 | Fila grande, envio progressivo | UT-080 | — | E2E-003 |
| US-013.EC-6 | DV inválido offline recusado na hora | UT-107 | — | — |
| US-014 | Contadores aguardando/para conferir | UT-101 | IT-027 | E2E-003 |
| US-014.EC-1 | Designação mudou → segue distrito da foto | — | IT-006 | — |
| US-014.EC-2 | Falha no servidor → para conferir com motivo | UT-081 | IT-017 | — |
| US-015 | Pós-liberação → evento de aviso imediato | — | IT-065 | — |
| US-015.AC-2 | Não liberado → sem sinal de aviso | — | IT-066 | — |
| US-015.EC-1 | 0h–6h (agendamento é do consumidor; evento carrega createdAt) | — | IT-065 | — |
| US-015.EC-2 | Descadastrado (checagem é do consumidor; evento emitido igual) | — | IT-065 | — |
| US-015.EC-3 | Sem WhatsApp pós-liberação → evento sem whatsapp | — | IT-067 | — |
| US-016 | Troca de WhatsApp em pacote avisado | — | IT-052 | — |
| US-016.AC-2/AC-3 | Número antigo e histórico no evento | — | IT-052 | — |
| US-016.EC-1 | Orientação anterior + carteiro informado (payload traz antes/depois) | — | IT-052 | — |
| US-016.EC-2 | Número novo descadastrado (consumidor) | — | IT-052 | — |
| US-016.EC-3 | Janela 0h–6h (consumidor) | — | IT-052 | — |
| US-016.EC-4 | Mesmo número formatado diferente → sem troca | UT-017 | IT-068 | — |
| US-017 | Editar/remover antes da liberação | UT-120 | IT-069, IT-070 | — |
| US-017.AC-2 | Após liberação: edita, não remove | — | IT-071 | — |
| US-017.AC-3 | Origem PLANILHA não remove | — | IT-072 | — |
| US-017.EC-1 | Remover PLANILHA_FOTO restaura planilha | — | IT-073 | — |
| US-017.EC-2 | Editar WhatsApp após liberação → evento | — | IT-074 | — |
| US-017.EC-3 | Libera durante remoção | — | IT-075 | — |
| US-017.EC-4 | Editar código = remover + capturar | — | IT-076 | — |
| US-018 | Supervisor remove após liberação | — | IT-077 | — |
| US-018.AC-2 | Some da lista do carteiro | — | IT-078 | — |
| US-018.EC-1 | Evento REMOVIDO sinaliza carteiro | — | IT-077 | — |
| US-018.EC-2 | Entregue → recusa | — | IT-079 | — |
| US-019 | Origem, código digitado, sobrescritas, foto | UT-121 | IT-080, IT-081, IT-082 | — |
| US-019.EC-1 | Foto excluída → 410 com data | UT-122 | IT-083 | — |
| US-019.EC-2 | Outra unidade → 404 | — | IT-084 | — |
| US-020 | Transferências no quadro | UT-123 | IT-085 | — |
| US-020.EC-1 | Várias transferências em ordem | — | IT-086 | — |
| US-020.EC-2 | Saída de distrito liberado sinalizada | — | IT-085 | — |
| US-021 | Pendências no quadro | UT-124 | IT-087 | — |
| US-021.AC-2 | Liberação permitida com pendências | — | IT-088 | — |
| US-021.EC-1 | Pendências só no aparelho não aparecem | — | IT-087 | — |
| US-021.EC-2 | Zeradas → some | — | IT-089 | — |
| US-022 | Exclusão ao fim do prazo | UT-052, UT-053 | IT-090 | — |
| US-022.AC-2 | Só a foto é afetada | — | IT-090 | — |
| US-022.EC-1 | Prazo máximo absoluto | UT-054 | IT-091 | — |
| US-022.EC-2 | Remoção/desfazer exclui na hora | — | IT-092 | — |
| US-022.EC-3 | Captura recusada não retém | — | IT-093 | — |
| `s10.ts` | Validação UPU | UT-001–UT-006 | — | — |
| `sigep-datamatrix.ts` | Parser | UT-007–UT-012 | — | — |
| Telefone | Normalização E.164 | UT-013–UT-017 | — | — |
| `montarCampos` | Precedência de fontes | UT-018–UT-025 | — | — |
| `avaliarMinimo` | Mínimo e dúvida | UT-026–UT-033 | — | — |
| `CepService` | Consulta, fallback, cache | UT-034–UT-041 | IT-031–IT-034 | — |
| `GeminiLabelExtractor` | Extração | UT-042–UT-047 | — | — |
| `DiskPhotoStore` | put/get/delete | UT-048–UT-051 | — | — |
| Retenção | Cálculo de expiração | UT-052–UT-055 | IT-090–IT-093 | — |
| `distrito-dia.service` | Resolução do distrito | UT-056–UT-061 | IT-001–IT-006 | — |
| Auth | Login, bloqueio, refresh, troca | UT-062–UT-070 | IT-040–IT-051 | — |
| `ConciliacaoService` | Regras 1–5, desfazer, remover | — | IT-012–IT-039, IT-052–IT-079 | — |
| `POST /captura/capturas` | Sucesso e falhas documentadas | — | IT-007, IT-008, IT-094–IT-098 | — |
| `GET /captura/conferir`, `/confirmar`, `/descartar`, `/desfazer` | Sucesso e falhas | — | IT-018–IT-027, IT-099–IT-101 | — |
| `GET /captura/cep/:cep` | 200/404/503 | — | IT-024, IT-102, IT-103 | — |
| `GET /captura/capturas/:id/foto` | 200/404/410 | — | IT-104, IT-105 | — |
| `/supervisao/*` | Endpoints do supervisor | — | IT-046–IT-051, IT-077–IT-089, IT-106–IT-108 | — |
| `PacoteEvento` outbox | Um evento por mudança, mesma transação | — | IT-109, IT-110 | — |
| `captureQueue` | Fila IndexedDB | UT-071–UT-076 | — | — |
| `captureSync` | Envio e retry | UT-077–UT-085 | — | — |
| `barcode.ts` | Decodificação | UT-086–UT-090 | — | — |
| `api.ts` | Multipart e rotação | UT-111–UT-114 | — | — |
| Worker `foto-retencao` | Job diário | — | IT-090, IT-091 | — |
| Trava `_test` | Aborta fora de banco de teste | UT-125 | — | — |

## Unit Tests

### s10.ts (TechSpec: Business Rules do PRD; Impact Analysis)

- **UT-001** (happy): `validateS10('AA123456785BR')` → `{ valid: true, servico: 'AA', checkDigit: 5 }`.
- **UT-002** (error): `validateS10('AA123456784BR')` → `valid: false`.
- **UT-003** (happy): `validateS10('RR123456785CN')` (sufixo CN) → `valid: true`.
- **UT-004** (error): `validateS10('A1234567895BR')`, `'AA12345678BR'`, `'AA123456785B'` → todos `valid: false`.
- **UT-005** (happy): `validateS10(' oy 716-488-072 br ')` → `valid: true`, código normalizado `OY716488072BR`.
- **UT-006** (boundary): `calculateS10CheckDigit` para uma série com soma mod 11 = 0 → 5, e para uma série com soma mod 11 = 1 → 0. As séries são escolhidas por busca no teste, com a asserção sobre os dois restos.

### sigep-datamatrix.ts (TechSpec: Core Interfaces; ADR-011)

- **UT-007** (happy): a string DataMatrix do fixture `rotulo-completo` → `{ cepDestino: '72115040', codigo: 'OY716488072BR', numero: '17', complemento: 'CASA', telefone: '61993401287' }`.
- **UT-008** (boundary): telefone `000000000000` → `telefone: null`.
- **UT-009** (boundary): número `00000` → `numero: null`; complemento só com espaços → `null`.
- **UT-010** (error): string menor que o tamanho mínimo do layout → `null` (sem exceção).
- **UT-011** (error): CEP com letras na posição do CEP → `null`.
- **UT-012** (error): código com DV inválido dentro do DataMatrix → `codigo: null` e os demais campos preservados.

### Normalização de telefone (TechSpec: Business Rules)

- **UT-013** (happy): `normalizarWhatsapp('(61) 99340-1287')` → `{ e164: '+5561993401287', tipo: 'celular' }`.
- **UT-014** (happy): `normalizarWhatsapp('(61) 3340-1287')` → `{ e164: null, outro: '+556133401287', tipo: 'fixo' }`.
- **UT-015** (happy): `'11 98765-4321'` → `'+5511987654321'`.
- **UT-016** (happy): `'61 9340-1287'` (celular sem o nono dígito) → `'+5561993401287'`.
- **UT-017** (boundary): `mesmoNumero('+5561993401287', '(61) 99340-1287')` → `true`.

### montarCampos (TechSpec: Data flow step 3.5; ADR-011)

- **UT-018** (happy): DataMatrix completo + CEP resolvido + LLM só com o nome → número, complemento e telefone com `fonte: 'DATAMATRIX'`, logradouro com `fonte: 'CEP'`, nome com `fonte: 'LLM'`, e nenhum `duvida`.
- **UT-019** (error): Code 128 `OY716488072BR` ≠ código do DataMatrix `AA123456785BR` → `codigo.duvida = true`, com motivo `codigos_divergentes`.
- **UT-020** (happy): sem CEP linear nem DataMatrix, CEP em texto do LLM `72115-040` → `cep: { valor: '72115040', fonte: 'LLM', duvida: true }`.
- **UT-021** (happy): CEP com logradouro → logradouro, bairro, cidade e UF do CEP; número do LLM.
- **UT-022** (state): CEP sem logradouro → logradouro e bairro do LLM com `duvida: true`, motivo `cep_sem_logradouro`.
- **UT-023** (state): CEP `INDISPONIVEL` → logradouro, bairro, cidade e UF do LLM, todos com `duvida: true`.
- **UT-024** (happy): logradouro do CEP "Quadra QNC 4" e do LLM "QNC 4" → vale o do CEP; o valor do rótulo em `motivo`/referência.
- **UT-025** (boundary): complemento de 120 caracteres vindo do LLM → mantido integralmente.

### avaliarMinimo (TechSpec: Conciliação regra 1)

- **UT-026** (happy): todos os campos mínimos presentes e sem dúvida → `{ ok: true }`.
- **UT-027** (error): `nome.valor = null` → `{ ok: false, motivos: ['nome_ausente'] }`.
- **UT-028** (error): `logradouro.valor = null` → motivo `endereco_incompleto`.
- **UT-029** (boundary): `numero.valor = 'S/N'` → ok; `numero.valor = ''` → `endereco_incompleto`.
- **UT-030** (state): `numero.duvida = true` → `{ ok: false, motivos: ['duvida:numero'] }`.
- **UT-031** (state): `whatsapp.duvida = true` → não ok (nunca vira "sem WhatsApp" em silêncio).
- **UT-032** (happy): `whatsapp.valor = null`, sem dúvida → ok.
- **UT-033** (error): `cep.valor = '7211504'` → motivo `cep_invalido`.

### CepService (ADR-009)

- **UT-034** (happy): ViaCEP 200 para `72115040` → `CepInfo` normalizado; `cep:72115040` gravado com TTL de 30 dias.
- **UT-035** (happy): cache presente → não chama o fetch.
- **UT-036** (error): ViaCEP `{ erro: true }` e CWS não configurado → `'NAO_ENCONTRADO'`, cache com TTL de 1 dia.
- **UT-037** (error): ViaCEP com timeout de 3 s e CWS não configurado → `'INDISPONIVEL'`, sem cache.
- **UT-038** (happy): ViaCEP com timeout e CWS configurado com 200 → `CepInfo` do CWS.
- **UT-039** (state): CEP de cidade (logradouro vazio no ViaCEP) → `logradouro: null`, `cidade` preenchida.
- **UT-040** (error): `lookup('123')` → lança `AppError(400)` sem chamar a rede.
- **UT-041** (error): Redis indisponível → consulta direta, sem falhar.

### GeminiLabelExtractor (ADR-008)

- **UT-042** (happy): `generateObject` falso devolve o nome "ALINE RODRIGUES" → `campos.nome = { valor: 'ALINE RODRIGUES', duvida: false, fonte: 'LLM' }`, e o uso de tokens é propagado.
- **UT-043** (happy): `pedir = ['nome']` → o schema enviado contém só `nome`.
- **UT-044** (state): o modelo devolve `{ valor: 'AL?NE', duvida: false }` → uma pós-validação detecta um caractere fora do alfabeto de nomes e força `duvida: true`.
- **UT-045** (error): `generateObject` rejeita → lança `ExtracaoIndisponivel`, que o `CapturaService` converte em PARA_CONFERIR.
- **UT-046** (error): o abort em 15 s → `ExtracaoIndisponivel` com motivo `timeout`.
- **UT-047** (happy): `CAPTURA_AI_PROVIDER=fake` → a factory devolve o `FakeLabelExtractor`.

### DiskPhotoStore (ADR-010)

- **UT-048** (happy): `put('u1/2026-09-30/c1.jpg', buf)` e depois `get` → os mesmos bytes.
- **UT-049** (happy): `delete` e depois `get` → `null`.
- **UT-050** (idempotency): `delete` de uma chave inexistente → resolve, sem erro.
- **UT-051** (error): chave com `..` → lança erro, sem tocar o disco.

### Retenção (ADR-010)

- **UT-052** (happy): `statusFinalEm = 2026-09-01`, `now = 2026-10-02`, 30 dias → expirada.
- **UT-053** (boundary): `statusFinalEm = 2026-09-01`, `now = 2026-09-30T23:59 -03` → não expirada.
- **UT-054** (happy): sem `statusFinalEm`, captura de 91 dias atrás, máximo de 90 → expirada.
- **UT-055** (boundary): variáveis de ambiente ausentes → padrões 30 e 90.

### distrito-dia.service (TechSpec: Components)

- **UT-056** (happy): `DistritoDia` de hoje com `carteiroId = eu` → esse distrito.
- **UT-057** (happy): sem designação, `Distrito.carteiroPadraoId = eu` e sem `DistritoDia` de hoje designado a outro → esse distrito (sem criar `DistritoDia` ainda).
- **UT-058** (state): o distrito padrão é o D-03, mas o `DistritoDia` de hoje do D-03 está designado a outro, e eu fui designado ao D-05 → D-05.
- **UT-059** (error): nenhuma designação e nenhum distrito padrão → lista vazia.
- **UT-060** (happy): duas designações hoje → duas opções, e `ativo` = a última escolhida (`PUT /hoje/ativo`) ou nenhuma.
- **UT-061** (boundary): `now = 2026-10-01T00:30-03:00` → a data resolvida é 2026-10-01 (não o UTC anterior).

### Auth (TechSpec: API Endpoints · Auth)

- **UT-062** (happy): o login de um usuário com `senhaTemporaria` → tokens emitidos com o claim `senhaTemporaria: true`.
- **UT-063** (happy): `refresh` → devolve um novo `refreshToken`, e o anterior fica revogado.
- **UT-064** (error): matrícula inexistente e senha errada → a mesma mensagem, "Matrícula ou senha incorretas".
- **UT-065** (boundary): a 5ª falha seguida → `bloqueadoAte = now + 15 min`.
- **UT-066** (state): um login correto durante o bloqueio → 423 `acesso_bloqueado`; depois do bloqueio, o sucesso zera `tentativasFalhas`.
- **UT-067** (error): `ativo=false` → 403 `acesso_desativado`.
- **UT-068** (error): `trocarSenha` com senha nova de menos de 8 caracteres → 400.
- **UT-069** (state): `trocarSenha` válido → `senhaTemporaria=false`.
- **UT-070** (happy): o TTL do refresh de CARTEIRO é de 30 dias; o de outros papéis, 7 dias.

### captureQueue (frontend, ADR-012)

- **UT-071** (happy): `add(captura)` → `listar('aguardando')` contém a captura, com o blob íntegro.
- **UT-072** (state): recriar a instância (simula reabrir o app) → a fila persiste.
- **UT-073** (error): `add` lança `QuotaExceededError` → a fila emite `espaco_insuficiente` e a UI mostra o aviso.
- **UT-074** (state): `marcar(id, 'concluida')` → sai de `aguardando`, e `recentes` guarda o resultado.
- **UT-075** (boundary): `recentes` mantém só os últimos 20.
- **UT-076** (idempotency): `add` com um `capturaId` repetido → substitui, sem duplicar.

### captureSync (frontend, ADR-012)

- **UT-077** (happy): o evento `online` com 2 itens aguardando → 2 POSTs em série, na ordem de `capturadoEm`.
- **UT-078** (idempotency): o fetch rejeita por rede → o item volta para `aguardando` com `tentativas+1` e o mesmo `capturaId`.
- **UT-079** (state): resposta 409 `captura_em_processamento` → continua aguardando, com nova tentativa depois.
- **UT-080** (happy): 30 itens → o contador `aguardando` diminui a cada resposta.
- **UT-081** (state): resposta 200 `PARA_CONFERIR` → o item fica `concluida`, e o contador para conferir sobe.
- **UT-082** (error): resposta 415 `foto_invalida` → `falhou_definitivo`, visível em Para conferir com o motivo.
- **UT-083** (state): 401 com o refresh falhando → a sincronização pausa sem apagar nada, e retoma depois do login.
- **UT-084** (state): um "desfazer" sem rede → enfileirado como operação, e o item aparece "removendo".
- **UT-085** (concurrency): o sync em andamento não bloqueia `captureQueue.add` de uma foto nova.

### barcode.ts (frontend, ADR-011)

- **UT-086** (happy): `decode(rotulo-completo.jpg)` → `{ objeto: 'OY716488072BR', cepLinear: '72115040', dataMatrixRaw: <string> }`.
- **UT-087** (error): `decode(rotulo-dois.jpg)` → lança `MultiplosRotulos` (dois códigos S10 distintos).
- **UT-088** (error): `decode(rotulo-escuro.jpg)` → `{ objeto: null, cepLinear: null, dataMatrixRaw: null }`.
- **UT-089** (happy): `decode(rotulo-sem-datamatrix.jpg)` → `dataMatrixRaw: null`, com o objeto e o CEP lidos.
- **UT-090** (happy): o WASM carrega sob demanda na primeira chamada, e a segunda chamada reutiliza a instância.

### Componentes de UI da captura (frontend)

- **UT-091** (happy): `ConferirPage` com `telefone.duvida` → o campo WhatsApp tem destaque e o texto "Um dígito ficou ilegível. Confira no rótulo ou deixe em branco."
- **UT-092** (error): nome apagado → "Salvar no D-03" desabilitado, com a mensagem "Informe o nome do destinatário".
- **UT-093** (error): número vazio → bloqueia; "S/N" → libera.
- **UT-094** (happy): WhatsApp vazio → salva, e o payload leva `whatsapp: null`.
- **UT-095** (error): WhatsApp `98876-1102` → "Número incompleto: corrija ou deixe em branco".
- **UT-096** (happy): CEP editado para `71919360` → chama `GET /captura/cep/71919360` e preenche rua, bairro, cidade e UF, mantendo o número digitado.
- **UT-097** (error): CEP `7191936` → "CEP deve ter 8 dígitos".
- **UT-098** (error): código editado para `AA123456784BR` → "Código não confere".
- **UT-099** (state): sair e voltar → as edições persistem (rascunho local por `capturaId`).
- **UT-100** (happy): "Refazer foto" → abre a câmera ligada à mesma pendência (a nova captura substitui a pendente ao salvar).
- **UT-101** (happy): `CapturaHomePage` mostra "D-03 · Águas Claras Sul", a data de hoje, o contador de capturados e os contadores Para conferir e Aguardando envio.
- **UT-102** (error): sem distrito → "Você não tem distrito hoje. Fale com o supervisor." e sem o botão da câmera.
- **UT-103** (happy): dois distritos → um seletor antes do botão da câmera.
- **UT-104** (boundary): 0 capturados → "Nenhum pacote ainda".
- **UT-105** (happy): o resultado SALVO → o aviso "Pacote OY716488072BR salvo no D-03 · desfazer"; o desfazer de um aviso chama `POST /capturas/<id>/desfazer` só daquele id.
- **UT-106** (happy): `CameraPage` depois do disparo com uma decodificação válida → `captureQueue.add` é chamado e a câmera volta pronta, com o contador "pacote N+1".
- **UT-107** (error): decodificação com DV inválido → "Código não confere. Fotografe de novo ou digite." e nada é enfileirado.
- **UT-108** (happy): nenhum código lido → a opção "Digitar código"; um código digitado válido → enfileira com `codigoDigitado: true`.
- **UT-109** (error): `getUserMedia` rejeita com `NotAllowedError` → uma explicação para liberar a câmera e o botão "Digitar código".
- **UT-110** (happy): "Cancelar" → volta ao início, sem enfileirar.

### api.ts (frontend)

- **UT-111** (happy): `api.postForm('/captura/capturas', formData)` → não fixa o Content-Type JSON; envia o `Authorization`.
- **UT-112** (happy): um 401 → o refresh devolve `{accessToken, refreshToken}`, os dois são gravados, e a requisição é repetida.
- **UT-113** (error): o refresh falha → limpa os tokens e redireciona para /login, sem tocar o IndexedDB da fila.
- **UT-114** (concurrency): dois 401 simultâneos → um único refresh em voo.

### Login e sessão (frontend)

- **UT-115** (happy): login com `senhaTemporaria` → redireciona para a tela "Crie sua senha".
- **UT-116** (happy): depois da troca → redireciona para `/carteiro/captura`.
- **UT-117** (error): Entrar com os campos vazios → não envia e destaca os campos.
- **UT-118** (error): offline no primeiro login (sem tokens) → "Sem conexão. O primeiro acesso precisa de internet."
- **UT-119** (state): "Sair" com 3 itens aguardando → um diálogo "3 pacotes ainda não foram enviados. Sair vai perdê-los?"; cancelar mantém a sessão.

### PacotePage e telas do supervisor (frontend)

- **UT-120** (state): `PacotePage` de um pacote meu num distrito ABERTO → mostra Remover; num LIBERADO → esconde Remover e mostra "Para remover, fale com o supervisor".
- **UT-121** (happy): `DistritoPacotesPage` mostra os chips de origem "Planilha", "Foto" e "Planilha + foto", e o selo "código digitado".
- **UT-122** (state): foto 410 → "Foto excluída em 30/10 (prazo de retenção)".
- **UT-123** (happy): `DistritosDiaPage` lista as transferências com código, carteiro e hora.
- **UT-124** (happy): `paraConferir: 4` → "4 para conferir no app do carteiro"; `0` → nada.

### Infraestrutura de teste

- **UT-125** (error): o `globalSetup` com `DATABASE_URL=.../correiosentregas_db` → lança "Recusado: testes só rodam em banco *_test" antes de qualquer conexão.

## Integration Tests

Todos via supertest contra o app em processo, com banco `_test`, `FakeLabelExtractor`, CEP falso e PhotoStore em diretório temporário, salvo indicação. A semente padrão: a unidade U1 com os distritos D-01, D-03 e D-05; o carteiro C1 (padrão do D-03), o carteiro C2 (padrão do D-01) e o supervisor S1, todos da U1; a unidade U2 com o carteiro C9. Data fixa: 2026-09-30 (America/Sao_Paulo).

### Distrito do dia

- **IT-001**: `GET /captura/hoje` como C1, com o `DistritoDia(D-03, hoje, carteiroId=C1)` → `distritos[0].codigo = 'D-03'`, `status = 'ABERTO'`.
- **IT-002**: como C1, sem nenhum `DistritoDia` de hoje → D-03 (distrito padrão); depois do primeiro POST de captura SALVO, existe `DistritoDia(D-03, hoje)`.
- **IT-003**: S1 faz `PUT /supervisao/distritos/D-05/dia/2026-09-30/carteiro {C1}` e `D-03` é designado a C2 → `GET /captura/hoje` como C1 retorna D-05.
- **IT-004**: carteiro C3 sem distrito padrão nem designação → `distritos: []`; o POST de captura com qualquer `distritoDiaId` → 403.
- **IT-005**: C1 designado ao D-03 e ao D-05 → `distritos.length = 2`; `PUT /captura/hoje/ativo {D-05}` → 204, e `ativo = D-05`.
- **IT-006**: captura com o `distritoDiaId` do D-03, enviada depois de a designação passar ao D-05 → o pacote é gravado no D-03 (o distrito do momento da foto), porque o C1 ainda era o designado quando `capturadoEm` ocorreu. Se o C1 não for mais o designado nem o padrão do D-03, → 403 `distrito_nao_autorizado`, e o aparelho move a captura para Para conferir.

### POST /captura/capturas e conciliação

- **IT-007**: POST com `rotulo-completo.jpg`, os barcodes e o fake LLM devolvendo o nome "ALINE RODRIGUES" sem dúvida → 200 `{ tipo: 'SALVO', atualizado: false }`; o `Pacote(OY716488072BR)` com origem FOTO, whatsappE164 `+5561993401287` e cep `72115040`; a foto existe no PhotoStore; um `PacoteEvento` CRIADO.
- **IT-008**: meta com o código `AA123456784BR` → 200 `{ tipo: 'RECUSADO', codigo: 'DV_INVALIDO' }`; nenhum pacote; a foto não é retida.
- **IT-009**: meta com `barcodes.multiplos = true` (o aparelho detectou dois S10) → `RECUSADO/MULTIPLOS_ROTULOS`; zero pacotes.
- **IT-010**: sem `cepLinear` nem DataMatrix, com o LLM dando o CEP "72115-040" → `PARA_CONFERIR`, com `campos.cep.duvida = true`.
- **IT-011**: código `RR123456785CN` → `SALVO`.
- **IT-012**: IT-007 seguido de `POST /capturas/<id>/desfazer` → 204; o pacote não existe; um evento DESFEITO; a foto excluída.
- **IT-013**: o pacote veio da planilha (semente origem PLANILHA, nome "Aline R."); a captura dá nome "ALINE RODRIGUES" e é salva; o desfazer → o nome volta a "Aline R.", a origem volta a PLANILHA.
- **IT-014**: duas capturas salvas (A e B); o desfazer de A → B permanece.
- **IT-015**: o pacote CRIADO pela foto num DistritoDia que depois vira LIBERADO; o desfazer → 409 `remocao_nao_permitida`. Com o pacote ATUALIZADO (existia antes): o desfazer → 204 e restaura `pacoteAntes`.
- **IT-016**: duas capturas diferentes (`capturaId` distintos) do mesmo código, pelo mesmo C1, em paralelo (`Promise.all`) → exatamente um `Pacote`; uma CRIADO e uma ATUALIZADO (ou um SALVO atualizado).
- **IT-017**: o `FakeLabelExtractor` configurado para lançar `ExtracaoIndisponivel` → `PARA_CONFERIR`, com `motivos` contendo `extracao_indisponivel` e os campos LLM vazios.
- **IT-018**: o LLM devolve `whatsapp.duvida = true` → `PARA_CONFERIR`; `GET /captura/conferir` lista a captura com `campos.whatsapp.duvida = true`.
- **IT-019**: `POST /capturas/<id>/confirmar` com os campos corrigidos e sem dúvida → `SALVO`; `GET /conferir` não lista mais essa captura.
- **IT-020**: `confirmar` com `nome: ''` → 400 `{ details.code: 'nome_ausente' }`.
- **IT-021**: `confirmar` com `numero: ''` → 400 `endereco_incompleto`; com `numero: 'S/N'` → 200.
- **IT-022**: `confirmar` com `whatsapp: null` → `SALVO`, com `whatsappE164 = null`.
- **IT-023**: `confirmar` com `whatsapp: '98876-1102'` → 400 `whatsapp_invalido`.
- **IT-024**: `GET /captura/cep/71919360` → 200 com o logradouro; `confirmar` com esse CEP e o número "3" → o pacote grava o logradouro do CEP.
- **IT-025**: `confirmar` com `cep: '7191936'` → 400 `cep_invalido`.
- **IT-026**: `confirmar` trocando o código para outro que já está no D-01 → `TRANSFERENCIA_PENDENTE`; trocando para um DV inválido → 400 `dv_invalido`.
- **IT-027**: 12 capturas PARA_CONFERIR criadas em horários diferentes → `GET /conferir` devolve as 12, em ordem crescente de `capturadoEm`.
- **IT-028**: a captura em PARA_CONFERIR; o DistritoDia é LIBERADO; o `confirmar` → `SALVO`, e o evento CRIADO tem `payload.distritoLiberado = true`.
- **IT-029**: meta com `codigoDigitado: true` → o pacote salvo tem `codigoDigitado = true`.
- **IT-030**: um código digitado que já existe no D-03 → `SALVO` com `atualizado: true`.

### CEP

- **IT-031**: o CEP falso devolve o logradouro "QNC 4" → o pacote tem logradouro "QNC 4" (fonte CEP) e o número "17" (DataMatrix).
- **IT-032**: o CEP falso devolve logradouro `null` (73800000) → `PARA_CONFERIR`, com `logradouro.duvida = true`.
- **IT-033**: o CEP falso `INDISPONIVEL` → `PARA_CONFERIR`, com cidade e UF com dúvida.
- **IT-034**: o CEP falso `NAO_ENCONTRADO` → `PARA_CONFERIR`, com `cep.duvida = true` e o motivo `cep_nao_encontrado`.

### Planilha × foto

- **IT-035**: um rótulo sem telefone (DataMatrix zerado), pacote novo → `SALVO`, `whatsappE164 = null`.
- **IT-036**: semente PLANILHA com whatsapp `+5561991112222`; captura sem telefone → `SALVO`; o whatsapp continua `+5561991112222`.
- **IT-037**: semente PLANILHA (nome "Aline R.", número "71"); a captura lê nome "ALINE RODRIGUES" e número "17" → os dois sobrescritos; a origem vira `PLANILHA_FOTO`; o evento ATUALIZADO com `payload.campos.nome = { antes: 'Aline R.', depois: 'ALINE RODRIGUES' }`; os campos fora de `CamposLidos` (`statusFinal`, `distritoDiaId`) ficam inalterados.
- **IT-038**: semente de 3 pacotes PLANILHA, com a captura de 1 deles → os outros 2 ficam idênticos (comparação por snapshot).
- **IT-039**: DistritoDia ABERTO; a captura troca o whatsapp → o evento WHATSAPP_ALTERADO com `distritoLiberado: false`.
- **IT-052**: DistritoDia LIBERADO; semente com whatsapp `+5561991112222`; a captura lê `+5561993401287` → WHATSAPP_ALTERADO com `payload = { antes: '+5561991112222', depois: '+5561993401287', distritoLiberado: true }`.
- **IT-068**: a captura lê `(61) 99111-2222` para um pacote com `+5561991112222` → nenhum evento WHATSAPP_ALTERADO.

### Auth

- **IT-040**: `POST /auth/login {matricula, senha}` de C1, com `senhaTemporaria` → 200; `GET /captura/hoje` → 403 `troca_de_senha_obrigatoria`.
- **IT-041**: `POST /auth/trocar-senha` → 204; depois `GET /captura/hoje` → 200.
- **IT-042**: `POST /auth/refresh` duas vezes seguidas, usando o token devolvido a cada vez → as duas dão 200. Reusar o primeiro token → 401.
- **IT-043**: matrícula inexistente → 401 com a mensagem "Matrícula ou senha incorretas"; matrícula certa e senha errada → a mesma resposta.
- **IT-044**: 5 senhas erradas → a 6ª tentativa, mesmo correta, dá 423 `acesso_bloqueado`.
- **IT-045**: `ativo=false` → login 403 `acesso_desativado`; um access token já emitido → a próxima chamada dá 403.
- **IT-046**: S1 `PUT /supervisao/carteiros/C1/senha {senha: 'Temp@2026'}` → 204; C1 entra com ela, com `senhaTemporaria = true`.
- **IT-047**: S1 redefine a senha de C1 → os refresh tokens de C1 são revogados (o refresh anterior dá 401).
- **IT-048**: `PUT .../senha {senha: '123'}` → 400 `senha_fraca`.
- **IT-049**: um carteiro sem matrícula → 409 `matricula_ausente`.
- **IT-050**: duas redefinições paralelas com senhas A e B → exatamente uma vale, a de maior `updatedAt`, e a outra falha no login.
- **IT-051**: um supervisor da U2 → `PUT /supervisao/carteiros/C1/senha` → 404.

### Transferência

- **IT-053**: o código está no D-01 (C2); C1 captura no D-03 → `TRANSFERENCIA_PENDENTE` com `distritoOrigem: 'D-01'`; o pacote continua no D-01.
- **IT-054**: `confirmar {confirmarTransferencia: true}` → o pacote no D-03, com o mesmo `pacote.id`; evento TRANSFERIDO `{ de: D-01, para: D-03 }`; campos da foto aplicados.
- **IT-055**: `POST /capturas/<id>/descartar` para a transferência pendente → 204; o pacote continua no D-01, sem alteração; a foto é excluída.
- **IT-056**: D-01 LIBERADO → TRANSFERIDO com `payload.origemLiberada = true` e `carteiroAnterior = C2`.
- **IT-057**: o pacote no D-01 com `statusFinal = 'ENTREGUE'` → `RECUSADO/JA_ENTREGUE`.
- **IT-058**: C1 e C3 (D-05) confirmam a transferência do mesmo pacote do D-01 em paralelo → um 200 e um 409 `transferencia_concorrente`; o pacote fica num só distrito.
- **IT-059**: o código está num distrito da U2 → `RECUSADO/OUTRA_UNIDADE`.
- **IT-060**: uma captura com `capturadoEm` de 2 h atrás (offline), o código no D-01 → `TRANSFERENCIA_PENDENTE`, listada em `GET /conferir`.

### Idempotência

- **IT-061**: duas capturas (`capturaId` diferentes) do mesmo código → um pacote; a segunda devolve `atualizado: true`; o contador de capturados em `/hoje` conta pacotes, não capturas.
- **IT-062**: o mesmo `capturaId` enviado duas vezes em sequência → a segunda devolve o mesmo corpo, sem chamar o LLM de novo (o fake conta as chamadas = 1).
- **IT-063**: o mesmo `capturaId` enviado enquanto a primeira está em processamento (o fake LLM com atraso) → a segunda dá 409 `captura_em_processamento`; uma `Captura` PROCESSANDO com `recebidoEm` de mais de 2 min → o reenvio reprocessa.
- **IT-064**: a primeira captura salvou o número "17"; a segunda lê o número com `duvida: true` → `PARA_CONFERIR`; o pacote mantém "17".

### Depois da liberação

- **IT-065**: DistritoDia LIBERADO; captura de um pacote novo com WhatsApp → o evento CRIADO com `distritoLiberado: true` e o whatsapp no payload.
- **IT-066**: DistritoDia ABERTO → CRIADO com `distritoLiberado: false`.
- **IT-067**: LIBERADO; pacote novo sem WhatsApp → CRIADO com `whatsappE164: null`.

### Correção

- **IT-069**: `PATCH /captura/pacotes/:id {complemento: 'CASA B'}` pelo C1, que capturou → 200; um evento ATUALIZADO.
- **IT-070**: `DELETE /captura/pacotes/:id` (origem FOTO, ABERTO) → 204; o pacote é excluído; o evento REMOVIDO com snapshot; a foto excluída.
- **IT-071**: LIBERADO: `PATCH` → 200; `DELETE` → 403 `remocao_nao_permitida`.
- **IT-072**: origem PLANILHA → `DELETE` pelo carteiro → 403 `remocao_nao_permitida`.
- **IT-073**: origem PLANILHA_FOTO, ABERTO → `DELETE` → 204; o pacote continua com os valores do snapshot pré-foto e a origem PLANILHA.
- **IT-074**: LIBERADO; `PATCH {whatsapp}` com outro número → WHATSAPP_ALTERADO com `distritoLiberado: true`.
- **IT-075**: a liberação commitada entre a leitura e o DELETE (a liberação feita na mesma transação de teste antes do delete) → 403 `remocao_nao_permitida`.
- **IT-076**: `PATCH {codigo: 'OY716488072BR'}` → 400 `codigo_nao_editavel_use_nova_captura` (a edição de código acontece só na conferência, IT-026).

### Supervisor

- **IT-077**: S1 `DELETE /supervisao/pacotes/:id` num DistritoDia LIBERADO → 204; o evento REMOVIDO com `payload.distritoLiberado = true`.
- **IT-078**: depois de IT-077, `GET /captura/hoje` como C1 → o pacote fora dos recentes e do contador.
- **IT-079**: um pacote com `statusFinal = 'ENTREGUE'` → 409 `pacote_entregue`.
- **IT-080**: `GET /supervisao/distritos-dia/:id/pacotes` → cada item com `origem` e `codigoDigitado`, e `temFoto: true` para os capturados.
- **IT-081**: `GET /supervisao/pacotes/:id/historico` → os eventos CRIADO e ATUALIZADO em ordem, com os campos antes e depois.
- **IT-082**: `GET /supervisao/pacotes/:id/foto` → 200 `image/jpeg`, com os bytes iguais ao upload.
- **IT-083**: a foto excluída pela retenção → 410 `{ details.fotoExcluidaEm }`.
- **IT-084**: um supervisor da U2 → `GET` do pacote ou da foto da U1 → 404.
- **IT-085**: depois de IT-054, `GET /supervisao/distritos-dia?data=2026-09-30` → o D-01 com `transferenciasSaida[0] = { codigo, para: 'D-03', carteiro: C1, hora }` e o D-03 com a entrada correspondente; `origemLiberada` refletido quando aplicável.
- **IT-086**: o pacote transferido D-01 → D-03 → D-05 → o histórico com 2 TRANSFERIDO em ordem.
- **IT-087**: C1 com 4 capturas PARA_CONFERIR no D-03 → `paraConferir: 4` no D-03; capturas que só existem no aparelho não entram (nenhuma linha no banco).
- **IT-088**: a liberação do D-03 com `paraConferir > 0` (via o endpoint de liberação do núcleo, ou a atualização direta de status na semente, até o monitoramento existir) → permitida.
- **IT-089**: depois de conferir as 4 → `paraConferir: 0`.

### Retenção (worker `foto-retencao`, relógio injetado)

- **IT-090**: um pacote com `statusFinalEm` de 31 dias atrás e foto → o job exclui o arquivo e grava `Captura.fotoExcluidaEm`; os campos do `Pacote` ficam inalterados.
- **IT-091**: uma captura de 91 dias atrás sem `statusFinalEm` → excluída; uma de 89 dias → mantida.
- **IT-092**: `desfazer` e `DELETE` de pacote → a foto não existe no PhotoStore logo depois da resposta.
- **IT-093**: uma captura RECUSADO (DV inválido, outra unidade) → `fotoKey = null` e nenhum arquivo gravado.

### Falhas documentadas do endpoint

- **IT-094**: POST sem a parte `foto` → 400.
- **IT-095**: uma foto de 2,5 MB → 413 `foto_muito_grande`.
- **IT-096**: uma "foto" PNG ou texto → 415 `foto_invalida`.
- **IT-097**: `meta.capturaId` não UUID → 400.
- **IT-098**: um token de papel UNIDADE → 403.
- **IT-099**: `confirmar` numa captura já SALVO → 409 `captura_ja_resolvida`.
- **IT-100**: `confirmar` numa captura de outro carteiro → 404.
- **IT-101**: `descartar` numa captura SALVO → 409 `captura_ja_resolvida`.
- **IT-102**: `GET /captura/cep/00000000` (fake NAO_ENCONTRADO) → 404 `cep_nao_encontrado`.
- **IT-103**: fake INDISPONIVEL → 503 `cep_indisponivel`.
- **IT-104**: `GET /captura/capturas/:id/foto` de outro carteiro → 404.
- **IT-105**: a foto já excluída → 410 `foto_excluida`.
- **IT-106**: `POST /supervisao/distritos {codigo: 'D-03'}` duplicado na U1 → 409.
- **IT-107**: `PUT /supervisao/distritos/:id/dia/2026-09-30/carteiro` com um carteiro da U2 → 400 `carteiro_de_outra_unidade`.
- **IT-108**: `GET /supervisao/distritos-dia` sem `data` → 400.

### Outbox

- **IT-109**: uma captura que atualiza 2 campos e troca o WhatsApp → exatamente 2 eventos (ATUALIZADO e WHATSAPP_ALTERADO) no mesmo commit; ao forçar um erro depois do update do pacote (hook de teste), → nenhum evento e nenhuma mudança no pacote (rollback).
- **IT-110**: todos os eventos novos têm `consumidoEm = null`, e o índice `(consumidoEm, createdAt)` devolve a ordem de criação.

## End-to-End Tests

### Captura na triagem (US-001, US-003, US-004, US-005)

- **E2E-001**: C1 com senha temporária abre `/login` → entra com matrícula e senha → cria uma senha nova → cai em `/carteiro/captura` e vê "D-03" → toca "Fotografar rótulo" (câmera substituída por `rotulo-completo.jpg`) → dispara → a câmera volta pronta com "pacote 2" → aparece "Pacote OY716488072BR salvo no D-03 · desfazer" → os recentes mostram "OY716488072BR · ALINE RODRIGUES" com o chip "Completo" → toca "desfazer" → o item some e o contador volta a 0.

### Conferência (US-006, US-008)

- **E2E-002**: C1 fotografa `rotulo-cep-unico.jpg` (o fake LLM devolve o logradouro com dúvida) → o contador Para conferir mostra 1 → abre a pendência → vê "Confira os dados" com o logradouro destacado → corrige o logradouro e o número → "Salvar no D-03" → a pendência some e o pacote aparece nos recentes como "Completo".

### Sem sinal para online (US-013, US-014)

- **E2E-003**: C1 no app → `context.setOffline(true)` → o indicador "Sem conexão" → fotografa 3 rótulos (fixtures) → "Aguardando envio: 3" → recarrega a página (a fila persiste) → `setOffline(false)` → o contador cai a 0 → 2 salvos aparecem nos recentes e 1 em Para conferir (o fake LLM configurado com dúvida para aquele código).
