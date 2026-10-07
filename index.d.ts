export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

export interface ConsoleOptions {
  enableTimestamp?: boolean;
  timestampFormat?: string;
  timestampPrefix?: string;
  timestampSuffix?: string;
  colorize?: boolean;
  level?: LogLevel;
}

export interface FilesOptions {
  folder?: string;
  filesName?: string;
  datePattern?: string;
  filename?: string;
  appName?: string;
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
