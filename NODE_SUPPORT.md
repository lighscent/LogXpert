# Node.js Support Policy

## Minimum and recommended versions

| Node.js | Status (upstream) | LogXpert support |
| --- | --- | --- |
| 18 (Hydrogen) | EOL since March 2025 | Minimum supported (`engines: >=18`), best effort only |
| 20 (Iron) | EOL since March 2026 | Best effort only |
| 22 (Jod) | LTS | **Recommended minimum** |
| 24 (Krypton) | LTS (latest) | Fully supported |
| 26 | Current | Fully supported |

Source: [Node.js release schedule](https://nodejs.org/en/about/previous-releases).

## What this means

- **Minimum supported (`>=18`):** the package declares `engines: >=18` and should install and run on Node.js 18. No guarantees beyond that.
- **EOL versions (18, 20):** upstream no longer ships fixes, including security patches. Bugs reported on EOL versions are handled on a best-effort basis and may be closed with a recommendation to upgrade. We cannot ensure the absence of bugs on runtimes that receive no upstream maintenance.
- **Recommended minimum (22):** Node.js 22 is the oldest LTS line. If you start a new project or report a bug, use 22 or newer.
- **CI:** every push and pull request is tested on **22, 24 and 26** (see `.github/workflows/ci.yml`). Versions outside this matrix are not verified automatically.

## Upgrading Node.js

Use a version manager ([Volta](https://volta.sh/), [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm)) and pin the LTS line in production. Check the [release schedule](https://nodejs.org/en/about/previous-releases) to anticipate the next EOL.
