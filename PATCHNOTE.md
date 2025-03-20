# Patch Notes

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