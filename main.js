const fs = require('fs');
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

/**
 * @typedef {Object} ConsoleOptions
 * @property {boolean} [enableTimestamp=true] - Enable or disable timestamp in console logs.
 * @property {string} [timestampFormat='YYYY-MM-DD HH:mm:ss'] - Format for the timestamp.
 * @property {string} [timestampPrefix=''] - String to prefix the timestamp.
 * @property {string} [timestampSuffix=''] - String to suffix the timestamp.
 */

/**
 * @typedef {Object} FilesOptions
 * @property {string} [folder='logs'] - Directory where log files will be stored.
 * @property {string} [filesName='YYYY-MM-DD'] - Date pattern used in the log file name.
 * @property {string} [maxFile='14d'] - Maximum file retention time.
 * @property {string} [maxSize='20m'] - Maximum file size per log file.
 * @property {boolean} [zippedArchive=false] - Whether to archive logs as zip.
 */

/**
 * @typedef {Object} LogSettingsOptions
 * @property {ConsoleOptions} [console] - Options for customizing console output.
 * @property {FilesOptions} [files] - Options for configuring file logging.
 */

// Custom format for logger (handles the timestamp if present)
const customFormat = format.printf(({ timestamp, level, message }) => {
    return timestamp ? `${timestamp} [${level}]: ${message}` : `[${level}]: ${message}`;
});

// Create a default console transport with timestamp enabled by default
let consoleTransport = new transports.Console({
    format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    )
});

// Create a logger with the default console transport
const logger = createLogger({
    level: 'debug',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [consoleTransport]
});

// Reference to file transport (added via settings)
let fileTransport;

/**
 * Configures logging settings for both console and file transports.
 * 
 * @param {LogSettingsOptions} options - The settings for console and file logging.
 * @example
 * // Customize console timestamp and enable file logging
 * log.settings({ 
 *   console: { 
 *     enableTimestamp: true,
 *     timestampFormat: 'YYYY-MM-DD HH:mm:ss',
 *     timestampPrefix: '[START] ',
 *     timestampSuffix: ' [END]'
 *   },
 *   files: { 
 *     folder: 'logs', 
 *     filesName: 'YYYY-MM-DD', 
 *     maxFile: '14d', 
 *     maxSize: '20m', 
 *     zippedArchive: false 
 *   }
 * });
 */
function applySettings(options = {}) {
    // Update console transport if configuration is provided
    if (options.console) {
        const enableTimestamp = options.console.enableTimestamp !== undefined ? options.console.enableTimestamp : true;
        const timestampFormat = options.console.timestampFormat || 'YYYY-MM-DD HH:mm:ss';
        const timestampPrefix = options.console.timestampPrefix || '';
        const timestampSuffix = options.console.timestampSuffix || '';

        // Remove the current console transport
        logger.remove(consoleTransport);

        // Create new console transport based on the provided options
        consoleTransport = new transports.Console({
            format: enableTimestamp
                ? format.combine(
                    format.colorize(),
                    format.timestamp({ format: timestampFormat }),
                    // Append prefix and suffix to the timestamp value
                    format((info) => {
                        if (info.timestamp) {
                            info.timestamp = timestampPrefix + info.timestamp + timestampSuffix;
                        }
                        return info;
                    })(),
                    customFormat
                )
                : format.combine(
                    format.colorize(),
                    customFormat
                )
        });
        logger.add(consoleTransport);
    }

    // Enable file logging if options.files is provided
    if (options.files) {
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

/**
 * Logs a general message using the info level.
 * 
 * @param {string} message - Message to be logged.
 */
function log(message) {
    logger.info(message);
}

/**
 * Logs an error message.
 * @param {string} message - Error message.
 */
log.error = function (message) {
    logger.error(message);
};

/**
 * Logs a warning message.
 * @param {string} message - Warning message.
 */
log.warn = function (message) {
    logger.warn(message);
};

/**
 * Logs an informational message.
 * @param {string} message - Informational message.
 */
log.info = function (message) {
    logger.info(message);
};

/**
 * Logs a debug message.
 * @param {string} message - Debug message.
 */
log.debug = function (message) {
    logger.debug(message);
};

// Expose the settings function for configuring file logging and console output customization
log.settings = applySettings;

module.exports = log;