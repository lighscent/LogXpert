# Patch Notes

## v1.0.1

- Improved support for fully custom console timestamp formats using Moment.js. Users can now supply completely custom formats (e.g., "This is the time: [YYYY-MM-DD HH:mm:ss] - " or "date: YYYY-MM-DD heure: HH:mm:ss - ") that correctly render dynamic dates and literal text.

## v1.0.0

- **Stability & Support:** This release is now the LTS version, providing a stable API for long-term production use.
- **Enhanced Configuration:** Added advanced configuration for console timestamps, including customizable format, prefix, and suffix.
- **File Logging Improvements:** Updated file logging settings and ensured the log folder is automatically created if it doesn't exist.
- **Documentation:** Updated README and API references for clarity and completeness.
- **Backward Compatibility:** Retained all features from previous versions, including methods for general, error, warning, info, and debug logging.

## Previous Versions

### v0.3.2
- Changed the default `filesName` pattern from `'YYYY-MM-DD_HH:mm:ss'` to `'YYYY-MM-DD'`.

### v0.3.1
- Ensured the log folder is created if it does not exist to prevent `ENOENT` errors.

### v0.3.0
- Added file logging support using winston and winston-daily-rotate-file.
- Introduced `log.settings()` to configure file logging.
- Updated configuration options to use `filesName` instead of the previous property name.