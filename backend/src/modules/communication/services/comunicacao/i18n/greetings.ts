/**
 * greetings.ts
 * Saudacao contextual baseada no horario/timezone.
 */
import { t } from './messages';

export function getGreeting(locale: string, timezone: string): string {
  const h = parseInt(
    new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
  );
  if (h >= 5 && h < 12) return t(locale, 'greeting_morning');
  if (h >= 12 && h < 18) return t(locale, 'greeting_afternoon');
  return t(locale, 'greeting_evening');
}
