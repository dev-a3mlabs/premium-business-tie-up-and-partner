const time = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => console.log(`[${time()}] INFO:`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${time()}] WARN:`, ...args),
  error: (...args: unknown[]) => console.error(`[${time()}] ERROR:`, ...args),
};
