/**
 * Textos e contas da tela das saídas (Monitoramento › Carregar Dados, ADR-019):
 * rótulos de status da rota, motivos de descarte e as abas do dia.
 */
import type { CartaoRota, DescarteSaida, MotivoSaida, QuadroSaidas, SaidaDoDia, StatusQuadro } from './entregas.types';
import { formatarHora } from './mensagens';

/** Status da rota no quadro. Não existe "pendente de upload": a rota só aparece quando um arquivo a trouxe. */
export type StatusRota = Exclude<StatusQuadro, 'PENDENTE_UPLOAD'>;

export const STATUS_ROTA: Record<StatusRota, { rotulo: string; classe: string }> = {
  DADOS_CARREGADOS: { rotulo: 'Carregada', classe: 'text-ce-carregado bg-ce-carregado-bg' },
  LIBERADO: { rotulo: 'Liberada', classe: 'text-ce-liberado bg-ce-liberado-bg' },
  EM_ENTREGA: { rotulo: 'Em entrega', classe: 'text-ce-entrega bg-ce-entrega-bg' },
  CONCLUIDO: { rotulo: 'Concluída', classe: 'text-ce-concluido bg-ce-concluido-bg' },
};

export const ORDEM_STATUS_ROTA: StatusRota[] = ['DADOS_CARREGADOS', 'LIBERADO', 'EM_ENTREGA', 'CONCLUIDO'];

export function statusDaRota(r: Pick<CartaoRota, 'status'>): StatusRota {
  return r.status === 'PENDENTE_UPLOAD' ? 'DADOS_CARREGADOS' : r.status;
}

const MOTIVOS_SAIDA: Record<MotivoSaida, string> = {
  faltam_campos: 'Falta o código ou o nome do destinatário',
  codigo_invalido: 'Código de rastreio inválido',
  digito_invalido: 'Dígito verificador do código não confere',
  duplicado_planilha: 'Código repetido no arquivo',
  ja_no_distrito: 'O pacote já está em outra rota hoje',
  sem_ddd: 'WhatsApp sem DDD',
  whatsapp_invalido: 'WhatsApp inválido',
  sem_rota: 'Linha sem rota',
  rota_invalida: 'Código de rota inválido',
  rota_inativa: 'Rota desativada no Cadastro',
  rota_liberada: 'Rota já liberada: os dados dela não mudam mais por arquivo',
  rota_em_outra_saida: 'A rota já foi carregada em outra saída hoje',
  limite_rota: 'A rota passou de 500 pacotes',
};

/** Motivo do descarte, em palavras (com a rota ou a saída quando o servidor informa). */
export function motivoDoDescarte(d: Pick<DescarteSaida, 'motivo' | 'detalhe'>): string {
  if (d.motivo === 'ja_no_distrito' && d.detalhe) return `O pacote já está na rota ${d.detalhe} hoje`;
  if (d.motivo === 'rota_em_outra_saida' && d.detalhe) return `A rota já foi carregada na Saída ${d.detalhe} hoje`;
  if (d.motivo === 'rota_liberada') return 'Rota já liberada: para incluir o pacote, use “Adicionar pacotes” na rota';
  return MOTIVOS_SAIDA[d.motivo] ?? d.motivo;
}

/** Nome da rota no Cadastro, quando diz algo além do código ("Rota 501" é o nome automático). */
export function nomeDaRota(r: Pick<CartaoRota, 'codigo' | 'nome'>): string | null {
  const nome = r.nome.trim();
  return !nome || nome.toLowerCase() === `rota ${r.codigo}`.toLowerCase() ? null : nome;
}

export const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

/** Aba do quadro: uma saída (`numero`) ou as cargas fora de saída (`'sem'`). */
export type AbaSaida = number | 'sem';

export interface AbaDoDia {
  aba: AbaSaida;
  titulo: string;
  sub: string;
  importada: boolean;
  /** Saídas com esse número (uma por unidade; várias só na visão de todas as unidades). */
  saidas: SaidaDoDia[];
  rotas: CartaoRota[];
}

/**
 * Abas do dia: uma por saída importada, a próxima ("Aguardando arquivo e
 * horário") e, quando existem, as rotas fora de saída.
 */
export function abasDoDia(q: QuadroSaidas): AbaDoDia[] {
  const numeros = [...new Set(q.saidas.map((s) => s.numero))].sort((a, b) => a - b);
  const abas: AbaDoDia[] = numeros.map((numero) => {
    const saidas = q.saidas.filter((s) => s.numero === numero);
    const rotas = q.rotas.filter((r) => r.saidaNumero === numero);
    const horarios = [...new Set(saidas.map((s) => s.horario))];
    const ultima = saidas.map((s) => s.importadaEm).sort().at(-1);
    return {
      aba: numero,
      titulo: `Saída ${numero}${horarios.length === 1 ? ` · ${horarios[0]}` : ''}`,
      sub: q.agregado
        ? `${plural(saidas.length, 'unidade', 'unidades')} · ${plural(rotas.length, 'rota', 'rotas')}`
        : `Importada às ${formatarHora(ultima)} · ${plural(rotas.length, 'rota', 'rotas')}`,
      importada: true,
      saidas,
      rotas,
    };
  });
  if (!q.somenteLeitura) {
    abas.push({ aba: q.proximaSaida, titulo: `Saída ${q.proximaSaida}`, sub: 'Aguardando arquivo e horário', importada: false, saidas: [], rotas: [] });
  }
  const semSaida = q.rotas.filter((r) => r.saidaNumero === null);
  if (semSaida.length > 0) {
    abas.push({ aba: 'sem', titulo: 'Sem saída', sub: `${plural(semSaida.length, 'rota', 'rotas')} fora de uma saída`, importada: true, saidas: [], rotas: semSaida });
  }
  return abas;
}

/** Rotas que a liberação em lote leva: carregadas, com carteiro e com alguém a avisar. */
export function rotasLiberaveis(rotas: CartaoRota[]): CartaoRota[] {
  return rotas.filter((r) => statusDaRota(r) === 'DADOS_CARREGADOS' && !r.semCarteiro && r.cargaId !== null && r.comWhatsapp > 0);
}
