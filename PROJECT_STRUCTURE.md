# Project Structure — LogXpert

```
LogXpert/
├── main.js                       # CJS entry point: facade (createLoggerInstance, transports, singleton)
├── main.mjs                      # ESM entry point: re-exports main.js
├── index.d.ts                    # CJS types (export = + namespace, required for CJS compat)
├── index.d.mts                   # ESM types
│
├── lib/                          # Homemade core (no runtime deps except dayjs)
│   ├── mini.js                   # Levels, MiniLogger, console transport, colors, transport error guard
│   ├── rotate.js                 # Daily file rotation: maxSize/maxFiles/gzip
│   ├── files.js                  # File options normalization (prefix, filePattern, runNumber…)
│   ├── time.js                   # Timestamps (precompiled)
│   ├── format.js                 # Log line formatting
│   ├── sanitize.js               # Sanitization (ANSI stripping, traversal guard)
│   ├── event.js                  # Event normalization (normalizeInput: Error/sanitize) + LogEvent factory
│   └── context.js                # Context enrichment (withContext: child loggers)
│
├── test/                         # Tests (node --test, explicit files)
│   ├── logger.test.js            # Facade / public API
│   ├── console.test.js           # Console transport (colors, stderrLevels, silent)
│   ├── files.test.js             # File transport (rotation, runNumber, archives)
│   ├── lib.test.js               # Direct lib/* modules
│   ├── helpers.js                # Shared helpers (not a test file)
│   └── reporter.js               # Custom reporter
│
├── test-d/                       # Type fixtures (nodenext strict, import 'logxpert')
│   ├── usage.cts / usage.mts
│   └── tsconfig.json
│
├── scripts/
│   └── downloads-graph.js        # Generates assets/npm-downloads.{svg,json} (native fetch, zero deps)
│
├── assets/                       # npm download chart + stats (auto-generated)
│   ├── npm-downloads.svg
│   └── npm-downloads.json
│
├── demo/
│   └── reporter.demo.test.js      # Reporter demo (`npm run test:demo`)
│
├── .github/workflows/
│   ├── ci.yml                    # Tests + types + attw (Node 22/24/26, paths-filtered)
│   ├── release.yml               # Auto-release when package.json version changes
│   └── downloads-graph.yml       # Regenerates chart/JSON (daily 4am UTC cron + manual)
│
├── x/                            # Versioned test folder (do not delete)
├── src/ / dist/                  # Empty folders (reserved)
│
├── README.md / CHANGELOG.md / NODE_SUPPORT.md / TODO.md / ROADMAP.md
├── CODE_OF_CONDUCT.md / LICENSE (Apache-2.0)
└── package.json
```
