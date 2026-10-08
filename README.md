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

// Lazy: evaluated only if the level is enabled (cheap debug in prod)
log.debug(() => JSON.stringify(hugeObject));
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
    // Default when omitted: `<package.json name>-%DATE%.log`
    // with datePattern YYYY_MM_DD (e.g. logxpert-2026_10_07.log),
    // fallback to application-%DATE%.log.
    // Explicit filename always wins; appName overrides the auto prefix.
    filename: 'logxpert-%DATE%.log',
    appName: 'my-service',
    filesName: 'YYYY_MM_DD',
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
Files options: `folder`, `filename`, `appName`, `runNumber`, `filesName`/`datePattern`, `maxFile`/`maxFiles`, `maxSize`, `zippedArchive`, `level`.

`runNumber` is disabled by default. Set `runNumber: true` to append an
incrementing run counter persisted in `<folder>/ .<prefix>.run`
(e.g. `application-2026_10_07-1.log`, then `-2.log` on next start).
Customize with `runNumber: { separator: '-', padding: 3, startAt: 1 }`
(e.g. `separator: '_'` + `padding: 3` gives `app-2026_10_07_001.log`).

Security notes: string messages are stripped of ANSI escape sequences and
C0 control characters (except `\n`, `\t`); `files.filename` values escaping
the log folder (`..`, absolute paths) are rejected.

## License

Apache-2.0. See [LICENSE](LICENSE).
