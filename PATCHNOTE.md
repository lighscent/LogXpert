# Patch Notes

## v1.0.3

- **Timestamp Disabling Fix:** Corrected the issue where setting `enableTimestamp: false` still printed a timestamp. Timestamps are now completely disabled in the console output when requested.
- **Custom Timestamp Decoration Fix:** Resolved formatting glitches when using custom timestamp formats with decorative characters (e.g., square brackets) so that formats like `"This is the date: [YYYY-MM-DD HH:mm:ss] - "` render correctly.
- All previous enhancements and features from v1.0.2 LTS remain intact.

## v1.0.2 

- **Custom Timestamp Decoration Preservation:** Introduced a helper function in the logging module to allow any decoration characters (such as [], (), {}) in the `timestampFormat` to be preserved as supplied by the user. This improvement lets you use formats like `"This is the date: [YYYY-MM-DD HH:mm:ss] - "` or `"date: YYYY-MM-DD heure: HH:mm:ss - "` without Moment.js automatically escaping the brackets.
- **Other Enhancements and Bug Fixes:** All previous improvements and features from v1.0.1 LTS remain intact.


## v1.0.1

- Improved support for fully custom console timestamp formats using Moment.js. Users can now supply completely custom formats (e.g., "This is the time: [YYYY-MM-DD HH:mm:ss] - " or "date: YYYY-MM-DD heure: HH:mm:ss - ") that correctly render dynamic dates and literal text.

## v1.0.0

- **Stability & Support:** This release is now the LTS version, providing a stable API for long-term production use.
- **Enhanced Configuration:** Added advanced configuration for console timestamps, including customizable format, prefix, and suffix.
- **File Logging Improvements:** Updated file logging settings and ensured the log folder is automatically created if it doesn't exist.
- **Documentation:** Updated README and API references for clarity and completeness.
- **Backward Compatibility:** Retained all features from previous versions, including methods for general, error, warning, info, and debug logging.

### v0.3.2
- Changed the default `filesName` pattern from `'YYYY-MM-DD_HH:mm:ss'` to `'YYYY-MM-DD'`.

### v0.3.1
- Ensured the log folder is created if it does not exist to prevent `ENOENT` errors.

### v0.3.0
- Added file logging support using winston and winston-daily-rotate-file.
- Introduced `log.settings()` to configure file logging.
- Updated configuration options to use `filesName` instead of the previous property name.