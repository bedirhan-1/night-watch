export type Level = 'critical' | 'error' | 'warning' | 'info';

export interface Event {
  title: string;
  message: string;
  level: Level;
  environment: 'local' | 'staging' | 'production';
  service: string;
  fingerprint: string;
}

export interface Options {
  /** Night Watch'taki hata gönderme adresi. Verilmezse NIGHTWATCH_DSN okunur. */
  dsn?: string | undefined;
  /** production, staging, development... Verilmezse NODE_ENV. */
  environment?: string | undefined;
  /** Sürüm, örn. 1.0.2. Verilmezse NIGHTWATCH_RELEASE ya da package.json sürümü. */
  release?: string | undefined;
  /** Kaydın "proje alanı", örn. api. */
  service?: string | undefined;
  /** Varsayılan: DSN varsa açık. */
  enabled?: boolean | undefined;
  /** Yakalanmayan hataları ve reddedilen promise'leri yakala. Varsayılan: true. */
  captureUnhandled?: boolean | undefined;
  /** Yakalanmayan hatadan sonra süreci kapat (Node'un varsayılanı). Varsayılan: true. */
  exitOnUncaught?: boolean | undefined;
  /** Aynı hatayı bu kadar saniye içinde tekrar gönderme. Varsayılan: 60. */
  dedupeSeconds?: number | undefined;
  /** Gönderim zaman aşımı. Varsayılan: 3000 ms. */
  timeoutMs?: number | undefined;
  /** Göndermeden önce olayı değiştir; null dönerse gönderilmez. */
  beforeSend?: (event: Event, error: unknown) => Event | null | undefined;
  debug?: boolean | undefined;
}

export interface CaptureContext {
  level?: Level | undefined;
  fingerprint?: string | undefined;
  service?: string | undefined;
  request?: unknown | undefined;
  user?: { id?: string | number; email?: string } | undefined;
  tags?: Record<string, string | number> | undefined;
  extra?: unknown | undefined;
}

export function init(options?: Options): Required<Omit<Options, 'dsn'>>;
export function captureException(error: unknown, context?: CaptureContext): string | null;
export function captureMessage(message: string, level?: Level, context?: CaptureContext): string | null;
export function flush(timeoutMs?: number): Promise<boolean>;
export function setUser(user: { id?: string | number; email?: string } | null): void;
export function setTag(key: string, value: string | number | null): void;
export function expressErrorHandler(options?: { minStatus?: number }): (err: any, req: any, res: any, next: (err?: any) => void) => void;
