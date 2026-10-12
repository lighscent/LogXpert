# Changelog

## 2.2.1
- Fix `zippedArchive`: one archive per day — date change merges all same-day logs (in order) into a single `<prefix>-<date>.log.gz` instead of one `.gz` per `runNumber`/`maxSize` split; `maxSize` splits stay plain `.log` until day rollover

## 2.2.0
- Fix `zippedArchive`: date change now archives all same-date siblings (`runNumber` runs, `maxSize` splits), not just the current file; `maxSize` rotation gzips the rotated-out file; live files archived on stream close; originals removed
- `runNumber` is now per-day: same day increments, a new day resets to `startAt` (legacy counters continue once, then migrate)

## 2.1.2
- `sanitize: false` opt-out; C1 ANSI handling, spinner and cursor-sequence cleanup

## 2.1.0
- Replace `winston` with a homemade core (`lib/` mini logger + daily rotation, only `dayjs` dependency)
- Per-level console colors with customization and validation; silent console mode
- Split test suites + custom reporter

## 2.0.3
- Dual CJS/ESM types: `export =` + namespace in `index.d.ts`, dedicated `index.d.mts`, `attw` clean, type fixtures + CI checks
- Improved ANSI stripping, `splitBrackets` timestamp formatting, app-name sanitization
- Node support policy (CI on 22/24/26)

## 2.0.2
- Rename `files` options with backward-compatible aliases: `prefix` (`appName`), `filePattern` (`filename`/`pattern`), `datePattern` (`filesName`/`dateFormat`); `%datePattern%` placeholder; `prefix` + `filePattern` now throws instead of silent precedence
- Auto filename prefix from `package.json` name + `appName` override; opt-in `runNumber` suffix
- Default file `datePattern` is now `YYYY_MM_DD`
- License changed to `Apache-2.0`
- Perf: precompiled timestamps, lazy messages; security: ANSI strip, filename escape guard

## 2.0.1
- Replace `moment` with `dayjs`
- Add ESM entry (`main.mjs`) + `index.d.ts` types
- Add `log.setLevel/getLevel`, `LOG_LEVEL` env support
- Add `log.createLogger()` isolated instances and `log.child()`
- Add structured logging: objects, meta, `Error` stacks, `splat`
- `files.filename` option, input validation in `settings()`
- Add tests (`node --test`) and CI

## 1.0.5
- Previous CJS-only release with `moment` + `winston`.
