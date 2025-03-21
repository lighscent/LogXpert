const fs = require('fs');
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

// Custom format for logger
const customFormat = format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}]: ${message}`;
});

// Create a logger with console transport only
const logger = createLogger({
    level: 'debug',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                customFormat
            )
        })
    ]
});

// Reference to file transport (added via settings)
let fileTransport;

// Settings function to enable file logging
// Example usage:
// log.settings({ files: { folder: 'logs', filesName: 'YYYY-MM-DD', maxFile: '14d', maxSize: '20m', zippedArchive: false }})
function applySettings(options = {}) {
    if (options.files) {
        // Set defaults if not provided
        const folder = options.files.folder || 'logs';
        const datePattern = options.files.filesName || 'YYYY-MM-DD';
        const maxFiles = options.files.maxFile || '14d';
        const maxSize = options.files.maxSize || '20m';
        const zippedArchive = options.files.zippedArchive !== undefined ? options.files.zippedArchive : false;

        // Ensure the log folder exists
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        // Remove existing file transport if it exists
        if (fileTransport) {
            logger.remove(fileTransport);
        }

        // Create a new daily rotate file transport with provided/default settings
        fileTransport = new transports.DailyRotateFile({
            filename: `${folder}/application-%DATE%.log`,
            datePattern,
            zippedArchive,
            maxSize,
            maxFiles
        });

        logger.add(fileTransport);
    }
}

// Create a simplified logging interface
function log(message) {
    logger.info(message);
}

log.error = function (message) {
    logger.error(message);
};

log.warn = function (message) {
    logger.warn(message);
};

log.info = function (message) {
    logger.info(message);
};

log.debug = function (message) {
    logger.debug(message);
};

// Expose the settings function for configuring file logging
log.settings = applySettings;

module.exports = log;