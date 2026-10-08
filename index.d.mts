import log from './index.js';

export default log;

export const settings: typeof log.settings;
export const setLevel: typeof log.setLevel;
export const getLevel: typeof log.getLevel;
export const child: typeof log.child;
export const close: typeof log.close;
export const createLogger: typeof log.createLogger;
export const error: typeof log.error;
export const warn: typeof log.warn;
export const info: typeof log.info;
export const debug: typeof log.debug;

export type LogLevel = log.LogLevel;
export type ConsoleOptions = log.ConsoleOptions;
export type FilesOptions = log.FilesOptions;
export type RunNumberOptions = log.RunNumberOptions;
export type LogSettingsOptions = log.LogSettingsOptions;
export type ChildLogger = log.ChildLogger;
export type LogXpert = log.LogXpert;
