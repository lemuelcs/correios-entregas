/**
 * logger.ts
 * Wrapper de logging compatível com a interface Pino usada pelo módulo de comunicação.
 */
const logger = {
  info: (data: any, msg?: string) => console.log(`[INFO] ${msg || ''}`, typeof data === 'string' ? data : JSON.stringify(data)),
  warn: (data: any, msg?: string) => console.warn(`[WARN] ${msg || ''}`, typeof data === 'string' ? data : JSON.stringify(data)),
  error: (data: any, msg?: string) => console.error(`[ERROR] ${msg || ''}`, typeof data === 'string' ? data : JSON.stringify(data)),
  debug: (data: any, msg?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${msg || ''}`, typeof data === 'string' ? data : JSON.stringify(data));
    }
  },
};

export default logger;
