# Changelog

## 2.0.0
- Replace `moment` with `dayjs`
- Add ESM entry (`main.mjs`) + `index.d.ts` types
- Add `log.setLevel/getLevel`, `LOG_LEVEL` env support
- Add `log.createLogger()` isolated instances and `log.child()`
- Add structured logging: objects, meta, `Error` stacks, `splat`
- `files.filename` option, input validation in `settings()`
- Fix license to `GPL-3.0-only`, add `exports`, `files`, `engines`
- Add tests (`node --test`) and CI

## 1.0.5
- Previous CJS-only release with `moment` + `winston`.
