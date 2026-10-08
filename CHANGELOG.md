# Changelog

## 2.1.1
- Add `console.stderrLevels` stream routing with `'all'` shortcut (e.g. Pterodactyl panels that only show `stderr`)
- Add `TROUBLESHOOTING.md` for known gotchas

## 2.1.0
- Replace `winston`/`winston-daily-rotate-file` with a built-in engine (`lib/mini.js`, `lib/rotate.js`); only `dayjs` remains as dependency
- Split `main.js` into `lib/` modules (`time`, `format`, `sanitize`, `files`); facade stays in `main.js`
- Add `console.colors` per-level customization
- Add silent console mode (`console: false` / `enabled: false`)
- Custom test reporter, tests split per area (`logger`/`console`/`files`/`lib`)

## 2.0.3
- Fix TS types for dual CJS/ESM: `export =` + namespace in `index.d.ts`, dedicated `index.d.mts` for the ESM entry (`attw` clean), TS consumer fixtures (`test-d/`)
- Node support policy (`NODE_SUPPORT.md`), CI on 22/24/26 with paths filter and least-privilege permissions
- Harden ANSI stripping and app-name sanitization, bracket-aware timestamp splitter

## 2.0.2
- Auto filename prefix from `package.json` name (`prefix`, legacy `appName`)
- Opt-in `runNumber` filename suffix with customizable format
- Rename `files` options with backward-compatible aliases: `filePattern` (`filename`/`pattern`), `datePattern` (`filesName`/`dateFormat`); `%datePattern%` placeholder; `prefix` + `filePattern` now throws instead of silent precedence
- Default file `datePattern` is now `YYYY_MM_DD`
- Faster timestamps (precompiled formatter, native fast path) and lazy messages
- Strip ANSI escapes and control characters from messages; reject filenames escaping the log folder
- License changed to `Apache-2.0`

## 2.0.0
- Replace `moment` with `dayjs`
- Add ESM entry (`main.mjs`) + `index.d.ts` types
- Add `log.setLevel/getLevel`, `LOG_LEVEL` env support
- Add `log.createLogger()` isolated instances and `log.child()`
- Add structured logging: objects, meta, `Error` stacks, `splat`
- `files.filename` option, input validation in `settings()`
- Fix license to `GPL-3.0-only`, add `exports`, `files`, `engines`
- Add tests (`node --test`) and CI

## 2.0.1
- First tagged GitHub release; same code as 2.0.0 (release pipeline test)

## 1.0.5
- Previous CJS-only release with `moment` + `winston`.
