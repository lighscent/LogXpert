# Patch Notes

## v0.3.2

- Changed the default `filesName` pattern from `'YYYY-MM-DD_HH:mm:ss'` to `'YYYY-MM-DD'` so that log filenames do not include hours, minutes, or seconds.

## v0.3.1

- Ensure the log folder is created if it does not exist to prevent `ENOENT` errors.

## v0.3.0

- Added file logging support using winston and winston-daily-rotate-file.
- Introduced `log.settings()` to configure file logging.
- Updated configuration options to use `filesName` instead of the previous property name.
- Default settings:
  - Folder: `logs`
  - Date pattern (`filesName`): `YYYY-MM-DD_HH:mm:ss`
  - Maximum file retention: `14d`
  - Maximum file size: `20m`
  - `zippedArchive`: default is `false` unless provided.
- Console logging remains with colorful formatted output.