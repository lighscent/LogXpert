# Troubleshooting

Behaviors that look like bugs but aren't — symptoms, causes and fixes.

<details>
<summary>Only <code>warn</code>/<code>error</code> lines show up in my Pterodactyl console</summary>

**Symptom:** the panel shows only `warn`/`error` lines while the log file contains everything (`debug`, `info`, ...).

**Cause:** LogXpert routes `warn` and `error` to `stderr` and everything else to `stdout` (same convention as `console.warn` vs `console.log`). Some Pterodactyl eggs / Docker setups only forward `stderr` to the panel, swallowing `stdout`. The file transport is unaffected, which is why the file stays complete.

**Quick diagnostic** (run in the container):

```js
log.info('STDOUT-TEST');
log.error('STDERR-TEST');
```

If only `STDERR-TEST` appears in the panel, `stdout` never reaches it — the issue is on the hosting side (egg startup command, Docker log driver), not in LogXpert. Check the egg's startup command for redirections (`>`, `2>`, pipes).

**Fix:** route everything to `stderr`:

```js
log.settings({ console: { stderrLevels: 'all' } });
```

Other useful values: `['error']` (only errors to `stderr`), `[]` (everything to `stdout`). Invalid level names throw.

</details>