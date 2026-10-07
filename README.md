# LogXpert

LogXpert is a powerful logging library for Node.js that provides easy-to-use logging methods with colorful formatted output and optional file logging support.

## Installation

```sh
npm install logxpert
```

## Usage

CommonJS:

```js
const log = require('logxpert');

log('general message');
log.error('error message');
log.warn('warn message');
log.info('info with meta', { user: 1 });
log.debug({ structured: 'object' });
log.error(new Error('boom'));
```

ESM:

```js
import log from 'logxpert';

log.info('hello');
```

Set level (`LOG_LEVEL` env also respected):

```js
log.setLevel('info');
console.log(log.getLevel());
```

Isolated instances and child loggers:

```js
const { createLogger } = require('logxpert');
const apiLog = createLogger({ level: 'info' });
apiLog.info('isolated');

const child = log.child({ service: 'api' });
child.info('child message');
```

### File output & console timestamp

```js
log.settings({
  level: 'debug',
  console: {
    enableTimestamp: true,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss',
    timestampPrefix: '',
    timestampSuffix: '',
    colorize: true
  },
  files: {
    folder: 'logs',
    filename: 'application-%DATE%.log',
    filesName: 'YYYY-MM-DD',
    maxFile: '14d',
    maxSize: '20m',
    zippedArchive: false
  }
});
```

Close file transports on shutdown:

```js
log.close();
```

## API Reference

- **log(message, ...meta):** info level.
- **log.error/warn/info/debug/http/verbose/silly(message, ...meta)**
- **log.log(level, message, ...meta)**
- **log.settings({ console, files, level })**
- **log.setLevel(level) / log.getLevel()**
- **log.createLogger(options):** independent instance.
- **log.child(meta):** child logger with bound context.
- **log.close():** remove file transport.

Console options: `enableTimestamp`, `timestampFormat`, `timestampPrefix`, `timestampSuffix`, `colorize`, `level`.
Files options: `folder`, `filename`, `filesName`/`datePattern`, `maxFile`/`maxFiles`, `maxSize`, `zippedArchive`, `level`.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
