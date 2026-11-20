/** Переменная окружения: .env (dev) или process.env (прод). */
export const env = (k: string): string | undefined =>
  process.env[k] ?? (import.meta.env as Record<string, string | undefined>)[k];
