/**
 * llm-adapter.service.ts
 * Bridge entre o WPP-PILOT e o llm.service.ts existente
 * Permite usar LLM como fallback quando keywords não batem
 */
import { db } from '../../types/prisma-extended';
import { getGlobalWppPilotConfig } from '../../utils/config-loader';
import logger from '../../shared/utils/logger';

// System prompts para o agente WPP-PILOT
const DRIVER_SYSTEM_PROMPT = `Você é o assistente virtual da {dspName}, DSP parceiro da Amazon.
Você está conversando com um motorista parceiro via WhatsApp.

REGRAS:
- Responda de forma curta e direta (máximo 3 frases)
- Use linguagem informal e amigável
- Foque em: rotas, entregas, pagamentos, insucessos, disponibilidade
- NÃO invente dados — se não souber, oriente a consultar o app ou o gestor
- NÃO discuta política, religião ou assuntos pessoais

ESCALAÇÃO — responda com [ESCALAR:motivo] no início se:
- Motorista pedir "falar com humano" ou similar
- Dúvida financeira complexa (multa, disputa, acidente)
- Sentimento negativo repetido ou reclamação grave
- Após 2 tentativas sem resolver a dúvida`;

const RECIPIENT_SYSTEM_PROMPT = `Você é o assistente de entregas da {dspName}.
Está conversando com um destinatário que aguarda uma entrega.

REGRAS:
- Responda de forma curta e educada (máximo 3 frases)
- Foque em: status de entrega, reagendamento, avaliação
- NÃO revele dados do motorista (nome, telefone, localização exata)
- Se não souber o status, informe que o destinatário receberá notificação quando o motorista sair

ESCALAÇÃO — responda com [ESCALAR:motivo] no início se:
- Destinatário pedir para falar com atendente
- Reclamação grave sobre entrega`;

interface LlmAdapterResponse {
  text: string;
  escalate?: boolean;
  reason?: string;
}

export const wppPilotLlmAdapter = {
  async processUnmatchedMessage(
    dspId: string,
    dspNome: string,
    participantType: 'CARTEIRO' | 'DESTINATARIO',
    phone: string,
    content: string,
    motoristaId?: string,
    _timezone?: string,
  ): Promise<LlmAdapterResponse | null> {
    // 1. Verificar se LLM está habilitado para este DSP
    const config = await getGlobalWppPilotConfig().catch(() => null);

    if (!config?.llmEnabled) return null;

    const llmConfig = config.llmConfig as Record<string, unknown> | null;
    if (!llmConfig || !llmConfig.provider) return null;

    // 2. Montar system prompt
    const systemPrompt = participantType === 'CARTEIRO'
      ? DRIVER_SYSTEM_PROMPT.replaceAll('{dspName}', dspNome)
      : RECIPIENT_SYSTEM_PROMPT.replaceAll('{dspName}', dspNome);

    // 3. Buscar histórico recente (últimas 10 mensagens)
    const history = await _getRecentHistory(phone, dspId, 10);

    // 4. Montar mensagens para o LLM
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content },
    ];

    // 5. Chamar o LLM
    try {
      const provider = (llmConfig.provider as string) || 'openai';
      const model = (llmConfig.model as string) || 'gpt-4o-mini';
      const temperature = (llmConfig.temperature as number) ?? 0.3;
      const maxTokens = (llmConfig.maxTokens as number) ?? 512;

      // Chamar diretamente os providers usando o llmService internals
      // Como o llmService.complete() precisa de tenantConfigId, vamos usar
      // a abordagem de chamar diretamente com config do env
      const response = await _callLlm(provider, model, messages, temperature, maxTokens);

      if (!response) return null;

      // 6. Parsear escalation
      const parsed = _parseEscalation(response.content);

      // 7. Registrar uso (async, best-effort)
      _logUsage(dspId, provider, model, response.inputTokens, response.outputTokens, response.latencyMs).catch(() => {});

      return {
        text: parsed.text,
        escalate: parsed.escalate,
        reason: parsed.reason,
      };
    } catch (err) {
      logger.error({ err: (err as Error).message, dspId }, '[WPP-PILOT-LLM] Erro ao chamar LLM');
      return null;
    }
  },
};

// ── Helpers internos ─────────────────────────────────────────────

async function _getRecentHistory(
  phone: string,
  unidadeId: string,
  limit: number,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  try {
    const session = await db.wppPilotSession.findFirst({
      where: {
        phone,
        unidadeId,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!session) {
      return [];
    }

    const messages = await db.wppPilotMessage.findMany({
      where: { sessionId: session.id, content: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { direction: true, content: true },
    });

    return messages
      .reverse()
      .map((m) => ({
        role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content ?? '',
      }));
  } catch {
    return [];
  }
}

async function _callLlm(
  provider: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
): Promise<{ content: string; inputTokens: number; outputTokens: number; latencyMs: number } | null> {
  const start = Date.now();

  try {
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model,
        messages: messages as any,
        temperature,
        max_tokens: maxTokens,
      });
      return {
        content: response.choices[0]?.message?.content || '',
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        latencyMs: Date.now() - start,
      };
    }

    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
      const nonSystem = messages.filter((m) => m.role !== 'system');
      const response = await anthropic.messages.create({
        model,
        system: systemMsg,
        messages: nonSystem.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        max_tokens: maxTokens,
        temperature,
      });
      const textBlock = response.content.find((b) => b.type === 'text');
      return {
        content: textBlock?.type === 'text' ? textBlock.text : '',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs: Date.now() - start,
      };
    }

    if (provider === 'google' && process.env.GOOGLE_AI_API_KEY) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
      const genModel = genAI.getGenerativeModel({ model });
      const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
      const lastMsg = messages[messages.length - 1];
      const chat = genModel.startChat({
        systemInstruction: systemMsg,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      });
      const result = await chat.sendMessage(lastMsg.content);
      return {
        content: result.response.text(),
        inputTokens: result.response.usageMetadata?.promptTokenCount || 0,
        outputTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
        latencyMs: Date.now() - start,
      };
    }

    return null;
  } catch (err) {
    logger.error({ err: (err as Error).message, provider, model }, '[WPP-PILOT-LLM] Provider error');
    return null;
  }
}

function _parseEscalation(text: string): { text: string; escalate: boolean; reason?: string } {
  const match = text.match(/^\[ESCALAR?:(.+?)\]/i) || text.match(/^\[ESCALATE:(.+?)\]/i);
  if (match) {
    return {
      text: text.replace(match[0], '').trim(),
      escalate: true,
      reason: match[1].trim(),
    };
  }
  return { text, escalate: false };
}

const COST_TABLE: Record<string, { input: number; output: number }> = {
  'openai:gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai:gpt-4o': { input: 2.50, output: 10.00 },
  'openai:gpt-4.1': { input: 2.00, output: 8.00 },
  'openai:gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'openai:gpt-4.1-nano': { input: 0.10, output: 0.40 },
  'anthropic:claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'anthropic:claude-haiku-4-5': { input: 1.00, output: 5.00 },
  'google:gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'google:gemini-2.5-pro': { input: 1.25, output: 10.00 },
};

async function _logUsage(
  dspId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
): Promise<void> {
  const key = `${provider}:${model}`;
  const cost = COST_TABLE[key] || { input: 0, output: 0 };
  const costUsd = (inputTokens / 1_000_000) * cost.input + (outputTokens / 1_000_000) * cost.output;

  // Buscar configId via unidadeId
  const wppConfig = await getGlobalWppPilotConfig().catch(() => null);

  if (!wppConfig) return;

  await db.llmUsageLog.create({
    data: {
      configId: wppConfig.id,
      provider,
      model,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs,
      useCase: 'wpp_pilot_bot',
      success: true,
    },
  });
}
