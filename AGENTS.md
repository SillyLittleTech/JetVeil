# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

JetVeil is a deep web proxy browser with two components:
- **Flutter client** (repo root) — Dart/Flutter app targeting web and desktop
- **Node.js proxy server** (`server/`) — Scramjet-powered HTTP proxy on port 8080

See `README.md` "Local Development" section for standard commands.

### Prerequisites

- Flutter SDK is installed at `/home/ubuntu/flutter` and added to `PATH` via `~/.bashrc`.
- Node.js (v18+) is available via nvm.
- Linux desktop build deps (`ninja-build`, `libgtk-3-dev`) are installed.

### Running services

1. **Proxy server**: `cd server && npm start` (runs on `http://localhost:8080`). Use `npm run dev` for file-watching mode.
2. **Flutter web build**: `flutter build web --release` then serve `build/web/` with any static HTTP server (e.g. `python3 -m http.server 8081 -d build/web`).
3. After starting both services, open the Flutter web app and configure `http://localhost:8080` as the Server URL in Settings.

### Lint and tests

- **Dart analysis**: `flutter analyze` (uses rules from `analysis_options.yaml`; expect some pre-existing warnings)
- **Flutter tests**: No `test/` directory exists yet; `flutter test` will report "not found".
- **Server**: No automated tests in `server/`.

### Gotchas

- The Flutter web app uses `url_launcher` to open proxied URLs. When running in Chrome (web target), this opens a new tab pointing to the proxy server directly. The proxy server's own UI (in `server/public/`) handles the Scramjet initialization.
- `flutter run -d chrome` may not work in headless environments. Prefer `flutter build web` + static server for cloud agent use.
- The `server/package.json` pins Scramjet as a GitHub release tarball URL — `npm install` requires network access to GitHub.
