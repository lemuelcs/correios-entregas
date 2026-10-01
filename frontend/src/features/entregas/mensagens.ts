/** Textos da área Entregas: códigos de erro do backend e rótulos de status. */
import toast from 'react-hot-toast';
import { ApiError, SESSAO_EXPIRADA } from '@/services/api';
import type { Motivo, StatusPacote, StatusQuadro } from './entregas.types';

const ERROS: Record<string, string> = {
  sem_carteiro: 'O distrito não tem carteiro hoje. Defina o carteiro do dia no Cadastro.',
  carga_vazia: 'O distrito não tem pacotes carregados.',
  nenhum_destinatario: 'Nenhum destinatário será avisado.',
  canal_indisponivel: 'O canal de WhatsApp da unidade não está disponível.',
  somente_leitura: 'Datas anteriores ficam só para consulta.',
  distrito_inativo: 'O distrito está desativado.',
  coluna_ausente: 'A planilha não tem uma coluna obrigatória.',
  nenhuma_encomenda: 'A planilha não tem nenhuma encomenda.',
  arquivo_invalido: 'Não foi possível ler o arquivo.',
  limite_linhas: 'A lista passa de 500 pacotes. Divida em partes.',
  formato_nao_suportado: 'Formato não suportado. Envie CSV ou XLSX.',
  arquivo_grande: 'O arquivo passa de 2 MB.',
  arquivo_ausente: 'Escolha um arquivo.',
  entrada_ausente: 'Envie uma planilha ou cole as linhas.',
  codigo_em_uso: 'Esse código de distrito já existe nesta unidade.',
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
  distrito_liberado_hoje: 'O distrito já foi liberado hoje.',
  unidade_obrigatoria: 'Escolha a unidade.',
  unidade_ref_obrigatoria: 'Informe a referência da unidade no canal compartilhado.',
  unidade_ref_em_uso: 'Essa referência já é usada por outra unidade no canal.',
  base_url_invalida: 'Endereço do Prosio inválido.',
  sem_canal: 'A unidade não tem canal de atendimento configurado.',
  atendimento_indisponivel: 'Atendimento indisponível no momento',
  pacote_entregue: 'Este pacote já consta como entregue.',
  orientacao_vazia: 'Escreva a orientação para o carteiro.',
  orientacao_longa: 'A orientação passa de 300 caracteres.',
  nao_encontrado: 'Registro não encontrado.',
  'Dados inválidos': 'Confira os campos do formulário.',
};

/** Mensagem legível de um erro da API (ou genérico). */
export function mensagemDeErro(err: unknown, padrao = 'Não foi possível concluir. Tente de novo.'): string {
  if (err instanceof ApiError) {
    const det = err.detalhes as { mensagem?: string; coluna?: string } | undefined;
    if (err.codigo === 'coluna_ausente' && det?.coluna) return `A planilha não tem a coluna “${det.coluna}”.`;
    return ERROS[err.codigo] ?? det?.mensagem ?? err.codigo ?? padrao;
  }
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
  ja_no_distrito: { rotulo: 'Já está em outro distrito hoje', nota: 'Remova daqui ou do outro distrito' },
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
