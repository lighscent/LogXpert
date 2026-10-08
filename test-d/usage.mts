import log, { info, settings, createLogger } from 'logxpert';
import type { LogLevel, FilesOptions, LogXpert } from 'logxpert';

const level: LogLevel = 'info';
log.setLevel(level);
info('hello');
settings({ level });
const files: FilesOptions = { folder: 'logs', prefix: 'api', runNumber: { padding: 3 } };
settings({ files });
const inst: LogXpert = createLogger({ level: 'debug' });
inst.close();
log.close();
