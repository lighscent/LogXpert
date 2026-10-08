export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

export interface ConsoleOptions {
  enableTimestamp?: boolean;
  timestampFormat?: string;
  timestampPrefix?: string;
  timestampSuffix?: string;
  colorize?: boolean;
  level?: LogLevel;
}

export interface RunNumberOptions {
  enabled?: boolean;
  separator?: string;
  padding?: number;
  startAt?: number;
}

export interface FilesOptions {
  folder?: string;
  /** Preferred: date format for %DATE%. */
  datePattern?: string;
  /** @deprecated Use datePattern. */
  filesName?: string;
  dateFormat?: string;
  /** Preferred: filename template containing %DATE%. */
  filePattern?: string;
  pattern?: string;
  /** @deprecated Use filePattern. */
  filename?: string;
  /** Preferred: filename prefix used when no pattern is given. */
  prefix?: string;
  /** @deprecated Use prefix. */
  appName?: string;
  runNumber?: boolean | RunNumberOptions;
  maxFile?: string;
  maxFiles?: string;
  maxSize?: string;
  zippedArchive?: boolean;
  level?: LogLevel;
}

export interface LogSettingsOptions {
  console?: ConsoleOptions;
  files?: FilesOptions;
  level?: LogLevel;
}

export interface ChildLogger {
  error(message: unknown, ...meta: unknown[]): void;
  warn(message: unknown, ...meta: unknown[]): void;
  info(message: unknown, ...meta: unknown[]): void;
  debug(message: unknown, ...meta: unknown[]): void;
  log(level: LogLevel, message: unknown, ...meta: unknown[]): void;
}

export interface LogXpert {
  (message: unknown, ...meta: unknown[]): void;
  error(message: unknown, ...meta: unknown[]): void;
  warn(message: unknown, ...meta: unknown[]): void;
  info(message: unknown, ...meta: unknown[]): void;
  debug(message: unknown, ...meta: unknown[]): void;
  http(message: unknown, ...meta: unknown[]): void;
  verbose(message: unknown, ...meta: unknown[]): void;
  silly(message: unknown, ...meta: unknown[]): void;
  log(level: LogLevel, message: unknown, ...meta: unknown[]): void;
  settings(options?: LogSettingsOptions): void;
  setLevel(level: LogLevel): void;
  getLevel(): string;
  child(meta?: Record<string, unknown>): ChildLogger;
  close(): void;
  createLogger(options?: LogSettingsOptions): LogXpert;
}

declare const log: LogXpert;
export default log;
