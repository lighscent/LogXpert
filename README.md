# LogXpert

LogXpert is a powerful logging library for Node.js that provides easy-to-use logging methods with colorful formatted output and optional file logging support

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Logging](#basic-logging)
  - [Advanced Logging: File Output & Custom Console Timestamp](#advanced-logging-file-output--custom-console-timestamp)
- [API Reference](#api-reference)
- [Additional Information](#additional-information)
- [License](#license)

## Installation

You can install LogXpert using npm:

```sh
npm install logxpert
```

## Usage

### Basic Logging

Import LogXpert in your project and use it to log messages:

```js
const log = require('logxpert');

// Log a general message
log('This is a general log message.');

// Log an error message
log.error('This is an error message.');

// Log a warning message
log.warn('This is a warning message.');

// Log an informational message
log.info('This is an informational message.');

// Log a debug message
log.debug('This is a debug message.');
```

### Advanced Logging: File Output & Custom Console Timestamp

LogXpert supports file logging using [winston](https://github.com/winstonjs/winston) and [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file).

Example configuration:

```js
const log = require('logxpert');

log.settings({ 
    console: { 
        enableTimestamp: true,
        // You can now include decoration characters as desired:
        timestampFormat: "This is the date: [YYYY-MM-DD HH:mm:ss] - ",
        timestampPrefix: '',
        timestampSuffix: ''
    },
    files: { 
        folder: 'logs', 
        filesName: 'YYYY-MM-DD', 
        maxFile: '14d', 
        maxSize: '20m', 
        zippedArchive: false
    }
});
```

## API Reference

- **log(message: string):**  
  Logs a general message using the `info` level.

- **log.error(message: string):**  
  Logs an error message.

- **log.warn(message: string):**  
  Logs a warning message.

- **log.info(message: string):**  
  Logs an informational message.

- **log.debug(message: string):**  
  Logs a debug message.

- **log.settings(options: object):**  
  Configures file logging and console output options.  
  **Console Options:**
  - `enableTimestamp` (boolean): Enable/disable timestamp (default: `true`).
  - `timestampFormat` (string): Format for the timestamp including any desired literal text or decoration (default: `'YYYY-MM-DD HH:mm:ss'`).
  - `timestampPrefix` (string): Prefix for the timestamp.
  - `timestampSuffix` (string): Suffix for the timestamp.
  
  **Files Options:**
  - `folder` (string): Directory where log files will be stored (default: `'logs'`).
  - `filesName` (string): Date pattern for the log file name (default: `'YYYY-MM-DD'`).
  - `maxFile` (string): Maximum file retention (default: `'14d'`).
  - `maxSize` (string): Maximum size per log file (default: `'20m'`).
  - `zippedArchive` (boolean): Archive logs in zip format (default: `false`).

## License

This project is licensed under GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.