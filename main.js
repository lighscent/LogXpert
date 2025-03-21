const fs = require('fs');
const moment = require('moment'); // Add moment as a dependency: npm install moment
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

/**
 * Helper function to format the timestamp while preserving bracket characters.
 * This function replaces all occurrences of '[' and ']' with temporary placeholders
 * so that Moment.js does not treat them as escapes. After formatting, it restores them.
 *
 * @param {string} fmt - The user-defined format string.
 * @returns {string} - The formatted timestamp with any decoration brackets preserved.
 *
 * Example:
 *   Input: "Voici la date et l'heure: [YYYY-MM-DD HH:mm:ss] - "
 *   Might output: "Voici la date et l'heure: [2025-03-21 15:30:45] - "
 */
function formatCustomTimestamp(fmt) {
    // Replace square brackets with placeholders
    const temp = fmt.replace(/\[/g, '__LB__').replace(/\]/g, '__RB__');
    // Let moment replace tokens in the modified string
    const formatted = moment().format(temp);
    // Restore the original bracket characters
    return formatted.replace(/__LB__/g, '[').replace(/__RB__/g, ']');
}

/**
 * @typedef {Object} ConsoleOptions
 * @property {boolean} [enableTimestamp=true] - Enable or disable timestamp in console logs.
 * @property {string} [timestampFormat='YYYY-MM-DD HH:mm:ss'] - Custom format for the timestamp.
 *   You can include any decoration characters ([], (), {}) without interference.
 *   For example:
 *     - "Voici la date et l'heure: [YYYY-MM-DD HH:mm:ss] - "
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

// Create a default console transport with timestamp enabled using the default format
let consoleTransport = new transports.Console({
    format: format.combine(
        format.colorize(),
        format.timestamp({
            format: () => moment().format(defaultConsoleFormat)
        }),
        customFormat
    )
});

// Create a logger with the default console transport
const logger = createLogger({
    level: 'debug',
    format: format.combine(
        format.timestamp({
            format: () => moment().format(defaultConsoleFormat)
        }),
        customFormat
    ),
    transports: [consoleTransport]
});

// Reference to file transport (added via settings)
let fileTransport;

/**
 * Configures logging settings for both console and file transports.
 *
 * @param {LogSettingsOptions} options - The settings for both console and file logging.
 * @example
 * // Example: Fully custom console timestamp that preserves decoration,
 * // and enabling file logging.
 * log.settings({ 
 *   console: { 
 *     enableTimestamp: true,
 *     // You can now include brackets or parentheses as decoration:
 *     timestampFormat: "Voici la date et l'heure: [YYYY-MM-DD HH:mm:ss] - "
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
        const timestampFormat = options.console.timestampFormat || defaultConsoleFormat;

        // Remove the current console transport
        logger.remove(consoleTransport);

        // Create new console transport based on the provided options.
        // Here, we use our helper function to let tokens be replaced while preserving any decoration.
        consoleTransport = new transports.Console({
            format: enableTimestamp
                ? format.combine(
                    format.colorize(),
                    format.timestamp({
                        format: () => formatCustomTimestamp(timestampFormat)
                    }),
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

        // Create a new daily-rotate file transport with provided/default settings
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

/**
 * Logs an error message.
 * @param {string} message - The error message.
 */
log.error = function (message) {
    logger.error(message);
};

/**
 * Logs a warning message.
 * @param {string} message - The warning message.
 */
log.warn = function (message) {
    logger.warn(message);
};

/**
 * Logs an informational message.
 * @param {string} message - The informational message.
 */
log.info = function (message) {
    logger.info(message);
};

/**
 * Logs a debug message.
 * @param {string} message - The debug message.
 */
log.debug = function (message) {
    logger.debug(message);
};

// Expose the settings function for configuring both file logging and console output
log.settings = applySettings;

module.exports = log;