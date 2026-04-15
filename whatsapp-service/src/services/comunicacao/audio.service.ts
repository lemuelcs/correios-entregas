/**
 * audio.service.ts
 * Adapter para transcrição de áudio no WPP-PILOT
 * Reutiliza o audio-transcription.service.ts (Groq Whisper + OpenAI fallback)
 */
import { evolutionClient } from './evolution.client';
import logger from '../../shared/utils/logger';

/**
 * Transcreve uma mensagem de áudio recebida pelo WhatsApp.
 * 1. Obtém base64 do áudio via Evolution API
 * 2. Converte para buffer e passa para o serviço de transcrição
 */
export async function transcribeAudioMessage(
  instanceName: string,
  messageId: string,
  remoteJid: string,
  language: string = 'pt',
): Promise<string | null> {
  try {
    // 1. Obter base64 do áudio via Evolution API
    const base64 = await evolutionClient.getBase64FromMediaMessage(
      instanceName,
      messageId,
      remoteJid,
    );

    if (!base64) {
      logger.warn({ instanceName, messageId }, '[WPP-PILOT] Áudio sem base64 — ignorando');
      return null;
    }

    // 2. Converter base64 para buffer
    const audioBuffer = Buffer.from(base64, 'base64');

    // 3. Transcrever usando Groq (primário) ou OpenAI (fallback)
    const result = await transcribeFromBuffer(audioBuffer, language);

    if (!result || !result.text) {
      logger.warn({ instanceName, messageId }, '[WPP-PILOT] Transcrição retornou vazio');
      return null;
    }

    logger.info(
      { instanceName, messageId, provider: result.provider, textLength: result.text.length },
      '[WPP-PILOT] Áudio transcrito com sucesso',
    );

    return result.text;
  } catch (err) {
    logger.error(
      { err: (err as Error).message, instanceName, messageId },
      '[WPP-PILOT] Erro ao transcrever áudio',
    );
    return null;
  }
}

/**
 * Transcreve áudio a partir de um buffer, usando Groq (primário) ou OpenAI (fallback).
 * Adaptação direta do audio-transcription.service.ts para aceitar buffer.
 */
async function transcribeFromBuffer(
  audioBuffer: Buffer,
  language: string,
): Promise<{ text: string; provider: string; model: string } | null> {
  // Tentar Groq primeiro
  if (process.env.GROQ_API_KEY) {
    try {
      const axios = (await import('axios')).default;
      const FormData = (await import('form-data')).default;

      const formData = new FormData();
      formData.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', language);
      formData.append('response_format', 'json');

      const response = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          timeout: 60000,
        },
      );

      return {
        text: response.data.text || '',
        provider: 'groq',
        model: 'whisper-large-v3-turbo',
      };
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[WPP-PILOT] Groq transcription falhou, tentando OpenAI');
    }
  }

  // Fallback: OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const file = new File([new Uint8Array(audioBuffer)], 'audio.ogg', { type: 'audio/ogg' });

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language,
        response_format: 'json',
      });

      return {
        text: transcription.text || '',
        provider: 'openai',
        model: 'whisper-1',
      };
    } catch (err) {
      logger.error({ err: (err as Error).message }, '[WPP-PILOT] OpenAI transcription também falhou');
    }
  }

  return null;
}
