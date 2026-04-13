# JetVeil

JetVeil is now a desktop-first web wrapper app that runs a local ScramJet proxy server on the user's device.

## What changed

- Removed repository-level PWA/web hosting files used for Cloudflare Pages, Vercel SPA rewrites, and GitHub Pages redirects.
- Added an Electron wrapper app that launches JetVeil in a native desktop window.
- Updated the ScramJet server to support embeddable startup so the desktop app can boot and stop it automatically.
- Preserved the existing JetVeil UI design by reusing the current server frontend in `server/public`.

## Architecture

| Layer | Technology | Runtime |
|-------|------------|---------|
| Desktop wrapper | Electron | Windows / macOS / Linux |
| Local proxy server | Node.js + ScramJet + bare-server | User device (localhost) |
| Browser UI | Existing JetVeil HTML/CSS/JS | Loaded from local server |

## Project layout

- `desktop/` Electron app entrypoint and window runtime.
- `server/` ScramJet + bare proxy server and JetVeil UI assets.
- `lib/` Legacy Flutter code (not used by the new desktop runtime).

## Local development

Install dependencies:

```bash
npm run install:all
```

Start desktop app:

```bash
npm run dev
```

Run only server (optional):

```bash
npm run server:start
```

## Build desktop binaries

Install dependencies first:

```bash
npm run install:all
```

Build for current Linux machine:

```bash
npm run build:linux
```

Build for macOS (ZIP, recommended for quick testing):

```bash
npm run build:mac
```

Optional DMG build:

```bash
npm run build:mac:dmg
```

Build unpacked app folder (fast local smoke test):

```bash
npm run pack
```

Build using Electron Builder default targets:

```bash
npm run build
```

Output artifacts are written under `desktop/dist/`.

Use this file for macOS testing:

- `desktop/dist/JetVeil-1.0.0-mac.zip`

Do not open these directly:

- `desktop/dist/JetVeil-1.0.0-mac.zip.blockmap` (auto-update metadata)
- `desktop/dist/latest-mac.yml` (update manifest)

Important notes:

- Linux cannot produce signed macOS binaries.
- Cross-building Windows installers from Linux may require additional toolchain setup.
- The desktop build embeds the local `server/` runtime and static UI assets, so no hosted web build is required.
- If DMG packaging errors with a missing `dmg-license` module, use ZIP builds (`npm run build:mac`) or install `dmg-license` in `desktop/` and retry the DMG target.

## Notes

- The desktop app starts the local server on a random available localhost port.
- When the desktop app exits, it gracefully shuts down the local proxy server.
- Existing visual design is kept through `server/public/index.html` and `server/public/styles.css`.

## License

[AGPL-3.0](LICENSE) © SillyLittleTech
