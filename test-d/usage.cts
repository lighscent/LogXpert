import log = require('logxpert');

const level: log.LogLevel = 'debug';
log.setLevel(level);
log.info('hello', { user: 1 });
log.debug({ structured: 'object' });
log.error(new Error('boom'));
log.debug(() => 'lazy');
log.settings({ files: { folder: 'logs', prefix: 'api' } });
log.settings({ console: { colors: { debug: 'gray', silly: false } } });
log.settings({ files: { filePattern: 'app-%datePattern%.log' } });
const child: log.ChildLogger = log.child({ service: 'api' });
child.warn('careful');
const inst: log.LogXpert = log.createLogger({ level: 'info' });
inst.close();
log.close();
