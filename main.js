const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    white: "\x1b[37m"
};

function colorText(text, color) {
    return `${color}${text}${colors.reset}`;
}

function log(message) {
    console.log(colorText(message, colors.white));
}

log.error = function (message) {
    console.error(colorText(`Error: ${message}`, colors.red));
};

log.warn = function (message) {
    console.warn(colorText(`Warn: ${message}`, colors.yellow));
};

log.info = function (message) {
    console.info(colorText(`Info: ${message}`, colors.cyan));
};

log.debug = function (message) {
    console.debug(colorText(`Debug: ${message}`, colors.magenta));
};

module.exports = log;