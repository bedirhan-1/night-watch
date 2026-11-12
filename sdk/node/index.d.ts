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
  dsn?: string;
  /** production, staging, development... Verilmezse NODE_ENV. */
  environment?: string;
  /** Sürüm, örn. 1.0.2. Verilmezse NIGHTWATCH_RELEASE ya da package.json sürümü. */
  release?: string;
  /** Kaydın "proje alanı", örn. api. */
  service?: string;
  /** Varsayılan: DSN varsa açık. */
  enabled?: boolean;
  /** Yakalanmayan hataları ve reddedilen promise'leri yakala. Varsayılan: true. */
  captureUnhandled?: boolean;
  /** Yakalanmayan hatadan sonra süreci kapat (Node'un varsayılanı). Varsayılan: true. */
  exitOnUncaught?: boolean;
  /** Aynı hatayı bu kadar saniye içinde tekrar gönderme. Varsayılan: 60. */
  dedupeSeconds?: number;
  /** Gönderim zaman aşımı. Varsayılan: 3000 ms. */
  timeoutMs?: number;
  /** Göndermeden önce olayı değiştir; null dönerse gönderilmez. */
  beforeSend?: (event: Event, error: unknown) => Event | null;
  debug?: boolean;
}

export interface CaptureContext {
  level?: Level;
  fingerprint?: string;
  service?: string;
  request?: unknown;
  user?: { id?: string | number; email?: string };
  tags?: Record<string, string | number>;
  extra?: unknown;
}

export function init(options?: Options): Required<Omit<Options, 'dsn'>>;
export function captureException(error: unknown, context?: CaptureContext): string | null;
export function captureMessage(message: string, level?: Level, context?: CaptureContext): string | null;
export function flush(timeoutMs?: number): Promise<boolean>;
export function setUser(user: { id?: string | number; email?: string } | null): void;
export function setTag(key: string, value: string | number | null): void;
export function expressErrorHandler(options?: { minStatus?: number }): (err: any, req: any, res: any, next: (err?: any) => void) => void;
