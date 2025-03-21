const fs = require('fs');
const moment = require('moment'); // Add moment as a dependency: npm install moment
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

/**
 * Helper function to format the timestamp while preserving square brackets.
 * It replaces "[" with "%%LB%%" and "]" with "%%RB%%" to prevent Moment.js from
 * treating the contents as literal text. After formatting, the placeholders are restored.
 *
 * @param {string} fmt - The user-defined format string.
 * @returns {string} - The formatted timestamp with square brackets preserved.
 *
 * Example:
 *   Input: "This is the date: [YYYY-MM-DD HH:mm:ss] - "
 *   Might output: "This is the date: [2025-03-21 15:30:45] - "
 */
function formatCustomTimestamp(fmt) {
    // Use a placeholder that's unlikely to be parsed by moment
    const temp = fmt.replace(/\[/g, '%%LB%%').replace(/\]/g, '%%RB%%');
    const formatted = moment().format(temp);
    // Restore the original square brackets
    return formatted.replace(/%%LB%%/g, '[').replace(/%%RB%%/g, ']');
}

/**
 * @typedef {Object} ConsoleOptions
 * @property {boolean} [enableTimestamp=true] - Enable or disable timestamp in console logs.
 * @property {string} [timestampFormat='YYYY-MM-DD HH:mm:ss'] - Custom format for the timestamp.
 *   You can include any decoration characters ([], (), {}) without interference.
 *   For example:
 *     - "This is the date: [YYYY-MM-DD HH:mm:ss] - "
 *     - "date: YYYY-MM-DD heure: HH:mm:ss - "
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

// Custom format for logger output
const customFormat = format.printf(({ timestamp, level, message }) => {
    return timestamp ? `${timestamp} [${level}]: ${message}` : `[${level}]: ${message}`;
});

// Default console timestamp format
const defaultConsoleFormat = 'YYYY-MM-DD HH:mm:ss';

// Create the global logger. Its default format will be overridden by the console transport settings.
const logger = createLogger({
    level: 'debug',
    format: format.combine(
        format.timestamp({ format: () => moment().format(defaultConsoleFormat) }),
        customFormat
    )
});

// Create default console transport (will be replaced via settings)
let consoleTransport = new transports.Console({
    format: format.combine(
        format.colorize(),
        format.timestamp({ format: () => moment().format(defaultConsoleFormat) }),
        customFormat
    )
});
logger.add(consoleTransport);

// Reference to file transport (added via settings)
let fileTransport;

/**
 * Configures logging settings for both console and file transports.
 *
 * @param {LogSettingsOptions} options - The settings for both console and file logging.
 * @example
 * // Example: Fully custom console timestamp that preserves decorational brackets,
 * // and enabling file logging.
 * log.settings({ 
 *   console: { 
 *     enableTimestamp: true,
 *     timestampFormat: "This is the date: [YYYY-MM-DD HH:mm:ss] - "
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
    if (options.console) {
        const enableTimestamp = options.console.enableTimestamp !== undefined ? options.console.enableTimestamp : true;
        const timestampFormat = options.console.timestampFormat || defaultConsoleFormat;

        // Remove the current console transport
        logger.remove(consoleTransport);

        // Build the console format based on the enableTimestamp flag.
        const consoleFormat = enableTimestamp
            ? format.combine(
                format.colorize(),
                format.timestamp({ format: () => formatCustomTimestamp(timestampFormat) }),
                customFormat
            )
            : format.combine(
                format((info) => { delete info.timestamp; return info; })(),
                format.colorize(),
                customFormat
            );

        consoleTransport = new transports.Console({
            format: consoleFormat
        });
        logger.add(consoleTransport);
    }

    if (options.files) {
        const folder = options.files.folder || 'logs';
        const datePattern = options.files.filesName || 'YYYY-MM-DD';
        const maxFiles = options.files.maxFile || '14d';
        const maxSize = options.files.maxSize || '20m';
        const zippedArchive = options.files.zippedArchive !== undefined ? options.files.zippedArchive : false;

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        if (fileTransport) {
            logger.remove(fileTransport);
        }

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
 * @param {string} message - The message to be logged.
 */
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

// Expose the settings function for configuring both file logging and console output.
log.settings = applySettings;

module.exports = log;