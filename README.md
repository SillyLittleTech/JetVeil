# JetVeil

> Deep proxy browser with a split backend model: Ultraviolet for Vercel web deployments, ScramJet for local desktop runtime.

[![Web App](https://img.shields.io/badge/Web_App-jetveil.sillylittle.tech-00E5FF?style=flat-square)](https://jetveil.sillylittle.tech)
[![License](https://img.shields.io/github/license/SillyLittleTech/JetVeil?style=flat-square)](LICENSE)

---

## Architecture

| Layer | Technology | Hosting |
|-------|-----------|---------|
| **Desktop app** (Win / macOS / Linux) | Flutter | GitHub Releases (built by CI) |
| **Desktop local backend** | Node.js + ScramJet + bare-server | Started locally by desktop app from `desktop/scramjet-server/` |
| **Web app / PWA** | Flutter web | Vercel (`build/web`) |
| **Proxy backend for web** | Node.js + Ultraviolet + bare-server | Vercel (`server/`) |
| **GitHub Pages redirect** | Static HTML in `docs/` | `sillylittletech.github.io/JetVeil` → `jetveil.sillylittle.tech` |

---

## Getting Started

### 1 — Deploy the Ultraviolet backend to Vercel

The web proxy backend lives in `server/`. Deploy it to Vercel's free tier in ~2 minutes:

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SillyLittleTech/JetVeil&root-directory=server)

Vercel gives you a URL like `https://my-jetveil.vercel.app`. Copy it.

### 2 — Configure JetVeil

Open the app → **Settings**:

- Set **Web Server URL (Ultraviolet)** to your deployed Vercel URL.
- Keep **Desktop Local Server URL** as `http://127.0.0.1:8080` (default).
- Keep **Prefer local backend on desktop** enabled for desktop builds.

### 3 — Browse

Type any URL in the address bar. On desktop, JetVeil routes through local ScramJet by default. On web, JetVeil routes through your Vercel-hosted Ultraviolet backend.

---

## Local Development

```bash
# Flutter app
flutter pub get
flutter run -d chrome        # web
flutter run -d linux         # desktop (Linux)
flutter run -d macos         # desktop (macOS)
flutter run -d windows       # desktop (Windows)

# Ultraviolet backend for web deployment
cd server
npm install
npm start                    # http://localhost:8080

# ScramJet backend for desktop local runtime
cd ../desktop/scramjet-server
npm install
npm start                    # http://127.0.0.1:8080
```

---

## CI / CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| **Pre-Release** | PR marked ready-for-review | Builds Linux + Windows + macOS → creates pre-release. Posts a PR comment instead of building if the version tag already exists. |
| **Build & Release** | Push to `main` touching `lib/`, `web/`, `pubspec.yaml`, or `analysis_options.yaml` | Builds Linux + Windows + macOS, deploys Flutter web to Vercel, creates full GitHub Release |

Version numbers come from `version:` in `pubspec.yaml` (`major.minor.patch+build`).

---

## Contributing

1. Fork and create a feature branch from `main`
2. Make your changes
3. Mark your PR as **Ready for Review** → triggers an automated pre-release build
4. Merge to `main` → triggers desktop builds, web deployment, and a full release

---

## License

[AGPL-3.0](LICENSE) © SillyLittleTech
