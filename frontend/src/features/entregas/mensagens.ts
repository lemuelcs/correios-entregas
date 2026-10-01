/** Textos da área Entregas: códigos de erro do backend e rótulos de status. */
import toast from 'react-hot-toast';
import { ApiError, SESSAO_EXPIRADA } from '@/services/api';
import type { Motivo, StatusPacote, StatusQuadro } from './entregas.types';

const ERROS: Record<string, string> = {
  sem_carteiro: 'A rota não tem carteiro hoje. Defina o carteiro do dia no Cadastro.',
  carga_vazia: 'A rota não tem pacotes carregados.',
  nenhum_destinatario: 'Nenhum destinatário será avisado.',
  canal_indisponivel: 'O canal de WhatsApp da unidade não está disponível.',
  somente_leitura: 'Datas anteriores ficam só para consulta.',
  distrito_inativo: 'A rota está desativada.',
  coluna_ausente: 'A planilha não tem uma coluna obrigatória.',
  nenhuma_encomenda: 'A planilha não tem nenhuma encomenda.',
  arquivo_invalido: 'Não foi possível ler o arquivo.',
  limite_linhas: 'A lista passa de 500 pacotes. Divida em partes.',
  formato_nao_suportado: 'Formato não suportado. Envie CSV ou XLSX.',
  arquivo_grande: 'O arquivo passa de 2 MB.',
  arquivo_ausente: 'Escolha um arquivo.',
  entrada_ausente: 'Envie uma planilha ou cole as linhas.',
  codigo_em_uso: 'Esse código de rota já existe nesta unidade.',
  matricula_em_uso: 'Essa matrícula já está cadastrada.',
  whatsapp_em_uso: 'Esse WhatsApp já está cadastrado para outro carteiro.',
  whatsapp_invalido: 'WhatsApp inválido. Use DDD + número, ex.: (61) 99812-4412.',
  telefone_invalido: 'WhatsApp inválido. Use DDD + número, ex.: (61) 99812-4412.',
  sem_ddd: 'Informe o DDD do WhatsApp.',
  nome_longo: 'O nome do ponto tem no máximo 24 caracteres.',
  limite_pontos: 'Já há 10 pontos ativos desse tipo. Desative um antes.',
  alterado_por_outro: 'Outra pessoa alterou este registro. Recarregue e tente de novo.',
  carteiro_invalido: 'Carteiro inválido para esta unidade.',
  carteiro_inativo: 'O carteiro está desativado.',
  distrito_liberado_hoje: 'A rota já foi liberada hoje.',
  unidade_obrigatoria: 'Escolha a unidade.',
  unidade_ref_obrigatoria: 'Informe a referência da unidade no canal compartilhado.',
  unidade_ref_em_uso: 'Essa referência já é usada por outra unidade no canal.',
  base_url_invalida: 'Endereço do Prosio inválido.',
  sem_canal: 'A unidade não tem canal de atendimento configurado.',
  atendimento_indisponivel: 'Atendimento indisponível no momento',
  pacote_entregue: 'Este pacote já consta como entregue.',
  orientacao_vazia: 'Escreva a orientação para o carteiro.',
  orientacao_longa: 'A orientação passa de 300 caracteres.',
  horario_obrigatorio: 'Confirme o horário da saída antes de importar.',
  saida_fora_de_ordem: 'Importe as saídas em ordem: falta a saída anterior.',
  saida_invalida: 'Número de saída inválido.',
  unidade_inativa: 'A unidade está desativada.',
  nao_encontrado: 'Registro não encontrado.',
  'Dados inválidos': 'Confira os campos do formulário.',
  // Auditoria da interface: códigos que apareciam crus na tela.
  data_passada: 'Essa data já passou. A troca do carteiro vale de hoje em diante.',
  data_invalida: 'Data inválida.',
  status_invalido: 'Filtro de status inválido.',
  upload_invalido: 'Não foi possível receber o arquivo. Envie um único CSV ou XLSX.',
  matricula_invalida: 'Matrícula inválida. Ela tem 8 caracteres, com ou sem pontos.',
  distrito_invalido: 'Rota inválida para esta unidade.',
  distrito_em_operacao: 'A rota está em operação hoje. Desative depois do encerramento.',
  carteiro_em_operacao: 'O carteiro está numa rota liberada hoje. Troque o carteiro do dia ou aguarde o encerramento.',
  unidade_invalida: 'Unidade inválida.',
  telefone_obrigatorio: 'Informe o WhatsApp com DDD.',
  nome_obrigatorio: 'Informe o nome.',
  canal_em_uso_compartilhado: 'Mais de uma unidade usa este canal: ele precisa continuar compartilhado.',
  sem_unidade: 'Seu usuário não está vinculado a uma unidade. Fale com a Gestão.',
  'Acesso negado': 'Seu perfil não pode fazer isso.',
  'Erro interno do servidor': 'O servidor não conseguiu concluir. Tente de novo em instantes.',
  'Registro duplicado': 'Já existe um registro com esses dados.',
};

/** Avisos (não bloqueiam) devolvidos em `avisos: [...]` pelas gravações do cadastro. */
export const AVISOS_CADASTRO: Record<string, string> = {
  carteiro_em_dois_distritos: 'Atenção: este carteiro está em mais de uma rota hoje.',
};

// ——— Erros por campo ———

interface IssueZod {
  code?: string;
  path?: Array<string | number>;
  message?: string;
  minimum?: number;
  maximum?: number;
  validation?: string;
  type?: string;
  received?: string;
}

/** Mensagem em português de um problema de validação do Zod (o servidor responde em inglês). */
function mensagemDoIssue(i: IssueZod): string {
  if (i.code === 'too_small') {
    if (i.type === 'string') return i.minimum === 1 ? 'Preencha este campo.' : `Use ao menos ${i.minimum} caracteres.`;
    return `O mínimo é ${i.minimum}.`;
  }
  if (i.code === 'too_big') return i.type === 'string' ? `Use no máximo ${i.maximum} caracteres.` : `O máximo é ${i.maximum}.`;
  if (i.code === 'invalid_string') {
    if (i.validation === 'email') return 'E-mail inválido.';
    if (i.validation === 'url') return 'Endereço inválido. Comece com https://';
    if (i.validation === 'uuid') return 'Escolha uma opção da lista.';
    return 'Formato inválido.';
  }
  if (i.code === 'invalid_type') return i.received === 'undefined' || i.received === 'null' ? 'Preencha este campo.' : 'Valor inválido.';
  if (i.code === 'invalid_enum_value') return 'Escolha uma opção da lista.';
  if (i.code === 'custom' && i.message && !/^invalid/i.test(i.message)) return i.message;
  return 'Valor inválido.';
}

/**
 * Erros por campo de uma resposta da API: os problemas do Zod (`Dados inválidos`, com
 * `details: [{path, message}]`) e os erros de regra que apontam o campo (`details.campo`).
 * Chave = nome do campo no corpo enviado (ex.: `whatsapp`, `endereco.cep` → `cep`).
 */
export function errosPorCampo(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  const det = err.detalhes;
  const erros: Record<string, string> = {};
  if (Array.isArray(det)) {
    for (const bruto of det as IssueZod[]) {
      const campo = bruto?.path?.length ? String(bruto.path[bruto.path.length - 1]) : null;
      if (campo && !erros[campo]) erros[campo] = mensagemDoIssue(bruto);
    }
    return erros;
  }
  if (det && typeof det === 'object' && 'campo' in det && typeof (det as { campo: unknown }).campo === 'string') {
    erros[(det as { campo: string }).campo] = mensagemDeErro(err);
  }
  return erros;
}

/** Um código de erro da API (`sem_carteiro`), e não um texto legível. */
function pareceCodigo(texto: string): boolean {
  return /^[a-z0-9]+(_[a-z0-9]+)+$/.test(texto) || /^HTTP \d+$/.test(texto);
}

/**
 * Mensagem legível de um erro da API. Ordem: o texto que o servidor mandou para este caso
 * (`details.mensagem`), o texto do código, o próprio `error` quando já é uma frase, e por
 * fim o genérico. Um código sem tradução nunca aparece cru na tela.
 */
export function mensagemDeErro(err: unknown, padrao = 'Não foi possível concluir. Tente de novo.'): string {
  if (err instanceof ApiError) {
    const det = (err.detalhes && typeof err.detalhes === 'object' && !Array.isArray(err.detalhes) ? err.detalhes : undefined) as
      | { mensagem?: unknown; coluna?: string }
      | undefined;
    if (err.codigo === 'coluna_ausente' && det?.coluna) return `A planilha não tem a coluna “${det.coluna}”.`;
    if (typeof det?.mensagem === 'string' && det.mensagem.trim()) return det.mensagem.trim();
    if (ERROS[err.codigo]) return ERROS[err.codigo];
    return err.codigo && !pareceCodigo(err.codigo) ? err.codigo : padrao;
  }
  // `fetch` sem rede lança TypeError ("Failed to fetch"): nada disso serve na tela.
  if (err instanceof TypeError) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  if (err instanceof Error && err.message) return err.message;
  return padrao;
}

/** Mostra o erro num toast (nada quando a sessão expirou: a tela já foi ao login). */
export function avisarErro(err: unknown, padrao?: string): void {
  if (err instanceof ApiError && err.codigo === SESSAO_EXPIRADA) return;
  toast.error(mensagemDeErro(err, padrao), { id: mensagemDeErro(err, padrao) });
}

export function ehSessaoExpirada(err: unknown): boolean {
  return err instanceof ApiError && err.codigo === SESSAO_EXPIRADA;
}

// ——— Status do distrito (quadro) ———

export const STATUS_QUADRO: Record<StatusQuadro, { rotulo: string; classe: string }> = {
  PENDENTE_UPLOAD: { rotulo: 'Pendente de upload', classe: 'text-ce-pendente bg-ce-pendente-bg' },
  DADOS_CARREGADOS: { rotulo: 'Dados carregados', classe: 'text-ce-carregado bg-ce-carregado-bg' },
  LIBERADO: { rotulo: 'Liberado', classe: 'text-ce-liberado bg-ce-liberado-bg' },
  EM_ENTREGA: { rotulo: 'Em entrega', classe: 'text-ce-entrega bg-ce-entrega-bg' },
  CONCLUIDO: { rotulo: 'Concluído', classe: 'text-ce-concluido bg-ce-concluido-bg' },
};

export const ORDEM_STATUS_QUADRO: StatusQuadro[] = ['PENDENTE_UPLOAD', 'DADOS_CARREGADOS', 'LIBERADO', 'EM_ENTREGA', 'CONCLUIDO'];

// ——— Status do pacote ———

export const STATUS_PACOTE: Record<StatusPacote, { rotulo: string; classe: string; ponto: string }> = {
  SEM_WHATSAPP: { rotulo: 'Sem WhatsApp', classe: 'text-ce-pendente bg-ce-pendente-bg', ponto: 'bg-ce-seg-semwa' },
  AGUARDANDO_LIBERACAO: { rotulo: 'Aguardando liberação', classe: 'text-ce-carregado bg-ce-carregado-bg', ponto: 'bg-ce-seg-whats' },
  AGENDADO: { rotulo: 'Agendado', classe: 'text-ce-liberado bg-ce-liberado-bg', ponto: 'bg-ce-azul' },
  NAO_ENVIADO: { rotulo: 'Não enviado', classe: 'text-ce-erro bg-ce-erro-bg', ponto: 'bg-ce-erro' },
  ENVIADO: { rotulo: 'Enviado', classe: 'text-ce-liberado bg-ce-liberado-bg', ponto: 'bg-ce-seg-enviado' },
  LIDO: { rotulo: 'Lido', classe: 'text-ce-liberado bg-ce-lido-bg', ponto: 'bg-ce-seg-lido' },
  INTERAGINDO: { rotulo: 'Interagindo', classe: 'text-ce-interagindo bg-ce-interagindo-bg', ponto: 'bg-ce-seg-interagindo' },
  INSUCESSO: { rotulo: 'Insucesso', classe: 'text-ce-erro bg-ce-erro-bg', ponto: 'bg-ce-seg-insucesso' },
  ENTREGUE: { rotulo: 'Entregue', classe: 'text-ce-concluido bg-ce-concluido-bg', ponto: 'bg-ce-seg-entregue' },
};

/** Ordem dos segmentos do cartão e dos filtros da lista (do fim para o começo da jornada). */
export const ORDEM_STATUS_PACOTE: StatusPacote[] = [
  'ENTREGUE', 'INSUCESSO', 'INTERAGINDO', 'LIDO', 'ENVIADO', 'AGENDADO', 'NAO_ENVIADO', 'AGUARDANDO_LIBERACAO', 'SEM_WHATSAPP',
];

// ——— Prévia da carga ———

export const MOTIVOS: Record<Motivo, { rotulo: string; nota: string }> = {
  faltam_campos: { rotulo: 'Faltam campos', nota: 'Preencha o código e o nome' },
  codigo_invalido: { rotulo: 'Código inválido', nota: 'Confira o código no pacote' },
  digito_invalido: { rotulo: 'Dígito verificador não confere', nota: 'Confira o código no pacote' },
  duplicado_planilha: { rotulo: 'Duplicado na planilha', nota: 'O mesmo código aparece antes na lista' },
  ja_no_distrito: { rotulo: 'Já está em outra rota hoje', nota: 'Remova daqui ou da outra rota' },
  sem_ddd: { rotulo: 'WhatsApp para corrigir', nota: 'Número sem DDD' },
  whatsapp_invalido: { rotulo: 'WhatsApp para corrigir', nota: 'Número inválido' },
};

export const AVISOS_PLANILHA: Record<string, string> = {
  varias_abas: 'A planilha tem várias abas: só a primeira foi lida.',
  sem_coluna_whatsapp: 'A planilha não tem coluna de WhatsApp: ninguém será avisado.',
  sem_coluna_endereco: 'A planilha não tem colunas de endereço.',
};

/** `+5561998124412` → `(61) 99812-4412`. Outros formatos voltam como estão. */
export function formatarWhatsapp(e164: string | null | undefined): string {
  if (!e164) return '—';
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function formatarEndereco(e: { logradouro: string | null; numero: string | null; complemento?: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep?: string | null; enderecoTexto: string | null }): string {
  if (e.enderecoTexto && !e.logradouro) return e.enderecoTexto;
  const rua = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(' ');
  const cidade = [e.cidade, e.uf].filter(Boolean).join('-');
  const cep = e.cep ? `${e.cep.slice(0, 5)}-${e.cep.slice(5)}` : null;
  return [rua, e.bairro, cidade, cep].filter(Boolean).join(' · ') || '—';
}

export function formatarHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d).replace(':', 'h');
}

export function formatarDataLonga(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatarDataCurta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
