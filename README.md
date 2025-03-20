# LogXpert

LogXpert is a powerful logging library for Node.js that provides easy-to-use logging methods with colorful formatted output and optional file logging support. This documentation explains the installation and usage of the module.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Logging](#basic-logging)
  - [Advanced Logging: File Output](#advanced-logging-file-output)
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

### Advanced Logging: File Output

LogXpert supports file logging using [winston](https://github.com/winstonjs/winston) and [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file). To enable file logging, you can configure it with custom settings via the `log.settings()` method. If not configured, only console logging is active.

Example configuration to enable file logging:

```js
const log = require('logxpert');

log.settings({ 
    files: { 
        folder: 'logs', 
        filesName: 'YYYY-MM-DD_HH:mm:ss', 
        maxFile: '14d', 
        maxSize: '20m', 
        zippedArchive: true 
    }
});
```

### API Reference

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

- **log.settings(options: Object):**  
  Configures the file logging options. Accepts an object with a `files` property.  
  **Options**:
  
  - `folder` (string): Directory where log files will be stored (default: `'logs'`).
  - `filesName` (string): Date pattern used in the log file name (default: `'YYYY-MM-DD_HH:mm:ss'`).
  - `maxFile` (string): Maximum file retention (default: `'14d'`).
  - `maxSize` (string): Maximum size per log file (default: `'20m'`).
  - `zippedArchive` (boolean): Whether to archive the logs in zipped format (default: `false`).

## Additional Information

- [French Version](./README.fr.md)
- [Patch Notes](./PATCHNOTE.md)

## License

This project is licensed under the MIT License.